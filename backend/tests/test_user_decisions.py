import asyncio
from copy import deepcopy

import pytest
from fastapi import HTTPException

import server
from question_catalog import CATALOG_VERSION, get_question_template
from user_decisions import (
    UserDecision,
    UserDecisionIntent,
    canonical_decision_item,
    catalog_recommendation,
    decide,
    decisions_to_legacy_answers,
    effective_answers,
    legacy_answer_to_decision,
    record_decision,
)


def user_decision(question_id="target.users", value="teams", status="CONFIRMED", source="USER_CUSTOM"):
    return UserDecision(
        question_id=question_id,
        value=value if status == "CONFIRMED" else "",
        status=status,
        source=source,
        source_id=question_id,
        decided_at="2026-01-01T00:00:00+00:00",
        actor_id="u1",
        catalog_version=CATALOG_VERSION,
    )


def test_recommendation_without_user_selection_is_not_a_decision():
    recommendation = catalog_recommendation(get_question_template("database.selection"), "database.selection.postgresql")

    assert recommendation.value == "PostgreSQL"
    assert recommendation.question_id == "database.selection"
    assert record_decision([], [], user_decision()) == ([user_decision()], [])


def test_selected_recommendation_becomes_confirmed():
    decision = decide(
        UserDecisionIntent(question_id="database.selection", catalog_version=CATALOG_VERSION, selection="database.selection.postgresql"),
        domain="Generic", actor_id="u1", decided_at="2026-01-01T00:00:00+00:00",
    )

    assert decision.value == "PostgreSQL"
    assert decision.status == "CONFIRMED"
    assert decision.source == "USER_RECOMMENDATION_SELECTION"
    assert decision.source_id == "database.selection.postgresql"


def test_custom_answer_becomes_confirmed_user_custom():
    decision = decide(
        UserDecisionIntent(question_id="database.selection", catalog_version=CATALOG_VERSION, custom_value="MariaDB"),
        domain="Generic", actor_id="u1",
    )

    assert decision.model_dump(include={"value", "status", "source"}) == {
        "value": "MariaDB", "status": "CONFIRMED", "source": "USER_CUSTOM",
    }


def test_unknown_does_not_fill_a_recommendation():
    decision = decide(
        UserDecisionIntent(question_id="database.selection", catalog_version=CATALOG_VERSION, unknown=True),
        domain="Generic", actor_id="u1",
    )

    assert decision.status == "UNKNOWN"
    assert decision.value == ""
    assert decision.source == "USER_UNKNOWN_SELECTION"


def test_not_required_is_only_allowed_for_scope_capable_questions():
    decision = decide(
        UserDecisionIntent(question_id="scope.shipping", catalog_version=CATALOG_VERSION, not_required=True),
        domain="E-Commerce", actor_id="u1",
    )

    assert decision.status == "NOT_REQUIRED"
    assert decision.source == "USER_NOT_REQUIRED_SELECTION"

    with pytest.raises(ValueError, match="NOT_REQUIRED is not allowed"):
        decide(UserDecisionIntent(question_id="database.selection", catalog_version=CATALOG_VERSION, not_required=True), domain="Generic", actor_id="u1")


def test_inferred_legacy_answer_cannot_become_user_decision():
    with pytest.raises(ValueError, match="INFERRED cannot become"):
        legacy_answer_to_decision("target.users", "teams", "INFERRED", actor_id="u1")


@pytest.mark.parametrize("intent", [
    UserDecisionIntent(question_id="missing.question", catalog_version=CATALOG_VERSION, unknown=True),
    UserDecisionIntent(question_id="database.selection", catalog_version=CATALOG_VERSION, selection="database.selection.oracle"),
    UserDecisionIntent(question_id="technology.frontend", catalog_version=CATALOG_VERSION, selection="database.selection.postgresql"),
    UserDecisionIntent(question_id="auth.required", catalog_version=CATALOG_VERSION, custom_value="yes"),
    UserDecisionIntent(question_id="database.selection", catalog_version="2.0", unknown=True),
])
def test_invalid_decision_intents_are_rejected(intent):
    with pytest.raises(ValueError):
        decide(intent, domain="Generic", actor_id="u1")


