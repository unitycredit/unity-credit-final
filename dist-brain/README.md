## dist-brain (temporary export)

This folder is a **clean copy** of the Unity Brain “Central Office” logic, prepared to be moved into a fresh Cursor project.

It contains:
- `core/` — prompt engineering + the single `ruleEngine.ts` (finance formulas)
- `storage/` — Supabase multi-domain schema + storage client
- `src/` — portable Express API (no Next.js)
- `admin/` — a starter `admin-dashboard.tsx` control-center UI file (separate frontend in the future)

### Run (dev)

Create `dist-brain/.env`:

```
PORT=4020
UPSTREAM_BRAIN_API_URL=https://your-upstream-brain
UPSTREAM_BRAIN_LICENSE_KEY=your-license
UNITY_APP_ID=UnityCredit-01
UNITY_APP_DOMAIN=your-domain.com

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key_here
```

Then:

```
npm install
npm run dev
```

### API endpoints
- `GET /health`
- `GET /v1/rules/prompts`
- `GET /v1/agents`
- `POST /v1/agents/execute`
- `POST /v1/execute-intelligence`
- `POST /v1/logic/process`
- `POST /v1/finance/snapshot`
- `POST /v1/brain/optimize`
- `POST /v1/professional-advice`
- `GET /v1/admin/stats`


