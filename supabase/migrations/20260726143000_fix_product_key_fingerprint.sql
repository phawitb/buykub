-- Supabase installs pgcrypto in the extensions schema.
create or replace function import_product_keys(
  p_product_id uuid,
  p_keys text[]
)
returns table (inserted_count integer, duplicate_count integer)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_key text;
  v_inserted integer := 0;
  v_duplicates integer := 0;
begin
  if not exists (
    select 1
    from products
    join shops on shops.id = products.shop_id
    where products.id = p_product_id
      and shops.owner_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  foreach v_key in array coalesce(p_keys, array[]::text[]) loop
    v_key := btrim(v_key);
    if v_key = '' then
      continue;
    end if;
    insert into product_keys (product_id, key_value, key_fingerprint)
    values (
      p_product_id,
      v_key,
      encode(extensions.digest(convert_to(v_key, 'UTF8'), 'sha256'), 'hex')
    )
    on conflict (product_id, key_fingerprint) do nothing;
    if found then
      v_inserted := v_inserted + 1;
    else
      v_duplicates := v_duplicates + 1;
    end if;
  end loop;

  return query select v_inserted, v_duplicates;
end;
$$;

revoke all on function import_product_keys(uuid, text[]) from public;
grant execute on function import_product_keys(uuid, text[]) to authenticated;
