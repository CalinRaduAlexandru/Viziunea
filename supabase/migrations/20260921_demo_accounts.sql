-- Permanent demo identities. The corresponding users must exist in Supabase Auth
-- with these exact emails; profiles are linked to auth.users and cannot be
-- created safely from the browser with the public key.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists contact_method text not null default 'platform';
alter table public.profiles add column if not exists contact_value text not null default '';
alter table public.profiles add column if not exists social_links jsonb not null default '{}'::jsonb;

insert into public.profiles
  (id, display_name, email, city, roles, interests, contact_method, contact_value, social_links, moderation_status, updated_at)
select u.id, v.display_name, lower(v.email), v.city, v.roles, v.interests,
       v.contact_method, v.contact_value, v.social_links, 'approved', now()
from auth.users u
join (values
  ('Zametheea Popescu', 'zametheea@demo.viziunea.ro', 'București', array['Creator','Participant']::text[], array['Artă','Experiențe']::text[], 'whatsapp', '+40 744 321 907', '{"linkedin":"https://linkedin.com/in/zametheea","instagram":"https://instagram.com/zametheea"}'::jsonb),
  ('Radu Călin', 'radu.calin@demo.viziunea.ro', 'București', array['Creator','Participant']::text[], array['Artă','Proiecte']::text[], 'platform', 'Mesaj pe Viziunea', '{"linkedin":"https://linkedin.com/in/radu-calin","instagram":"https://instagram.com/radu.calin"}'::jsonb)
) as v(display_name, email, city, roles, interests, contact_method, contact_value, social_links)
  on lower(u.email) = lower(v.email)
on conflict (id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  city = excluded.city,
  roles = excluded.roles,
  interests = excluded.interests,
  contact_method = excluded.contact_method,
  contact_value = excluded.contact_value,
  social_links = excluded.social_links,
  moderation_status = 'approved',
  updated_at = now();
