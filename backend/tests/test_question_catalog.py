import pytest

from question_catalog import (
    CATALOG_VERSION,
    QUESTION_CATALOG,
    VALIDATED_QUESTION_CATALOG,
    QuestionTemplate,
    get_question_template,
    list_question_templates,
    validate_question_catalog,
)


def template_data(template_id="test.question", **overrides):
    data = {
        "id": template_id,
        "category": "TECHNOLOGY",
        "question": "Which technology constraints apply?",
        "type": "text",
        "applicable_domains": ["Generic"],
        "priority": 50,
        "catalog_version": CATALOG_VERSION,
    }
    data.update(overrides)
    return data


def test_catalog_ids_are_unique_and_lookup_is_stable():
    ids = [template.id for template in QUESTION_CATALOG]

    assert len(QUESTION_CATALOG) == 25
    assert len(ids) == len(set(ids))
    assert get_question_template("database.selection").id == "database.selection"
    assert get_question_template("missing.question") is None


def test_question_text_can_change_without_changing_catalog_identity():
    original = get_question_template("database.selection")
    revised = original.model_copy(update={"question": "Which data store should the product use?"})

    assert revised.id == original.id
    assert get_question_template("database.selection").question == original.question


def test_catalog_is_validated_and_lookup_returns_defensive_copies():
    assert tuple(VALIDATED_QUESTION_CATALOG) == validate_question_catalog(QUESTION_CATALOG)

    first = get_question_template("database.selection")
    first.options.append("Unexpected")
    assert "Unexpected" not in get_question_template("database.selection").options
    assert len(list_question_templates()) == len(QUESTION_CATALOG)


def test_every_template_has_valid_schema_and_catalog_version():
    valid_types = {"single_choice", "multi_choice", "boolean", "text", "textarea", "number"}
    valid_categories = {
        "PRODUCT", "PURPOSE", "TARGET_USERS", "CORE_FUNCTIONALITY", "ROLES_PERMISSIONS", "WORKFLOW",
        "AUTHENTICATION", "AUTHENTICATION_METHOD", "DATABASE", "BACKEND", "FRONTEND", "TECHNOLOGY",
        "PAYMENT_METHOD", "PAYMENT_PROVIDER", "INVENTORY", "STORAGE", "INTEGRATIONS", "DEPLOYMENT",
        "INFRASTRUCTURE", "CONSTRAINTS", "NON_GOALS",
    }

    for template in QUESTION_CATALOG:
        assert template.type in valid_types
        assert template.category in valid_categories
        assert template.catalog_version == CATALOG_VERSION
        assert template.priority >= 0
        assert template.applicable_domains


@pytest.mark.parametrize("template_id", ["payment.method", "database.selection", "technology.frontend"])
def test_choice_questions_have_authoritative_unique_options(template_id):
    template = get_question_template(template_id)

    assert template.type in {"single_choice", "multi_choice"}
    assert template.options
    assert len({option.casefold() for option in template.options}) == len(template.options)


def test_catalog_supports_all_required_question_types():
    assert {template.type for template in QUESTION_CATALOG} == {
        "single_choice", "multi_choice", "boolean", "text", "textarea", "number"
    }
    assert get_question_template("constraints.scale").type == "number"


def test_taxonomy_keeps_semantically_distinct_categories():
    category = {template.id: template.category for template in QUESTION_CATALOG}

    assert category["target.users"] == "TARGET_USERS"
    assert category["roles.permissions"] == "ROLES_PERMISSIONS"
    assert category["payment.method"] == "PAYMENT_METHOD"
    assert category["payment.provider"] == "PAYMENT_PROVIDER"
    assert category["auth.required"] == "AUTHENTICATION"
    assert category["auth.method"] == "AUTHENTICATION_METHOD"
    assert category["technology.general"] == "TECHNOLOGY"
    assert category["technology.frontend"] == "FRONTEND"
    assert category["technology.backend"] == "BACKEND"
    assert category["database.selection"] == "DATABASE"
    assert category["deployment.selection"] == "DEPLOYMENT"
    assert category["infrastructure.selection"] == "INFRASTRUCTURE"
    assert category["functionality.core"] == "CORE_FUNCTIONALITY"
    assert category["scope.non_goals"] == "NON_GOALS"


