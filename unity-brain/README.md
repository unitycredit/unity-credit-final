## unity-brain (Central Office API)

This service is the "Central Office" for Unity apps:
- Stores and serves **prompt/rulesets**
- Runs the **5-agent consensus** execution by proxying to the upstream Brain runtime
- Hosts **finance math rules** (single source of truth)
- Writes Unity Intelligence insights/interactions into a **shared Supabase schema** usable by multiple domains

### Run (dev)

Create `unity-brain/.env`:

```
PORT=4020
UPSTREAM_BRAIN_API_URL=http://localhost:4021
UPSTREAM_BRAIN_LICENSE_KEY=your-license
UNITY_APP_ID=UnityCredit-01
UNITY_APP_DOMAIN=localhost:3002

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key_here
```

Then:

```
npm install
npm run dev
```

### API

- `GET /health`
- `GET /v1/rules/prompts`
- `POST /v1/logic/process`
- `POST /v1/finance/snapshot`


