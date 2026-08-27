import os
import time
from typing import Any
from pathlib import Path
from datetime import datetime, timezone

import pytest
import requests
from dotenv import load_dotenv


# Load frontend env so tests always use public backend URL.
load_dotenv(Path("/app/frontend/.env"))
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")

ADMIN_TOKEN = os.getenv("TEST_ADMIN_SESSION_TOKEN")
REGULAR_TOKEN = os.getenv("TEST_REGULAR_SESSION_TOKEN")
REGULAR_USER_ID = os.getenv("TEST_REGULAR_USER_ID")


@pytest.fixture(scope="session")
def api_client() -> requests.Session:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is missing")
    return BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def test_ctx() -> dict[str, Any]:
    return {}


@pytest.fixture(scope="session")
def credentials() -> dict[str, str]:
    if not all((ADMIN_TOKEN, REGULAR_TOKEN, REGULAR_USER_ID)):
        pytest.skip("Manual payment test credentials are not configured in environment variables")
    return {"admin_token": ADMIN_TOKEN, "regular_token": REGULAR_TOKEN, "regular_user_id": REGULAR_USER_ID}


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_access_admin_payment_endpoints(api_client: requests.Session, base_url: str, credentials: dict[str, str]) -> None:
    # Admin/payment authorization checks
    admin_settings = api_client.get(f"{base_url}/api/admin/payment-settings", headers=auth_headers(credentials["admin_token"]))
    assert admin_settings.status_code == 200

    admin_payments = api_client.get(f"{base_url}/api/admin/payments", headers=auth_headers(credentials["admin_token"]))
    assert admin_payments.status_code == 200

    regular_forbidden = api_client.get(f"{base_url}/api/admin/payments", headers=auth_headers(credentials["regular_token"]))
    assert regular_forbidden.status_code == 403
    assert regular_forbidden.json().get("detail") == "Admin access required"


def test_admin_can_save_settings_and_duration_is_editable(api_client: requests.Session, base_url: str, test_ctx: dict[str, Any], credentials: dict[str, str]) -> None:
    # Payment settings CRUD checks
    marker = str(int(time.time()))
    payload = {
        "bank_name": "BCA",
        "account_number": f"123456{marker[-4:]}",
        "account_holder": "PRD CreativeAI",
        "pro_price": 99000,
        "pro_duration_days": 45,
        "instructions": f"Transfer dan kirim bukti - {marker}",
    }
    put_res = api_client.put(
        f"{base_url}/api/admin/payment-settings",
        headers=auth_headers(credentials["admin_token"]),
        json=payload,
    )
    assert put_res.status_code == 200
    put_data = put_res.json()
    assert put_data["bank_name"] == payload["bank_name"]
    assert put_data["account_number"] == payload["account_number"]
    assert put_data["pro_price"] == payload["pro_price"]
    assert put_data["pro_duration_days"] == payload["pro_duration_days"]

    get_res = api_client.get(f"{base_url}/api/payments/manual-settings", headers=auth_headers(credentials["regular_token"]))
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["configured"] is True
    assert get_data["account_number"] == payload["account_number"]
    assert get_data["instructions"] == payload["instructions"]

    # Verify default duration=30 when field omitted by admin.
    default_payload = {
        "bank_name": "BCA",
        "account_number": f"223344{marker[-4:]}",
        "account_holder": "PRD CreativeAI",
        "pro_price": 99000,
        "instructions": "Default duration check",
    }
    default_res = api_client.put(
        f"{base_url}/api/admin/payment-settings",
        headers=auth_headers(credentials["admin_token"]),
        json=default_payload,
    )
    assert default_res.status_code == 200
    assert default_res.json()["pro_duration_days"] == 30
    test_ctx["expected_duration"] = 30