def test_dependency_violation_is_rejected():
    with pytest.raises(ValueError, match="Dependencies not satisfied"):
        decide(UserDecisionIntent(question_id="auth.method", catalog_version=CATALOG_VERSION, unknown=True), domain="Generic", actor_id="u1")


def test_decision_history_preserves_revisions_and_idempotency():
    postgres = decide(UserDecisionIntent(question_id="database.selection", catalog_version=CATALOG_VERSION, selection="database.selection.postgresql"), domain="Generic", actor_id="u1", decided_at="t1")
    mariadb = decide(UserDecisionIntent(question_id="database.selection", catalog_version=CATALOG_VERSION, custom_value="MariaDB"), domain="Generic", actor_id="u1", current_decisions=[postgres], decided_at="t2")
    current, history = record_decision([postgres], [], mariadb)
    same_current, same_history = record_decision(current, history, mariadb)

    assert current == [mariadb]
    assert history == [postgres]
    assert same_current == current
    assert same_history == history


def test_provenance_and_catalog_version_are_retained():
    decision = decide(UserDecisionIntent(question_id="database.selection", catalog_version=CATALOG_VERSION, selection="database.selection.postgresql"), domain="Generic", actor_id="u1", decided_at="t1")
    item = canonical_decision_item(decision)

    assert item["source"] == "USER_RECOMMENDATION_SELECTION"
    assert item["source_id"] == "database.selection.postgresql"
    assert item["question_id"] == "database.selection"
    assert item["catalog_version"] == CATALOG_VERSION
    assert item["decided_at"] == "t1"


def test_legacy_projection_is_not_the_guided_authority():
    decision = user_decision(value="guided teams")
    discovery = {
        "decisions": [decision.model_dump()],
        "answers": {"target.users": {"value": "stale legacy value", "status": "CONFIRMED"}},
    }

    assert effective_answers(discovery) == {"target.users": {"value": "guided teams", "status": "CONFIRMED"}}
    assert decisions_to_legacy_answers([decision]) == effective_answers(discovery)


def test_canonical_projection_preserves_confirmed_unknown_and_not_required():
    confirmed = canonical_decision_item(user_decision())
    unknown = canonical_decision_item(user_decision("database.selection", status="UNKNOWN"))
    excluded = canonical_decision_item(user_decision("scope.shipping", status="NOT_REQUIRED"))

    assert confirmed["status"] == "CONFIRMED" and confirmed["value"] == "teams"
    assert unknown["status"] == "UNKNOWN" and unknown["value"] == ""
    assert excluded["status"] == "NOT_REQUIRED" and excluded["value"] == "NOT_REQUIRED"


def test_recommendation_object_alone_has_no_canonical_projection():
    recommendation = catalog_recommendation(get_question_template("database.selection"), "database.selection.postgresql")

    assert recommendation is not None
    assert decisions_to_legacy_answers([]) == {}


def test_confirmed_guided_decision_maps_into_existing_canonical_builder():
    decision = user_decision()
    project = {
        "id": "p1", "name": "X", "description": "idea", "discovery_status": "confirmed",
        "discovery": {"decisions": [decision.model_dump()], "answers": {}, "confirmation_snapshot": {
            "original_project_fields": {}, "answers": {}, "decisions": [decision.model_dump()],
            "summary": {"summary": {}, "scope": {"out_of_scope": []}}, "status": "confirmed",
        }},
    }

    spec = server.build_canonical_spec(project)

    assert spec.target_users == "teams"
    assert spec.field_provenance["target_users"]["source"] == "USER_CUSTOM"


class _ProjectCollection:
    def __init__(self, projects):
        self.projects = projects

    async def find_one(self, query, *args, **kwargs):
        project = self.projects.get(query.get("id"))
        if project is None or (query.get("user_id") and project.get("user_id") != query["user_id"]):
            return None
        return project

    async def update_one(self, query, update, *args, **kwargs):
        project = self.projects.get(query.get("id"))
        if project:
            project.update(update.get("$set", {}))


