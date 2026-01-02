## dist-brain Inventory (Logic & Brain Extraction)

This document lists **project files related to**:
- AI prompting / agent configuration
- financial calculations / rule engine
- backend database interaction (Supabase + long-lived AI insights)

Notes:
- `node_modules/**` and `unity-brain/dist/**` are excluded.
- Unity Credit UI components are excluded.
- `/dist-brain` is a **clean copy** ready to move into a fresh project.

---

### A) AI prompting / agent configuration

**Unity Brain (canonical)**
- `unity-brain/core/prompts.ts`
- `unity-brain/src/brain/upstreamConnector.ts`
- `unity-brain/src/routes/agents.ts`
- `unity-brain/src/routes/executeIntelligence.ts`
- `unity-brain/src/routes/logicProcess.ts`
- `unity-brain/src/routes/optimize.ts`
- `unity-brain/src/routes/professionalAdvice.ts`
- `unity-brain/src/routes/rules.ts`
- `unity-brain/src/server.ts`

**Unity Credit (proxies only; no prompt ownership)**
- `lib/unity-brain-office.ts`
- `app/api/logic/process/route.ts` (proxy → Central Office)
- `app/api/brain/optimize/route.ts` (proxy → Central Office)
- `app/api/professional-advice/route.ts` (proxy → Central Office)
- `app/api/unity-brain/v1/route.ts` (proxy → Central Office execute-intelligence)

---

### B) Financial calculations / rule engine

**Unity Brain (canonical)**
- `unity-brain/core/ruleEngine.ts`
- `unity-brain/ruleEngine.ts` (re-export)
- `unity-brain/src/routes/finance.ts`
- `unity-brain/src/routes/logicProcess.ts` (uses snapshot in prompt rules)

**Unity Credit (no formulas; only proxies)**
- `app/api/finance/snapshot/route.ts` (proxy → Central Office)
- `app/dashboard/page.tsx` (fetches computed snapshot; no computeCreditSummary)
- `lib/finance/financeLogic.ts` (deprecated stub; no formulas)
- `lib/finance/calculations.ts` (deprecated re-export stub)

---

### C) Backend database interaction (Supabase + storage)

**Unity Brain (global storage; multi-domain)**
- `unity-brain/storage/supabase.ts`
- `unity-brain/storage/UNITY_BRAIN_GLOBAL_SCHEMA.sql`
- `unity-brain/src/routes/logicProcess.ts` (writes interactions best-effort)
- `unity-brain/src/config.ts` (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)

**Unity Credit (app-specific DB interactions; not part of brain extraction)**
- `lib/supabase-admin.ts`
- `lib/supabase-server.ts`
- `lib/supabase-browser.ts`
- `lib/supabase.ts`
- `lib/runtime-env.ts`
- `lib/plaid-token-store.ts`
- `app/api/bank/**` (Plaid + transaction persistence)
- `app/api/cards/**` / `lib/actions/cards.ts` (credit card CRUD)
- `app/api/savings-finder/**` (writes `user_savings_snapshots`)
- `lib/unity-brain/interaction-store.ts` (older per-app interaction store)

---

### Extracted clean copy: `/dist-brain`

This folder contains the **portable brain-only service** (no Next.js, no UI dependencies):
- `dist-brain/core/prompts.ts`
- `dist-brain/core/ruleEngine.ts`
- `dist-brain/src/brain/upstreamConnector.ts`
- `dist-brain/src/routes/*` (agents, execute-intelligence, logic, optimize, finance, admin stats)
- `dist-brain/storage/*` (Supabase client + global schema SQL)
- `dist-brain/src/server.ts`
- `dist-brain/package.json`, `dist-brain/tsconfig.json`

Admin UI placeholder (to be used in a future admin app):
- `dist-brain/admin/admin-dashboard.tsx`

---

### Quick “move to fresh project” checklist

Copy the entire `dist-brain/` directory into a new repo and run:

```
npm install
npm run dev
```

Required env vars (in the new project):
- `PORT` (optional; defaults to 4020)
- `UPSTREAM_BRAIN_API_URL`
- `UPSTREAM_BRAIN_LICENSE_KEY`
- `UNITY_APP_ID`
- `UNITY_APP_DOMAIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`


