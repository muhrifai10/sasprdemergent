"""Server-owned guided-discovery question catalog.

This module is intentionally independent from the legacy discovery flow. D1.1
defines and validates catalog metadata; planner, recommendations, and decisions
will consume it in later stages.
"""

from copy import deepcopy
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


CATALOG_VERSION = "1.0"

CatalogCategory = Literal[
    "PRODUCT",
    "PURPOSE",
    "TARGET_USERS",
    "CORE_FUNCTIONALITY",
    "ROLES_PERMISSIONS",
    "WORKFLOW",
    "AUTHENTICATION",
    "AUTHENTICATION_METHOD",
    "DATABASE",
    "BACKEND",
    "FRONTEND",
    "TECHNOLOGY",
    "PAYMENT_METHOD",
    "PAYMENT_PROVIDER",
    "INVENTORY",
    "STORAGE",
    "INTEGRATIONS",
    "DEPLOYMENT",
    "INFRASTRUCTURE",
    "CONSTRAINTS",
    "NON_GOALS",
]
CatalogDomain = Literal[
    "POS",
    "SaaS",
    "E-Commerce",
    "AI SaaS",
    "Generic",
    "Internal Tool",
    "CMS",
]
QuestionType = Literal[
    "single_choice",
    "multi_choice",
    "boolean",
    "text",
    "textarea",
    "number",
]
RecommendationPolicy = Literal["none", "catalog_default"]
ConditionName = Literal[
    "contains_persistent_data",
    "indicates_digital_payment",
    "requires_authentication",
    "contains_external_integration",
]
_NOT_REQUIRED_CATEGORIES = {"NON_GOALS", "INTEGRATIONS", "STORAGE"}


