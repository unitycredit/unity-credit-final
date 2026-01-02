-- ==========================================================
-- Unity Savings Vault (Independent Intelligence Storage)
-- Supabase Postgres + encrypted payloads (app-level)
-- Run in Supabase SQL Editor
-- ==========================================================

create extension if not exists pgcrypto;

-- Stores normalized “savings intelligence” records.
-- Data is encrypted before storage:
-- - encrypted_payload is a JSON string containing v/alg/iv/tag/data (base64 fields)
--   produced by AES-256-GCM in the app layer.
create table if not exists public.unity_savings_vault (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'pattern',          -- pattern | negotiation_success | advice
  category text not null,                        -- insurance | phone | utilities | internet | subscription | other
  merchant text not null,
  merchant_norm text not null,
  success_count integer not null default 1,
  last_seen_at timestamptz not null default now(),
  encrypted_payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unity_savings_vault_kind_chk check (kind in ('pattern','negotiation_success','advice'))
);

create unique index if not exists unity_savings_vault_unique_key
  on public.unity_savings_vault (kind, category, merchant_norm);

create index if not exists unity_savings_vault_last_seen_idx
  on public.unity_savings_vault (last_seen_at desc);

alter table public.unity_savings_vault disable row level security;

-- Knowledge assets metadata (files stored in Supabase Storage bucket, encrypted in app layer).
create table if not exists public.unity_knowledge_assets (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  sha256 text not null,
  storage_bucket text not null default 'unity-knowledge',
  storage_path text not null,
  encrypted boolean not null default true,
  notes text null,
  created_at timestamptz not null default now()
);

create unique index if not exists unity_knowledge_assets_sha_idx
  on public.unity_knowledge_assets (sha256);

alter table public.unity_knowledge_assets disable row level security;


