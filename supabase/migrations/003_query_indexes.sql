-- Query shapes used by the directory, Feed and Admin screens.
create index if not exists profiles_name_search on public.profiles using gin (to_tsvector('simple', coalesce(display_name, '')));
create index if not exists profiles_roles_gin on public.profiles using gin (roles);
create index if not exists profiles_interests_gin on public.profiles using gin (interests);
create index if not exists community_posts_interests_gin on public.community_posts using gin (interests);
create index if not exists community_posts_published_created on public.community_posts (status, created_at desc);
create index if not exists community_posts_city_created on public.community_posts (status, city, created_at desc);

