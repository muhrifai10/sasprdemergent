import os
import uuid
import asyncio
import logging
import re
import hashlib
import hmac
from base64 import urlsafe_b64encode
from collections import Counter
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from cryptography.fernet import Fernet, InvalidToken
from templates_data import TEMPLATES

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
except ImportError:
    LlmChat = UserMessage = TextDelta = StreamDone = None

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
AI_PROVIDER = os.environ.get('AI_PROVIDER', 'openai')
AI_MODEL = os.environ.get('AI_MODEL', 'gpt-5.4')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_MODEL = os.environ.get('GROQ_MODEL', 'openai/gpt-oss-120b')
GROQ_BASE_URL = os.environ.get('GROQ_BASE_URL', 'https://api.groq.com/openai/v1')
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
DEEPSEEK_MODEL = os.environ.get('DEEPSEEK_MODEL', 'deepseek-v4-flash')
DEEPSEEK_BASE_URL = os.environ.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
VYCEAI_API_KEY = os.environ.get('VYCEAI_API_KEY', '')
VYCEAI_MODEL = os.environ.get('VYCEAI_MODEL', 'gpt-5.6-luna')
VYCEAI_MODELS = [VYCEAI_MODEL] + [
    model.strip() for model in os.environ.get('VYCEAI_MODELS', '').split(',')
    if model.strip() and model.strip() != VYCEAI_MODEL
]
VYCEAI_BASE_URL = os.environ.get('VYCEAI_BASE_URL', 'https://vyceai.com/v1')
OPENAGENTIC_API_KEY = os.environ.get('OPENAGENTIC_API_KEY', '')
OPENAGENTIC_MODEL = os.environ.get('OPENAGENTIC_MODEL', 'ox-alpha-free')
OPENAGENTIC_MODELS = list(dict.fromkeys([OPENAGENTIC_MODEL] + [
    model.strip() for model in os.environ.get('OPENAGENTIC_MODELS', '').split(',') if model.strip()
]))
OPENAGENTIC_BASE_URL = os.environ.get('OPENAGENTIC_BASE_URL', 'https://openagentic.id/api/v1')
ZAI_API_KEY = os.environ.get('ZAI_API_KEY', '')
ZAI_MODEL = os.environ.get('ZAI_MODEL', '')
ZAI_BASE_URL = os.environ.get('ZAI_BASE_URL', '')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENROUTER_MODEL = os.environ.get('OPENROUTER_MODEL', 'deepseek/deepseek-chat')
OPENROUTER_BASE_URL = os.environ.get('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
NINEROUTER_API_KEY = os.environ.get('NINEROUTER_API_KEY', '')
NINEROUTER_MODEL = os.environ.get('NINEROUTER_MODEL', 'Gemini')
NINEROUTER_BASE_URL = os.environ.get('NINEROUTER_BASE_URL', 'http://localhost:20128/v1')
MIDTRANS_SERVER_KEY = os.environ.get('MIDTRANS_SERVER_KEY', '')
MIDTRANS_CLIENT_KEY = os.environ.get('MIDTRANS_CLIENT_KEY', '')
MIDTRANS_IS_PRODUCTION = os.environ.get('MIDTRANS_IS_PRODUCTION', 'false').lower() == 'true'
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()]

PLANS = {
    "free": {"name": "Free", "max_projects": 1, "generation_limits": {"prd": 1, "agent_prompt": 1}, "research": False},
    "pro": {"name": "Pro", "max_projects": 20, "generation_limits": {"prd": 20, "agent_prompt": 20}, "research": True},
    "enterprise": {"name": "Enterprise", "max_projects": None, "generation_limits": None, "research": True},
}

AUTH_API = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
# ponytail: same-site (localhost) dev over plain HTTP needs secure=False; set COOKIE_SECURE=true in real HTTPS prod.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax")
BRANDING_SETTINGS_ID = "site-branding"
AI_PROVIDER_SETTINGS_ID = "ai-provider-settings"
AI_PROVIDER_NAMES = ("deepseek", "openrouter", "9router", "groq", "vyceai", "openagentic", "zai")
AI_PROVIDER_LABELS = {
    "deepseek": "DeepSeek",
    "openrouter": "OpenRouter",
    "9router": "9router",
    "groq": "Groq",
    "vyceai": "VyceAI",
    "openagentic": "OpenAgentic",
    "zai": "Z.ai",
}
ALLOWED_LOGO_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
MAX_LOGO_BYTES = 2 * 1024 * 1024

app = FastAPI()
api_router = APIRouter(prefix="/api")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None


class SessionRequest(BaseModel):
    session_id: str


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    product_type: str = ""
    target_users: str = ""
    business_goal: str = ""
    main_problem: str = ""
    desired_features: str = ""
    preferred_technology: str = ""
    design_preference: str = ""
    auth_requirement: str = ""
    payment_requirement: str = ""
    integrations: str = ""
    deployment_preference: str = ""
    additional_requirements: str = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    product_type: Optional[str] = None
    target_users: Optional[str] = None
    business_goal: Optional[str] = None
    main_problem: Optional[str] = None
    desired_features: Optional[str] = None
    preferred_technology: Optional[str] = None
    design_preference: Optional[str] = None
    auth_requirement: Optional[str] = None
    payment_requirement: Optional[str] = None
    integrations: Optional[str] = None
    deployment_preference: Optional[str] = None
    additional_requirements: Optional[str] = None


class GenerateRequest(BaseModel):
    language: str = "id"


class PrdUpdate(BaseModel):
    content: str


class ShareToggle(BaseModel):
    enabled: bool


class AdminUserUpdate(BaseModel):
    plan: Optional[str] = None
    role: Optional[str] = None
    suspended: Optional[bool] = None


class AIProviderSettingsUpdate(BaseModel):
    active_provider: str = Field(min_length=1, max_length=30)
    target_provider: Optional[str] = None
    api_key: Optional[str] = Field(default=None, max_length=500)
    model: Optional[str] = Field(default=None, max_length=200)
    clear_api_key: bool = False


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    tagline: str = ""
    icon: str = "sparkles"
    prefill: dict = {}


class ManualPaymentSettingsUpdate(BaseModel):
    bank_name: str = Field(min_length=1, max_length=80)
    account_number: str = Field(min_length=1, max_length=80)
    account_holder: str = Field(min_length=1, max_length=120)
    pro_price: int = Field(ge=0)
    pro_duration_days: int = Field(default=30, ge=1, le=3650)
    instructions: str = Field(default="", max_length=1000)


class PaymentPricingUpdate(BaseModel):
    pro_price: int = Field(ge=1)
    pro_duration_days: int = Field(default=30, ge=1, le=3650)


class ManualPaymentSubmission(BaseModel):
    sender_name: str = Field(min_length=1, max_length=120)
    sender_bank: str = Field(default="", max_length=80)
    transfer_reference: str = Field(default="", max_length=160)
    transfer_at: str = Field(min_length=1, max_length=40)
    notes: str = Field(default="", max_length=1000)


class PaymentReview(BaseModel):
    status: str
    rejection_reason: str = Field(default="", max_length=500)


class BrandingResponse(BaseModel):
    logo_url: Optional[str] = None


class MidtransNotification(BaseModel):
    order_id: str
    transaction_status: str
    status_code: str
    gross_amount: str
    signature_key: str
    fraud_status: Optional[str] = None


# ---------- Auth ----------
def get_session_token(request: Request) -> str:
    token = request.cookies.get("session_token")
    if token:
        return token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    raise HTTPException(status_code=401, detail="Not authenticated")


def as_utc_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


async def ensure_active_plan(user: dict) -> dict:
    if user.get("plan") != "pro" or not user.get("pro_expires_at"):
        return user
    if as_utc_datetime(user["pro_expires_at"]) > datetime.now(timezone.utc):
        return user
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"plan": "free"}, "$unset": {"pro_expires_at": ""}},
    )
    user["plan"] = "free"
    user.pop("pro_expires_at", None)
    return user


