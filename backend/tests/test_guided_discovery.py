import asyncio
import json

import pytest
from fastapi import HTTPException

import server
from question_catalog import CATALOG_VERSION
from user_decisions import UserDecisionIntent


class _Projects:
    def __init__(self, project):
        self.project = project

    async def find_one(self, query, *args, **kwargs):
        if query.get("id") != self.project["id"] or query.get("user_id") != self.project["user_id"]:
            return None
        return self.project

    async def update_one(self, query, update, *args, **kwargs):
        if query.get("id") == self.project["id"] and query.get("user_id") == self.project["user_id"]:
            self.project.update(update.get("$set", {}))


class _Db:
    def __init__(self, project):
        self.projects = _Projects(project)


def _project():
    return {
        "id": "p1", "user_id": "u1", "name": "Retail POS",
        "description": "Saya ingin membuat aplikasi kasir berbasis web untuk toko retail.",
        "product_type": "POS", "discovery_status": "none",
        "discovery": {"mode": "guided_discovery", "questions": [], "answers": {}, "decisions": [], "decision_history": []},
    }


def _planner_stream(monkeypatch):
    responses = [
        json.dumps({"question_ids": ["target.users", "functionality.core", "inventory.required", "payment.method"]}),
        json.dumps({"question_ids": ["roles.permissions"]}),
        json.dumps({"question_ids": ["workflow.primary"]}),
    ]
    calls = []

    async def attempts():
        return [("9router", "Gemini", "key", "url")]

    async def stream(*args, **kwargs):
        calls.append(args[5])
        yield responses[min(len(calls) - 1, len(responses) - 1)]

    monkeypatch.setattr(server, "build_ai_attempts", attempts)
    monkeypatch.setattr(server, "stream_openai_compatible", stream)
    return calls


def test_guided_pos_multi_round_catalog_recommendations_and_readiness(monkeypatch):
    project = _project()
    monkeypatch.setattr(server, "db", _Db(project))
    calls = _planner_stream(monkeypatch)

    first = asyncio.run(server.discovery_analyze("p1", {"user_id": "u1"}))
    assert first["mode"] == "guided_discovery"
    assert first["readiness"] == "in_progress"
    assert {item["question_id"] for item in first["questions"]} == {
        "target.users", "functionality.core", "inventory.required", "payment.method",
    }
    assert all(item["question"] == server.get_question_template(item["question_id"]).question for item in first["questions"])
    assert next(item for item in first["questions"] if item["question_id"] == "payment.method")["recommendations"]
    assert [item["value"] for item in next(item for item in first["questions"] if item["question_id"] == "target.users")["recommendations"]] == ["Owner", "Admin", "Kasir"]
    assert [item["value"] for item in next(item for item in first["questions"] if item["question_id"] == "functionality.core")["recommendations"]] == ["Sales transactions", "Inventory management", "Receipts", "Reports"]
    assert not project["discovery"]["decisions"]

    batch = server.GuidedDecisionBatchRequest(decisions=[
        UserDecisionIntent(question_id="target.users", type="custom", value="Owner/Admin/Kasir"),
        UserDecisionIntent(question_id="functionality.core", type="custom", value="Transaksi penjualan"),
        UserDecisionIntent(question_id="inventory.required", type="custom", value="Yes"),
        UserDecisionIntent(question_id="payment.method", type="custom", value="Cash + QRIS"),
    ])
    second = asyncio.run(server.discovery_decision_batch("p1", batch, {"user_id": "u1"}))
    assert second["completeness"]["category_status"]["inventory"] == "CONFIRMED"
    assert [item["question_id"] for item in second["questions"]] == ["roles.permissions"]
    assert all(item["state"] == "unanswered" for item in second["questions"])

    role = UserDecisionIntent(question_id="roles.permissions", type="custom", value="Admin manages; cashier sells")
    third = asyncio.run(server.discovery_decisions("p1", role, {"user_id": "u1"}))
    assert [item["question_id"] for item in third["questions"]] == ["workflow.primary"]

    workflow = UserDecisionIntent(question_id="workflow.primary", type="custom", value="Open register, sell, close register")
    final = asyncio.run(server.discovery_decisions("p1", workflow, {"user_id": "u1"}))
    assert final["readiness"] == "ready_for_review"
    assert final["ready_for_review"] is True
    assert final["discovery_status"] == "awaiting_confirmation"
    assert len(calls) == 3
    assert {item["status"] for item in final["decisions"]} == {"CONFIRMED"}

    review = asyncio.run(server.discovery_review("p1", {"user_id": "u1"}))
    assert review["catalog_version"] == CATALOG_VERSION
    assert review["readiness"] == "ready_for_review"

    confirmed = asyncio.run(server.discovery_confirm("p1", {"user_id": "u1"}))
    assert confirmed["discovery_status"] == "confirmed"
    assert project["discovery"]["confirmation_snapshot"]["catalog_version"] == CATALOG_VERSION
    assert server.build_canonical_spec(project).target_users == "Owner/Admin/Kasir"


