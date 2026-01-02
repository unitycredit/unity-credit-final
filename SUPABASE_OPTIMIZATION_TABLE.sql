-- UnityCredit: Optimization Catalog table (server-only writes)
-- Run this in Supabase SQL Editor.

create table if not exists public.optimization (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null,
  verification jsonb null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists optimization_kind_created_at_idx
  on public.optimization (kind, created_at desc);

-- Optional: RLS off for this table if only service-role writes/reads are used server-side.
alter table public.optimization disable row level security;


