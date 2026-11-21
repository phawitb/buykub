-- Up to 20 sample images per product (was 12).
alter table buykub.products drop constraint if exists products_preview_images_check;
alter table buykub.products
  add constraint products_preview_images_check
  check (jsonb_typeof(preview_images) = 'array' and jsonb_array_length(preview_images) <= 20);
