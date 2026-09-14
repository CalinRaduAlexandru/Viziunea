-- Viziunea core member directory. Apply in the Supabase SQL editor.
create extension if not exists pgcrypto;
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  email text not null,
  city text,
  role text not null check (role in ('member','creator','student','collaborator','organizer')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_email_lowercase check (email = lower(trim(email)))
);
create unique index if not exists members_email_unique on public.members (email);
create index if not exists members_role_created_at on public.members (role, created_at desc);
alter table public.members enable row level security;
create policy "public can register" on public.members for insert to anon, authenticated with check (true);
-- Add staff-only policies after configuring Supabase Auth and staff roles.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists members_updated_at on public.members;
create trigger members_updated_at before update on public.members for each row execute function public.set_updated_at();
