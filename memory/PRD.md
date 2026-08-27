# PRD — PRD CreativeAI (built on Emergent)

## Original Problem Statement
Build "PRD CreativeAI" — AI SaaS that turns product ideas into complete 42-section PRDs and AI Coding Agent implementation prompts enforcing a strict FRONTEND → BACKEND → INTEGRATION workflow. Full master prompt provided by user (42 PRD sections, agent prompt structure, phases, dashboard, templates, admin, subscriptions, export, etc.). Initial scope chosen by user: **Landing page + core MVP**.

## User Choices
- Scope: Landing page + core MVP (auth, dashboard, create project, generate PRD & agent prompt)
- AI: Emergent Universal Key (openai gpt-5.4 via emergentintegrations)
- Auth: Emergent-managed Google login
- Content: Bilingual ID/EN (toggle)

## Architecture
- FastAPI + MongoDB (motor), React 19 + Tailwind + shadcn, framer-motion, lenis, react-fast-marquee, react-markdown
- AI generation runs as **server-side background job** (asyncio task, in-memory GENERATION_JOBS) polled via GET /api/generations/{job_id} — required because ingress cuts streaming responses at ~60s while a full 42-section PRD takes ~130s
- Collections: users, user_sessions, projects, prd_documents (versioned), ai_prompts (versioned), usage_records
- Config via backend/.env: EMERGENT_LLM_KEY, AI_PROVIDER, AI_MODEL, and optional OpenAI-compatible Groq, DeepSeek, VyceAI, or Z.ai credentials

## API (all /api, cookie or Bearer session auth)
- POST /auth/session, GET /auth/me, POST /auth/logout
- CRUD /projects, GET /stats
- POST /projects/{id}/generate-prd, POST /projects/{id}/generate-agent-prompt → {job_id}
- GET /generations/{job_id} → {status, content, error}
- GET/PUT /projects/{id}/prd, GET /projects/{id}/prompt

## Implemented (2026-06)
- Awwwards-style dark landing page (Cabinet Grotesk/Manrope, kinetic hero line reveal, marquee ribbon, numbered manifesto, bento features, workflow viz, PRD/prompt showcases, testimonials, pricing, FAQ accordion, CTA/footer), bilingual ID/EN, lenis smooth scroll
- Google login (Emergent), protected routes, AuthCallback per playbook
- Dashboard (stats + recent projects), Projects list (search/delete), Create Project form (free-form description + 12 optional structured fields)
- Project detail: Overview / PRD / Agent Prompt tabs; live-progress generation (polling), 42-section PRD verified (exactly 42 `##` sections), agent prompt verified (PHASE 1/2/3 + 3 completion reports), output language ID/EN selector, PRD inline editing, copy + .md download, regenerate (creates new version), error state with retry
- Usage records logged per generation (provider, model, chars, status)
- **PRD Templates** (2026-06): GET /api/templates (backend/templates_data.py) — 6 bilingual templates (SaaS, Marketplace, Mobile App, E-Commerce, AI SaaS, Internal Tool); picker on Create Project page prefills all 12 requirement fields per active language, "Blank" resets
- **Export & hero redesign** (2026-06): prominent "Export PRD.md" + "Copy AI Agent Prompt" action bar on project detail header; quick download/copy icons on project cards (fetch on demand). Hero redesigned: centered layout, gradient accent headline, 3-column pipeline panel; heading font switched Cabinet Grotesk → **Clash Display** (user disliked previous design/font)
- **Landing font change** (2026-06): superseded — **entire app (landing + dashboard) now uses Plus Jakarta Sans** globally (body + .font-display); Clash Display/Manrope removed from index.css & App.css
- **Admin + Plans + Share** (2026-06):
  - Admin: ADMIN_EMAILS env (rifaichannel02@gmail.com → auto admin on login); /api/admin/stats, /admin/users (list + PUT change plan/role/suspend), /admin/usage (last 50 records), /admin/templates (POST custom template to db.custom_templates, DELETE); /admin page with 4 tabs; sidebar Admin link only for role=admin; suspended users blocked (403)
  - Plans (PLANS dict in server.py): free = 5 projects & 20 gens/month; pro/enterprise unlimited. Enforced at create_project + both generate endpoints. GET /api/me/limits; plan badge in sidebar + usage line on dashboard. Payment NOT integrated (architecture only per user request — admin changes plans manually)
  - Share: POST /projects/{id}/share (enabled bool) → share_id on project; public GET /api/public/share/{share_id} (no auth) returns PRD + Prompt; public /share/:shareId page (read-only, copy, CTA); share buttons on project detail header

- **Manual Pro payments (2026-08):**
  - Admin payment configuration: `/api/admin/payment-settings` stores bank name, account number, account holder, Pro price, duration, and instructions in MongoDB. Admin dashboard now has a Payments tab to configure recipient account and review submissions.
  - User upgrade flow: `/upgrade` displays configured transfer instructions, Pro price/duration, transfer-confirmation form, and personal payment history. One pending submission per user is enforced.
  - Manual verification: `/api/admin/payments` lists submissions; approve/reject is admin-only. Approval upgrades the user to Pro, adds/extends `pro_expires_at`, and expired Pro access automatically reverts to Free.
  - Access/data consistency: `/admin` has a frontend admin role guard plus backend authorization; manual Free/Enterprise changes clear a stale `pro_expires_at` field.
  - Verification: testing agent backend suite passed 5/5; API smoke test and browser role-guard test passed. No payment gateway is integrated or mocked—this is an intentional manual-transfer workflow.

- **Code quality hardening (2026-08):**
  - Manual-payment backend tests now receive all test sessions and user IDs exclusively from `TEST_ADMIN_SESSION_TOKEN`, `TEST_REGULAR_SESSION_TOKEN`, and `TEST_REGULAR_USER_ID`; no session token literals remain in source.
  - Auth plan-expiry validation is split into focused helpers (`get_session_token`, `as_utc_datetime`, `ensure_active_plan`) to keep request authorization maintainable.
  - React async loaders use stable callbacks/effect dependencies; auth failures are logged rather than silently discarded. Static landing/dashboard list keys now use stable identifiers.
  - Frontend has a maintained flat ESLint config at `frontend/eslint.config.mjs`. Final verification: ESLint clean, manual-payment pytest 5/5, and admin/upgrade route smoke tests pass.

## Backlog (P0/P1/P2)
- P0: User verification: configure the real transfer destination and price in Admin → Pembayaran; verify it with the real Google admin account.
- P1: PRD version history UI (versions stored in DB already), prompt version list/restore
- P1: Section-level regenerate, PDF/DOCX/JSON export
- P1: Duplicate/archive project, sort/filter
- P2: Optional transfer-proof upload and admin audit trail (requires a storage integration decision); payment gateway integration remains out of scope.

## Test Notes
- Test identity in /app/memory/test_credentials.md (seeded session token); auth playbook at /app/auth_testing.md
- Verified via curl (auth, CRUD, generation jobs, stats) + browser screenshots (landing, dashboard, PRD render, prompt render)
