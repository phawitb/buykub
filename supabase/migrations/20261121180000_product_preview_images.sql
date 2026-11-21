-- Sample images shown under "สิ่งที่คุณจะได้รับ" on the product page. Each is
-- uploaded to the public product-images bucket with its blur and watermark
-- already drawn in, so this only lists them: [{id, path, publicUrl, width,
-- height, blur, watermark}].
alter table buykub.products add column if not exists preview_images jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where connamespace = 'buykub'::regnamespace and conname = 'products_preview_images_check'
  ) then
    alter table buykub.products
      add constraint products_preview_images_check
      check (jsonb_typeof(preview_images) = 'array' and jsonb_array_length(preview_images) <= 12);
  end if;
end $$;