class _DecisionDb:
    def __init__(self, projects):
        self.projects = _ProjectCollection(projects)


def _project_store(monkeypatch, project=None):
    project = project or {
        "id": "p1", "user_id": "u1", "name": "X", "description": "idea",
        "desired_features": "task", "target_users": "teams", "discovery_status": "in_progress",
        "discovery": {"questions": [], "answers": {}},
    }
    projects = {"p1": project}
    monkeypatch.setattr(server, "db", _DecisionDb(projects))
    return projects


def test_server_decision_endpoint_determines_status_and_persists_ledger(monkeypatch):
    projects = _project_store(monkeypatch)
    intent = UserDecisionIntent(question_id="target.users", catalog_version=CATALOG_VERSION, custom_value="cashiers")

    result = asyncio.run(server.discovery_decisions("p1", intent, {"user_id": "u1"}))

    decision = projects["p1"]["discovery"]["decisions"][0]
    assert result["decision"]["status"] == "CONFIRMED"
    assert decision["source"] == "USER_CUSTOM"
    assert projects["p1"]["discovery"]["answers"]["target.users"] == {"value": "cashiers", "status": "CONFIRMED"}


def test_server_rejects_client_status_and_legacy_write_for_guided_project(monkeypatch):
    projects = _project_store(monkeypatch)
    with pytest.raises(Exception):
        UserDecisionIntent.model_validate({"question_id": "target.users", "catalog_version": CATALOG_VERSION, "unknown": True, "status": "CONFIRMED"})
    intent = UserDecisionIntent(question_id="target.users", catalog_version=CATALOG_VERSION, custom_value="cashiers")
    asyncio.run(server.discovery_decisions("p1", intent, {"user_id": "u1"}))
    body = server.DiscoveryAnswersRequest(answers={"target.users": server.DiscoveryAnswer(value="hijack", status="CONFIRMED")})

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.discovery_answers("p1", body, {"user_id": "u1"}))
    assert error.value.status_code == 409
    assert projects["p1"]["discovery"]["decisions"][0]["value"] == "cashiers"


def test_cross_project_decision_access_is_rejected(monkeypatch):
    _project_store(monkeypatch)
    intent = UserDecisionIntent(question_id="target.users", catalog_version=CATALOG_VERSION, custom_value="cashiers")

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.discovery_decisions("p1", intent, {"user_id": "u2"}))
    assert error.value.status_code == 404


def test_guided_confirmation_snapshot_contains_decisions_and_history(monkeypatch):
    project = {
        "id": "p1", "user_id": "u1", "name": "X", "description": "idea", "desired_features": "task",
        "target_users": "", "discovery_status": "in_progress",
        "discovery": {"questions": [], "answers": {}, "decisions": [], "decision_history": {}, "summary": {}, "confirmed_at": None},
    }
    projects = _project_store(monkeypatch, project)
    intent = UserDecisionIntent(question_id="target.users", catalog_version=CATALOG_VERSION, custom_value="teams")
    asyncio.run(server.discovery_decisions("p1", intent, {"user_id": "u1"}))
    asyncio.run(server.discovery_confirm("p1", {"user_id": "u1"}))

    snapshot = projects["p1"]["discovery"]["confirmation_snapshot"]
    assert snapshot["catalog_version"] == CATALOG_VERSION
    assert snapshot["decisions"][0]["question_id"] == "target.users"
    assert snapshot["decision_history"] == []


def test_legacy_import_projection_is_explicit_and_compatible():
    decision = legacy_answer_to_decision("target.users", "teams", "CONFIRMED", actor_id="u1", decided_at="t1")

    assert decision.source == "LEGACY_IMPORT"
    assert decision.status == "CONFIRMED"
    assert decisions_to_legacy_answers([decision]) == {"target.users": {"value": "teams", "status": "CONFIRMED"}}
