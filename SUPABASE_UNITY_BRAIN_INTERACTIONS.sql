-- Unity Brain: encrypted interaction journal
-- Stores encrypted payloads produced by Unity Credit's Brain-facing routes.
-- Requires `UNITY_VAULT_ENC_KEY` for encryption/decryption on the app side.

create table if not exists public.unity_brain_interactions (
  id text primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('chat', 'decision')),
  source text not null,
  user_id uuid null,
  request_id text null,
  encrypted_payload jsonb not null,
  meta jsonb null
);

create index if not exists unity_brain_interactions_created_at_idx on public.unity_brain_interactions (created_at desc);
create index if not exists unity_brain_interactions_user_id_idx on public.unity_brain_interactions (user_id, created_at desc);
create index if not exists unity_brain_interactions_kind_idx on public.unity_brain_interactions (kind, created_at desc);


