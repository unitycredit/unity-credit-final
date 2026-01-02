-- ==========================================================
-- Unity Deals Library (Data Sovereignty) — Supabase Postgres
-- Run in Supabase SQL Editor
-- ==========================================================

create extension if not exists pgcrypto;

-- Stores proprietary savings “patterns” and community benchmarks.
-- - kind='deal': percent-based savings pattern (0..1) for a (category, merchant_norm)
-- - kind='recurring_benchmark': community average monthly cost for a (category, merchant_norm)
create table if not exists public.unity_deals_library (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'deal', -- deal | recurring_benchmark
  category text not null,            -- insurance | phone | utilities | internet | subscription | other
  merchant text not null,
  merchant_norm text not null,
  saving_pct numeric null,           -- 0..1 (deal patterns)
  avg_monthly_price numeric null,    -- dollars/month (benchmarks)
  sample_count integer not null default 1,
  source text not null default 'ai', -- ai | manual
  active boolean not null default true,
  notes text null,
  meta jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unity_deals_library_kind_chk check (kind in ('deal','recurring_benchmark')),
  constraint unity_deals_library_source_chk check (source in ('ai','manual')),
  constraint unity_deals_library_saving_pct_chk check (saving_pct is null or (saving_pct >= 0 and saving_pct <= 1)),
  constraint unity_deals_library_avg_price_chk check (avg_monthly_price is null or (avg_monthly_price >= 0)),
  constraint unity_deals_library_kind_fields_chk check (
    (kind = 'deal' and saving_pct is not null)
    or
    (kind = 'recurring_benchmark' and avg_monthly_price is not null)
  )
);

-- Unique key for deterministic upserts
create unique index if not exists unity_deals_library_unique_key
  on public.unity_deals_library (kind, category, merchant_norm);

-- Query helpers
create index if not exists unity_deals_library_active_idx
  on public.unity_deals_library (active, kind, category);

create index if not exists unity_deals_library_merchant_norm_idx
  on public.unity_deals_library (merchant_norm);

-- Keep server-only: disable RLS (service-role access).
alter table public.unity_deals_library disable row level security;

-- Maintain updated_at automatically (shared helper)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_unity_deals_library_updated_at on public.unity_deals_library;
create trigger set_unity_deals_library_updated_at
  before update on public.unity_deals_library
  for each row execute function public.set_updated_at();


