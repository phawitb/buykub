begin;
create function buykub.payout_bank_name_matches(full_name text, details text)
returns boolean language plpgsql immutable strict set search_path=pg_catalog as $$
declare account_name text;
begin
  account_name := details::jsonb->>'accountName';
  return coalesce(
    btrim(regexp_replace(normalize(full_name), '[[:space:]]+', ' ', 'g')) =
    btrim(regexp_replace(normalize(account_name), '[[:space:]]+', ' ', 'g')), false);
exception when invalid_text_representation then return false;
end $$;
revoke all on function buykub.payout_bank_name_matches(text,text) from public,anon;
grant execute on function buykub.payout_bank_name_matches(text,text) to authenticated,service_role;
alter table buykub.seller_payout_profiles add constraint payout_bank_name_matches_identity
  check (payout_method <> 'bank' or (full_name_th is not null and bank_details is not null
    and buykub.payout_bank_name_matches(full_name_th,bank_details))) not valid;
notify pgrst,'reload schema';
commit;
