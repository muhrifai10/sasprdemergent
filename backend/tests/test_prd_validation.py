import asyncio
from types import SimpleNamespace

import pytest

import server
from server import PRD_SECTIONS, REQUIRED_PRD_HEADINGS, validate_prd_content


def complete_prd() -> str:
    return "# Product Requirements Document\n\n" + PRD_SECTIONS + "\n\nDetails"


def test_prd_has_the_compact_required_sections():
    assert len(REQUIRED_PRD_HEADINGS) == 14


def test_prd_prompt_enforces_traceability_without_generator_specific_stack():
    request = server.prd_user_prompt({"name": "Test"}, "id")

    assert "GREENFIELD" in server.PRD_SYSTEM
    assert "traceable chain" in server.PRD_SYSTEM
    assert "PROJECT FOLLOWING RULES" in request
    assert "user's product actually needs" in request
    assert "Do not describe this PRD-writing application" in server.PRD_SYSTEM
    assert "MVP scope" in request
    assert "FR IDs" in request
    # The prompt must NOT hardcode the generator's own stack for any user project.
    assert "Next.js 14 App Router" not in request
    assert "GenerationJob" not in request


def test_prd_prompt_keeps_generator_agnostic_section_guidance():
    request = server.prd_user_prompt({"name": "Test"}, "id")
    assert "the entities the user's product actually needs" in request
    assert "Only include the routes the product needs" in request


def test_agent_prompt_request_enforces_short_phased_instructions():
    request = server.agent_prompt_user_prompt({"name": "Test"}, "## 1. Product Overview\nA website.", "id")

    assert "under 700 words" in request
    assert "PHASE 1" in request
    assert "PHASE 2" in request
    assert "PHASE 3" in request
    assert "Do not output a file structure" in request


def test_validate_prd_accepts_all_required_sections():
    validate_prd_content(complete_prd())


def test_validate_prd_rejects_missing_section():
    content = complete_prd().replace("## 7. API Specification\n", "")

    with pytest.raises(ValueError, match="missing: ## 7\\. API Specification"):
        validate_prd_content(content)


def test_validate_prd_rejects_out_of_order_sections():
    content = complete_prd().replace(
        "## 1. Product Overview\n## 2. Problem, Goals, and Non-Goals",
        "## 2. Problem, Goals, and Non-Goals\n## 1. Product Overview",
    )

    with pytest.raises(ValueError, match="out of order"):
        validate_prd_content(content)


def test_validate_prd_rejects_duplicate_numbered_subheading():
    content = complete_prd().replace("## 6. Data Model and Database Schema", "### 6. Data Model and Database Schema\n## 6. Data Model and Database Schema")

    with pytest.raises(ValueError, match="numbered sections must use ##"):
        validate_prd_content(content)


def test_validate_prd_allows_numbered_subheadings_that_are_not_required_sections():
    content = complete_prd() + "\n\n### 1. Entitas: User\n\nSchema detail."

    validate_prd_content(content)


def test_validate_prd_consistency_rejects_heading_only_document():
    with pytest.raises(ValueError, match="PRD consistency validation failed"):
        server.validate_prd_consistency(complete_prd())


def test_validate_prd_consistency_accepts_a_real_user_project():
    # A toko-online product built with Laravel/MySQL/Midtrans must pass without
    # any generator vocabulary (no Next.js, GenerationJob, UsageLog, worker...).
    bodies = {
        "## 1. Product Overview": "E-commerce pakaian pria/wanita dengan checkout via Midtrans.",
        "## 2. Problem, Goals, and Non-Goals": "Goals: katalog, checkout, admin order",
        "## 3. Users, Roles, and Core Journeys": "Customer dan admin dashboard, checkout, kelola order",
        "## 4. Functional Requirements and User Stories": "1. Customer mendaftar dan login dengan role. 2. Admin kelola katalog pakaian pria/wanita. 3. Customer keranjang dan checkout. 4. Payment via Midtrans Snap. 5. Dashboard admin dan customer.",
        "## 5. UX, Pages, and Interaction States": "Katalog, checkout, dashboard, state loading/empty/error.",
        "## 6. Data Model and Database Schema": "Tabel product, order, order_item, user, payment. Field id, name, price, stock, status.",
        "## 7. API Specification": "HTTP endpoint POST /checkout, GET /products, GET /orders. Json request.",
        "## 8. Authentication, Authorization, and Security": "Login Laravel, role admin dan customer, session, bcrypt.",
        "## 9. Integrations, Payments, and Notifications": "Midtrans Snap, webhook settlement, retry timeout.",
        "## 10. Tech Stack and System Architecture": "Laravel, MySQL, Blade, web server.",
        "## 11. Validation, Errors, and Observability": "Validasi stok, logging order.",
        "## 12. Testing and Acceptance Criteria": "AC-AUTH AC-AUTHZ AC-GENERATION AC-EXPORT AC-RESTORE AC-DELETE AC-RATE-LIMIT AC-SECRET.",
        "## 13. Delivery Plan and Environment": "Frontend lalu backend lalu integration.",
        "## 14. Assumptions and Decisions": "None unresolved.",
    }
    content = "# Product Requirements Document\n\n" + "\n\n".join(
        f"{heading}\n\n{bodies.get(heading, 'Concrete implementation details.')}"
        for heading in REQUIRED_PRD_HEADINGS
    )

    server.validate_prd_consistency(content)


