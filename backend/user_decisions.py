"""Guided-discovery user decision authority and legacy projections."""

import re
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from question_catalog import CATALOG_VERSION, QuestionTemplate, get_question_template


DecisionStatus = Literal["CONFIRMED", "UNKNOWN", "NOT_REQUIRED"]
DecisionSource = Literal[
    "USER_RECOMMENDATION_SELECTION",
    "USER_CUSTOM",
    "USER_UNKNOWN_SELECTION",
    "USER_NOT_REQUIRED_SELECTION",
    "LEGACY_IMPORT",
]


class UserDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    question_id: str = Field(min_length=1)
    value: str = ""
    status: DecisionStatus
    source: DecisionSource
    source_id: str = Field(min_length=1)
    decided_at: str = Field(min_length=1)
    actor_id: str = Field(min_length=1)
    catalog_version: str = Field(pattern=r"^\d+\.\d+$")


class Recommendation(BaseModel):
    """A catalog-backed recommendation; it is not a user decision."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(min_length=1)
    question_id: str = Field(min_length=1)
    value: str = Field(min_length=1)
    label: str = Field(min_length=1)
    reason: str = ""
    source: Literal["CATALOG"] = "CATALOG"


class UserDecisionIntent(BaseModel):
    """Client intent. Status and source are intentionally absent."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    question_id: str = Field(min_length=1)
    catalog_version: str = Field(pattern=r"^\d+\.\d+$")
    recommendation_id: str | None = Field(default=None, alias="selection")
    custom_value: str | None = None
    unknown: bool = False
    not_required: bool = False

    @property
    def selection(self) -> str | None:
        return self.recommendation_id

    @model_validator(mode="after")
    def require_one_intent(self):
        branches = bool(self.recommendation_id) + bool(self.custom_value and self.custom_value.strip()) + self.unknown + self.not_required
        if branches != 1:
            raise ValueError("exactly one decision intent is required")
        return self


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")


def catalog_recommendation(template: QuestionTemplate, recommendation_id: str) -> Recommendation | None:
    if template.recommendation_policy != "catalog_default":
        return None
    for option in template.options:
        if option.casefold() in {"other", "unknown", "not required"}:
            continue
        if f"{template.id}.{_slug(option)}" == recommendation_id:
            return Recommendation(
                id=recommendation_id,
                question_id=template.id,
                value=option,
                label=option,
                reason=template.recommendation_reason,
            )
    return None


def _dependency_decisions(decisions) -> dict[str, UserDecision]:
    result = {}
    for decision in decisions:
        item = decision if isinstance(decision, UserDecision) else UserDecision.model_validate(decision)
        result[item.question_id] = item
    return result


def _dependency_satisfied(template: QuestionTemplate, decisions) -> bool:
    current = _dependency_decisions(decisions)
    return all(current.get(dependency) and current[dependency].status == "CONFIRMED" for dependency in template.dependencies)


def decide(
    intent: UserDecisionIntent,
    *,
    domain: str,
    actor_id: str,
    current_decisions=(),
    decided_at: str | None = None,
) -> UserDecision:
    """Resolve user intent into an authoritative decision without AI."""
    template = get_question_template(intent.question_id)
    if not template:
        raise ValueError(f"Unknown catalog question: {intent.question_id}")
    if intent.catalog_version != CATALOG_VERSION or intent.catalog_version != template.catalog_version:
        raise ValueError(f"Catalog version mismatch for {intent.question_id}")
    if domain not in template.applicable_domains:
        raise ValueError(f"Question {intent.question_id} is not applicable to domain {domain}")
    if not _dependency_satisfied(template, current_decisions):
        raise ValueError(f"Dependencies not satisfied for {intent.question_id}")
    if not actor_id.strip():
        raise ValueError("actor_id is required")

    source: DecisionSource
    source_id: str
    value = ""
    if intent.recommendation_id:
        recommendation = catalog_recommendation(template, intent.recommendation_id)
        if not recommendation:
            raise ValueError(f"Invalid recommendation for question: {intent.recommendation_id}")
        value = recommendation.value
        source = "USER_RECOMMENDATION_SELECTION"
        source_id = recommendation.id
        status: DecisionStatus = "CONFIRMED"
    elif intent.custom_value and intent.custom_value.strip():
        if not template.allow_custom:
            raise ValueError(f"Custom answers are not allowed for {intent.question_id}")
        value = intent.custom_value.strip()
        source = "USER_CUSTOM"
        source_id = intent.question_id
        status = "CONFIRMED"
    elif intent.unknown:
        if not template.allow_unknown:
            raise ValueError(f"UNKNOWN is not allowed for {intent.question_id}")
        source = "USER_UNKNOWN_SELECTION"
        source_id = intent.question_id
        status = "UNKNOWN"
    else:
        if not template.allow_not_required:
            raise ValueError(f"NOT_REQUIRED is not allowed for {intent.question_id}")
        source = "USER_NOT_REQUIRED_SELECTION"
        source_id = intent.question_id
        status = "NOT_REQUIRED"

    return UserDecision(
        question_id=template.id,
        value=value,
        status=status,
        source=source,
        source_id=source_id,
        decided_at=decided_at or datetime.now(timezone.utc).isoformat(),
        actor_id=actor_id,
        catalog_version=template.catalog_version,
    )