def test_regular_can_submit_once_and_second_pending_is_blocked(api_client: requests.Session, base_url: str, test_ctx: dict[str, Any], credentials: dict[str, str]) -> None:
    # Submission + one-pending-only rule checks
    make_free = api_client.put(
        f"{base_url}/api/admin/users/{credentials['regular_user_id']}",
        headers=auth_headers(credentials["admin_token"]),
        json={"plan": "free", "suspended": False},
    )
    assert make_free.status_code == 200
    assert make_free.json()["plan"] == "free"

    first_payload = {
        "sender_name": "TEST Sender",
        "sender_bank": "BCA",
        "transfer_reference": f"REGRESSION-{int(time.time())}",
        "transfer_at": datetime.now(timezone.utc).date().isoformat(),
        "notes": "pytest submission",
    }
    first_submit = api_client.post(
        f"{base_url}/api/payments/manual",
        headers=auth_headers(credentials["regular_token"]),
        json=first_payload,
    )
    assert first_submit.status_code == 200
    first_data = first_submit.json()
    assert first_data["status"] == "pending"
    assert isinstance(first_data["payment_id"], str)
    assert first_data["payment_id"].startswith("pay_")
    test_ctx["payment_id"] = first_data["payment_id"]

    second_payload = {
        "sender_name": "TEST Sender 2",
        "sender_bank": "BNI",
        "transfer_reference": f"REGRESSION-SECOND-{int(time.time())}",
        "transfer_at": datetime.now(timezone.utc).date().isoformat(),
        "notes": "must fail",
    }
    second_submit = api_client.post(
        f"{base_url}/api/payments/manual",
        headers=auth_headers(credentials["regular_token"]),
        json=second_payload,
    )
    assert second_submit.status_code == 409
    assert "menunggu verifikasi" in second_submit.json().get("detail", "").lower()


def test_admin_can_review_pending_and_approval_upgrades_user(api_client: requests.Session, base_url: str, test_ctx: dict[str, Any], credentials: dict[str, str]) -> None:
    # Review flow + user plan upgrade checks
    payment_id = test_ctx.get("payment_id")
    assert payment_id

    all_payments = api_client.get(f"{base_url}/api/admin/payments", headers=auth_headers(credentials["admin_token"]))
    assert all_payments.status_code == 200
    items = all_payments.json()
    target = next((p for p in items if p["payment_id"] == payment_id), None)
    assert target is not None
    assert target["status"] == "pending"

    approve = api_client.put(
        f"{base_url}/api/admin/payments/{payment_id}",
        headers=auth_headers(credentials["admin_token"]),
        json={"status": "approved"},
    )
    assert approve.status_code == 200
    approved = approve.json()
    assert approved["status"] == "approved"
    assert approved["reviewed_by"]
    assert isinstance(approved.get("pro_expires_at"), str)

    me = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers(credentials["regular_token"]))
    assert me.status_code == 200
    me_data = me.json()
    assert me_data["plan"] == "pro"
    assert isinstance(me_data.get("pro_expires_at"), str)

    limits = api_client.get(f"{base_url}/api/me/limits", headers=auth_headers(credentials["regular_token"]))
    assert limits.status_code == 200
    limits_data = limits.json()
    assert limits_data["plan"] == "pro"
    assert limits_data["max_projects"] is None
    assert limits_data["monthly_generations"] is None


def test_user_payment_history_shows_final_status(api_client: requests.Session, base_url: str, test_ctx: dict[str, Any], credentials: dict[str, str]) -> None:
    # History status consistency checks
    payment_id = test_ctx.get("payment_id")
    assert payment_id

    history = api_client.get(f"{base_url}/api/payments/my", headers=auth_headers(credentials["regular_token"]))
    assert history.status_code == 200
    records = history.json()
    target = next((p for p in records if p["payment_id"] == payment_id), None)
    assert target is not None
    assert target["status"] == "approved"
    assert target["plan"] == "pro"
    assert target["bank_snapshot"]["pro_duration_days"] == test_ctx["expected_duration"]