def test_validate_prd_consistency_rejects_missing_structure():
    # Sections exist but the core implementation sections are empty.
    bodies = {
        "## 3. Users, Roles, and Core Journeys": "FR-1 roles",
        "## 6. Data Model and Database Schema": "N/A",
        "## 7. API Specification": "N/A",
        "## 8. Authentication, Authorization, and Security": "N/A",
    }
    content = "# Product Requirements Document\n\n" + "\n\n".join(
        f"{heading}\n\n{bodies.get(heading, '')}"
        for heading in REQUIRED_PRD_HEADINGS
    )

    with pytest.raises(ValueError, match="PRD consistency validation failed"):
        server.validate_prd_consistency(content)


# ---------- Contradiction engine tests (master-prompt section 29) ----------

def test_contradiction_db_bigint_api_uuid_is_critical():
    content = f"""# Product Requirements Document

## 6. Data Model and Database Schema
Tabel user: id BIGINT PRIMARY KEY, email VARCHAR.

## 7. API Specification
GET /users/{{id}} -> 200. Response id is a UUID string.

## 10. Tech Stack and System Architecture
Backend: Laravel, MySQL, web server.
"""
    report = server.analyze_prd_consistency(content)
    assert any("BIGINT/INT" in c or "bigint" in c.lower() for c in report["critical"])
    assert report["counts"]["critical"] >= 1


def test_contradiction_guest_checkout_vs_required_user_is_high():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Guest checkout is allowed for customers without an account.

## 6. Data Model and Database Schema
Tabel order: id, user_id NOT NULL, total.

## 7. API Specification
POST /checkout -> 201.
"""
    report = server.analyze_prd_consistency(content)
    assert any("guest" in h.lower() and "user_id" in h.lower() for h in report["high"])


def test_contradiction_multiple_webhooks_is_high():
    content = f"""# Product Requirements Document

## 9. Integrations, Payments, and Notifications
Webhook /webhook/payment and /webhook/midtrans receive callbacks.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert len(report["high"]) == 1 and "webhook" in report["high"][0].lower()