def record_decision(decisions, history, decision: UserDecision) -> tuple[list[UserDecision], list[UserDecision]]:
    """Replace one current decision while retaining the superseded version."""
    current = [item if isinstance(item, UserDecision) else UserDecision.model_validate(item) for item in decisions]
    previous_history = [item if isinstance(item, UserDecision) else UserDecision.model_validate(item) for item in history]
    index = next((index for index, item in enumerate(current) if item.question_id == decision.question_id), None)
    if index is None:
        current.append(decision)
    elif current[index].model_dump() != decision.model_dump():
        previous_history.append(current[index])
        current[index] = decision
    return current, previous_history


def decisions_to_legacy_answers(decisions) -> dict[str, dict[str, str]]:
    return {
        decision.question_id: {"value": decision.value, "status": decision.status}
        for decision in (item if isinstance(item, UserDecision) else UserDecision.model_validate(item) for item in decisions)
    }


def legacy_answer_to_decision(question_id: str, value: str, status: str, *, actor_id: str, decided_at: str | None = None) -> UserDecision:
    if status == "INFERRED":
        raise ValueError("INFERRED cannot become a UserDecision")
    if status not in {"CONFIRMED", "UNKNOWN", "NOT_REQUIRED"}:
        raise ValueError(f"Unsupported legacy decision status: {status}")
    source: DecisionSource = "LEGACY_IMPORT"
    return UserDecision(
        question_id=question_id,
        value=value if status == "CONFIRMED" else "",
        status=status,
        source=source,
        source_id=question_id,
        decided_at=decided_at or datetime.now(timezone.utc).isoformat(),
        actor_id=actor_id,
        catalog_version=CATALOG_VERSION,
    )


def decision_provenance(decision: UserDecision) -> dict:
    return {
        "source": decision.source,
        "source_id": decision.source_id,
        "question_id": decision.question_id,
        "catalog_version": decision.catalog_version,
        "decided_at": decision.decided_at,
        "actor_id": decision.actor_id,
    }


def canonical_decision_item(decision: UserDecision) -> dict:
    """Canonical projection; recommendations have no path into this function."""
    if not isinstance(decision, UserDecision):
        decision = UserDecision.model_validate(decision)
    template = get_question_template(decision.question_id)
    return {
        "key": template.category if template else decision.question_id,
        "value": decision.value if decision.status == "CONFIRMED" else ("NOT_REQUIRED" if decision.status == "NOT_REQUIRED" else ""),
        "status": decision.status,
        "source": decision.source,
        "source_id": decision.source_id,
        "question_id": decision.question_id,
        "catalog_version": decision.catalog_version,
        "decided_at": decision.decided_at,
        "actor_id": decision.actor_id,
    }


def current_decisions(discovery: dict) -> list[UserDecision]:
    return [UserDecision.model_validate(item) for item in discovery.get("decisions", [])]


def effective_answers(discovery: dict) -> dict[str, dict[str, str]]:
    if "decisions" in discovery:
        answers = dict(discovery.get("answers") or {})
        answers.update(decisions_to_legacy_answers(current_decisions(discovery)))
        return answers
    return dict(discovery.get("answers") or {})


def decision_snapshot(discovery: dict) -> dict:
    current = current_decisions(discovery)
    history = [UserDecision.model_validate(item) for item in discovery.get("decision_history", [])]
    return {
        "decisions": [item.model_dump() for item in current],
        "decision_history": [item.model_dump() for item in history],
        "catalog_version": CATALOG_VERSION,
    }
