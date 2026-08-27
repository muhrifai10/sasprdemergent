# Agent Guide

## Layout

- `backend/server.py` is the FastAPI app and owns MongoDB access, auth, plans, payments, and AI generation.
- `frontend/` is a React 19 CRA app run through CRACO. `frontend/src/App.js` is the route map; `frontend/src/lib/api.js` is the shared API client.
- There is no root package/task runner. Run frontend commands from `frontend/` and backend commands from `backend/`.

## Commands

- Frontend install: `cd frontend && yarn install` (the lockfile and `package.json` pin Yarn 1.22.22).
- Frontend dev server: `cd frontend && yarn start`.
- Frontend production build: `cd frontend && yarn build`.
- Frontend tests: `cd frontend && yarn test`.
- Frontend lint: `cd frontend && yarn --silent eslint "src/**/*.{js,jsx}"`.
- Backend dev server: `cd backend && uvicorn server:app --reload`.
- Backend tests: `cd backend && pytest`.
- Run one backend test: `cd backend && pytest tests/test_manual_payment_upgrade.py -k test_admin_can_access_admin_payment_endpoints`.
- `backend/pytest.ini` always adds `-n 2 --dist loadscope`; use `pytest -n 0` for a serial run, not `-p no:xdist`.

## Configuration

- Backend reads `backend/.env` and requires `MONGO_URL`, `DB_NAME`, and `EMERGENT_LLM_KEY`; `AI_PROVIDER`, `AI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_BASE_URL`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`, `VYCEAI_API_KEY`, `VYCEAI_MODEL`, `VYCEAI_MODELS`, `VYCEAI_BASE_URL`, `OPENAGENTIC_API_KEY`, `OPENAGENTIC_MODEL`, `OPENAGENTIC_MODELS`, `OPENAGENTIC_BASE_URL`, `ZAI_API_KEY`, `ZAI_MODEL`, `ZAI_BASE_URL`, `ADMIN_EMAILS`, and `CORS_ORIGINS` are optional overrides. Configured Groq, DeepSeek, VyceAI, OpenAgentic, or Z.ai credentials can be used as fallback when an earlier AI provider is unavailable. Set `AI_PROVIDER=deepseek`, `AI_PROVIDER=vyceai`, `AI_PROVIDER=openagentic`, or `AI_PROVIDER=zai` to use those providers as primary.
- Frontend reads `REACT_APP_BACKEND_URL`; the axios client appends `/api` and sends cookies with `withCredentials`.
- Never put backend keys in frontend code. `.env` files are ignored; do not commit credentials.
- The backend test file loads `/app/frontend/.env` if present and otherwise relies on process environment. Its integration tests require `REACT_APP_BACKEND_URL`, `TEST_ADMIN_SESSION_TOKEN`, `TEST_REGULAR_SESSION_TOKEN`, and `TEST_REGULAR_USER_ID`; missing values cause skips.

## Important Flows

- Login is Emergent OAuth: the callback puts `session_id` in the URL hash, `AuthCallback` exchanges it at `/api/auth/session`, and the backend sets the `session_token` cookie. Preserve this flow and do not add hardcoded or fallback auth URLs.
- AI generation is a server-side background task stored in the in-memory `GENERATION_JOBS` map. The API returns a `job_id`; the frontend polls `/api/generations/{job_id}` rather than relying on a long-lived streaming response.
- Admin authorization is enforced in both `App.js` (`AdminRoute`) and `server.py` (`require_admin`); keep both checks when changing admin features.
- Manual Pro payments are intentionally transfer-and-admin-review only; there is no payment gateway. Approval changes the user plan and expiry, and expired Pro access is normalized on authenticated requests.

## Verification Conventions

- Keep interactive controls tagged with `data-testid`; browser smoke tests depend on these selectors.
- Reuse existing components under `frontend/src/components/ui` and the shared `api` client instead of creating parallel primitives or request clients.
- `test_result.md` begins with a protected testing protocol block. Do not edit or remove that block; append testing data below it when the repository's testing-agent workflow is used.
- Treat `memory/PRD.md`, `auth_testing.md`, and `memory/test_credentials.md` as context and playbooks; verify behavior against code and current environment before relying on historical test reports.