class ConditionalRule(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    category: CatalogCategory
    condition: ConditionName


class QuestionTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(pattern=r"^[a-z][a-z0-9]*(?:\.[a-z0-9_]+)+$")
    category: CatalogCategory
    question: str = Field(min_length=1)
    type: QuestionType
    options: list[str] = Field(default_factory=list)
    recommendation_policy: RecommendationPolicy = "none"
    recommendation_reason: str = ""
    required: bool = False
    conditional_on: list[ConditionalRule] = Field(default_factory=list)
    applicable_domains: list[CatalogDomain] = Field(min_length=1)
    dependencies: list[str] = Field(default_factory=list)
    priority: int = Field(ge=0, le=1000)
    allow_custom: bool = False
    allow_unknown: bool = False
    allow_not_required: bool = False
    catalog_version: str = Field(pattern=r"^\d+\.\d+$")

    @model_validator(mode="after")
    def validate_question_shape(self):
        normalized_options = [option.strip().casefold() for option in self.options]
        if any(not option.strip() for option in self.options):
            raise ValueError("options must not contain empty values")
        if len(normalized_options) != len(set(normalized_options)):
            raise ValueError("options must be unique")
        if self.type in {"single_choice", "multi_choice"} and not self.options:
            raise ValueError(f"{self.type} questions require options")
        if self.type not in {"single_choice", "multi_choice"} and self.options:
            raise ValueError(f"{self.type} questions cannot define options")
        if self.recommendation_policy == "catalog_default" and not self.recommendation_reason.strip():
            raise ValueError("catalog_default requires recommendation_reason")
        if self.allow_not_required and self.category not in _NOT_REQUIRED_CATEGORIES:
            raise ValueError(f"{self.category} cannot allow NOT_REQUIRED")
        if len(self.dependencies) != len(set(self.dependencies)):
            raise ValueError("dependencies must be unique")
        return self


def _template(
    template_id: str,
    category: CatalogCategory,
    question: str,
    question_type: QuestionType,
    *,
    options: list[str] | None = None,
    recommendation_policy: RecommendationPolicy = "none",
    recommendation_reason: str = "",
    required: bool = False,
    conditional_on: list[ConditionalRule] | None = None,
    domains: list[CatalogDomain] | None = None,
    dependencies: list[str] | None = None,
    priority: int = 50,
    allow_custom: bool = False,
    allow_unknown: bool = False,
    allow_not_required: bool = False,
) -> QuestionTemplate:
    return QuestionTemplate(
        id=template_id,
        category=category,
        question=question,
        type=question_type,
        options=options or [],
        recommendation_policy=recommendation_policy,
        recommendation_reason=recommendation_reason,
        required=required,
        conditional_on=conditional_on or [],
        applicable_domains=domains or ["Generic"],
        dependencies=dependencies or [],
        priority=priority,
        allow_custom=allow_custom or question_type in {"text", "textarea"},
        allow_unknown=allow_unknown,
        allow_not_required=allow_not_required,
        catalog_version=CATALOG_VERSION,
    )


_PERSISTENT_DATA = [ConditionalRule(category="CORE_FUNCTIONALITY", condition="contains_persistent_data")]
_DIGITAL_PAYMENT = [ConditionalRule(category="PAYMENT_METHOD", condition="indicates_digital_payment")]

QUESTION_CATALOG = (
    _template("product.identity", "PRODUCT", "What is the product name?", "text", required=True, priority=100),
    _template("product.purpose", "PURPOSE", "What problem or purpose should the product address?", "textarea", required=True, priority=95),
    _template("target.users", "TARGET_USERS", "Who are the target users?", "textarea", required=True, priority=95),
    _template("functionality.core", "CORE_FUNCTIONALITY", "Which core capabilities are required?", "textarea", required=True, priority=95),
    _template(
        "roles.permissions", "ROLES_PERMISSIONS", "What roles and permissions are required?", "textarea",
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        dependencies=["target.users"], priority=90,
    ),
    _template(
        "workflow.primary", "WORKFLOW", "What is the primary user workflow?", "textarea",
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        dependencies=["roles.permissions"], priority=85,
    ),
    _template(
        "auth.required", "AUTHENTICATION", "Does the product require users to log in?", "boolean",
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"], priority=85,
        allow_unknown=True,
    ),
    _template(
        "auth.method", "AUTHENTICATION_METHOD", "Which authentication method should be used?", "single_choice",
        options=["Password", "SSO", "PIN", "Other", "Unknown"],
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        dependencies=["auth.required"], priority=70, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "database.selection", "DATABASE", "Which database should be used?", "single_choice",
        options=["PostgreSQL", "MySQL", "MongoDB", "Supabase", "SQLite", "MariaDB", "Other", "Unknown"],
        recommendation_policy="catalog_default", recommendation_reason="Suitable for transactional application data.",
        conditional_on=_PERSISTENT_DATA, domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=55, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "technology.frontend", "FRONTEND", "Which frontend technology should be used?", "single_choice",
        options=["Next.js", "React", "Vue", "Angular", "Svelte", "Other", "Unknown"],
        recommendation_policy="catalog_default", recommendation_reason="Choose a component-based frontend suited to the product UI.",
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=50, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "technology.backend", "BACKEND", "Which backend technology should be used?", "single_choice",
        options=["FastAPI", "Node.js", "Django", "Laravel", "Spring Boot", "Other", "Unknown"],
        recommendation_policy="catalog_default", recommendation_reason="Choose a backend platform that fits the product's API and workflow needs.",
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=50, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "technology.general", "TECHNOLOGY", "Are there any general technology constraints?", "textarea",
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=45, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "payment.method", "PAYMENT_METHOD", "Which payment methods must be supported?", "multi_choice",
        options=["Cash", "QRIS", "Card", "Bank Transfer", "Other", "Unknown"],
        domains=["POS", "E-Commerce"], priority=80, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "payment.provider", "PAYMENT_PROVIDER", "Which payment provider should be used?", "single_choice",
        options=["Midtrans", "Xendit", "Stripe", "PayPal", "Other", "Unknown"],
        recommendation_policy="catalog_default", recommendation_reason="Select a provider compatible with the confirmed payment methods and operating region.",
        conditional_on=_DIGITAL_PAYMENT, domains=["POS", "E-Commerce", "SaaS"],
        dependencies=["payment.method"], priority=60, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "inventory.required", "INVENTORY", "Does the product need inventory or stock management?", "boolean",
        domains=["POS", "E-Commerce", "Generic"], priority=75, allow_unknown=True,
    ),
    _template(
        "storage.selection", "STORAGE", "Which file or object storage should be used, if any?", "single_choice",
        options=["AWS S3", "Cloudinary", "Firebase Storage", "Other", "Unknown", "Not required"],
        conditional_on=_PERSISTENT_DATA, domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=40, allow_custom=True, allow_unknown=True, allow_not_required=True,
    ),
    _template(
        "integration.external", "INTEGRATIONS", "Which external systems must be integrated?", "textarea",
        conditional_on=[ConditionalRule(category="CORE_FUNCTIONALITY", condition="contains_external_integration")],
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=45, allow_custom=True, allow_unknown=True, allow_not_required=True,
    ),
    _template(
        "deployment.selection", "DEPLOYMENT", "How should the product be deployed?", "single_choice",
        options=["Managed hosting", "Self-hosted", "Other", "Unknown"],
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=35, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "infrastructure.selection", "INFRASTRUCTURE", "Which infrastructure or hosting platform should be used?", "single_choice",
        options=["Vercel", "AWS", "Railway", "Render", "Other", "Unknown"],
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=30, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "constraints.business", "CONSTRAINTS", "What business or technical constraints must be respected?", "textarea",
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=40, allow_custom=True, allow_unknown=True,
    ),
    _template(
        "constraints.scale", "CONSTRAINTS", "How many primary user groups or operating locations must be supported?", "number",
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=25, allow_unknown=True,
    ),
    _template(
        "scope.non_goals", "NON_GOALS", "Which capabilities are explicitly out of scope?", "textarea",
        domains=["POS", "SaaS", "E-Commerce", "AI SaaS", "Generic", "Internal Tool", "CMS"],
        priority=65, allow_custom=True, allow_unknown=True, allow_not_required=True,
    ),
    _template(
        "scope.shipping", "NON_GOALS", "Is shipping or delivery in scope?", "boolean",
        domains=["E-Commerce"], priority=60, allow_unknown=True, allow_not_required=True,
    ),
    _template(
        "scope.online_store", "NON_GOALS", "Is an online storefront in scope?", "boolean",
        domains=["E-Commerce"], priority=60, allow_unknown=True, allow_not_required=True,
    ),
    _template(
        "scope.marketplace", "NON_GOALS", "Is marketplace distribution in scope?", "boolean",
        domains=["E-Commerce"], priority=55, allow_unknown=True, allow_not_required=True,
    ),
)


def validate_question_catalog(templates) -> tuple[QuestionTemplate, ...]:
    """Validate a catalog and its dependency graph before it can be consumed."""
    try:
        normalized = tuple(QuestionTemplate.model_validate(template) for template in templates)
    except Exception as error:
        raise ValueError(f"Invalid question catalog template: {error}") from error

    ids = [template.id for template in normalized]
    if len(ids) != len(set(ids)):
        raise ValueError("Question catalog IDs must be unique")
    by_id = {template.id: template for template in normalized}
    known_domains = set(CatalogDomain.__args__)
    for template in normalized:
        if template.catalog_version != CATALOG_VERSION:
            raise ValueError(f"Unsupported catalog version: {template.catalog_version}")
        if not set(template.applicable_domains).issubset(known_domains):
            raise ValueError(f"Unknown domain in template {template.id}")
        missing = [dependency for dependency in template.dependencies if dependency not in by_id]
        if missing:
            raise ValueError(f"Template {template.id} has missing dependencies: {', '.join(missing)}")
        if template.id in template.dependencies:
            raise ValueError(f"Template {template.id} depends on itself")

    graph = {template.id: set(template.dependencies) for template in normalized}
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(template_id: str):
        if template_id in visiting:
            raise ValueError(f"Circular question catalog dependency at {template_id}")
        if template_id in visited:
            return
        visiting.add(template_id)
        for dependency in graph[template_id]:
            visit(dependency)
        visiting.remove(template_id)
        visited.add(template_id)

    for template_id in graph:
        visit(template_id)
    return normalized


VALIDATED_QUESTION_CATALOG = validate_question_catalog(QUESTION_CATALOG)
_QUESTION_INDEX = {template.id: template for template in VALIDATED_QUESTION_CATALOG}


def get_question_template(template_id: str) -> QuestionTemplate | None:
    template = _QUESTION_INDEX.get(template_id)
    return template.model_copy(deep=True) if template else None


def list_question_templates() -> list[QuestionTemplate]:
    return [deepcopy(template) for template in VALIDATED_QUESTION_CATALOG]
