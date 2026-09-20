insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Post images are publicly readable" on storage.objects;
create policy "Post images are publicly readable"
on storage.objects for select
using (bucket_id = 'post-images');

drop policy if exists "Members can upload post images" on storage.objects;
create policy "Members can upload post images"
on storage.objects for insert to authenticated
with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Members can delete their post images" on storage.objects;
create policy "Members can delete their post images"
on storage.objects for delete to authenticated
using (bucket_id = 'post-images' and owner_id = auth.uid()::text);