def test_domain_applicability_is_deterministic():
    shipping = get_question_template("scope.shipping")
    online_store = get_question_template("scope.online_store")
    payment = get_question_template("payment.method")

    assert shipping.applicable_domains == ["E-Commerce"]
    assert online_store.applicable_domains == ["E-Commerce"]
    assert "POS" not in shipping.applicable_domains
    assert "SaaS" not in shipping.applicable_domains
    assert set(payment.applicable_domains) == {"POS", "E-Commerce"}


def test_ai_specific_domain_is_not_universal():
    assert all("AI SaaS" in template.applicable_domains for template in QUESTION_CATALOG if template.category == "TECHNOLOGY")
    assert "AI SaaS" not in get_question_template("scope.shipping").applicable_domains


def test_conditional_rules_are_typed_and_dependencies_are_valid():
    database = get_question_template("database.selection")
    provider = get_question_template("payment.provider")
    auth_method = get_question_template("auth.method")

    assert database.conditional_on[0].condition == "contains_persistent_data"
    assert database.conditional_on[0].category == "CORE_FUNCTIONALITY"
    assert provider.conditional_on[0].condition == "indicates_digital_payment"
    assert provider.dependencies == ["payment.method"]
    assert auth_method.dependencies == ["auth.required"]


def test_recommendation_metadata_does_not_select_a_value():
    database = get_question_template("database.selection")

    assert database.recommendation_policy == "catalog_default"
    assert database.recommendation_reason
    assert database.allow_unknown is True
    assert database.options[0] == "PostgreSQL"


def test_core_discovery_questions_have_domain_keyed_recommendation_metadata():
    for question_id in ("target.users", "functionality.core"):
        template = get_question_template(question_id)
        assert template.type == "textarea"
        assert template.options == []
        assert template.recommendation_policy == "catalog_default"
        assert set(template.recommendation_options) == set(template.applicable_domains)
        assert all(template.recommendation_options[domain] for domain in template.applicable_domains)


def test_decision_flags_cover_custom_unknown_and_not_required():
    assert get_question_template("database.selection").allow_custom is True
    assert get_question_template("database.selection").allow_unknown is True
    assert get_question_template("scope.shipping").allow_not_required is True
    assert get_question_template("auth.required").allow_not_required is False


def test_duplicate_id_is_rejected():
    with pytest.raises(ValueError, match="IDs must be unique"):
        validate_question_catalog([get_question_template("product.identity"), get_question_template("product.identity")])


@pytest.mark.parametrize("field, value, message", [
    ("category", "NOT_A_CATEGORY", "Input should be"),
    ("type", "free_form_schema", "Input should be"),
    ("catalog_version", "v-next", "String should match pattern"),
])
def test_invalid_template_metadata_is_rejected(field, value, message):
    with pytest.raises(ValueError, match=message):
        validate_question_catalog([template_data(**{field: value})])


def test_duplicate_options_are_rejected():
    with pytest.raises(ValueError, match="options must be unique"):
        validate_question_catalog([template_data(type="single_choice", options=["Other", "other"])])


def test_choice_options_are_required_and_non_choice_options_are_rejected():
    with pytest.raises(ValueError, match="require options"):
        validate_question_catalog([template_data(type="single_choice")])
    with pytest.raises(ValueError, match="cannot define options"):
        validate_question_catalog([template_data(type="text", options=["Other"])])


def test_default_recommendation_requires_a_reason():
    with pytest.raises(ValueError, match="recommendation_reason"):
        validate_question_catalog([template_data(recommendation_policy="catalog_default")])


def test_missing_dependency_is_rejected():
    with pytest.raises(ValueError, match="missing dependencies"):
        validate_question_catalog([template_data(dependencies=["missing.question"])])


def test_circular_dependency_is_rejected():
    first = template_data("first.question", dependencies=["second.question"])
    second = template_data("second.question", dependencies=["first.question"])

    with pytest.raises(ValueError, match="Circular"):
        validate_question_catalog([first, second])


def test_not_required_is_rejected_for_non_scope_categories():
    with pytest.raises(ValueError, match="cannot allow NOT_REQUIRED"):
        validate_question_catalog([template_data(category="DATABASE", allow_not_required=True)])


def test_dependencies_in_catalog_are_acyclic_and_resolvable():
    by_id = {template.id: template for template in QUESTION_CATALOG}

    for template in QUESTION_CATALOG:
        assert all(dependency in by_id for dependency in template.dependencies)
    assert validate_question_catalog(QUESTION_CATALOG)
