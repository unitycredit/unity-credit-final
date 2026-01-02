-- ==========================================================
-- Unity Brain License Manager — Supabase Postgres
-- Run in Supabase SQL Editor
-- ==========================================================

create extension if not exists pgcrypto;

create table if not exists public.unity_brain_licenses (
  id uuid primary key default gen_random_uuid(),
  app_name text not null, -- Savings | Business | Travel | other
  license_key text not null, -- 64-char Brain Token
  status text not null default 'active', -- active | revoked
  usage_count bigint not null default 0,
  last_seen_at timestamptz null,
  last_domain text null, -- savings | inventory | travel
  last_seen_app text null,
  last_ip text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unity_brain_licenses_status_chk check (status in ('active','revoked'))
);

create unique index if not exists unity_brain_licenses_key_uidx on public.unity_brain_licenses (license_key);
create index if not exists unity_brain_licenses_status_idx on public.unity_brain_licenses (status, updated_at desc);
create index if not exists unity_brain_licenses_usage_idx on public.unity_brain_licenses (usage_count desc);

alter table public.unity_brain_licenses disable row level security;

-- ==========================================================
-- Unity Brain License Manager — Supabase Postgres
-- Run in Supabase SQL Editor
-- ==========================================================

create extension if not exists pgcrypto;

-- NOTE:
-- We store a SHA-256 hash of the 64-char token (not the plaintext secret),
-- plus a short prefix for admin display.
create table if not exists public.unity_brain_licenses (
  id uuid primary key default gen_random_uuid(),
  app_name text not null, -- Savings | Business | Travel (free-form)
  license_key text not null, -- SHA-256 hex hash of token
  license_prefix text not null, -- first 8 chars of token for display
  status text not null default 'active', -- active | revoked
  usage_count bigint not null default 0,
  last_seen_at timestamptz null,
  last_seen_app text null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unity_brain_licenses_status_chk check (status in ('active','revoked'))
);

create unique index if not exists unity_brain_licenses_key_uq on public.unity_brain_licenses (license_key);
create index if not exists unity_brain_licenses_status_idx on public.unity_brain_licenses (status, updated_at desc);
create index if not exists unity_brain_licenses_app_idx on public.unity_brain_licenses (app_name, updated_at desc);

alter table public.unity_brain_licenses disable row level security;

-- ==========================================================
-- Unity Brain License Manager — Supabase Postgres
-- Run in Supabase SQL Editor
-- ==========================================================

create extension if not exists pgcrypto;

-- License keys are stored as SHA-256 hashes (license_key) for security.
-- The plaintext token is shown ONLY once at creation time in the admin UI.
create table if not exists public.unity_brain_licenses (
  id uuid primary key default gen_random_uuid(),
  app_name text not null,                    -- Savings | Business | Travel
  license_key text not null unique,          -- sha256 hex of plaintext token (64 chars)
  status text not null default 'active',     -- active | revoked
  usage_count bigint not null default 0,     -- best-effort counter (not per-request writes)
  last_used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unity_brain_licenses_status_chk check (status in ('active','revoked'))
);

create index if not exists unity_brain_licenses_app_idx on public.unity_brain_licenses (app_name, status, updated_at desc);
create index if not exists unity_brain_licenses_used_idx on public.unity_brain_licenses (last_used_at desc);

alter table public.unity_brain_licenses disable row level security;

-- Maintain updated_at automatically (shared helper may already exist)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_unity_brain_licenses_updated_at on public.unity_brain_licenses;
create trigger set_unity_brain_licenses_updated_at
  before update on public.unity_brain_licenses
  for each row execute function public.set_updated_at();