def test_guided_recommendation_custom_unknown_and_not_required_authority(monkeypatch):
    project = _project()
    project["product_type"] = "E-Commerce"
    project["discovery"]["questions"] = [
        server._guided_question_record(server.get_question_template("database.selection")),
        server._guided_question_record(server.get_question_template("technology.frontend")),
        server._guided_question_record(server.get_question_template("scope.shipping")),
    ]
    project["discovery"]["active_question_ids"] = ["database.selection", "technology.frontend", "scope.shipping"]
    project["discovery_status"] = "in_progress"
    monkeypatch.setattr(server, "db", _Db(project))
    monkeypatch.setattr(server, "_advance_guided_discovery", lambda *args: asyncio.sleep(0, result=server._guided_response(project)))

    selected = asyncio.run(server.discovery_decisions("p1", UserDecisionIntent(
        question_id="database.selection", type="recommendation", recommendation_id="database.selection.postgresql",
    ), {"user_id": "u1"}))
    assert selected["decision"]["status"] == "CONFIRMED"
    assert selected["decision"]["source"] == "USER_RECOMMENDATION_SELECTION"

    unknown = asyncio.run(server.discovery_decisions("p1", UserDecisionIntent(
        question_id="technology.frontend", type="unknown",
    ), {"user_id": "u1"}))
    assert unknown["decision"]["status"] == "UNKNOWN"
    assert not unknown["decision"]["value"]

    excluded = asyncio.run(server.discovery_decisions("p1", UserDecisionIntent(
        question_id="scope.shipping", type="not_required",
    ), {"user_id": "u1"}))
    assert excluded["decision"]["status"] == "NOT_REQUIRED"
    assert server.completeness_check(project)["category_status"]["shipping"] == "NOT_REQUIRED"
    assert any(item["key"] == "shipping" for item in server._d072_scope_exclusions(project))


def test_guided_idempotency_and_stale_question(monkeypatch):
    project = _project()
    project["discovery"]["active_question_ids"] = ["target.users"]
    project["discovery"]["questions"] = [server._guided_question_record(server.get_question_template("target.users"))]
    project["discovery_status"] = "in_progress"
    monkeypatch.setattr(server, "db", _Db(project))
    advances = []

    async def no_advance(*args):
        advances.append(1)
        return server._guided_response(project)

    monkeypatch.setattr(server, "_advance_guided_discovery", no_advance)
    intent = UserDecisionIntent(question_id="target.users", type="custom", value="cashiers")
    asyncio.run(server.discovery_decisions("p1", intent, {"user_id": "u1"}))
    asyncio.run(server.discovery_decisions("p1", intent, {"user_id": "u1"}))
    assert advances == [1]
    assert project["discovery"]["decision_history"] == []

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.discovery_decisions(
            "p1", UserDecisionIntent(question_id="functionality.core", type="custom", value="tasks"), {"user_id": "u1"},
        ))
    assert error.value.status_code == 409
    assert error.value.detail["code"] == "STALE_QUESTION"


def test_guided_mode_is_opt_in_for_new_projects(monkeypatch):
    class _Collection:
        async def count_documents(self, *args, **kwargs):
            return 0

        async def insert_one(self, doc):
            return None

    class _DbCreate:
        projects = _Collection()

    monkeypatch.setattr(server, "db", _DbCreate())
    result = asyncio.run(server.create_project(
        server.ProjectCreate(name="POS", description="retail", discovery_mode="guided_discovery"),
        {"user_id": "u1", "plan": "free"},
    ))
    assert result["discovery"]["mode"] == "guided_discovery"
