-- Add only BUYKUB storage; existing bucket inventory was empty before setup.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']),
       ('product-files','product-files',false,52428800,null);
create policy "buykub public product images" on storage.objects for select to anon, authenticated
using (bucket_id='product-images');
create policy "buykub owners read files" on storage.objects for select to authenticated
using (bucket_id='product-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "buykub owners upload assets" on storage.objects for insert to authenticated
with check (bucket_id in ('product-images','product-files') and (storage.foldername(name))[1]=auth.uid()::text);
create policy "buykub owners update assets" on storage.objects for update to authenticated
using (bucket_id in ('product-images','product-files') and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id in ('product-images','product-files') and (storage.foldername(name))[1]=auth.uid()::text);
create policy "buykub owners remove assets" on storage.objects for delete to authenticated
using (bucket_id in ('product-images','product-files') and (storage.foldername(name))[1]=auth.uid()::text);
commit;
