-- Hernando Inspections — cloud sync schema.
--
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query
-- → paste this whole file → Run). Safe to re-run: every statement is
-- idempotent (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
--
-- Design: one row per app record, keyed by the same text id the app already
-- generates locally (db.js's uid()) — so a record's id never changes moving
-- between IndexedDB and here. Most of each record's shape lives in a single
-- `data jsonb` column rather than a rigid column-per-field schema, matching
-- how the app already treats these as loosely-typed JS objects; a handful of
-- fields that sync/RLS logic needs to filter on are pulled out as real
-- columns. Every table is scoped to auth.uid() via Row Level Security, so a
-- signed-in user can only ever see and write their own rows regardless of
-- what the app sends — that isolation is enforced by Postgres, not by the
-- client code being well-behaved.
--
-- Photos/videos are NOT stored here — those go in Supabase Storage (a
-- separate bucket, set up in a later phase), with only a metadata row and a
-- storage path in the `media` table below.

create table if not exists clients (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false
);
create index if not exists clients_user_id_idx on clients(user_id);

create table if not exists properties (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false
);
create index if not exists properties_user_id_idx on properties(user_id);
create index if not exists properties_client_id_idx on properties(client_id);

create table if not exists inspections (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  status text,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false
);
create index if not exists inspections_user_id_idx on inspections(user_id);
create index if not exists inspections_client_id_idx on inspections(client_id);

create table if not exists templates (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false
);
create index if not exists templates_user_id_idx on templates(user_id);

create table if not exists comments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false
);
create index if not exists comments_user_id_idx on comments(user_id);

create table if not exists contacts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false
);
create index if not exists contacts_user_id_idx on contacts(user_id);

-- One row per user (not one row per settings key like the local IndexedDB
-- store) — the whole settings object as a single jsonb blob is simpler to
-- sync than many small keyed rows.
create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0
);

-- Metadata only; the actual photo/video bytes live in Storage under
-- `media/{user_id}/{id}` once that phase is wired up.
create table if not exists media (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  inspection_id text not null,
  slot text not null,
  storage_path text,
  meta jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false
);
create index if not exists media_user_id_idx on media(user_id);
create index if not exists media_inspection_id_idx on media(inspection_id);

-- ---------------------------------------------------------------- RLS

alter table clients enable row level security;
alter table properties enable row level security;
alter table inspections enable row level security;
alter table templates enable row level security;
alter table comments enable row level security;
alter table contacts enable row level security;
alter table settings enable row level security;
alter table media enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['clients','properties','inspections','templates','comments','contacts','settings','media']
  loop
    execute format('drop policy if exists "own rows only" on %I', t);
    execute format(
      'create policy "own rows only" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;
