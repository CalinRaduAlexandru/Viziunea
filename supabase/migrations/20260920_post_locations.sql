alter table public.community_posts add column if not exists location_label text;
alter table public.community_posts add column if not exists latitude double precision;
alter table public.community_posts add column if not exists longitude double precision;
alter table public.community_posts add column if not exists place_id text;

create index if not exists community_posts_location on public.community_posts (city, latitude, longitude);
