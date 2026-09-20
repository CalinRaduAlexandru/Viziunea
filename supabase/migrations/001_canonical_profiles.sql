-- Canonical member identity. The legacy members table is kept during migration,
-- but new application code should read and write profiles.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists region text;
alter table public.profiles add column if not exists admin_note text not null default '';
alter table public.profiles add column if not exists last_seen_at timestamptz;

create unique index if not exists profiles_email_unique
  on public.profiles (lower(trim(email))) where email is not null;
create index if not exists profiles_directory_filters
  on public.profiles (moderation_status, city, created_at desc);

-- Backfill profiles that already have a corresponding legacy member row.
insert into public.profiles (id, display_name, email, city, roles, interests, admin_note, moderation_status, created_at, updated_at)
select m.id, m.name, lower(trim(m.email)), m.city, coalesce(m.roles, '{}'), coalesce(m.interests, '{}'),
       coalesce(m.admin_note, ''),
       case m.status when 'active' then 'approved' when 'pending' then 'pending' when 'rejected' then 'rejected' else 'pending' end,
       coalesce(m.created_at, now()), coalesce(m.updated_at, now())
from public.members m
where exists (select 1 from auth.users u where u.id = m.id)
on conflict (id) do update set
  display_name = excluded.display_name,
  email = coalesce(excluded.email, public.profiles.email),
  city = excluded.city,
  roles = case when cardinality(excluded.roles) > 0 then excluded.roles else public.profiles.roles end,
  interests = case when cardinality(excluded.interests) > 0 then excluded.interests else public.profiles.interests end,
  updated_at = now();

create or replace view public.admin_profiles as
select id, display_name, email, phone, city, county, region, country,
       roles, interests, moderation_status, admin_note, created_at, updated_at, last_seen_at
from public.profiles;
