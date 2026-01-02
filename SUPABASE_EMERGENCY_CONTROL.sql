-- ==========================================================
-- Emergency Kill-Switch & Maintenance Mode — Supabase Postgres
-- Run in Supabase SQL Editor
-- ==========================================================

create extension if not exists pgcrypto;

-- Key/value emergency controls.
-- Keys:
-- - global_site_access
-- - advice_engine
-- - email_dispatch
create table if not exists public.emergency_control (
  key text primary key,
  enabled boolean not null default true,
  resume_at timestamptz null,
  reason text null,
  updated_at timestamptz not null default now()
);

-- Keep server-only (service-role writes). RLS disabled.
alter table public.emergency_control disable row level security;

-- Seed defaults (idempotent)
insert into public.emergency_control (key, enabled)
values
  ('global_site_access', true),
  ('advice_engine', true),
  ('email_dispatch', true)
on conflict (key) do nothing;

-- Hot-path index for resume scans
create index if not exists emergency_control_resume_idx on public.emergency_control (enabled, resume_at);


