-- How many pages the delivered PDF has. The gallery shows a handful of sample
-- pages and counts them ("3 / 5"), which a buyer can read as the whole product
-- being five pages long. The file's own length is a different number, so the
-- product page has to be able to say both.
alter table buykub.products add column if not exists file_page_count integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where connamespace = 'buykub'::regnamespace and conname = 'products_file_page_count_check'
  ) then
    alter table buykub.products
      add constraint products_file_page_count_check
      check (file_page_count is null or file_page_count > 0);
  end if;
end $$;
