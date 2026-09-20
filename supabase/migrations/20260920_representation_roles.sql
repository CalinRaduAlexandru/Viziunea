alter table public.community_posts
  drop constraint if exists community_posts_representation_type_check;

update public.community_posts
set representation_type = case representation_type
  when 'self' then 'founder'
  when 'on_behalf' then 'representative'
  when 'proposal' then 'observer'
  else representation_type
end
where representation_type in ('self', 'on_behalf', 'proposal');

alter table public.community_posts
  add constraint community_posts_representation_type_check
  check (representation_type in ('founder','representative','collaborator','supporter','observer'));