def test_consistent_status_state_machine_passes():
    content = f"""# Product Requirements Document

## 2. Problem, Goals, and Non-Goals
Order status flow: PENDING -> PAID -> PROCESSING -> SHIPPED.

## 3. Users, Roles, and Core Journeys
A payment PENDING becomes PAID then PROCESSING then SHIPPED.

## 6. Data Model and Database Schema
Tabel order: id, status enum(pending, paid, processing, shipped).

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["critical"] == 0
    assert report["counts"]["high"] == 0
    assert report["readiness"] == "READY FOR IMPLEMENTATION"


def test_payment_expired_releases_stock_is_consistent():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Checkout reserves stock; when a payment is EXPIRED the reserved stock is released.

## 6. Data Model and Database Schema
Tabel product: id, stock. Tabel order: id, status enum(pending, paid, processing, shipped, delivered, cancelled, expired).

## 9. Integrations, Payments, and Notifications
Payment gateway webhook maps expire -> order EXPIRED and releases reserved stock.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["critical"] == 0
    assert report["counts"]["high"] == 0


def test_contradiction_public_checkout_page_vs_auth_order_api_is_high():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Customers browse catalog and can checkout.

## 5. UX, Pages, and Interaction States
/checkout (Public), /orders (Public) pages.

## 6. Data Model and Database Schema
Tabel orders: id, user_id NOT NULL, total.

## 7. API Specification
POST /api/orders -> 201. Requires Bearer JWT.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert any("PUBLIC" in h.upper() and "authentication" in h.lower() for h in report["high"])


def test_consistent_authenticated_checkout_passes():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Customer logs in, then checks out.

## 5. UX, Pages, and Interaction States
/checkout (Customer/Authenticated), /orders (Customer/Authenticated).

## 6. Data Model and Database Schema
Tabel orders: id, user_id NOT NULL, total.

## 7. API Specification
POST /api/orders -> 201. Requires Customer Bearer JWT.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_consistent_guest_checkout_passes():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Guest checkout is allowed without an account.

## 5. UX, Pages, and Interaction States
/checkout (Public), /orders (Public with secure order token).

## 6. Data Model and Database Schema
Tabel orders: id, user_id NULL, order_token UNIQUE.

## 7. API Specification
POST /api/orders -> 201. Public (no auth). GET /orders/{{order_token}} -> 200.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    # guest + NULL user_id + public create -> logically consistent (Model B).
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_guest_with_required_user_and_public_order_page_is_incoherent():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Guest checkout is allowed without an account.

## 5. UX, Pages, and Interaction States
/checkout (Public), /orders (Public).

## 6. Data Model and Database Schema
Tabel orders: id, user_id NOT NULL, total.

## 7. API Specification
POST /api/orders -> 201. Requires Bearer JWT.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] >= 1


def test_mixed_stock_deduct_checkout_and_reserve_is_high():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Checkout deducts stock immediately, then payment is processed. Also reserve stock on checkout.

## 6. Data Model and Database Schema
Tabel orders: id, status, user_id. Tabel product_variant: id, stock.

## 7. API Specification
POST /api/orders -> 201.

## 9. Integrations, Payments, and Notifications
Midtrans webhook updates payment status.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert any("stock" in h.lower() and "strategy" in h.lower() for h in report["high"])


def test_ambiguous_stock_deduct_at_checkout_or_payment_is_medium():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Stock is deducted at checkout or at payment.

## 6. Data Model and Database Schema
Tabel product: id, stock.

## 7. API Specification
POST /api/orders -> 201.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert any("ambiguous" in m.lower() and "stock" in m.lower() for m in report["medium"])


def test_single_reservation_stock_strategy_passes():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Checkout reserves stock atomically; payment success commits it; payment cancel/expire releases it.

## 6. Data Model and Database Schema
Tabel orders: id, status. Tabel product_variant: id, stock, reserved.

## 7. API Specification
POST /api/orders -> 201 atomically reserves stock if available; 409 if sold out.

## 9. Integrations, Payments, and Notifications
Midtrans webhook: settlement commits reservation; cancel/expire releases it.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_non_canonical_order_status_failed_is_high():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Order can be processed, shipped, and delivered.

## 6. Data Model and Database Schema
Tabel orders: id, user_id, status enum(pending, paid, failed, cancelled).

## 7. API Specification
POST /api/orders -> 201.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert any("FAILED" in h.upper() or "failed" in h.lower() for h in report["high"])


def test_canonical_order_state_machine_passes():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Order flows PENDING -> PAID -> PROCESSING -> SHIPPED -> DELIVERED. Or PENDING -> CANCELLED / EXPIRED.

## 6. Data Model and Database Schema
Tabel orders: id, user_id, status enum(pending, paid, processing, shipped, delivered, cancelled, expired).

## 7. API Specification
POST /api/orders -> 201.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_separates_order_status_from_payment_status():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Order PENDING -> PAID -> PROCESSING -> SHIPPED -> DELIVERED.

## 6. Data Model and Database Schema
Tabel orders: id, user_id, status enum(pending, paid, processing, shipped, delivered, cancelled, expired). Tabel payments: id, order_id, transaction_status enum(pending, settlement, deny, cancel, expire, failure).

## 7. API Specification
POST /api/orders -> 201.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_public_order_access_with_numeric_id_is_high():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Customers can view their order by id.

## 5. UX, Pages, and Interaction States
/orders/{{id}} (Public).

## 6. Data Model and Database Schema
Tabel orders: id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id, status.

## 7. API Specification
GET /api/orders/{{id}} -> 200 (Public). POST /api/orders -> 201.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert any("enumeration" in h.lower() or "public_order_token" in h.lower() for h in report["high"])


def test_public_order_via_secure_token_passes():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Guest views their order via a secure public_order_token.

## 5. UX, Pages, and Interaction States
/orders/{{public_order_token}} (Public).

## 6. Data Model and Database Schema
Tabel orders: id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id NULL, public_order_token VARCHAR UNIQUE, status.

## 7. API Specification
GET /api/orders/{{public_order_token}} -> 200. POST /api/orders -> 201.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_authenticated_owner_only_order_detail_passes():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Only the owner can view their own order; admin can view all; another customer gets denied.

## 5. UX, Pages, and Interaction States
/orders/{{id}} (Customer owner/Admin authenticated).

## 6. Data Model and Database Schema
Tabel orders: id, user_id NOT NULL, status.

## 7. API Specification
GET /api/orders/{{id}} -> 401 if not logged in; 403/404 if not owner and not admin. POST /api/orders -> 201 (auth required).

## 8. Authentication, Authorization, and Security
Only the owner (orders.user_id) or ADMIN can read an order; a customer is denied another customer's order.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_session_cookie_with_unexplained_bearer_is_high():
    content = f"""# Product Requirements Document

