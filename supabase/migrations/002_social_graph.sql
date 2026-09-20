-- Durable social interactions. These replace browser-only state once the app
-- is connected to Supabase.
create table if not exists public.post_saves (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);
create index if not exists post_saves_profile_created on public.post_saves (profile_id, created_at desc);

create table if not exists public.post_likes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);
create index if not exists post_likes_post_created on public.post_likes (post_id, created_at desc);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists post_comments_thread on public.post_comments (post_id, parent_id, created_at);
create index if not exists post_comments_author on public.post_comments (author_id, created_at desc);

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
create index if not exists conversation_members_profile on public.conversation_members (profile_id, joined_at desc);

alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
create index if not exists messages_conversation_created on public.messages (conversation_id, created_at);

alter table public.notifications add column if not exists entity_type text;
alter table public.notifications add column if not exists entity_id uuid;
create index if not exists notifications_user_unread on public.notifications (user_id, read_at, created_at desc);

