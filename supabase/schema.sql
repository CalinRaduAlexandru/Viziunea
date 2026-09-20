-- Viziunea MVP schema. Safe to re-run in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  county text,
  country text not null default 'România',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'moderator' check (role in ('admin','moderator')),
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.staff_users where user_id = auth.uid()) $$;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  email text not null,
  city text,
  role text not null check (role in ('member','creator','student','collaborator','organizer')),
  status text not null default 'active' check (status in ('active','inactive')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_email_lowercase check (email = lower(trim(email)))
);
create unique index if not exists members_email_unique on public.members (email);
alter table public.members add column if not exists admin_note text not null default '';
alter table public.members add column if not exists roles text[] not null default '{}';
alter table public.members add column if not exists interests text[] not null default '{}';
alter table public.members drop constraint if exists members_status_check;
alter table public.members add constraint members_status_check check (status in ('active','pending','rejected','inactive'));
create index if not exists members_role_created_at on public.members (role, created_at desc);

create table if not exists public.directory_items (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null check (length(trim(title)) between 2 and 180),
  description text not null default '',
  item_type text not null check (item_type in ('person','project','space','course','service','experience','resource','initiative')),
  domain text not null check (domain in ('art','education','tourism','creative_services','cultural_intervention')),
  value_type text not null check (value_type in ('people_skills','knowledge','opportunities','experiences_services','resources_infrastructure','signals_action')),
  tags text[] not null default '{}',
  location_label text,
  city text,
  county text,
  region text,
  country text not null default 'România',
  location_mode text not null default 'location_independent' check (location_mode in ('fixed','travels','remote','hybrid','location_independent')),
  service_area_scope text not null default 'online' check (service_area_scope in ('city','nearby','county','region','national','international','online')),
  travel_radius_km integer check (travel_radius_km is null or travel_radius_km between 1 and 2000),
  contact_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.directory_items add column if not exists region text;
alter table public.directory_items add column if not exists location_label text;
create index if not exists directory_published_domain_type on public.directory_items (status, domain, item_type);
create index if not exists directory_city_county on public.directory_items (country, county, city);
create index if not exists directory_region_city on public.directory_items (country, region, city);
create index if not exists directory_tags_gin on public.directory_items using gin (tags);

create table if not exists public.needs (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  intent text not null check (intent in ('create','find','offer','learn','participate','organize','unsure')),
  query text not null check (length(trim(query)) between 2 and 500),
  community_summary text not null default '' check (length(trim(community_summary)) between 2 and 500),
  city text,
  county text,
  region text,
  country text not null default 'România',
  location_preference text not null default 'flexible' check (location_preference in ('fixed','travels','remote','hybrid','location_independent','flexible')),
  max_distance_km integer check (max_distance_km is null or max_distance_km between 1 and 2000),
  remote_ok boolean not null default false,
  domain text check (domain is null or domain in ('art','education','tourism','creative_services','cultural_intervention')),
  value_type text check (value_type is null or value_type in ('people_skills','knowledge','opportunities','experiences_services','resources_infrastructure','signals_action')),
  status text not null default 'open' check (status in ('open','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.needs add column if not exists region text;
create index if not exists needs_owner_status_created on public.needs (requester_id, status, created_at desc);
create index if not exists needs_community_created on public.needs (status, created_at desc);
create index if not exists needs_geo on public.needs (country, county, city);
create index if not exists needs_region_city on public.needs (country, region, city);

alter table public.needs add column if not exists community_summary text not null default '';
update public.needs set community_summary = 'Caut o soluție pentru o nevoie în comunitate.' where length(trim(community_summary)) < 2;
alter table public.needs alter column community_summary drop default;

create or replace function public.sanitize_community_need()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.community_summary := regexp_replace(new.query, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email eliminat]', 'gi');
  new.community_summary := regexp_replace(new.community_summary, 'https?://[^[:space:]]+', '[link eliminat]', 'gi');
  new.community_summary := regexp_replace(new.community_summary, '[+0-9][0-9 ().-]{6,}[0-9]', '[telefon eliminat]', 'g');
  if length(trim(new.community_summary)) < 2 then new.community_summary := 'Caut o soluție pentru o nevoie în comunitate.'; end if;
  return new;
end;
$$;
drop trigger if exists needs_sanitize_community on public.needs;
create trigger needs_sanitize_community before insert or update of query on public.needs for each row execute function public.sanitize_community_need();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'needs_community_summary_length') then
    alter table public.needs add constraint needs_community_summary_length check (length(trim(community_summary)) between 2 and 500);
  end if;
end $$;

create or replace function public.is_open_need(target_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.needs where id = target_id and status = 'open') $$;

create or replace function public.set_need_status(target_id uuid, requested_status text)
returns setof public.needs language plpgsql security definer set search_path = public
as $$
begin
  if requested_status not in ('open','resolved','closed') then
    raise exception 'Invalid need status';
  end if;
  return query update public.needs
    set status = requested_status
    where id = target_id and requester_id = auth.uid()
    returning *;
  if not found then raise exception 'Need not found or not owned by current user'; end if;
end;
$$;

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  submitted_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  suggestion_type text not null check (suggestion_type in ('referral','self')),
  name text not null check (length(trim(name)) between 2 and 180),
  description text not null default '',
  contact_url text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists suggestions_need_status on public.suggestions (need_id, status, created_at desc);
create index if not exists suggestions_submitter on public.suggestions (submitted_by, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  need_id uuid references public.needs(id) on delete cascade,
  suggestion_id uuid references public.suggestions(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created on public.notifications (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists members_updated_at on public.members;
create trigger members_updated_at before update on public.members for each row execute function public.set_updated_at();
drop trigger if exists directory_items_updated_at on public.directory_items;
create trigger directory_items_updated_at before update on public.directory_items for each row execute function public.set_updated_at();
drop trigger if exists needs_updated_at on public.needs;
create trigger needs_updated_at before update on public.needs for each row execute function public.set_updated_at();

create or replace function public.notify_requester_on_approval()
returns trigger language plpgsql security definer set search_path = public
as $$
declare owner_id uuid;
begin
  if old.status = 'pending' and new.status = 'approved' then
    select requester_id into owner_id from public.needs where id = new.need_id;
    insert into public.notifications(user_id, need_id, suggestion_id, title, body)
    values (owner_id, new.need_id, new.id, 'A apărut o sugestie pentru nevoia ta', 'Echipa Viziunea a aprobat o sugestie. Deschide notificarea pentru detalii.');
  end if;
  return new;
end;
$$;
drop trigger if exists suggestion_approval_notification on public.suggestions;
create trigger suggestion_approval_notification after update of status on public.suggestions for each row execute function public.notify_requester_on_approval();

-- The public view deliberately excludes requester_id and all account/profile fields.
create or replace view public.community_needs with (security_barrier = true) as
select id, intent, community_summary as query, city, county, region, country, location_preference, max_distance_km, remote_ok, created_at
from public.needs where status = 'open';

alter table public.profiles enable row level security;
alter table public.staff_users enable row level security;
alter table public.members enable row level security;
alter table public.directory_items enable row level security;
alter table public.needs enable row level security;
alter table public.suggestions enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profile owner read" on public.profiles;
create policy "profile owner read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
drop policy if exists "profile owner write" on public.profiles;
create policy "profile owner write" on public.profiles for all to authenticated using (id = auth.uid() or public.is_staff()) with check (id = auth.uid() or public.is_staff());
drop policy if exists "staff can read own role" on public.staff_users;
create policy "staff can read own role" on public.staff_users for select to authenticated using (user_id = auth.uid() or public.is_staff());
-- No client policy grants insert/update/delete on staff_users. Provision staff with SQL only.

drop policy if exists "members public can register" on public.members;
drop policy if exists "public can register" on public.members;
create policy "members public can register" on public.members for insert to anon, authenticated with check (true);
drop policy if exists "staff manage members" on public.members;
create policy "staff manage members" on public.members for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "published directory read" on public.directory_items;
create policy "published directory read" on public.directory_items for select to anon, authenticated using (status = 'published' or public.is_staff());
drop policy if exists "staff manage directory" on public.directory_items;
create policy "staff manage directory" on public.directory_items for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "owner or staff read needs" on public.needs;
create policy "owner or staff read needs" on public.needs for select to authenticated using (requester_id = auth.uid() or public.is_staff());
drop policy if exists "owner create needs" on public.needs;
create policy "owner create needs" on public.needs for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "owner update needs" on public.needs;
create policy "owner update needs" on public.needs for update to authenticated using (requester_id = auth.uid() or public.is_staff()) with check (requester_id = auth.uid() or public.is_staff());
drop policy if exists "owner delete needs" on public.needs;
create policy "owner delete needs" on public.needs for delete to authenticated using (requester_id = auth.uid() or public.is_staff());

drop policy if exists "submitter or staff read suggestions" on public.suggestions;
create policy "submitter or staff read suggestions" on public.suggestions for select to authenticated using (submitted_by = auth.uid() or public.is_staff() or (status = 'approved' and exists (select 1 from public.needs n where n.id = need_id and n.requester_id = auth.uid())));
drop policy if exists "signed in users submit suggestions" on public.suggestions;
create policy "signed in users submit suggestions" on public.suggestions for insert to authenticated with check (submitted_by = auth.uid() and public.is_open_need(need_id));
drop policy if exists "staff moderate suggestions" on public.suggestions;
create policy "staff moderate suggestions" on public.suggestions for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "user read own notifications" on public.notifications;
create policy "user read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "user mark own notifications" on public.notifications;
create policy "user mark own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "staff create notifications" on public.notifications;
create policy "staff create notifications" on public.notifications for insert to authenticated with check (public.is_staff());

grant select on public.directory_items to anon, authenticated;
grant select on public.community_needs to anon, authenticated;
revoke insert, update, delete on public.needs from authenticated;
grant select on public.needs to authenticated;
grant insert (intent,query,city,county,region,country,location_preference,max_distance_km,remote_ok,domain,value_type) on public.needs to authenticated;
grant update (intent,query,city,county,region,country,location_preference,max_distance_km,remote_ok,domain,value_type) on public.needs to authenticated;
grant delete on public.needs to authenticated;
grant execute on function public.set_need_status(uuid,text) to authenticated;
revoke insert on public.suggestions from authenticated;
grant select, update on public.suggestions to authenticated;
grant insert (need_id,suggestion_type,name,description,contact_url,note) on public.suggestions to authenticated;
grant select, update on public.notifications to authenticated;
grant insert on public.notifications to authenticated;
grant select on public.members to authenticated;
grant update (status, admin_note) on public.members to authenticated;
grant insert on public.members to anon, authenticated;
grant update, delete on public.members to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.staff_users to authenticated;
grant insert, update, delete on public.directory_items to authenticated;

-- Seed the public directory; repeated runs update the same stable slugs.
insert into public.directory_items (slug,title,description,item_type,domain,value_type,tags,location_label,city,county,region,country,location_mode,service_area_scope,travel_radius_km,contact_url,status) values
('foto-constanta','Fotograf pentru proiecte creative','Fotograf de portret și documentar disponibil pentru proiecte și evenimente locale.','person','creative_services','people_skills',array['fotograf','fotografie','portret','eveniment','foto'],'Constanța','Constanța','Constanța','Sud-Est','România','travels','county',80,'https://example.org/fotograf','published'),
('spatiu-evenimente-bucuresti','Spațiu pentru evenimente independente','Sală modulară pentru expoziții, performance și întâlniri comunitare.','space','art','resources_infrastructure',array['spațiu','eveniment','expoziție','sală','locație'],'București','București','București','București-Ilfov','România','fixed','city',null,'https://example.org/spatiu','published'),
('atelier-ceramica-cluj','Atelier de ceramică','Ateliere introductive de ceramică pentru grupuri mici.','course','art','knowledge',array['atelier','ceramică','curs','artă','învățare'],'Atelier de ceramică, Cluj-Napoca','Cluj-Napoca','Cluj','Nord-Vest','România','fixed','city',null,'https://example.org/ceramica','published'),
('hiking-macin','Hiking în Munții Măcinului','Tur ghidat pe trasee din Munții Măcinului, cu accent pe natură și patrimoniu local.','experience','tourism','experiences_services',array['hiking','drumeție','natură','Munții Măcinului','Măcin','tur ghidat'],'Munții Măcinului','Greci','Tulcea','Sud-Est','România','fixed','nearby',null,'https://example.org/macin','published'),
('tur-cultural-constanta','Experiență culturală în Constanța','Plimbare ghidată prin poveștile și arhitectura multiculturală a orașului.','experience','tourism','experiences_services',array['experiență culturală','tur','patrimoniu','Constanța','istorie'],'Centrul vechi, Constanța','Constanța','Constanța','Sud-Est','România','fixed','city',null,'https://example.org/tur-cultural','published'),
('mentor-branding-online','Mentorat de branding','Sesiuni individuale online pentru clarificarea identității și poziționării unui proiect.','service','creative_services','people_skills',array['consultant branding','branding','mentor','consultanță','online','remote'],null,'București','București','București-Ilfov','România','remote','online',null,'https://example.org/mentorat','published'),
('kit-sunet-tulcea','Kit mobil de sunet','Echipament audio compact disponibil pentru împrumut în județul Tulcea.','resource','creative_services','resources_infrastructure',array['echipament','sunet','audio','microfon','resursă'],'Tulcea','Tulcea','Tulcea','Sud-Est','România','travels','county',60,'https://example.org/kit-sunet','published'),
('colaborare-scenografie','Oportunitate de colaborare în scenografie','Căutăm colaboratori pentru dezvoltarea unor instalații scenografice temporare.','project','art','opportunities',array['colaborare','scenografie','proiect','oportunitate','decor'],null,'București','București','București-Ilfov','România','hybrid','national',null,'https://example.org/scenografie','published'),
('semnal-spatii-culturale','Inițiativa Semnal pentru spații culturale','Inițiativă de documentare a spațiilor culturale independente și a nevoilor lor.','initiative','cultural_intervention','signals_action',array['intervenție culturală','semnal','inițiativă','spații culturale','educație'],null,'','',null,'România','location_independent','national',null,'https://example.org/semnal','published'),
('editor-video-remote','Editor video pentru proiecte','Editare și post-producție video, colaborare complet remote.','service','creative_services','experiences_services',array['editor video','video','editare','remote','film'],null,'','',null,'România','remote','online',null,'https://example.org/video','published')
on conflict (slug) do update set title=excluded.title, description=excluded.description, item_type=excluded.item_type, domain=excluded.domain, value_type=excluded.value_type, tags=excluded.tags, location_label=excluded.location_label, city=excluded.city, county=excluded.county, region=excluded.region, country=excluded.country, location_mode=excluded.location_mode, service_area_scope=excluded.service_area_scope, travel_radius_km=excluded.travel_radius_km, contact_url=excluded.contact_url, status=excluded.status;

-- Create the first staff user manually after that user has signed in once:
-- insert into public.staff_users (user_id, role)
-- select id, 'admin' from auth.users where email = 'admin@example.com'
-- on conflict (user_id) do update set role = excluded.role;

-- Scalable profile/preferences layer. These tables are intentionally normalized so
-- new roles and interests do not require adding columns to profiles.
alter table public.profiles add column if not exists roles text[] not null default '{}';
alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles add column if not exists moderation_status text not null default 'pending';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_moderation_status_check') then
    alter table public.profiles add constraint profiles_moderation_status_check check (moderation_status in ('pending','approved','rejected'));
  end if;
end $$;
create index if not exists profiles_moderation_city on public.profiles (moderation_status, country, city);

create table if not exists public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (length(trim(role)) between 2 and 80),
  created_at timestamptz not null default now(),
  primary key (profile_id, role)
);
create table if not exists public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest text not null check (length(trim(interest)) between 2 and 100),
  created_at timestamptz not null default now(),
  primary key (profile_id, interest)
);
create index if not exists profile_roles_role on public.profile_roles (role, profile_id);
create index if not exists profile_interests_interest on public.profile_interests (interest, profile_id);

create table if not exists public.feed_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  city text,
  radius_km integer not null default 50 check (radius_km between 1 and 2000),
  interests text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 180),
  body text not null check (length(trim(body)) between 2 and 5000),
  post_type text not null check (post_type in ('update','project','request','event','opportunity','offer')),
  city text,
  interest text,
  status text not null default 'pending' check (status in ('pending','published','rejected','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_posts_feed on public.community_posts (status, city, interest, created_at desc);
create index if not exists community_posts_author on public.community_posts (author_id, created_at desc);

create or replace function public.is_approved_member(target_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = target_id and moderation_status = 'approved') $$;

alter table public.profile_roles enable row level security;
alter table public.profile_interests enable row level security;
alter table public.feed_preferences enable row level security;
alter table public.community_posts enable row level security;

drop policy if exists "profile roles owner or staff" on public.profile_roles;
create policy "profile roles owner or staff" on public.profile_roles for all to authenticated using (profile_id = auth.uid() or public.is_staff()) with check (profile_id = auth.uid() or public.is_staff());
drop policy if exists "profile interests owner or staff" on public.profile_interests;
create policy "profile interests owner or staff" on public.profile_interests for all to authenticated using (profile_id = auth.uid() or public.is_staff()) with check (profile_id = auth.uid() or public.is_staff());
drop policy if exists "feed preferences owner" on public.feed_preferences;
create policy "feed preferences owner" on public.feed_preferences for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "published posts read" on public.community_posts;
create policy "published posts read" on public.community_posts for select to anon, authenticated using (status = 'published');
drop policy if exists "approved members create posts" on public.community_posts;
create policy "approved members create posts" on public.community_posts for insert to authenticated with check (author_id = auth.uid() and status = 'pending' and public.is_approved_member());
drop policy if exists "authors update own posts" on public.community_posts;
create policy "authors update own posts" on public.community_posts for update to authenticated using (author_id = auth.uid() or public.is_staff()) with check ((author_id = auth.uid() and status = 'pending') or public.is_staff());
drop policy if exists "staff moderate posts" on public.community_posts;
create policy "staff moderate posts" on public.community_posts for delete to authenticated using (public.is_staff());

grant select, insert, update, delete on public.profile_roles, public.profile_interests, public.feed_preferences to authenticated;
grant select on public.community_posts to anon, authenticated;
grant insert, update, delete on public.community_posts to authenticated;

-- A member may edit identity/preferences, never their own moderation decision.
revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name, city, county, country, roles, interests) on public.profiles to authenticated;
grant update (display_name, city, county, country, roles, interests) on public.profiles to authenticated;
create or replace function public.moderate_profile(target_id uuid, next_status text)
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare result public.profiles;
begin
  if not public.is_staff() then raise exception 'Only staff can moderate profiles'; end if;
  if next_status not in ('pending','approved','rejected') then raise exception 'Invalid moderation status'; end if;
  update public.profiles set moderation_status = next_status where id = target_id returning * into result;
  if result.id is null then raise exception 'Profile not found'; end if;
  return result;
end;
$$;
grant execute on function public.moderate_profile(uuid,text) to authenticated;
drop trigger if exists feed_preferences_updated_at on public.feed_preferences;
create trigger feed_preferences_updated_at before update on public.feed_preferences for each row execute function public.set_updated_at();
drop trigger if exists community_posts_updated_at on public.community_posts;
create trigger community_posts_updated_at before update on public.community_posts for each row execute function public.set_updated_at();