## 6. Data Model and Database Schema
Tabel orders: id, status enum(pending, paid, processing, shipped, delivered, cancelled, expired).

## 7. API Specification
POST /api/orders -> 201. All API routes require Authorization: Bearer JWT.

## 8. Authentication, Authorization, and Security
NextAuth.js Credentials provider. Session Strategy = JWT in a secure httpOnly session cookie.

## 10. Tech Stack and System Architecture
NextAuth, PostgreSQL, Prisma.
"""
    report = server.analyze_prd_consistency(content)
    assert any("Authentication is inconsistent" in h for h in report["high"])


def test_session_only_auth_passes():
    content = f"""# Product Requirements Document

## 6. Data Model and Database Schema
Tabel orders: id, status enum(pending, paid, processing, shipped, delivered, cancelled, expired).

## 7. API Specification
POST /api/orders -> 201. All API routes verify the session cookie.

## 8. Authentication, Authorization, and Security
Authentication Provider = NextAuth Credentials; Session Strategy = JWT; Browser Auth = secure httpOnly session cookie; API Authorization = server verifies the session cookie on each request. No raw Bearer header used.

## 10. Tech Stack and System Architecture
NextAuth, PostgreSQL, Prisma.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_bearer_explained_with_issuer_passes():
    content = f"""# Product Requirements Document

## 6. Data Model and Database Schema
Tabel orders: id, status enum(pending, paid, processing, shipped, delivered, cancelled, expired).

## 7. API Specification
POST /api/orders -> 201. This public API verifies a signed JWT Bearer token.

## 8. Authentication, Authorization, and Security
Token issuer = the same NextAuth server; token format = signed JWT; validation = verify signature + claims + expiry; lifetime = 7 days with rotation; the frontend obtains it from the login response; the API validates it with the same AUTH_SECRET keys as the session.

## 10. Tech Stack and System Architecture
NextAuth, PostgreSQL, Prisma.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_infra_two_db_alternatives_is_medium():
    content = f"""# Product Requirements Document

## 6. Data Model and Database Schema
Tabel orders: id, status enum(pending, paid, processing, shipped, delivered, cancelled, expired).

## 7. API Specification
POST /api/orders -> 201.

## 10. Tech Stack and System Architecture
Database: Supabase / Neon PostgreSQL. Web: Vercel.

## 13. Delivery Plan and Environment
Deploy web to Vercel; database uses Supabase / Neon.
"""
    report = server.analyze_prd_consistency(content)
    assert any("two alternatives" in m.lower() for m in report["medium"])


def test_infra_db_provider_differs_between_tech_and_deploy_is_high():
    content = f"""# Product Requirements Document

## 6. Data Model and Database Schema
Tabel orders: id, status enum(pending, paid, processing, shipped, delivered, cancelled, expired).

## 7. API Specification
POST /api/orders -> 201.

## 10. Tech Stack and System Architecture
Database: Neon PostgreSQL. Web: Vercel.

## 13. Delivery Plan and Environment
Deploy database to Supabase; web on Vercel.
"""
    report = server.analyze_prd_consistency(content)
    assert any("differs between tech stack" in h.lower() for h in report["high"])


def test_infra_single_stack_passes():
    content = f"""# Product Requirements Document

## 6. Data Model and Database Schema
Tabel orders: id, status enum(pending, paid, processing, shipped, delivered, cancelled, expired).

## 7. API Specification
POST /api/orders -> 201.

## 10. Tech Stack and System Architecture
Frontend + Backend: Vercel. Database: Neon PostgreSQL. Image storage: Cloudinary. Payment: Midtrans.

