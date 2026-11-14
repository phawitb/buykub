-- Move payout data out of publicly readable shops. Apply BEFORE the new UI.
begin;

create function buykub.valid_thai_national_id(value text)
returns boolean language plpgsql immutable strict set search_path = pg_catalog as $$
declare total integer := 0; i integer;
begin
  if value !~ '^[1-8][0-9]{12}$' then return false; end if;
  for i in 1..12 loop total := total + substring(value, i, 1)::integer * (14 - i); end loop;
  return (11 - total % 11) % 10 = substring(value, 13, 1)::integer;
end $$;

create function buykub.valid_payout_bank_details(value text)
returns boolean language plpgsql immutable strict set search_path = pg_catalog as $$
declare details jsonb;
begin
  details := value::jsonb;
  return coalesce(jsonb_typeof(details) = 'object'
    and details->>'version' = '1'
    and details->>'bankCode' = any(array['scb','bbl','kbank','ktb','ttb','bay','cimbt','lhb','uob','kkp','tisco','tcrb','gsb','baac','ghb','ibank'])
    and details->>'accountNumber' ~ '^[0-9]{6,16}$'
    and char_length(btrim(details->>'accountName')) between 1 and 200, false);
exception when invalid_text_representation then return false;
end $$;

create function buykub.valid_payout_thai_name(value text)
returns boolean language sql immutable strict set search_path = pg_catalog as $$
  select char_length(value) <= 200
    and btrim(value) ~ '^[ก-ฮะ-ฺเ-ๅ็-๎]+( +[ก-ฮะ-ฺเ-ๅ็-๎]+)+$'
    and not exists (select 1 from regexp_split_to_table(btrim(value), ' +') as part where part !~ '[ก-ฮ]');
$$;

create table buykub.seller_payout_profiles (
  shop_id uuid primary key references buykub.shops(id) on delete cascade,
  payout_method text not null default 'promptpay' check (payout_method in ('promptpay', 'bank')),
  promptpay_id text,
  bank_details text,
  full_name_th text,
  contact_phone text,
  national_id text,
  address_line text,
  subdistrict text,
  district text,
  province text,
  postal_code text
);

-- Copy even incomplete/legacy payment data without inventing identity details.
insert into buykub.seller_payout_profiles (shop_id, payout_method, promptpay_id, bank_details)
select id, payout_method, promptpay_id, bank_details from buykub.shops;

-- NOT VALID preserves migrated incomplete profiles, but PostgreSQL enforces the
-- full constraint on EVERY new INSERT/UPDATE (including updates to legacy rows).
alter table buykub.seller_payout_profiles add constraint seller_payout_profile_complete check (
  full_name_th is not null and buykub.valid_payout_thai_name(full_name_th)
  and contact_phone is not null and contact_phone ~ '^0[0-9]{9}$'
  and national_id is not null and buykub.valid_thai_national_id(national_id)
  and address_line is not null and char_length(address_line) between 1 and 500 and address_line ~ '[^[:space:]]'
  and subdistrict is not null and char_length(subdistrict) between 1 and 100 and subdistrict ~ '[^[:space:]]'
  and district is not null and char_length(district) between 1 and 100 and district ~ '[^[:space:]]'
  and province is not null and char_length(province) between 1 and 100 and province ~ '[^[:space:]]'
  and postal_code is not null and postal_code ~ '^[0-9]{5}$'
  and (
    (payout_method = 'promptpay' and promptpay_id is not null
      and promptpay_id ~ '^([0-9]{10}|[0-9]{13})$' and bank_details is null)
    or (payout_method = 'bank' and bank_details is not null
      and buykub.valid_payout_bank_details(bank_details) and promptpay_id is null)
  )
) not valid;

alter table buykub.seller_payout_profiles enable row level security;
alter table buykub.seller_payout_profiles force row level security;
revoke all on buykub.seller_payout_profiles from public, anon, authenticated, service_role;
grant select, insert, update on buykub.seller_payout_profiles to authenticated;
-- Trusted backend/manual payout operations; never use a service key in a browser.
grant select, insert, update on buykub.seller_payout_profiles to service_role;

create policy "owners read private payout profiles" on buykub.seller_payout_profiles
  for select to authenticated using (
    exists (select 1 from buykub.shops where shops.id = shop_id and shops.owner_id = auth.uid())
  );
create policy "owners insert private payout profiles" on buykub.seller_payout_profiles
  for insert to authenticated with check (
    exists (select 1 from buykub.shops where shops.id = shop_id and shops.owner_id = auth.uid())
  );
create policy "owners update private payout profiles" on buykub.seller_payout_profiles
  for update to authenticated using (
    exists (select 1 from buykub.shops where shops.id = shop_id and shops.owner_id = auth.uid())
  ) with check (
    exists (select 1 from buykub.shops where shops.id = shop_id and shops.owner_id = auth.uid())
  );

revoke all on function buykub.valid_thai_national_id(text), buykub.valid_payout_bank_details(text), buykub.valid_payout_thai_name(text) from public, anon;
grant execute on function buykub.valid_thai_national_id(text), buykub.valid_payout_bank_details(text), buykub.valid_payout_thai_name(text) to authenticated, service_role;

update buykub.shops set promptpay_id = null, bank_details = null, payout_method = 'promptpay';
-- Keep legacy columns for old consumers, but prevent them becoming a new leak.
alter table buykub.shops add constraint shops_no_public_payout_details check (promptpay_id is null and bank_details is null);

notify pgrst, 'reload schema';
commit;
