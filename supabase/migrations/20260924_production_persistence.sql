-- Production persistence for the social graph.
-- Safe to run after schema.sql and the previous migrations. It does not delete
-- demo data; demo accounts continue to use the browser fallback until they are
-- provisioned as real Supabase Auth users.

-- Some environments were bootstrapped only with public content tables.
-- Create messaging primitives before adding their social-graph columns.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  need_id uuid,
  suggestion_id uuid,
  type text not null default 'system',
  related_id uuid,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications add column if not exists need_id uuid;
alter table public.notifications add column if not exists suggestion_id uuid;
alter table public.notifications add column if not exists type text not null default 'system';
alter table public.notifications add column if not exists related_id uuid;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists created_at timestamptz not null default now();
alter table public.messages add column if not exists read_at timestamptz;
alter table public.messages add column if not exists created_at timestamptz not null default now();

create table if not exists public.post_saves (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);
create table if not exists public.post_likes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.comment_mentions (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, mentioned_profile_id)
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','group')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, profile_id)
);
alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.notifications add column if not exists sender_id uuid references auth.users(id) on delete set null;

create table if not exists public.post_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);
create index if not exists post_interests_post_created on public.post_interests (post_id, created_at desc);
create index if not exists post_interests_profile_created on public.post_interests (profile_id, created_at desc);

alter table public.post_saves enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.post_interests enable row level security;

drop policy if exists "post saves owner read" on public.post_saves;
create policy "post saves owner read" on public.post_saves for select to authenticated using (profile_id = auth.uid());
drop policy if exists "post saves owner write" on public.post_saves;
create policy "post saves owner write" on public.post_saves for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "post likes public read" on public.post_likes;
create policy "post likes public read" on public.post_likes for select to authenticated using (true);
drop policy if exists "post likes owner write" on public.post_likes;
create policy "post likes owner write" on public.post_likes for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "post comments public read" on public.post_comments;
create policy "post comments public read" on public.post_comments for select to anon, authenticated using (true);
drop policy if exists "post comments member write" on public.post_comments;
create policy "post comments member write" on public.post_comments for insert to authenticated with check (author_id = auth.uid() and public.is_approved_member());
drop policy if exists "post comments author update" on public.post_comments;
create policy "post comments author update" on public.post_comments for update using (author_id = auth.uid() or public.is_staff()) with check (author_id = auth.uid() or public.is_staff());
drop policy if exists "post comments author delete" on public.post_comments;
create policy "post comments author delete" on public.post_comments for delete using (author_id = auth.uid() or public.is_staff());

drop policy if exists "post interests public read" on public.post_interests;
create policy "post interests public read" on public.post_interests for select to authenticated using (true);
drop policy if exists "post interests owner write" on public.post_interests;
create policy "post interests owner write" on public.post_interests for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "conversation members own read" on public.conversation_members;
create policy "conversation members own read" on public.conversation_members for select to authenticated using (profile_id = auth.uid());
drop policy if exists "conversation members own update" on public.conversation_members;
create policy "conversation members own update" on public.conversation_members for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "conversation members create" on public.conversation_members;
create policy "conversation members create" on public.conversation_members for insert to authenticated with check (profile_id = auth.uid() or public.is_staff());

drop policy if exists "conversation participant read" on public.conversations;
create policy "conversation participant read" on public.conversations for select to authenticated using (created_by = auth.uid() or exists (select 1 from public.conversation_members m where m.conversation_id = id and m.profile_id = auth.uid()));
drop policy if exists "conversation member create" on public.conversations;
create policy "conversation member create" on public.conversations for insert to authenticated with check (created_by = auth.uid());

grant select, insert, update, delete on public.post_saves, public.post_likes, public.post_comments, public.post_interests to authenticated;
grant select on public.comment_mentions to authenticated;
grant select, insert on public.conversations, public.conversation_members to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

drop policy if exists "conversation messages read" on public.messages;
create policy "conversation messages read" on public.messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "conversation messages send" on public.messages;
create policy "conversation messages send" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.is_approved_member());
drop policy if exists "conversation messages mark read" on public.messages;
create policy "conversation messages mark read" on public.messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

grant select, insert, update on public.messages to authenticated;

drop policy if exists "member activity notifications" on public.notifications;
create policy "member activity notifications" on public.notifications for insert to authenticated
with check (sender_id = auth.uid() and type in ('interest', 'mention'));
grant insert on public.notifications to authenticated;