## 13. Delivery Plan and Environment
Deploy web to Vercel; database on Neon PostgreSQL; images on Cloudinary; payment via Midtrans. Local dev uses the same Neon database.
"""
    report = server.analyze_prd_consistency(content)
    assert report["counts"]["high"] == 0
    assert report["counts"]["critical"] == 0


def test_canonical_numeric_conflict_detected():
    content = f"""# Product Requirements Document

## 1. Product Overview
Maximum attendance radius = 50 meters.

## 6. Data Model and Database Schema
Max radius 100 meters, attendance_radius.

## 7. API Specification
API enforces radius 100 meters.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert any("Numeric business value inconsistent" in m for m in report["medium"])


def test_canonical_route_conflict_detected():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Employee visits /user/dashboard.

## 5. UX, Pages, and Interaction States
/karyawan/dashboard.

## 10. Tech Stack and System Architecture
Dashboard at /dashboard.
"""
    report = server.analyze_prd_consistency(content)
    assert any("Multiple routes" in m for m in report["medium"])


def test_canonical_hash_conflict_is_critical():
    content = f"""# Product Requirements Document

## 6. Data Model and Database Schema
Password hash uses Argon2id.

## 8. Authentication, Authorization, and Security
Password hashed with Argon2id / bcrypt.

## 10. Tech Stack and System Architecture
Uses bcrypt hashing.
"""
    report = server.analyze_prd_consistency(content)
    assert any("hashing algorithm" in c.lower() for c in report["critical"])


def test_canonical_config_source_conflict_is_high():
    content = f"""# Product Requirements Document

## 6. Data Model and Database Schema
company_locations.radius_meters.

## 7. API Specification
MAX_RADIUS_METERS env var. Admin can edit radius.

## 8. Authentication, Authorization, and Security
Admin can change radius.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert any("source of truth" in h.lower() for h in report["high"])


def test_canonical_vocabulary_conflict_is_medium():
    content = f"""# Product Requirements Document

## 5. UX, Pages, and Interaction States
PRESENT attendance.

## 7. API Specification
CRUD attendance MASUK.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert any("Vocabulary inconsistency" in m for m in report["medium"])


def test_oauth_account_linking_rule_required():
    content = f"""# Product Requirements Document

## 3. Users, Roles, and Core Journeys
Existing password user logs in with Google OAuth using the same email.

## 8. Authentication, Authorization, and Security
Google OAuth login. Existing user email = Google email.

## 10. Tech Stack and System Architecture
Laravel, MySQL.
"""
    report = server.analyze_prd_consistency(content)
    assert any("OAuth account linking" in m for m in report["medium"])


def test_strip_prd_contract_markers_keeps_human_readable_text():
    content = """## 7. API Specification

`DELETE_TEMPLATE_EFFECT: DEACTIVATE_ONLY` means DELETE only deactivates.

## 9. Integrations, Payments, and Notifications