async def get_current_user(request: Request) -> dict:
    token = get_session_token(request)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    if as_utc_datetime(session["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("suspended"):
        raise HTTPException(status_code=403, detail="Account suspended")
    return await ensure_active_plan(user)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@api_router.post("/auth/session")
async def create_session(body: SessionRequest, response: Response):
    async with httpx.AsyncClient() as hc:
        resp = await hc.get(AUTH_API, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session id")
    data = resp.json()
    is_admin = data["email"].lower() in ADMIN_EMAILS
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        updates = {"name": data.get("name", ""), "picture": data.get("picture")}
        if is_admin:
            updates["role"] = "admin"
        await db.users.update_one({"user_id": user_id}, {"$set": updates})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": data["email"],
            "name": data.get("name", ""),
            "picture": data.get("picture"),
            "role": "admin" if is_admin else "user",
            "plan": "free",
            "suspended": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(
        key="session_token", value=session_token, httponly=True,
        secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, path="/", max_age=7 * 24 * 3600,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Projects ----------
def project_context(p: dict) -> str:
    fields = [
        ("Project Name", p.get("name")),
        ("Description", p.get("description")),
        ("Product Type", p.get("product_type")),
        ("Target Users", p.get("target_users")),
        ("Business Goal", p.get("business_goal")),
        ("Main Problem", p.get("main_problem")),
        ("Desired Features", p.get("desired_features")),
        ("Preferred Technology", p.get("preferred_technology")),
        ("Design Preference", p.get("design_preference")),
        ("Authentication Requirement", p.get("auth_requirement")),
        ("Payment Requirement", p.get("payment_requirement")),
        ("Third-party Integrations", p.get("integrations")),
        ("Deployment Preference", p.get("deployment_preference")),
        ("Additional Requirements", p.get("additional_requirements")),
    ]
    return "\n".join(f"- {k}: {v}" for k, v in fields if v)


def canonical_project_decisions(p: dict) -> str:
    """Deterministic per-project frozen spec, derived only from the user's
    explicit inputs. Every section must read and reuse these exact values so a
    new project never drifts or inherits decisions from a previous one.

    ponytail: extraction is deterministic (no LLM) so it adds no latency and
    can never invent a decision — only fields the user actually filled appear.
    """
    lines: list[str] = []
    tech = p.get("preferred_technology")
    auth = p.get("auth_requirement")
    pay = p.get("payment_requirement")
    integ = p.get("integrations")
    deploy = p.get("deployment_preference")
    ttype = p.get("product_type")
    users = p.get("target_users")
    goal = p.get("business_goal")
    if tech:
        lines.append(f"- Technology (frozen): {tech}")
    if auth:
        lines.append(f"- Authentication (frozen): {auth}")
    if pay:
        lines.append(f"- Payment (frozen): {pay}")
    if integ:
        lines.append(f"- Integrations (frozen): {integ}")
    if deploy:
        lines.append(f"- Deployment (frozen): {deploy}")
    if ttype:
        lines.append(f"- Product type (frozen): {ttype}")
    if users:
        lines.append(f"- Target users (frozen): {users}")
    if goal:
        lines.append(f"- Business goal (frozen): {goal}")
    if not lines:
        lines.append("- Canonical spec: none explicitly stated; derive from description with safe defaults, do NOT invent.")
    return "\n".join(lines)


@api_router.post("/projects")
async def create_project(body: ProjectCreate, user: dict = Depends(get_current_user)):
    plan = PLANS.get(user.get("plan", "free"), PLANS["free"])
    if plan["max_projects"] is not None:
        count = await db.projects.count_documents({"user_id": user["user_id"]})
        if count >= plan["max_projects"]:
            raise HTTPException(status_code=403, detail=f"Batas plan {plan['name']} tercapai ({plan['max_projects']} project). Upgrade untuk project tanpa batas.")
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "prd_status": "none",
        "prompt_status": "none",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    return await db.projects.find({"user_id": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)


@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    p = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.projects.update_one({"id": project_id, "user_id": user["user_id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return await db.projects.find_one({"id": project_id, "user_id": user["user_id"]}, {"_id": 0})


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    result = await db.projects.delete_one({"id": project_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.prd_documents.delete_many({"project_id": project_id})
    await db.ai_prompts.delete_many({"project_id": project_id})
    return {"ok": True}


@api_router.get("/stats")
async def get_stats(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    total_projects = await db.projects.count_documents({"user_id": uid})
    total_prds = await db.prd_documents.count_documents({"user_id": uid})
    total_prompts = await db.ai_prompts.count_documents({"user_id": uid})
    total_generations = await db.usage_records.count_documents({"user_id": uid})
    recent = await db.projects.find({"user_id": uid}, {"_id": 0}).sort("updated_at", -1).to_list(5)
    return {
        "total_projects": total_projects,
        "total_prds": total_prds,
        "total_prompts": total_prompts,
        "total_generations": total_generations,
        "recent_projects": recent,
    }


# ---------- AI Generation ----------
PRD_SYSTEM = """You are a senior product manager, solution architect, and technical writer creating a production-ready PRD for a GREENFIELD application.
Write clean, precise Markdown that a coding agent can implement without guessing.

Quality contract:
- Treat the user's project requirements as the source of truth. Do not invent major features, integrations, roles, or infrastructure that are not requested. If a capability is out of scope, say so explicitly.
- Make one canonical technical decision for authentication, database, backend, frontend, deployment, payments, and AI provider. Never mix alternatives such as Stripe and Midtrans, PostgreSQL and MongoDB, or Next.js and React CRA in the implementation plan.
- If a required choice is missing, choose one reasonable default, use it consistently in every section, and record the decision and reason in Section 14. Only mark an item unresolved when implementation truly cannot proceed without the user's answer.
- Keep a traceable chain: every functional requirement must map to a page/state, data entity, API or service behavior, acceptance test, and delivery phase. Do not reference tables, endpoints, roles, or services that are not defined elsewhere.
- Define the MVP boundary clearly. Put optional future ideas under Non-Goals or Future Enhancements, not inside mandatory requirements.
- Use concrete field names, types, validation rules, status transitions, permissions, error behavior, and success criteria. Avoid vague words such as 'manage' or 'seamless'.
- For AI generation, define one provider abstraction, one primary configuration, and an explicit fallback policy. Never put API keys in frontend code.
- For asynchronous or streaming work, describe the job lifecycle, polling/streaming endpoint, persistence, retry, timeout, and reconnect behavior consistently.
- Never use placeholder text such as TBD, lorem ipsum, or fake secrets. Use <server-secret> only in example environment variables.

Mandatory canonical MVP decisions for this greenfield product:
- The PRD describes the user's product exactly as specified, honoring every explicitly requested technology, database, payment gateway, auth method, and role. Do not substitute a different stack.
- If a required choice was not specified, pick ONE reasonable default, use it consistently, and record the decision and reason in Section 14. Never mix alternatives.
- Define the MVP boundary around only what the user requested; put optional ideas under Non-Goals or Future Enhancements.
- Do not describe this PRD-writing application, the generation tooling, or any meta-layer. The document is only about the user's business.
- Only invent features, roles, entities, or integrations the user's requirements genuinely imply; otherwise mark them out of scope.
- Never use placeholder text such as TBD, lorem ipsum, or fake secrets. Use <server-secret> only in example environment variables.

Output only the requested 14-section PRD in clean Markdown."""

PRD_SECTIONS = """## 1. Product Overview
## 2. Problem, Goals, and Non-Goals
## 3. Users, Roles, and Core Journeys
## 4. Functional Requirements and User Stories
## 5. UX, Pages, and Interaction States
## 6. Data Model and Database Schema
## 7. API Specification
## 8. Authentication, Authorization, and Security
## 9. Integrations, Payments, and Notifications
## 10. Tech Stack and System Architecture
## 11. Validation, Errors, and Observability
## 12. Testing and Acceptance Criteria
## 13. Delivery Plan and Environment
## 14. Assumptions and Decisions"""

REQUIRED_PRD_HEADINGS = [line.strip() for line in PRD_SECTIONS.splitlines() if line.strip()]

PRD_SECTION_GUIDANCE = {
    "## 1. Product Overview": "Define the product, target outcome, scope, and one concrete success metric.",
    "## 2. Problem, Goals, and Non-Goals": "State the problem, measurable goals, constraints, and explicit non-goals.",
    "## 3. Users, Roles, and Core Journeys": "List user roles, permissions, and step-by-step happy paths plus important alternate paths.",
    "## 4. Functional Requirements and User Stories": "List numbered requirements with inputs, rules, outputs, and user stories. Avoid vague words such as manage without explaining behavior.",
    "## 5. UX, Pages, and Interaction States": "Specify every page URL, role, layout, components, forms, validation, loading, empty, error, success, and responsive states.",
    "## 6. Data Model and Database Schema": "Define each entity, fields, types, required/nullability, defaults, indexes, relations, ON DELETE behavior, and lifecycle rules in markdown tables. Use the entities the user's product actually needs.",
    "## 7. API Specification": "Define each endpoint separately with method, URL, auth, request schema, validation, success response, error responses, and side effects. Only include the routes the product needs.",
    "## 8. Authentication, Authorization, and Security": "Define login/session flow, roles, authorization rules, secret handling, input validation, and security controls, based on the auth approach actually chosen for the product.",
    "## 9. Integrations, Payments, and Notifications": "List external services, triggers, payloads, retry/failure behavior, payment states, and notification events. State not required when applicable.",
    "## 10. Tech Stack and System Architecture": "Choose concrete frontend/backend/database/deployment technologies and describe module boundaries and data flow, based on the stack actually chosen for the product.",
    "## 11. Validation, Errors, and Observability": "Define business validation, user-facing errors, logging fields, monitoring signals, and recovery behavior.",
    "## 12. Testing and Acceptance Criteria": "Give test cases and objective Given/When/Then acceptance criteria for every critical flow.",
    "## 13. Delivery Plan and Environment": "Define the implementation phases in a sensible order, then environment variables, local setup, deployment, and definition of done.",
    "## 14. Assumptions and Decisions": "List every assumption and decision that prevents an AI coding agent from guessing. Mark unresolved items explicitly.",
}


def validate_prd_content(content: str) -> None:
    headings = [
        re.sub(r"\s+", " ", line.strip())
        for line in content.splitlines()
        if re.match(r"^##\s+\d+\.\s+", line.strip())
    ]
    wrong_level = [
        line.strip() for line in content.splitlines()
        if re.match(r"^#{3,6}\s+\d+\.\s+", line.strip())
        and re.sub(r"^#{3,6}", "##", line.strip()) in REQUIRED_PRD_HEADINGS
    ]
    counts = Counter(headings)
    missing = [heading for heading in REQUIRED_PRD_HEADINGS if counts[heading] == 0]
    duplicates = [heading for heading in REQUIRED_PRD_HEADINGS if counts[heading] > 1]
    matched = [heading for heading in headings if heading in REQUIRED_PRD_HEADINGS]
    unexpected = [heading for heading in headings if heading not in REQUIRED_PRD_HEADINGS]
    errors = []
    if missing:
        errors.append("missing: " + ", ".join(missing))
    if duplicates:
        errors.append("duplicate: " + ", ".join(duplicates))
    if not missing and matched != REQUIRED_PRD_HEADINGS:
        errors.append("sections are out of order")
    if unexpected:
        errors.append("unexpected: " + ", ".join(unexpected))
    if wrong_level:
        errors.append("numbered sections must use ## exactly once: " + ", ".join(wrong_level))
    if errors:
        raise ValueError("PRD validation failed: " + "; ".join(errors))


def strip_prd_contract_markers(content: str) -> str:
    for marker in (
        "DELETE_TEMPLATE_EFFECT: DEACTIVATE_ONLY",
        "USAGE_LOG_CARDINALITY: ONE_FINAL_LOG_PER_JOB",
        "USAGELOG_NULLABLE_FIELDS: jobId, documentId",
    ):
        content = re.sub(re.escape(marker), "", content, flags=re.IGNORECASE)
    return re.sub(r"\n{3,}", "\n\n", content).strip()


def validate_prd_consistency(content: str) -> None:
    """Structural completeness for any user project (generator-agnostic).

    The PRD must contain all 14 required headings, number functional requirements
    as FR-N, reference them elsewhere, and give non-trivial bodies to the schema,
    API, auth, and security sections. This no longer demands the generator's own
    stack/entities, so it won't reject a real user product (e.g. Laravel + MySQL
    + Midtrans) for lacking Next.js/GenerationJob/UsageLog vocabulary.
    """
    validate_prd_content(content)
    sections = {}
    matches = list(re.finditer(r"^##\s+\d+\.\s+.*$", content, re.MULTILINE))
    for index, match in enumerate(matches):
        heading = re.sub(r"\s+", " ", match.group().strip())
        end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        sections[heading] = content[match.end():end].strip()

    def body_of(prefix):
        return next((v for h, v in sections.items() if h.startswith(prefix)), "")

    missing = []
    section4 = body_of("## 4. Functional Requirements")
    if len(section4.split()) < 20:
        missing.append("Section 4: functional requirements not fleshed out")

    minimum = {
        "## 6. Data Model and Database Schema": ("data model", "entity", "table", "field", "kolom", "schema"),
        "## 7. API Specification": ("api", "endpoint", "route", "http", "get ", "post "),
        "## 8. Authentication, Authorization, and Security": ("auth", "login", "password", "role", "session", "token"),
    }
    for heading, terms in minimum.items():
        b = body_of(heading)
        if not any(t in b.lower() for t in terms):
            missing.append(f"{heading}: missing core content")

    if "[image" in content.lower() or "lorem" in content.lower() or "tbd" in content.lower():
        missing.append("placeholder text present")

    if missing:
        raise ValueError("PRD consistency validation failed: " + ", ".join(missing))


# ---------- Deterministic Contradiction Detection ----------
# ponytail: regex/heuristic checks only. Detects the concrete contradictions a
# coding agent would hit (DB type vs API type, guest checkout vs required user,
# webhook count, conflicting status vocabulary, DB-family vs deployment). No LLM
# call, no state machine solver. Upgrade to a full parser only if these heuristics
# miss real cases. Never blocks on a "wrong" heuristic: only CRITICAL/HIGH block.
def analyze_prd_consistency(content: str) -> dict:
    text = content
    lowered = content.lower()
    critical: list[str] = []
    high: list[str] = []
    medium: list[str] = []
    low: list[str] = []

    def section_body(prefix: str) -> str:
        idx = text.find(prefix)
        if idx < 0:
            return ""
        nxt = text.find("## ", idx + len(prefix))
        return text[idx:nxt if nxt >= 0 else len(text)]

    db = section_body("## 6. Data Model and Database Schema")
    api = section_body("## 7. API Specification")
    journey = section_body("## 3. Users, Roles, and Core Journeys")
    tech = section_body("## 10. Tech Stack and System Architecture")
    integrations = section_body("## 9. Integrations, Payments, and Notifications")

    db_l = db.lower()
    api_l = api.lower()

    # 1. DB family vs deployment contradiction (PostgreSQL vs MySQL).
    db_family = next((f for f in ("postgresql", "postgres", "mysql", "mariadb", "mongodb", "sqlite") if f in db_l), None)
    deploy_family = next((f for f in ("postgresql", "postgres", "mysql", "mariadb", "mongodb", "sqlite") if f in tech.lower() and f != db_family), None)
    if db_family and deploy_family:
        critical.append(f"Database uses {db_family} but architecture/deployment references {deploy_family}")

    # 2. DB id type mismatch: numeric BIGINT/INT id vs UUID used by API.
    id_numeric = re.search(r"\b(id|_id|Id)\b[^|]*\b(bigint|int|integer)\b", db, re.IGNORECASE)
    uuid_used = re.search(r"\buuid\b", api + "\n" + tech, re.IGNORECASE)
    if id_numeric and uuid_used:
        critical.append("Database primary key uses BIGINT/INT but API references UUID identifiers")

    # 3. Guest checkout vs required user FK.
    guest_allowed = re.search(r"\bguest\b", lowered) or re.search(r"\bguest\s*(checkout|order)\b", journey.lower())
    user_not_null = re.search(r"(user_id|userId|user id)\b[^|]*\b(not null|required|mandatory|wajib)\b", db, re.IGNORECASE)
    if guest_allowed and user_not_null:
        high.append("Guest checkout is allowed but the order/payment requires a non-null user_id")

    # 3b. Checkout/Order page marked PUBLIC but order API requires auth (Model A/B mixed).
    def section_has_public(prefix: str) -> bool:
        return re.search(r"\b(public|publik)\b", section_body(prefix), re.IGNORECASE) is not None
    ux_pages = section_body("## 5. UX, Pages, and Interaction States")
    public_checkout_page = re.search(r"\b(public|publik)\b", ux_pages, re.IGNORECASE) and re.search(r"\b(checkout|order)\b", ux_pages, re.IGNORECASE)
    order_api_auth = re.search(r"(/api/orders|create order|POST /orders|/checkout)\b[^|]*\b(requires?\s+(auth|bearer|jwt|login)|auth(entication|orization)?\s+required|bearer\s+(jwt\s+)?token\s+required|login\s+(required|mandatory)|(auth\s+required))\b", api, re.IGNORECASE)
    if public_checkout_page and (order_api_auth or user_not_null):
        high.append("Checkout/Order pages marked PUBLIC but order creation requires authentication and/or a non-null user_id")

    # 4. Webhook endpoint count: only conflict if more than one distinct webhook URL.
    webhook_urls = set(re.findall(r"(?:https?://[^\s`\"')]+/webhook[^\s`\"')]*)", lowered, re.IGNORECASE))
    # fallback: count distinct "webhook" path mentions with different names
    webhook_names = set(re.findall(r"/webhook/([a-z0-9_-]+)", lowered, re.IGNORECASE))
    if len(webhook_names) > 1 or len(webhook_urls) > 1:
        high.append(f"Multiple webhook endpoints defined ({len(webhook_names) or len(webhook_urls)} found); choose one canonical webhook")

    # 5. Conflicting status vocabulary (same domain, two words for one state).
    domain = section_body("## 2. Problem, Goals, and Non-Goals") + journey + db
    status_conflicts = []
    for a, b in (("pending", "unpaid"), ("completed", "shipped"), ("cancelled", "canceled"), ("paid", "settlement"), ("failed", "error")):
        if a in domain.lower() and b in domain.lower():
            status_conflicts.append(f"{a}/{b}")
    if status_conflicts:
        medium.append("Possible duplicate status vocabulary: " + ", ".join(status_conflicts))

    # 6. "real-time" claimed without a mechanism.
    if re.search(r"\breal[- ]time\b", lowered) and not re.search(r"\b(websocket|sse|server[- ]sent|polling|_{interval)\b", lowered):
        medium.append("'real-time' is claimed without defining a transport mechanism")

    # 7. Notification mentioned without provider/out-of-scope marker.
    if re.search(r"\b(email|whatsapp|sms|push notification|notifikasi)\b", lowered) and not re.search(r"\b(not required|out of scope|ditangguhkan|di luar|cakupan mvp|n/a)\b", lowered):
        medium.append("Notification mechanism mentioned but not scoped out or given a provider")

    # 8. Mentioned integration missing from integration section.
    named_int = re.findall(r"\b(midtrans|stripe|xendit|paypal|firebase|twilio)\b", journey.lower())
    for name in set(named_int):
        if name not in integrations.lower():
            medium.append(f"Integration '{name}' used in journey but not defined in the integration section")

    # 9. Mixed stock strategy: deduct-at-checkout combined with reserve.
    all_body = section_body("## 2. Problem, Goals, and Non-Goals") + journey + db + api + integrations
    deduct_stock = re.search(r"\b(deduct|reduce|kurangi|decrement|subtract)\w*\b[^.]{0,80}\b(stock|stok|inventory|inventori|qty|kuantitas)\b", all_body, re.IGNORECASE) or re.search(r"\b(stock|stok|inventory|inventori)\b[^.]{0,80}\b(deduct|reduce|kurangi|decrement|subtract)\w*\b", all_body, re.IGNORECASE)
    reserve_stock = re.search(r"\b(reserve|reservation|reservasi|locked|lock)\w*\b[^.]{0,80}\b(stock|stok|inventory|inventori)\b", all_body, re.IGNORECASE) or re.search(r"\b(stock|stok|inventory|inventori)\b[^.]{0,80}\b(reserve|reservation|reservasi|locked)\w*\b", all_body, re.IGNORECASE)
    if deduct_stock and reserve_stock:
        high.append("Mixed stock strategy: deduct-at-checkout combined with reservation; pick one mechanism")
    # 10. Inventory strategy ambiguous ("deduct at checkout or at payment").
    if re.search(r"\b(deduct|reduce|kurangi|decrement|subtract)\w*\b[^.]{0,80}\b(atau|or)\b[^.]{0,40}\b(payment|paid|bayar|checkout)\b", all_body, re.IGNORECASE):
        medium.append("Stock deduction strategy is ambiguous ('deduct at checkout or at payment'); define a single mechanism")

    # 11. Order status consistency: reject non-canonical order statuses.
    db_schema_l = db.lower()
    has_order_entity = re.search(r"(order|orders|pesanan)\b", db_schema_l) and re.search(r"(status)\b[^.]{0,80}(enum|enum\()", db_schema_l, re.IGNORECASE)
    # Find status tokens that look like order states but are not in the canonical set.
    non_canonical = ("failed", "complete", "completed", "unpaid", "refund", "refunded", "delivering", "return", "returned")
    present_non_canonical = [s for s in non_canonical if has_order_entity and re.search(rf"\b{s}\b", db_schema_l, re.IGNORECASE)]
    if present_non_canonical:
        high.append(f"Non-canonical order status used in schema: {', '.join(present_non_canonical)}; use PENDING/PAID/PROCESSING/SHIPPED/DELIVERED/CANCELLED/EXPIRED")
    # Canonical set present in this PRD at all? Recommend the state machine is documented.
    canonical = ("pending", "paid", "processing", "shipped", "delivered", "cancelled", "expired")
    present_canonical = [s for s in canonical if re.search(rf"\b{s}\b", db_schema_l, re.IGNORECASE)]
    if has_order_entity and not present_canonical:
        medium.append("No canonical order status (PENDING/PAID/PROCESSING/SHIPPED/DELIVERED/CANCELLED/EXPIRED) found in schema")

    # 12. Order detail access control: public order detail via numeric id without a token => enumeration risk.
    ux_l = section_body("## 5. UX, Pages, and Interaction States").lower()
    public_order = re.search(r"/orders\s*/\s*\{?id\}?\b[^.]{0,60}\b(public|publik)\b", ux_l, re.IGNORECASE) or re.search(r"(public|publik)\b[^.]{0,60}/orders\s*/\s*\{?id\}?\b", ux_l, re.IGNORECASE)
    has_public_token = re.search(r"public_order_token|order_token", lowered, re.IGNORECASE) or re.search(r"/orders\s*/\s*\{?order_token\}?", ux_l, re.IGNORECASE)
    numeric_id = re.search(r"\b(id|order_id)\b[^.|]{0,60}\b(bigint|int|integer|auto_increment|increment|unsigned)\b", db, re.IGNORECASE) or re.search(r"order.*?(id|PK|primary key)", db_l, re.IGNORECASE)
    owner_auth_exists = re.search(r"(only|owner|milik)\b[^.]{0,60}\b(auth|login|user_id|bearer|jwt)\b", lowered, re.IGNORECASE)
    if public_order and not has_public_token and not owner_auth_exists:
        high.append("Order detail is PUBLIC by numeric id with no public token and no owner authorization (enumeration risk); use /orders/{public_order_token} or owner-only auth")
    elif public_order and not has_public_token and numeric_id:
        high.append("Order detail is PUBLIC but accessed by a guessable id; no public_order_token defined")
    if not public_order and re.search(r"/orders\s*/\s*\{?id\}?", ux_l, re.IGNORECASE) and not owner_auth_exists and not has_public_token:
        medium.append("Order detail route defined but its access control (owner auth or public token) is not specified")

    # 13. Authentication consistency: session-cookie + raw Bearer JWT for the same API without linking them.
    auth_sec = section_body("## 8. Authentication, Authorization, and Security") + section_body("## 7. API Specification")
    session_cookie = re.search(r"\b(session cookie|httpOnly|http-only|secure cookie|samesite|session strategy)\w*\b", auth_sec, re.IGNORECASE)
    # Positive Bearer requirement: ignore negations like "tanpa/no/without Bearer token".
    bearer = re.search(r"\b(Authorization:\s*Bearer|Bearer\s+JWT|bearer token|Authorization header)\b", auth_sec, re.IGNORECASE)
    if bearer:
        ctx = auth_sec[max(0, bearer.start() - 40):bearer.end() + 40].lower()
        if re.search(r"\b(tanpa|tidak|bukan|no |without|not |nie)\s", ctx):
            bearer = None
    nextauth = re.search(r"\b(nextauth|next-auth|laravel breeze|auth.js)\b", auth_sec, re.IGNORECASE)
    # A Bearer header is legitimate only if it is explained as the same identity as the session/token issuer.
    explains_legacy = re.search(r"\b(issuer|issued|same|from the session|token issuer|signed JWT|verify signature|obtained from)\b", auth_sec, re.IGNORECASE)
    if bearer and session_cookie and not explains_legacy:
        high.append("Authentication is inconsistent: uses a session cookie AND a raw 'Authorization: Bearer JWT' for the same API without linking them; pick one or explain issuance/validation")
    if nextauth and bearer and not session_cookie and not explains_legacy:
        medium.append("NextAuth session and a separate Bearer JWT coexist but are not connected by an issuer/validation rule")

    # 14. Infrastructure consistency: two alternatives for one concern, or DB vs deployment provider conflict.
    db_low = lowered
    # DB provider used in tech stack vs database section.
    db_alt = re.search(r"(supabase\s*/\s*neon|neon\s*/\s*supabase|vercel\s*/\s*heroku|heroku\s*/\s*vercel|railway\s*/\s*render|render\s*/\s*railway|s3\s*/\s*cloudinary|cloudinary\s*/\s*s3)", db_low, re.IGNORECASE)
    if db_alt:
        medium.append(f"Infrastructure gives two alternatives for one concern: '{db_alt.group(0)}'; pick one provider")
    # DB family across tech vs deployment.
    tech_section = section_body("## 10. Tech Stack and System Architecture")
    deploy_section = section_body("## 13. Delivery Plan and Environment")
    tech_family = next((f for f in ("postgresql", "postgres", "mysql", "mariadb", "mongodb", "supabase", "neon") if re.search(rf"\b{f}\b", tech_section, re.IGNORECASE)), None)
    deploy_family = next((f for f in ("postgresql", "postgres", "mysql", "mariadb", "mongodb", "supabase", "neon") if re.search(rf"\b{f}\b", deploy_section, re.IGNORECASE)), None)
    if tech_family and deploy_family and tech_family != deploy_family and not re.search(r"selection criteria|fallback|^or$|alternate", deploy_section, re.IGNORECASE):
        high.append(f"Database provider differs between tech stack ({tech_family}) and deployment section ({deploy_family}); pick one")

    # 15. Canonical numeric values: same named business constant with two different numbers.
    numbers = {}
    for name in re.findall(r"\b([A-Z][A-Z0-9_]{2,}(?:_RADIUS|_METERS|_METER|_LIMIT|_MAX|_DAYS|_HOURS|_KM|_COUNT))\b", lowered):
        if name.lower() not in numbers:
            numbers[name.lower()] = set()
    # Collect "<value> <unit>" statements tied to a context keyword (radius/limit/duration).
    for match in re.finditer(r"\b(\d+(?:\.\d+)?)\s*(meter|meters?|m\b|km|kilometer|kilometers|menit|minutes?|hari|days?|jam|hours?|detik|seconds?|orang|pax|unit)\b", lowered):
        unit = match.group(2).lower()
        val = match.group(1)
        # Heuristic: same unit appearing with two different magnitudes.
        if unit not in numbers:
            numbers[unit] = set()
        numbers[unit].add(val)
    for key, vals in numbers.items():
        if len(vals) > 1:
            medium.append(f"Numeric business value inconsistent for '{key}': {'/'.join(sorted(vals))}; pick one canonical value")

    # 16. Duplicate config source: business config in DB AND env var with no clear single source of truth.
    env_var = re.search(r"\b(MAX_RADIUS_METERS|RADIUS_METERS|ATTENDANCE_RADIUS|MAX_[A-Z_]+|ADMIN_EDITABLE_[A-Z_]+)\b", lowered, re.IGNORECASE)
    db_config = re.search(r"(radius_meters|latitude|longitude|is_active|active_status|attendance_radius|company_location)\b", db, re.IGNORECASE)
    admin_editable = re.search(r"\b(admin\s+can\s+(edit|change|update|set)|dapat\s+(mengubah|mengedit)|admin\s+editable|configurable by admin)\b", lowered, re.IGNORECASE)
    if db_config and env_var and admin_editable:
        high.append("Business configuration has two sources of truth: a database field and an environment variable, yet admin can edit it; database must be the single source of truth")

    # 17. Canonical route consistency: the same dashboard target named by different routes.
    # Only fires when the doc mixes employee/user/karyawan style dashboard routes.
    route_set = set()
    for m in re.finditer(r"/(?:user|karyawan|employee|admin)/dashboard", lowered):
        route_set.add(m.group(0))
    if len(route_set) > 1:
        medium.append(f"Multiple routes for the same dashboard ({', '.join(sorted(route_set))}); pick one canonical route")

    # 18. Canonical role vocabulary: roles expressed by more than one term.
    role_set = {t for t in ("admin", "superadmin", "employee", "karyawan", "staff", "customer", "member", "user") if re.search(rf"\b{t}\b", journey.lower())}
    # Only warn if the mixed terms are intended for the SAME role (employee vs karyawan vs staff vs user).
    if {"employee", "karyawan", "staff", "user"} <= role_set:
        medium.append("Vocabulary inconsistency: employee/karyawan/staff/user used interchangeably; pick one canonical term")
    if "admin" in role_set and "superadmin" in role_set:
        medium.append("Vocabulary inconsistency: admin/superadmin used interchangeably; pick one canonical role")

    # 19. Cross-term vocabulary (PRESENT vs MASUK) applied to the same concept.
    vocab_pairs = (("present", "masuk"), ("leave", "cuti"), ("kantor", "office"))
    for a, b in vocab_pairs:
        if re.search(rf"\b{a}\b", text.lower()) and re.search(rf"\b{b}\b", text.lower()):
            medium.append(f"Vocabulary inconsistency: '{a}' and '{b}' both used; pick one canonical term")
            break

    # 20. Password hashing algorithm consistency.
    hash_schema = next((h for h in ("argon2id", "argon2", "bcrypt", "bycrypt", "pbkdf2", "scrypt") if re.search(rf"\b{h}\b", db, re.IGNORECASE)), None)
    hash_other = next((h for h in ("argon2id", "argon2", "bcrypt", "bycrypt", "pbkdf2", "scrypt") if re.search(rf"\b{h}\b", text, re.IGNORECASE)), None)
    hash_alt = re.search(r"(argon2id\s*/\s*bcrypt|bcrypt\s*/\s*argon2id|argon2\s*/\s*bcrypt)", lowered, re.IGNORECASE)
    if hash_schema and hash_other and hash_schema != hash_other:
        critical.append(f"Password hashing algorithm inconsistent: schema uses {hash_schema} but other sections use {hash_other}; pick one")
    elif hash_alt:
        critical.append(f"Password hashing algorithm is ambiguous ({hash_alt.group(0)}); pick one canonical algorithm")

    # 21. OAuth account linking rule (same email for password + Google) must be explicit.
    oauth = re.search(r"\b(google oauth|oauth|google login|sign in with google|login with google)\b", lowered, re.IGNORECASE)
    same_email = re.search(r"\b(existing user email = |same email|email matches|email yang sama|same google email)\b", lowered, re.IGNORECASE)
    link_rule = re.search(r"\b(link|link to existing account|reject linking|merge account|duplicate account|tautkan|gabung akun)\b", lowered, re.IGNORECASE)
    if oauth and same_email and not link_rule:
        medium.append("OAuth account linking rule not defined for an existing email; state LINK TO EXISTING ACCOUNT or REJECT LINKING to avoid duplicate accounts")

    critical_count = len(critical)
    high_count = len(high)
    status = "READY FOR IMPLEMENTATION" if critical_count == 0 and high_count == 0 else "NEEDS REVIEW"

    return {
        "id_type": "uuid" if uuid_used else ("int" if id_numeric else None),
        "database_family": db_family,
        "critical": critical,
        "high": high,
        "medium": medium,
        "counts": {
            "critical": critical_count,
            "high": high_count,
            "medium": len(medium),
            "total": critical_count + high_count + len(medium),
        },
        "readiness": status,
    }


PROMPT_SYSTEM = """You create a short, clean Markdown instruction for an AI coding agent.
The agent must build the website from the PRD supplied in the request.
Do not repeat the PRD, invent a file tree, draw ASCII diagrams, or add long architecture details.
Keep the final prompt under 700 words. Use only practical instructions and short bullet lists.
The workflow must be strictly sequential: Frontend, then Backend, then Integration and Testing.
The agent must stop after each phase and write a short completion report before continuing.
Output only the copy-paste-ready prompt."""


CANONICAL_MVP_DECISIONS = """PROJECT FOLLOWING RULES:
- The PRD describes the USER'S product as stated in PROJECT REQUIREMENTS. Do not describe this PRD-writing tool, the generator, or any meta-layer; the document is purely about the user's business.
- Honor every technology, framework, language, database, payment gateway, authentication method, role, and integration that the user explicitly named. If the user said Laravel, MySQL, and Midtrans, use exactly those. Never substitute a different stack.
- If the user left a required choice unspecified (for example no database, auth, or payment gateway named), choose ONE reasonable default, use it consistently everywhere, and record the decision and reason in Section 14. Never mix alternatives such as Stripe and Midtrans, PostgreSQL and MongoDB, or Next.js and React CRA.
- Define the MVP boundary around only what the user asked for. Put optional or future ideas under Non-Goals or Future Enhancements, not inside mandatory requirements.
- Only invent features, roles, entities, or integrations when the user's requirements genuinely imply them; otherwise state them as out of scope.
- Keep a traceable chain: every functional requirement must map to a page/state, data entity, API or service behavior, acceptance test, and delivery phase. Do not reference tables, endpoints, roles, or services that are not defined elsewhere.
- Pick ONE checkout access model and apply it consistently across every section (users/roles, journey, FRs, pages, database, API, auth, security, testing):
  - MODEL A (authenticated checkout): catalog is public; cart, checkout, create-order, and order details all require a logged-in customer; orders.user_id is REQUIRED; POST /api/orders requires authentication. Do NOT mark checkout or order pages as public.
  - MODEL B (guest checkout): catalog, cart, checkout, and create-order are public; orders.user_id is NULLABLE; public order access uses a secure random order token like /orders/{order_token}, never a guessable DB id.
  Choose the model the user's requirement implies. If the requirement is unclear, choose ONE, use it everywhere, and record the choice in Section 14.
- Order detail access control MUST match the chosen checkout model. NEVER expose order detail by a numeric primary key to the public.
  - MODEL A: order detail requires authentication and owner authorization.
    - Route: /orders/{order_id} (internal id is fine).
    - Access: only the logged-in owner from orders.user_id can view; ADMIN can view any order; a customer cannot view another customer's order (403/404). A GET to another customer's order id is DENIED, never a public read of order_id.
  - MODEL B: order detail is public ONLY by an unguessable, non-sequential, high-entropy `public_order_token` that is not the primary key.
    - Route: /orders/{public_order_token}.
    - Store a dedicated public_order_token column (e.g. 128-bit random/URL-safe) distinct from the incremental/numeric order id.
    - There is NO public /orders/{order_id} endpoint; an invalid or unknown token returns 404/denied.
  - Consolidate: never have both an unauthenticated /orders/{numeric_id} and a token route. Pick the token (Model B) or the owner-authenticated route (Model A).
  - Testing/AC must include: customer A opening customer B's order -> DENIED; invalid public token -> NOT FOUND/DENIED; valid token -> GRANTED.
- Use exactly ONE stock/inventory strategy, consistently across every section (journey, FRs, business rules, database lifecycle, API, payment integration, state machine, error handling, recovery, testing, acceptance criteria, decisions). When the product has inventory, use RESERVATION:
  - Stock Strategy = RESERVATION. Checkout atomically reserves stock (locked, not yet sold); payment success commits (converts the reservation into a permanent sale); payment expires/cancelled/denied or order times out releases the reservation.
  - Do NOT also deduct stock at checkout. Do NOT say "deduct at checkout OR reserve at checkout". Never combine two mechanisms.
  - Concurrency: stock reservation must use a database transaction with an atomic conditional update (stock >= requested_quantity check) so two customers cannot reserve the same last unit; the customer losing the race gets a stock-exhausted error.
  - Stock belongs to the product VARIANT (e.g. Kemeja / M-Black), never a generic product-level integer, when the product has size/color/SKU variations. Use same variant identity in database, API, and journey.
- Use exactly ONE canonical ORDER status state machine, consistently across every section (database, API, journey, FRs, UI, admin permissions, business rules, Midtrans mapping, testing, acceptance criteria, delivery plan, DoD). The canonical set is:
  - PENDING → PAID → PROCESSING → SHIPPED → DELIVERED (happy path)
  - PENDING → CANCELLED (cancellation path)
  - PENDING → EXPIRED (expiration path)
  - Meanings: PENDING = created, not yet paid; PAID = payment verified by gateway; PROCESSING = admin/toko processing; SHIPPED = sent; DELIVERED = received; CANCELLED = cancelled; EXPIRED = payment timed out.
  - Do NOT define extra order statuses (e.g. FAILED, COMPLETED, UNPAID, REFUNDED) as order states; payments may fail but order stays PENDING/CANCELLED/EXPIRED per the state machine.
  - Separate ORDER status from PAYMENT status. Gateway values (deny, cancel, expire, failure, settlement, capture, pending) map to payment status, and only translate to order status via the rule: settlement/capture → PAID; no payment → EXPIRED when timed out; denied/expired before payment → EXPIRED; post-paid cancel/refund is out of MVP unless requested.
- Use ONE coherent authentication architecture, consistently across every section (login page, login API, session middleware, API security, frontend session, admin/customer authorization, environment variables, testing). Pick ONCE and describe the full path:
  - SESSION/COOKIE model: Authentication Provider = [user's choice, e.g. NextAuth/Laravel] Credentials; Session Strategy = JWT; Browser Auth = secure httpOnly session cookie; API Authorization = server verifies the session cookie/JWT on every request. The browser NEVER sends a raw Authorization: Bearer header that duplicates the session; the cookie is the credential.
  - If a Bearer token is genuinely required (e.g. third-party API, mobile app), define it explicitly and link it to the same identity: token issuer = same auth server; format = signed JWT; validation = verify signature + claims + expiry on the API; lifetime = e.g. 7 days with rotation; how the frontend obtains it = from the login response/session claim; how the API validates = same secret/keys as session.
  - Do NOT keep two unrelated auth systems (NextAuth session cookie + a separate custom JWT + a third login token) without a single explained source of truth. Never mix "session cookie" and "Bearer JWT" as parallel, unexplained mechanisms.
  - State clearly which mechanism protects the API chosen for the product, and name the auth env vars (e.g. AUTH_SECRET / NEXT_PUBLIC_AUTH_URL) once, consistently.
- Pick ONE infrastructure/hosting stack and apply it consistently across tech stack, architecture, environment variables, local development, deployment, database, media storage, external services, and setup instructions:
  - Use the project's existing decisions. For example: web = Vercel; database = Neon PostgreSQL; image storage = Cloudinary; payment = Midtrans.
  - Never offer two alternatives for the same concern. Do NOT write "Supabase / Neon", "Vercel / Heroku", "Railway / Render", "S3 / Cloudinary" unless one is genuinely the fallback for the other and you state a selection criterion.
  - For each external service (database, storage, hosting, payments, AI, email), state ONE provider, ONE purpose, and ONE environment-variable set.
  - Keep local development in sync: the same database/storage choices used in deployment must appear in setup instructions.
- Pick ONE canonical value for every important business constant and apply it identically in every section (overview, goals, constraints, journey, FRs, UX, database, API, security, integration, architecture, validation, testing, delivery, decisions, env vars). Pick based on the user's actual requirement; do not invent or estimate a value. Never write a number one way in one section and differently elsewhere (e.g. radius 50m in overview but 100m in database) — that is a contradiction.
- Pick ONE canonical terminology/vocabulary and use it everywhere. Do not mix synonyms for the same concept: use exactly one of {employee, karyawan, staff, user} for the same role, one of {admin, superadmin} for a role, one of {PRESENT, MASUK} for a concept, and one route name per page. Do not create multiple routes for the same page.
- Pick ONE password hashing algorithm (either Argon2id or bcrypt) and use it consistently in database, auth, security, architecture, tech stack, assumptions, delivery, setup, and testing. Never write "Argon2id / bcrypt".
- Pick ONE source of truth for business configuration. If a value is admin-editable or manager-controllable (e.g. office latitude/longitude, attendance radius, active status), it MUST come from the database; environment variables are only for secrets, API keys, and immutable infrastructure config. Never define a business value in both a database field and an env var as alternative sources.
- Define ONE canonical route per page (e.g. dashboard) and use that exact route in journey, UX, API, middleware, architecture, testing, and delivery. Do not introduce alias routes.
- Define Google OAuth account linking explicitly. If an existing password account shares the same email as a Google login, state LINK TO EXISTING ACCOUNT or REJECT LINKING; never create duplicate accounts silently."""


def prd_user_prompt(project: dict, language: str) -> str:
    lang = "Bahasa Indonesia" if language == "id" else "English"
    return f"""Generate a concise but implementation-ready Product Requirements Document in {lang} for the following project.

PROJECT REQUIREMENTS:
{project_context(project)}

{CANONICAL_MVP_DECISIONS}

RULES:
- Start with: # Product Requirements Document — {project.get('name')}
- Include ALL 14 sections below, in exact order, using these exact heading levels:
{PRD_SECTIONS}
- Follow this specific requirement for each section:
{chr(10).join(f'- {heading}: {PRD_SECTION_GUIDANCE[heading]}' for heading in REQUIRED_PRD_HEADINGS)}
- In Section 1, describe the user's product and separate MVP scope from future enhancements.
- In Section 4, number requirements as FR-1, FR-2, etc. and include priority (Must/Should/Could).
- In Sections 5–13, reference the relevant FR IDs so the implementation can be traced end to end.
- In Section 6, define the data model in terms of the actual entities the user's product needs, with concrete fields, types, nullability, defaults, and relations. The entities are the user's domain objects, not a fixed list.
- In Section 7, define the actual API routes the product needs, with method, auth, request schema, success response, error responses, and side effects. Do not invent routes unrelated to the product.
- In Section 8, describe the authentication and authorization approach actually chosen for the product (honoring any user-stated choice), and the secret/validation/security controls that follow from it.
- In Section 9, list the real external services the product uses (payment gateway, email, AI, etc.) and their retry/failure behavior; if none are needed, state that clearly.
- In Section 10, use the stack and architecture actually chosen (honoring any user-stated choice), and describe module boundaries and data flow.
- In Sections 10 and 13, describe the real deployment model for the product; do not assume a specific platform unless the user requires it.
- In Section 14, record every assumption and decision, including the resolution of any unspecified choice, and state whether any unresolved items remain.
- Never repeat one of the 14 required section headings as a `###` or another heading; use each required `##` heading exactly once. Other numbered subheadings are allowed.
- In Section 12, include concrete Given/When/Then acceptance tests for the product's critical flows: authentication/authorization, the primary user journey, any async/generation flow, exports, restore, delete, rate limiting, and secret handling. Label them AC-AUTH, AC-AUTHZ, AC-GENERATION (if the product generates content), AC-USAGE, AC-EXPORT, AC-RESTORE, AC-DELETE, AC-RATE-LIMIT, and AC-SECRET as applicable.
- Do not print internal validation labels such as DELETE_TEMPLATE_EFFECT, USAGE_LOG_CARDINALITY, or USAGELOG_NULLABLE_FIELDS in the final PRD. State their meanings naturally.
- Mark genuinely unclear product items with "⚠ Needs Clarification" plus the assumption used.
- Keep each section focused and concrete. This document must be directly usable by an AI coding agent without guessing."""


def agent_prompt_user_prompt(project: dict, prd_content: str, language: str) -> str:
    lang = "Bahasa Indonesia" if language == "id" else "English"
    return f"""Write a concise AI coding-agent prompt in {lang} for this project.

PROJECT:
{project_context(project)}

Use the following PRD as the only source of truth. Summarize only the requirements needed to start coding; do not copy the full PRD into the output:
{prd_content[:60000]}

The output MUST use exactly these sections and stay under 700 words:

# AI CODING AGENT PROMPT
## Mission
Tell the agent to build the website described by the PRD.
## Workflow
1. PHASE 1 — FRONTEND: build pages, navigation, components, forms, validation, responsive states, and mock data only. Do not write backend code. Stop and report.
2. PHASE 2 — BACKEND: implement database, authentication, authorization, APIs, validation, business logic, and tests. Stop and report.
3. PHASE 3 — INTEGRATION: connect frontend and backend, implement loading/error states, test critical user flows, and fix issues. Stop and report.
## Rules
Include the rules to follow the PRD, work only on the current phase, avoid deleting existing functionality, avoid duplicate code, validate inputs, never hardcode secrets, and use environment variables.
## Start Now
Tell the agent to read the PRD, state assumptions briefly, and begin PHASE 1 only.

Do not output a file structure, ASCII diagram, long technical specification, repeated PRD, or extra sections."""


# In-memory generation jobs: survives proxy timeouts; clients poll for progress.
GENERATION_JOBS: dict = {}


def ai_provider_cipher() -> Fernet:
    key = urlsafe_b64encode(hashlib.sha256(EMERGENT_LLM_KEY.encode()).digest())
    return Fernet(key)


def encrypt_provider_key(value: str) -> str:
    return ai_provider_cipher().encrypt(value.encode()).decode()


def decrypt_provider_key(value: str) -> str:
    try:
        return ai_provider_cipher().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError):
        logger.warning("Stored AI provider key could not be decrypted")
        return ""


async def load_ai_provider_config() -> tuple[str, dict, dict]:
    collection = getattr(db, "ai_provider_settings", None)
    settings = await collection.find_one({"id": AI_PROVIDER_SETTINGS_ID}, {"_id": 0}) if collection is not None else None
    dashboard_keys = {
        provider: decrypt_provider_key(value)
        for provider, value in (settings or {}).get("api_keys", {}).items()
        if provider in AI_PROVIDER_NAMES and value
    }
    active = (settings or {}).get("active_provider") or AI_PROVIDER
    if active != "auto" and active not in AI_PROVIDER_NAMES and active != "openai":
        active = AI_PROVIDER if AI_PROVIDER in AI_PROVIDER_NAMES or AI_PROVIDER == "openai" else "auto"
    return active, dashboard_keys, (settings or {}).get("models", {})


async def build_ai_attempts() -> list[tuple[str, str, str, str | None]]:
    active, dashboard_keys, dashboard_models = await load_ai_provider_config()
    env_config = {
        "deepseek": (DEEPSEEK_API_KEY, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL),
        "openrouter": (OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL),
        "9router": (NINEROUTER_API_KEY, NINEROUTER_MODEL, NINEROUTER_BASE_URL),
        "groq": (GROQ_API_KEY, GROQ_MODEL, GROQ_BASE_URL),
        "vyceai": (VYCEAI_API_KEY, VYCEAI_MODEL, VYCEAI_BASE_URL),
        "openagentic": (OPENAGENTIC_API_KEY, OPENAGENTIC_MODEL, OPENAGENTIC_BASE_URL),
        "zai": (ZAI_API_KEY, ZAI_MODEL, ZAI_BASE_URL),
    }
    order = ["9router", "openrouter", "deepseek", "groq", "vyceai", "openagentic", "zai"] if active == "auto" else [active] + [p for p in AI_PROVIDER_NAMES if p != active]
    attempts = []

    for provider in order:
        if provider == "openai":
            attempts.append((provider, AI_MODEL, EMERGENT_LLM_KEY, None))
            continue
        env_key, env_model, base_url = env_config[provider]
        api_key = dashboard_keys.get(provider) or env_key
        model = dashboard_models.get(provider) or env_model
        if provider == "vyceai":
            models = [model] if provider in dashboard_models else VYCEAI_MODELS
        elif provider == "openagentic":
            models = [model] if provider in dashboard_models else OPENAGENTIC_MODELS
        else:
            models = [model]
        if api_key or provider == active:
            attempts.extend((provider, item, api_key, base_url) for item in models)

    if not any(provider == "openai" for provider, *_ in attempts):
        attempts.append(("openai", AI_MODEL, EMERGENT_LLM_KEY, None))
    return attempts


async def stream_openai_compatible(provider: str, api_key: str, base_url: str, model: str, system_msg: str, user_msg: str, max_output_tokens: int | None = None):
    if not api_key and provider != "9router":
        raise RuntimeError(f"{provider.upper()}_API_KEY is required when using the {provider} provider")
    async with AsyncOpenAI(api_key=api_key or "local-9router", base_url=base_url, timeout=300.0, max_retries=0) as client:
        messages = (
            [{"role": "user", "content": f"{system_msg}\n\n{user_msg}"}]
            if provider == "vyceai"
            else [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ]
        )
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            # Groq has an 8k TPM limit in the current organization.
            max_tokens=max_output_tokens or (7000 if provider == "groq" else 12000),
            stream=False,
        )
        if response.choices and response.choices[0].message.content:
            yield response.choices[0].message.content


def prd_chunk_user_prompt(project: dict, language: str, start: int, end: int) -> str:
    lang = "Bahasa Indonesia" if language == "id" else "English"
    sections = "\n".join(REQUIRED_PRD_HEADINGS[start:end])
    guidance = "\n".join(f"{heading}: {PRD_SECTION_GUIDANCE[heading]}" for heading in REQUIRED_PRD_HEADINGS[start:end])
    frozen = canonical_project_decisions(project)
    if end - start == 1:
        word_limit = 600 if start in {5, 6} else 350 if start == 8 else 220
        return f"""Write concise Markdown in {lang} for this project.

Project requirements:
{project_context(project)}

FROZEN CANONICAL SPEC (single source of truth — use these exact values, do NOT change them):
{frozen}

{CANONICAL_MVP_DECISIONS}

Write only the body for this section:
{sections}

Required content:
{guidance}

Do not output a heading, title, introduction, conclusion, or any other section. Keep it under {word_limit} words and use concrete, actionable details."""
    return f"""Write concise Markdown in {lang} for this project.

Project requirements:
{project_context(project)}

FROZEN CANONICAL SPEC (single source of truth — use these exact values, do NOT change them):
{frozen}

{CANONICAL_MVP_DECISIONS}

Return only these sections, with each heading exactly once and in this order:
{sections}

Required content:
{guidance}

Keep each section under 220 words. Do not add an introduction, conclusion, or other headings. Use concrete, actionable details."""


async def generate_prd_chunk(provider: str, api_key: str, base_url: str, model: str, project: dict, language: str, start: int, end: int):
    expected = REQUIRED_PRD_HEADINGS[start:end]
    for attempt in range(3):
        parts = []
        try:
            async for content in stream_openai_compatible(
                provider, api_key, base_url, model,
                PRD_SYSTEM, prd_chunk_user_prompt(project, language, start, end),
                max_output_tokens=1500 if provider in {"vyceai", "openagentic"} else 5000,
            ):
                parts.append(content)
        except Exception as error:
            status_code = getattr(error, "status_code", None)
            if attempt < 2 and (status_code is None or status_code >= 500):
                logger.warning("AI provider %s failed on PRD chunk; retrying chunk", provider)
                continue
            raise

        chunk = "".join(parts)
        headings = [
            re.sub(r"\s+", " ", line.strip())
            for line in chunk.splitlines()
            if re.match(r"^##\s+\d+\.\s+", line.strip())
        ]
        if len(expected) == 1:
            if headings and headings != expected:
                problem = ", ".join(headings)
            else:
                if headings == expected:
                    chunk = re.sub(r"^##\s+\d+\.\s+.*(?:\r?\n|$)", "", chunk, count=1, flags=re.MULTILINE).strip()
                if chunk:
                    return f"{expected[0]}\n\n{chunk}"
                problem = "empty section body"
        else:
            repeat_count = len(headings) // len(expected)
            if repeat_count > 1 and headings == expected * repeat_count:
                heading_matches = list(re.finditer(r"^##\s+\d+\.\s+.*$", chunk, re.MULTILINE))
                chunk = chunk[:heading_matches[len(expected)].start()].rstrip()
                headings = expected
            if headings == expected:
                return chunk
            missing = [heading for heading in expected if heading not in headings]
            duplicates = [heading for heading in expected if headings.count(heading) > 1]
            unexpected = [heading for heading in headings if heading not in expected]
            problem = ", ".join(missing + duplicates + unexpected) or "headings out of order"

        if attempt < 2:
            logger.warning("AI provider %s returned an invalid PRD chunk; retrying: %s", provider, problem)
        else:
            raise ValueError("PRD chunk headings invalid: " + problem)


async def stream_prd(provider: str, api_key: str, base_url: str, model: str, project: dict, language: str, system_msg: str, user_msg: str):
    if provider == "deepseek":
        for start in range(len(REQUIRED_PRD_HEADINGS)):
            yield await generate_prd_chunk(provider, api_key, base_url, model, project, language, start, start + 1)
        return
    # Schema and integration sections need more room than a three-section chunk allows.
    for start, end in ((0, 3), (3, 5), (5, 6), (6, 8), (8, 9), (9, 12), (12, 14)):
        yield await generate_prd_chunk(provider, api_key, base_url, model, project, language, start, end)


async def run_generation_job(job_id: str, generation_type: str, project: dict, user: dict, system_msg: str, user_msg: str, language: str):
    job = GENERATION_JOBS[job_id]
    project_id = project["id"]
    provider_used = AI_PROVIDER
    model_used = AI_MODEL
    try:
        attempts = await build_ai_attempts()
        if not attempts:
            raise RuntimeError("No AI provider is configured")
        provider_used, model_used = attempts[0][0], attempts[0][1]

        for index, (provider, model, api_key, base_url) in enumerate(attempts):
            provider_used, model_used = provider, model
            job["content"] = ""
            try:
                if provider in {"vyceai", "deepseek", "openrouter", "9router", "zai", "openagentic"} and generation_type == "prd":
                    async for delta in stream_prd(
                        provider, api_key, base_url, model, project, language, system_msg, user_msg,
                    ):
                        job["content"] = f"{job['content'].rstrip()}\n\n{delta.strip()}".strip()
                else:
                    if base_url:
                        async for delta in stream_openai_compatible(
                            provider, api_key, base_url, model, system_msg, user_msg,
                            max_output_tokens=2800 if generation_type == "agent_prompt" else None,
                        ):
                            job["content"] += delta
                    else:
                        if LlmChat is None:
                            raise RuntimeError(f"The {provider} provider requires emergentintegrations")
                        chat = LlmChat(
                            api_key=api_key,
                            session_id=f"{generation_type}-{project_id}-{uuid.uuid4().hex[:8]}",
                            system_message=system_msg,
                        ).with_model(provider, model)
                        async for ev in chat.stream_message(UserMessage(text=user_msg)):
                            if isinstance(ev, TextDelta):
                                job["content"] += ev.content
                            elif isinstance(ev, StreamDone):
                                break
                break
            except Exception as error:
                if index < len(attempts) - 1:
                    logger.warning("AI provider %s unavailable; retrying with %s", provider, attempts[index + 1][0])
                    continue
                raise

        content = job["content"]
        if len(content.strip()) < 200:
            raise ValueError("AI output too short / invalid")
        report = None
        if generation_type == "prd":
            validate_prd_consistency(content)
            content = strip_prd_contract_markers(content)
            validate_prd_consistency(content)
            report = analyze_prd_consistency(content)
            job["report"] = report
            job["content"] = content
        now = datetime.now(timezone.utc).isoformat()
        if generation_type == "prd":
            version = await db.prd_documents.count_documents({"project_id": project_id}) + 1
            await db.prd_documents.insert_one({
                "id": str(uuid.uuid4()), "project_id": project_id, "user_id": user["user_id"],
                "content": content, "version": version, "language": language,
                "edited": False, "connected_consistency": report, "created_at": now,
            })
            await db.projects.update_one({"id": project_id}, {"$set": {"prd_status": "completed", "updated_at": now}})
        else:
            version = await db.ai_prompts.count_documents({"project_id": project_id}) + 1
            await db.ai_prompts.insert_one({
                "id": str(uuid.uuid4()), "project_id": project_id, "user_id": user["user_id"],
                "content": content, "version": version, "language": language, "created_at": now,
            })
            await db.projects.update_one({"id": project_id}, {"$set": {"prompt_status": "completed", "updated_at": now}})
        await db.usage_records.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["user_id"], "project_id": project_id,
            "provider": provider_used, "model": model_used, "generation_type": generation_type,
            "chars": len(content), "status": "success", "created_at": now,
        })
        job["status"] = "completed"
    except Exception as e:
        logger.exception("generation failed")
        job["status"] = "failed"
        job["error"] = str(e)
        await db.usage_records.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["user_id"], "project_id": project_id,
            "provider": provider_used, "model": model_used, "generation_type": generation_type,
            "status": "failed", "error": str(e), "created_at": datetime.now(timezone.utc).isoformat(),
        })


def start_generation_job(generation_type: str, project: dict, user: dict, system_msg: str, user_msg: str, language: str):
    job_id = str(uuid.uuid4())
    GENERATION_JOBS[job_id] = {"status": "running", "content": "", "error": None, "user_id": user["user_id"]}
    if len(GENERATION_JOBS) > 100:
        for k in [k for k, v in GENERATION_JOBS.items() if v["status"] != "running"][:50]:
            GENERATION_JOBS.pop(k, None)
    asyncio.create_task(run_generation_job(job_id, generation_type, project, user, system_msg, user_msg, language))
    return job_id


def month_start_iso() -> str:
    return datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


async def check_generation_limit(user: dict, generation_type: str):
    plan = PLANS.get(user.get("plan", "free"), PLANS["free"])
    limits = plan["generation_limits"]
    limit = limits.get(generation_type) if limits else None
    if limit is None:
        return
    count = await db.usage_records.count_documents({
        "user_id": user["user_id"],
        "generation_type": generation_type,
        "created_at": {"$gte": month_start_iso()},
    })
    if count >= limit:
        label = "PRD" if generation_type == "prd" else "Agent Prompt"
        raise HTTPException(status_code=403, detail=f"Batas {label} plan {plan['name']} tercapai ({limit}/bulan). Upgrade ke Pro untuk melanjutkan.")


@api_router.get("/me/limits")
async def my_limits(user: dict = Depends(get_current_user)):
    plan_key = user.get("plan", "free")
    plan = PLANS.get(plan_key, PLANS["free"])
    projects_used = await db.projects.count_documents({"user_id": user["user_id"]})
    usage_filter = {"user_id": user["user_id"], "created_at": {"$gte": month_start_iso()}}
    prd_used = await db.usage_records.count_documents({**usage_filter, "generation_type": "prd"})
    prompt_used = await db.usage_records.count_documents({**usage_filter, "generation_type": "agent_prompt"})
    generation_limits = plan["generation_limits"]
    return {
        "plan": plan_key, "plan_name": plan["name"],
        "projects_used": projects_used, "max_projects": plan["max_projects"],
        "prd_used": prd_used, "prd_limit": generation_limits["prd"] if generation_limits else None,
        "prompt_used": prompt_used, "prompt_limit": generation_limits["agent_prompt"] if generation_limits else None,
        "research_enabled": plan["research"],
    }


# ---------- Manual payment ----------
PAYMENT_SETTINGS_ID = "manual-payment-settings"

MIDTRANS_API_BASE = (
    "https://app.midtrans.com/snap/v1"
    if MIDTRANS_IS_PRODUCTION
    else "https://app.sandbox.midtrans.com/snap/v1"
)


async def get_manual_payment_settings() -> Optional[dict]:
    return await db.payment_settings.find_one({"id": PAYMENT_SETTINGS_ID}, {"_id": 0})


@api_router.get("/payments/manual-settings")
async def manual_payment_settings(user: dict = Depends(get_current_user)):
    settings = await get_manual_payment_settings()
    if not settings:
        return {"configured": False}
    return {"configured": True, **settings}


@api_router.get("/payments/public-pricing")
async def public_pricing():
    settings = await get_manual_payment_settings()
    if not settings:
        return {"configured": False}
    return {
        "configured": True,
        "pro_price": settings.get("pro_price", 0),
        "pro_duration_days": settings.get("pro_duration_days", 30),
    }


@api_router.get("/payments/midtrans-config")
async def midtrans_config(user: dict = Depends(get_current_user)):
    settings = await get_manual_payment_settings()
    return {
        "configured": bool(MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY and settings),
        "client_key": MIDTRANS_CLIENT_KEY,
        "is_production": MIDTRANS_IS_PRODUCTION,
        "pro_price": settings.get("pro_price", 0) if settings else 0,
        "pro_duration_days": settings.get("pro_duration_days", 30) if settings else 30,
    }


@api_router.post("/payments/midtrans/create")
async def create_midtrans_payment(user: dict = Depends(get_current_user)):
    settings = await get_manual_payment_settings()
    if not MIDTRANS_SERVER_KEY or not MIDTRANS_CLIENT_KEY:
        raise HTTPException(status_code=503, detail="Midtrans belum dikonfigurasi")
    if not settings or not settings.get("pro_price"):
        raise HTTPException(status_code=400, detail="Harga Pro belum dikonfigurasi oleh admin")

    order_id = f"prd-{uuid.uuid4().hex}"
    amount = int(settings["pro_price"])
    payload = {
        "transaction_details": {"order_id": order_id, "gross_amount": amount},
        "item_details": [{
            "id": "pro-plan",
            "price": amount,
            "quantity": 1,
            "name": f"PRD CreativeAI Pro ({settings.get('pro_duration_days', 30)} hari)",
        }],
        "customer_details": {"first_name": user.get("name") or "User", "email": user["email"]},
    }
    async with httpx.AsyncClient(timeout=45.0) as http:
        response = await http.post(
            f"{MIDTRANS_API_BASE}/transactions",
            auth=(MIDTRANS_SERVER_KEY, ""),
            json=payload,
        )
    if response.status_code >= 400:
        logger.error("Midtrans create transaction failed: %s", response.text[:500])
        raise HTTPException(status_code=502, detail="Midtrans gagal membuat transaksi")

    data = response.json()
    now = datetime.now(timezone.utc).isoformat()
    await db.midtrans_payments.insert_one({
        "order_id": order_id,
        "user_id": user["user_id"],
        "amount": amount,
        "currency": "IDR",
        "duration_days": settings.get("pro_duration_days", 30),
        "status": "pending",
        "snap_token": data["token"],
        "created_at": now,
        "updated_at": now,
    })
    return {"order_id": order_id, "token": data["token"], "redirect_url": data.get("redirect_url")}


@api_router.get("/payments/midtrans/{order_id}")
async def midtrans_payment_status(order_id: str, user: dict = Depends(get_current_user)):
    payment = await db.midtrans_payments.find_one(
        {"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0, "order_id": 1, "status": 1}
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    return payment


@api_router.post("/payments/midtrans/notification")
async def midtrans_notification(body: MidtransNotification):
    if not MIDTRANS_SERVER_KEY:
        raise HTTPException(status_code=503, detail="Midtrans belum dikonfigurasi")
    expected_signature = hashlib.sha512(
        f"{body.order_id}{body.status_code}{body.gross_amount}{MIDTRANS_SERVER_KEY}".encode()
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, body.signature_key):
        raise HTTPException(status_code=403, detail="Invalid Midtrans signature")

    payment = await db.midtrans_payments.find_one({"order_id": body.order_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    status = body.transaction_status
    if status in {"capture", "settlement"} and (status != "capture" or body.fraud_status in {None, "accept"}):
        if payment.get("status") != "settlement":
            now = datetime.now(timezone.utc)
            user = await db.users.find_one({"user_id": payment["user_id"]}, {"_id": 0})
            if not user:
                raise HTTPException(status_code=404, detail="User transaksi tidak ditemukan")
            base_time = now
            if user.get("pro_expires_at") and as_utc_datetime(user["pro_expires_at"]) > now:
                base_time = as_utc_datetime(user["pro_expires_at"])
            expires_at = (base_time + timedelta(days=payment.get("duration_days", 30))).isoformat()
            await db.users.update_one(
                {"user_id": payment["user_id"]},
                {"$set": {"plan": "pro", "pro_expires_at": expires_at}},
            )
            await db.midtrans_payments.update_one(
                {"order_id": body.order_id},
                {"$set": {"status": "settlement", "transaction_status": status, "pro_expires_at": expires_at, "updated_at": now.isoformat()}},
            )
    else:
        await db.midtrans_payments.update_one(
            {"order_id": body.order_id},
            {"$set": {"status": status, "transaction_status": status, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    return {"ok": True}


@api_router.get("/payments/my")
async def my_payments(user: dict = Depends(get_current_user)):
    return await db.payment_submissions.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)


@api_router.post("/payments/manual")
async def submit_manual_payment(body: ManualPaymentSubmission, user: dict = Depends(get_current_user)):
    settings = await get_manual_payment_settings()
    if not settings:
        raise HTTPException(status_code=400, detail="Pembayaran manual belum dikonfigurasi oleh admin")
    existing = await db.payment_submissions.find_one(
        {"user_id": user["user_id"], "status": "pending"}, {"_id": 0, "payment_id": 1}
    )
    if existing:
        raise HTTPException(status_code=409, detail="Anda masih memiliki pengajuan pembayaran yang menunggu verifikasi")
    now = datetime.now(timezone.utc).isoformat()
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    await db.payment_submissions.insert_one({
        "payment_id": payment_id,
        "user_id": user["user_id"],
        "plan": "pro",
        "amount": settings["pro_price"],
        "currency": "IDR",
        "status": "pending",
        "sender_name": body.sender_name,
        "sender_bank": body.sender_bank,
        "transfer_reference": body.transfer_reference,
        "transfer_at": body.transfer_at,
        "notes": body.notes,
        "bank_snapshot": {
            "bank_name": settings["bank_name"],
            "account_number": settings["account_number"],
            "account_holder": settings["account_holder"],
            "pro_duration_days": settings["pro_duration_days"],
        },
        "created_at": now,
        "updated_at": now,
    })
    return {"payment_id": payment_id, "status": "pending"}


@api_router.post("/projects/{project_id}/generate-prd")
async def generate_prd(project_id: str, body: GenerateRequest, user: dict = Depends(get_current_user)):
    await check_generation_limit(user, "prd")
    project = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    job_id = start_generation_job("prd", project, user, PRD_SYSTEM, prd_user_prompt(project, body.language), body.language)
    return {"job_id": job_id}


@api_router.post("/projects/{project_id}/generate-agent-prompt")
async def generate_agent_prompt(project_id: str, body: GenerateRequest, user: dict = Depends(get_current_user)):
    await check_generation_limit(user, "agent_prompt")
    project = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    prd = await db.prd_documents.find_one({"project_id": project_id}, {"_id": 0}, sort=[("version", -1)])
    if not prd:
        raise HTTPException(status_code=400, detail="Generate the PRD first")
    job_id = start_generation_job("agent_prompt", project, user, PROMPT_SYSTEM,
                                  agent_prompt_user_prompt(project, prd["content"], body.language), body.language)
    return {"job_id": job_id}


@api_router.get("/generations/{job_id}")
async def get_generation(job_id: str, user: dict = Depends(get_current_user)):
    job = GENERATION_JOBS.get(job_id)
    if not job or job["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": job["status"], "content": job["content"], "error": job["error"], "report": job.get("report")}


@api_router.get("/projects/{project_id}/prd")
async def get_prd(project_id: str, user: dict = Depends(get_current_user)):
    prd = await db.prd_documents.find_one({"project_id": project_id, "user_id": user["user_id"]}, {"_id": 0}, sort=[("version", -1)])
    if not prd:
        raise HTTPException(status_code=404, detail="PRD not found")
    return prd


@api_router.put("/projects/{project_id}/prd")
async def update_prd(project_id: str, body: PrdUpdate, user: dict = Depends(get_current_user)):
    prd = await db.prd_documents.find_one({"project_id": project_id, "user_id": user["user_id"]}, {"_id": 0}, sort=[("version", -1)])
    if not prd:
        raise HTTPException(status_code=404, detail="PRD not found")
    try:
        validate_prd_content(body.content)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    await db.prd_documents.update_one({"id": prd["id"]}, {"$set": {"content": body.content, "edited": True}})
    return {"ok": True}


@api_router.get("/projects/{project_id}/prompt")
async def get_prompt(project_id: str, user: dict = Depends(get_current_user)):
    prompt = await db.ai_prompts.find_one({"project_id": project_id, "user_id": user["user_id"]}, {"_id": 0}, sort=[("version", -1)])
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt


# ---------- Share links ----------
@api_router.post("/projects/{project_id}/share")
async def toggle_share(project_id: str, body: ShareToggle, user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.enabled:
        share_id = project.get("share_id") or uuid.uuid4().hex
        await db.projects.update_one({"id": project_id}, {"$set": {"share_id": share_id}})
        return {"share_id": share_id}
    await db.projects.update_one({"id": project_id}, {"$unset": {"share_id": ""}})
    return {"share_id": None}


@api_router.get("/public/share/{share_id}")
async def public_share(share_id: str):
    project = await db.projects.find_one({"share_id": share_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Share link not found")
    prd = await db.prd_documents.find_one({"project_id": project["id"]}, {"_id": 0, "content": 1, "version": 1, "created_at": 1}, sort=[("version", -1)])
    prompt = await db.ai_prompts.find_one({"project_id": project["id"]}, {"_id": 0, "content": 1, "version": 1, "created_at": 1}, sort=[("version", -1)])
    return {"project_name": project["name"], "prd": prd, "prompt": prompt}


def branding_response(settings: dict | None, request: Request) -> dict:
    logo_path = settings.get("logo_path") if settings else None
    return {"logo_url": f"{str(request.base_url).rstrip('/')}{logo_path}" if logo_path else None}


async def ai_provider_settings_response() -> dict:
    active, dashboard_keys, dashboard_models = await load_ai_provider_config()
    env_config = {
        "deepseek": (DEEPSEEK_API_KEY, DEEPSEEK_MODEL),
        "openrouter": (OPENROUTER_API_KEY, OPENROUTER_MODEL),
        "9router": (NINEROUTER_API_KEY, NINEROUTER_MODEL),
        "groq": (GROQ_API_KEY, GROQ_MODEL),
        "vyceai": (VYCEAI_API_KEY, VYCEAI_MODEL),
        "openagentic": (OPENAGENTIC_API_KEY, OPENAGENTIC_MODEL),
        "zai": (ZAI_API_KEY, ZAI_MODEL),
    }
    providers = []
    for provider in AI_PROVIDER_NAMES:
        env_key, env_model = env_config[provider]
        key = dashboard_keys.get(provider) or env_key
        providers.append({
            "id": provider,
            "label": AI_PROVIDER_LABELS[provider],
            "configured": bool(key) or provider == "9router",
            "source": "dashboard" if dashboard_keys.get(provider) else ("environment" if env_key else ("local" if provider == "9router" else None)),
            "model": dashboard_models.get(provider) or env_model,
        })
    return {"active_provider": active, "providers": providers}


@api_router.get("/site-settings", response_model=BrandingResponse)
async def site_settings(request: Request):
    settings = await db.site_settings.find_one({"id": BRANDING_SETTINGS_ID}, {"_id": 0})
    return branding_response(settings, request)


# ---------- Admin ----------
@api_router.get("/admin/ai-provider")
async def admin_ai_provider(admin: dict = Depends(require_admin)):
    return await ai_provider_settings_response()


@api_router.put("/admin/ai-provider")
async def update_admin_ai_provider(body: AIProviderSettingsUpdate, admin: dict = Depends(require_admin)):
    if body.active_provider != "auto" and body.active_provider not in AI_PROVIDER_NAMES and body.active_provider != "openai":
        raise HTTPException(status_code=400, detail="Invalid AI provider")
    target_provider = body.target_provider or body.active_provider
    if target_provider not in AI_PROVIDER_NAMES:
        raise HTTPException(status_code=400, detail="Invalid target AI provider")

    _, dashboard_keys, _ = await load_ai_provider_config()
    env_keys = {
        "deepseek": DEEPSEEK_API_KEY,
        "openrouter": OPENROUTER_API_KEY,
        "9router": NINEROUTER_API_KEY,
        "groq": GROQ_API_KEY,
        "vyceai": VYCEAI_API_KEY,
        "openagentic": OPENAGENTIC_API_KEY,
        "zai": ZAI_API_KEY,
    }
    effective_key = body.api_key.strip() if body.api_key is not None else dashboard_keys.get(body.active_provider) or env_keys.get(body.active_provider, "")
    if body.clear_api_key and body.api_key is None:
        effective_key = env_keys.get(body.active_provider, "")
    if body.active_provider not in ("auto", "openai", "9router") and not effective_key:
        raise HTTPException(status_code=400, detail="API key provider tersebut belum dikonfigurasi")

    now = datetime.now(timezone.utc).isoformat()
    updates = {"id": AI_PROVIDER_SETTINGS_ID, "active_provider": body.active_provider, "updated_at": now, "updated_by": admin["user_id"]}
    unset = {}
    if body.api_key is not None and body.api_key.strip():
        updates[f"api_keys.{target_provider}"] = encrypt_provider_key(body.api_key.strip())
    elif body.clear_api_key:
        unset[f"api_keys.{target_provider}"] = ""
    if body.model is not None and body.model.strip() and body.active_provider in AI_PROVIDER_NAMES:
        updates[f"models.{body.active_provider}"] = body.model.strip()
    operations = {"$set": updates}
    if unset:
        operations["$unset"] = unset
    await db.ai_provider_settings.update_one({"id": AI_PROVIDER_SETTINGS_ID}, operations, upsert=True)
    return await ai_provider_settings_response()


@api_router.get("/admin/branding", response_model=BrandingResponse)
async def admin_branding(request: Request, admin: dict = Depends(require_admin)):
    settings = await db.site_settings.find_one({"id": BRANDING_SETTINGS_ID}, {"_id": 0})
    return branding_response(settings, request)


@api_router.post("/admin/branding/logo", response_model=BrandingResponse)
async def upload_branding_logo(request: Request, file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    extension = ALLOWED_LOGO_TYPES.get(file.content_type or "")
    if not extension:
        raise HTTPException(status_code=400, detail="Logo harus PNG, JPG, atau WebP")
    contents = await file.read(MAX_LOGO_BYTES + 1)
    if len(contents) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=413, detail="Ukuran logo maksimal 2 MB")

    filename = f"logo-{uuid.uuid4().hex}{extension}"
    target = UPLOAD_DIR / filename
    target.write_bytes(contents)
    previous = await db.site_settings.find_one({"id": BRANDING_SETTINGS_ID}, {"_id": 0, "logo_path": 1})
    await db.site_settings.update_one(
        {"id": BRANDING_SETTINGS_ID},
        {"$set": {"id": BRANDING_SETTINGS_ID, "logo_path": f"/uploads/{filename}", "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin["user_id"]}},
        upsert=True,
    )
    previous_path = previous.get("logo_path") if previous else None
    if previous_path and previous_path.startswith("/uploads/"):
        old_file = UPLOAD_DIR / Path(previous_path).name
        if old_file != target and old_file.exists():
            old_file.unlink()
    return branding_response({"logo_path": f"/uploads/{filename}"}, request)


@api_router.delete("/admin/branding/logo")
async def delete_branding_logo(admin: dict = Depends(require_admin)):
    settings = await db.site_settings.find_one({"id": BRANDING_SETTINGS_ID}, {"_id": 0})
    logo_path = settings.get("logo_path") if settings else None
    if logo_path and logo_path.startswith("/uploads/"):
        logo_file = UPLOAD_DIR / Path(logo_path).name
        if logo_file.exists():
            logo_file.unlink()
    await db.site_settings.update_one({"id": BRANDING_SETTINGS_ID}, {"$unset": {"logo_path": ""}, "$set": {"updated_by": admin["user_id"]}}, upsert=True)
    return {"logo_url": None}


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_projects = await db.projects.count_documents({})
    total_prds = await db.prd_documents.count_documents({})
    total_prompts = await db.ai_prompts.count_documents({})
    gens_ok = await db.usage_records.count_documents({"status": "success"})
    gens_fail = await db.usage_records.count_documents({"status": "failed"})
    gens_month = await db.usage_records.count_documents({"created_at": {"$gte": month_start_iso()}})
    return {
        "total_users": total_users, "total_projects": total_projects,
        "total_prds": total_prds, "total_prompts": total_prompts,
        "generations_success": gens_ok, "generations_failed": gens_fail,
        "generations_this_month": gens_month,
    }


@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    proj_counts = {r["_id"]: r["n"] async for r in db.projects.aggregate([{"$group": {"_id": "$user_id", "n": {"$sum": 1}}}])}
    gen_counts = {r["_id"]: r["n"] async for r in db.usage_records.aggregate([{"$group": {"_id": "$user_id", "n": {"$sum": 1}}}])}
    for u in users:
        u["plan"] = u.get("plan", "free")
        u["suspended"] = u.get("suspended", False)
        u["projects_count"] = proj_counts.get(u["user_id"], 0)
        u["generations_count"] = gen_counts.get(u["user_id"], 0)
    return users


@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserUpdate, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {}
    if body.plan is not None:
        if body.plan not in PLANS:
            raise HTTPException(status_code=400, detail="Invalid plan")
        updates["plan"] = body.plan
    if body.role is not None:
        if body.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Invalid role")
        updates["role"] = body.role
    if body.suspended is not None:
        updates["suspended"] = body.suspended
    if updates:
        operations = {"$set": updates}
        if body.plan in ("free", "enterprise"):
            operations["$unset"] = {"pro_expires_at": ""}
        await db.users.update_one({"user_id": user_id}, operations)
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})


@api_router.get("/admin/usage")
async def admin_usage(admin: dict = Depends(require_admin)):
    records = await db.usage_records.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    emails = {u["user_id"]: u["email"] for u in await db.users.find({}, {"_id": 0, "user_id": 1, "email": 1}).to_list(500)}
    for r in records:
        r["user_email"] = emails.get(r["user_id"], "?")
    return records


@api_router.get("/admin/payment-settings")
async def admin_payment_settings(admin: dict = Depends(require_admin)):
    settings = await get_manual_payment_settings()
    return settings or {"configured": False}


@api_router.get("/admin/payment-pricing")
async def admin_payment_pricing(admin: dict = Depends(require_admin)):
    settings = await get_manual_payment_settings()
    return {
        "pro_price": settings.get("pro_price", 0) if settings else 0,
        "pro_duration_days": settings.get("pro_duration_days", 30) if settings else 30,
    }


@api_router.put("/admin/payment-pricing")
async def update_admin_payment_pricing(body: PaymentPricingUpdate, admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    await db.payment_settings.update_one(
        {"id": PAYMENT_SETTINGS_ID},
        {"$set": {**body.model_dump(), "id": PAYMENT_SETTINGS_ID, "updated_at": now, "updated_by": admin["user_id"]}},
        upsert=True,
    )
    return await admin_payment_pricing(admin)


@api_router.put("/admin/payment-settings")
async def update_admin_payment_settings(body: ManualPaymentSettingsUpdate, admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    settings = body.model_dump()
    settings.update({"id": PAYMENT_SETTINGS_ID, "updated_at": now, "updated_by": admin["user_id"]})
    await db.payment_settings.update_one({"id": PAYMENT_SETTINGS_ID}, {"$set": settings}, upsert=True)
    return settings


@api_router.get("/admin/payments")
async def admin_payments(admin: dict = Depends(require_admin)):
    payments = await db.payment_submissions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "email": 1, "name": 1}).to_list(500)
    user_lookup = {u["user_id"]: u for u in users}
    for payment in payments:
        payer = user_lookup.get(payment["user_id"], {})
        payment["user_email"] = payer.get("email", "?")
        payment["user_name"] = payer.get("name", "?")
    return payments


@api_router.put("/admin/payments/{payment_id}")
async def review_payment(payment_id: str, body: PaymentReview, admin: dict = Depends(require_admin)):
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid payment status")
    payment = await db.payment_submissions.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment["status"] != "pending":
        raise HTTPException(status_code=409, detail="Payment sudah pernah ditinjau")
    now_dt = datetime.now(timezone.utc)
    updates = {
        "status": body.status,
        "reviewed_at": now_dt.isoformat(),
        "reviewed_by": admin["user_id"],
        "rejection_reason": body.rejection_reason if body.status == "rejected" else "",
        "updated_at": now_dt.isoformat(),
    }
    if body.status == "approved":
        duration = payment.get("bank_snapshot", {}).get("pro_duration_days", 30)
        target_user = await db.users.find_one({"user_id": payment["user_id"]}, {"_id": 0})
        if not target_user:
            raise HTTPException(status_code=404, detail="User pembayaran tidak ditemukan")
        base_time = now_dt
        current_expiry = target_user.get("pro_expires_at")
        if current_expiry:
            parsed_expiry = as_utc_datetime(current_expiry)
            if parsed_expiry > now_dt:
                base_time = parsed_expiry
        pro_expires_at = (base_time + timedelta(days=duration)).isoformat()
        updates["pro_expires_at"] = pro_expires_at
        await db.users.update_one(
            {"user_id": payment["user_id"]},
            {"$set": {"plan": "pro", "pro_expires_at": pro_expires_at}},
        )
    await db.payment_submissions.update_one({"payment_id": payment_id}, {"$set": updates})
    reviewed = await db.payment_submissions.find_one({"payment_id": payment_id}, {"_id": 0})
    return reviewed


@api_router.post("/admin/templates")
async def admin_create_template(body: TemplateCreate, admin: dict = Depends(require_admin)):
    allowed = {"product_type", "target_users", "business_goal", "main_problem", "desired_features",
               "preferred_technology", "design_preference", "auth_requirement", "payment_requirement",
               "integrations", "deployment_preference", "additional_requirements"}
    prefill = {k: str(v) for k, v in body.prefill.items() if k in allowed and v}
    doc = {
        "id": f"custom-{uuid.uuid4().hex[:8]}",
        "icon": body.icon,
        "name": {"id": body.name, "en": body.name},
        "tagline": {"id": body.tagline, "en": body.tagline},
        "prefill": {"id": prefill, "en": prefill},
        "custom": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.custom_templates.insert_one({**doc})
    return doc


@api_router.delete("/admin/templates/{template_id}")
async def admin_delete_template(template_id: str, admin: dict = Depends(require_admin)):
    result = await db.custom_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"ok": True}


@api_router.get("/templates")
async def list_templates():
    custom = await db.custom_templates.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return TEMPLATES + custom


@api_router.get("/health")
async def health():
    return {"message": "PRD CreativeAI API", "status": "ok"}


@api_router.get("/")
async def root():
    return {"message": "PRD CreativeAI API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def ensure_indexes():
    await asyncio.gather(
        db.users.create_index("user_id", unique=True),
        db.users.create_index("email", unique=True),
        db.user_sessions.create_index("session_token", unique=True),
        db.user_sessions.create_index("expires_at"),
        db.projects.create_index([("user_id", 1), ("updated_at", -1)]),
        db.projects.create_index("share_id", unique=True, sparse=True),
        db.prd_documents.create_index([("project_id", 1), ("version", -1)]),
        db.ai_prompts.create_index([("project_id", 1), ("version", -1)]),
        db.usage_records.create_index([("user_id", 1), ("created_at", 1)]),
        db.usage_records.create_index([("status", 1), ("created_at", 1)]),
        db.payment_submissions.create_index([("user_id", 1), ("status", 1)]),
        db.payment_submissions.create_index([("created_at", -1)]),
        db.payment_submissions.create_index("payment_id", unique=True),
        db.payment_settings.create_index("id", unique=True),
        db.ai_provider_settings.create_index("id", unique=True),
        db.midtrans_payments.create_index("order_id", unique=True),
        db.midtrans_payments.create_index([("user_id", 1), ("created_at", -1)]),
        db.custom_templates.create_index([("created_at", -1)]),
    )


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
