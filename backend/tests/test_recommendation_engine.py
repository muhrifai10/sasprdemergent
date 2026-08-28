import asyncio

import pytest
from pydantic import ValidationError

import server
from question_catalog import CATALOG_VERSION
from recommendation_engine import (
    RecommendationBatch,
    RecommendationContext,
    enrich_recommendation_reason,
    recommendations_for_question,
)
from user_decisions import Recommendation


def context(**overrides):
    values = {
        "domain": "Generic",
        "raw_idea": "application with persistent records and transactions",
        "catalog_version": CATALOG_VERSION,
    }
    values.update(overrides)
    return RecommendationContext(**values)


def test_catalog_recommendations_are_typed_and_catalog_bound():
    database = recommendations_for_question("database.selection", context())
    frontend = recommendations_for_question("technology.frontend", context())
    assert [item.value for item in database] == ["PostgreSQL", "MySQL", "MongoDB", "Supabase", "SQLite", "MariaDB"]
    assert [item.value for item in frontend] == ["Next.js", "React", "Vue", "Angular", "Svelte"]
    assert all(item.source == "CATALOG" and item.applicability for item in database + frontend)
    assert [item.rank for item in database] == list(range(1, 7))
    assert recommendations_for_question("database.selection", RecommendationContext(domain="Generic"))


def test_target_and_core_questions_have_domain_specific_catalog_recommendations():
    pos_users = recommendations_for_question("target.users", context(domain="POS"))
    saas_users = recommendations_for_question("target.users", context(domain="SaaS"))
    pos_features = recommendations_for_question("functionality.core", context(domain="POS"))
    saas_features = recommendations_for_question("functionality.core", context(domain="SaaS"))

    assert [item.value for item in pos_users] == ["Owner", "Admin", "Kasir"]
    assert [item.value for item in saas_users] == ["Owner", "Admin", "Member", "Manager"]
    assert [item.value for item in pos_features] == ["Sales transactions", "Inventory management", "Receipts", "Reports"]
    assert [item.value for item in saas_features] == ["Projects", "Tasks", "Assignments", "Team dashboard"]
    assert all(item.source == "CATALOG" for item in pos_users + saas_users + pos_features + saas_features)


def test_context_and_dependencies_gate_recommendations():
    assert recommendations_for_question("payment.provider", context(domain="SaaS")) == []
    assert recommendations_for_question("payment.provider", context(domain="E-Commerce", confirmed_decisions={"payment.method": "Cash"})) == []
    assert recommendations_for_question("payment.provider", context(domain="E-Commerce", confirmed_decisions={"payment.method": "QRIS"}))


def test_confirmed_and_not_required_decisions_suppress_recommendations():
    assert recommendations_for_question("database.selection", context(confirmed_decisions={"database.selection": "PostgreSQL"})) == []
    assert recommendations_for_question("database.selection", context(not_required_decisions=["database.selection"])) == []
    assert recommendations_for_question("target.users", context(unknown_decisions=["target.users"])) == []


def test_recommendation_model_rejects_mismatch_and_batch_duplicates():
    with pytest.raises(ValidationError):
        Recommendation(
            id="database.selection.postgresql",
            question_id="technology.frontend",
            value="PostgreSQL",
            label="PostgreSQL",
        )
    item = recommendations_for_question("database.selection", context())[0]
    with pytest.raises(ValidationError, match="unique"):
        RecommendationBatch(recommendations=(item, item))


def test_ai_reason_enrichment_cannot_change_recommendation():
    item = recommendations_for_question("database.selection", context())[0]
    calls = []

    async def invalid_stream(*args, **kwargs):
        calls.append(args)
        yield '{"recommendation_id":"database.selection.oracle","reason":"Use Oracle"}'

    result = asyncio.run(enrich_recommendation_reason(
        item, context(), [("9router", "Gemini", "", "http://localhost")], invalid_stream,
    ))
    assert result.id == item.id
    assert result.value == item.value
    assert result.reason == item.reason
    assert result.source == "CATALOG"
    assert len(calls) == 2


class _Projects:
    def __init__(self, project):
        self.project = project

    async def find_one(self, query, *args, **kwargs):
        if query.get("id") != self.project["id"] or query.get("user_id") != self.project["user_id"]:
            return None
        return self.project


class _Db:
    def __init__(self, project):
        self.projects = _Projects(project)


def test_recommendation_endpoint_is_owned_and_returns_current_decision(monkeypatch):
    project = {
        "id": "p1", "user_id": "u1", "name": "Records", "description": "transaction records",
        "product_type": "Generic", "discovery": {"catalog_version": CATALOG_VERSION, "decisions": []},
    }
    monkeypatch.setattr(server, "db", _Db(project))
    result = asyncio.run(server.discovery_recommendations("p1", "database.selection", {"user_id": "u1"}))
    assert result["catalog_version"] == CATALOG_VERSION
    assert result["recommendations"][0]["value"] == "PostgreSQL"
    with pytest.raises(server.HTTPException) as error:
        asyncio.run(server.discovery_recommendations("p1", "database.selection", {"user_id": "u2"}))
    assert error.value.status_code == 404