USAGE_LOG_CARDINALITY: ONE_FINAL_LOG_PER_JOB. Retries go to metadata.
"""

    cleaned = server.strip_prd_contract_markers(content)
    assert "DELETE_TEMPLATE_EFFECT" not in cleaned
    assert "USAGE_LOG_CARDINALITY" not in cleaned
    assert "means DELETE only deactivates" in cleaned
    assert "Retries go to metadata" in cleaned


def test_deepseek_builds_the_prd_one_validated_section_at_a_time(monkeypatch):
    calls = 0

    async def fake_stream(*args, **kwargs):
        nonlocal calls
        calls += 1
        yield "Concrete implementation details."

    async def collect():
        chunks = []
        async for chunk in server.stream_prd("deepseek", "key", "url", "model", {}, "id", "system", "user"):
            chunks.append(chunk)
        return chunks

    monkeypatch.setattr(server, "stream_openai_compatible", fake_stream)
    chunks = asyncio.run(collect())
    validate_prd_content("\n".join(chunks))
    assert len(chunks) == len(REQUIRED_PRD_HEADINGS)
    assert calls == len(REQUIRED_PRD_HEADINGS)


def test_non_deepseek_isolates_schema_and_integration_sections(monkeypatch):
    calls = []

    async def fake_generate(provider, api_key, base_url, model, project, language, start, end):
        calls.append((start, end))
        return "\n".join(REQUIRED_PRD_HEADINGS[start:end])

    async def collect():
        return [chunk async for chunk in server.stream_prd("9router", "key", "url", "model", {}, "id", "system", "user")]

    monkeypatch.setattr(server, "generate_prd_chunk", fake_generate)
    chunks = asyncio.run(collect())

    assert calls == [(0, 3), (3, 5), (5, 6), (6, 8), (8, 9), (9, 12), (12, 14)]
    validate_prd_content("\n".join(chunks))


def test_schema_and_integration_chunks_have_sufficient_word_limits():
    assert "under 600 words" in server.prd_chunk_user_prompt({}, "id", 5, 6)
    assert "under 350 words" in server.prd_chunk_user_prompt({}, "id", 8, 9)
    assert "under 220 words" in server.prd_chunk_user_prompt({}, "id", 0, 1)


def test_generation_job_collects_all_prd_chunks(monkeypatch):
    async def fake_stream(*args):
        for heading in REQUIRED_PRD_HEADINGS:
            yield f"{heading}\n\nConcrete implementation details."

    class Collection:
        async def count_documents(self, *args, **kwargs):
            return 0

        async def insert_one(self, *args, **kwargs):
            return None

        async def update_one(self, *args, **kwargs):
            return None

    monkeypatch.setattr(server, "stream_prd", fake_stream)
    monkeypatch.setattr(server, "validate_prd_consistency", lambda content: None)
    monkeypatch.setattr(server, "db", SimpleNamespace(
        prd_documents=Collection(), projects=Collection(), usage_records=Collection(),
    ))
    server.GENERATION_JOBS["test-job"] = {"status": "running", "content": "", "error": None, "user_id": "user"}

    async def run():
        await server.run_generation_job(
            "test-job", "prd", {"id": "project", "name": "Test"}, {"user_id": "user"},
            server.PRD_SYSTEM, "prompt", "id",
        )

    asyncio.run(run())
    job = server.GENERATION_JOBS.pop("test-job")
    assert job["status"] == "completed"
    validate_prd_content(job["content"])


# ---------- Cross-domain canonical isolation (master prompt section 31/32/33) ----------

def test_canonical_decisions_follow_each_project_input():
    ecom = server.canonical_project_decisions({
        "name": "Toko", "preferred_technology": "Laravel + MySQL",
        "payment_requirement": "Midtrans", "auth_requirement": "Login email/password",
        "target_users": "Customer dan Admin",
    })
    attendance = server.canonical_project_decisions({
        "name": "Absensi", "preferred_technology": "Laravel + MySQL",
        "payment_requirement": "Payment: None",
        "auth_requirement": "Login karyawan dengan Google",
        "target_users": "Karyawan dan Admin HRD",
    })
    saas = server.canonical_project_decisions({
        "name": "SaaS", "preferred_technology": "Next.js + PostgreSQL",
        "auth_requirement": "NextAuth Credentials",
        "target_users": "Tenant user",
    })
    # Each project derives from its OWN inputs; no carryover of payment/tech/auth.
    assert "Midtrans" in ecom
    assert "Midtrans" not in attendance and "Midtrans" not in saas
    assert "NextAuth" in saas and "NextAuth" not in ecom
    assert "Google" in attendance and "Google" not in saas
    assert "PostgreSQL" in saas and "PostgreSQL" not in ecom


def test_canonical_decisions_no_invention_when_fields_empty():
    spec = server.canonical_project_decisions({"name": "X", "description": "A small tool"})
    assert "invent" in spec.lower()


def test_chunk_prompt_embeds_frozen_canonical_spec():
    p = {"name": "Toko", "preferred_technology": "Laravel + MySQL", "payment_requirement": "Midtrans"}
    prompt = server.prd_chunk_user_prompt(p, "id", 0, 1)
    assert "FROZEN CANONICAL SPEC" in prompt
    assert "Laravel + MySQL" in prompt
    assert "Midtrans" in prompt


def test_stream_prd_passes_project_to_canonical_spec(monkeypatch):
    calls = []

    async def fake_generate(provider, api_key, base_url, model, project, language, start, end):
        calls.append(project)
        return "\n".join(REQUIRED_PRD_HEADINGS[start:end])

    monkeypatch.setattr(server, "generate_prd_chunk", fake_generate)
    async def collect():
        return [chunk async for chunk in server.stream_prd("9router", "key", "url", "model", {"name": "Toko", "preferred_technology": "Laravel"}, "id", "system", "user")]
    asyncio.run(collect())
    assert calls and all("name" in c and c["name"] == "Toko" for c in calls)
