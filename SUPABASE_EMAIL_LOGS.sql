-- ==========================================================
-- UnityCredit Email Delivery Logs (Resend) — Supabase Postgres
-- Run in Supabase SQL Editor
-- ==========================================================

create extension if not exists pgcrypto;

-- Track every outbound email queued/sent via Resend.
-- Primary key is the email job id (we use it as an idempotency key).
create table if not exists public.email_logs (
  id text primary key,
  provider text not null default 'resend',
  kind text not null default 'raw', -- otp | welcome | negotiator | optimization | raw | ...
  to_email text not null,
  subject text not null,
  status text not null default 'queued', -- queued | sent | failed
  resend_id text null,
  error text null,
  meta jsonb null,
  queued_at timestamptz not null default now(),
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hot-path indexes (admin dashboards / filters)
create index if not exists email_logs_created_at_idx on public.email_logs (created_at desc);
create index if not exists email_logs_to_email_idx on public.email_logs (to_email, created_at desc);
create index if not exists email_logs_status_idx on public.email_logs (status, created_at desc);
create index if not exists email_logs_kind_idx on public.email_logs (kind, created_at desc);

-- Keep this server-only: disable RLS (service-role access).
alter table public.email_logs disable row level security;

-- Maintain updated_at automatically
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_email_logs_updated_at on public.email_logs;
create trigger set_email_logs_updated_at
  before update on public.email_logs
  for each row execute function public.set_updated_at();


