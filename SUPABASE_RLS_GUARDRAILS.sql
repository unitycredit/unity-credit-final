-- ==========================================================
-- UnityCredit RLS Guardrails (Security & Stability First)
-- Goal: No authenticated user can ever read/write another user's data,
--       and "server-only" tables remain inaccessible from anon/auth clients
--       even if application logic makes a mistake.
--
-- Run in Supabase SQL Editor AFTER the base schema scripts.
-- ==========================================================

-- ---------- 1) User-scoped tables ----------

-- Unity Brain interaction journal (encrypted payloads)
alter table if exists public.unity_brain_interactions enable row level security;
alter table if exists public.unity_brain_interactions force row level security;

drop policy if exists "Users can read own brain interactions" on public.unity_brain_interactions;
create policy "Users can read own brain interactions"
  on public.unity_brain_interactions for select
  using (auth.uid() = user_id);

-- Writes are server-driven; do not allow direct writes from anon/auth.
drop policy if exists "No direct writes (unity_brain_interactions)" on public.unity_brain_interactions;
create policy "No direct writes (unity_brain_interactions)"
  on public.unity_brain_interactions for all
  using (false)
  with check (false);


-- Plaid transactions table (if enabled) should already have read-own policy.
-- Keep inserts server-only unless you explicitly add an insert policy later.
alter table if exists public.plaid_transactions enable row level security;
alter table if exists public.plaid_transactions force row level security;

drop policy if exists "Users can view own plaid transactions" on public.plaid_transactions;
create policy "Users can view own plaid transactions"
  on public.plaid_transactions for select
  using (auth.uid() = user_id);


-- ---------- 2) Server-only tables ----------
-- These tables contain operational, admin, or global intelligence data.
-- We enable RLS + FORCE it, and explicitly deny anon/auth access.

do $$
begin
  -- Optimization snapshots/catalog
  execute 'alter table if exists public.optimization enable row level security';
  execute 'alter table if exists public.optimization force row level security';
  execute 'drop policy if exists "No direct access (optimization)" on public.optimization';
  execute 'create policy "No direct access (optimization)" on public.optimization for all using (false) with check (false)';

  -- Email delivery logs (admin-only)
  execute 'alter table if exists public.email_logs enable row level security';
  execute 'alter table if exists public.email_logs force row level security';
  execute 'drop policy if exists "No direct access (email_logs)" on public.email_logs';
  execute 'create policy "No direct access (email_logs)" on public.email_logs for all using (false) with check (false)';

  -- Admin alert config (admin-only)
  execute 'alter table if exists public.admin_alert_config enable row level security';
  execute 'alter table if exists public.admin_alert_config force row level security';
  execute 'drop policy if exists "No direct access (admin_alert_config)" on public.admin_alert_config';
  execute 'create policy "No direct access (admin_alert_config)" on public.admin_alert_config for all using (false) with check (false)';

  -- Emergency control (admin-only)
  execute 'alter table if exists public.emergency_control enable row level security';
  execute 'alter table if exists public.emergency_control force row level security';
  execute 'drop policy if exists "No direct access (emergency_control)" on public.emergency_control';
  execute 'create policy "No direct access (emergency_control)" on public.emergency_control for all using (false) with check (false)';

  -- Unity deals library (global intelligence; admin/server-only)
  execute 'alter table if exists public.unity_deals_library enable row level security';
  execute 'alter table if exists public.unity_deals_library force row level security';
  execute 'drop policy if exists "No direct access (unity_deals_library)" on public.unity_deals_library';
  execute 'create policy "No direct access (unity_deals_library)" on public.unity_deals_library for all using (false) with check (false)';

  -- Unity savings vault + knowledge assets (encrypted intelligence; admin/server-only)
  execute 'alter table if exists public.unity_savings_vault enable row level security';
  execute 'alter table if exists public.unity_savings_vault force row level security';
  execute 'drop policy if exists "No direct access (unity_savings_vault)" on public.unity_savings_vault';
  execute 'create policy "No direct access (unity_savings_vault)" on public.unity_savings_vault for all using (false) with check (false)';

  execute 'alter table if exists public.unity_knowledge_assets enable row level security';
  execute 'alter table if exists public.unity_knowledge_assets force row level security';
  execute 'drop policy if exists "No direct access (unity_knowledge_assets)" on public.unity_knowledge_assets';
  execute 'create policy "No direct access (unity_knowledge_assets)" on public.unity_knowledge_assets for all using (false) with check (false)';

  -- Unity brain licenses (admin/server-only)
  execute 'alter table if exists public.unity_brain_licenses enable row level security';
  execute 'alter table if exists public.unity_brain_licenses force row level security';
  execute 'drop policy if exists "No direct access (unity_brain_licenses)" on public.unity_brain_licenses';
  execute 'create policy "No direct access (unity_brain_licenses)" on public.unity_brain_licenses for all using (false) with check (false)';
end $$;


