-- Run after the private payout migration in an isolated local database.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;
select gen_random_uuid() seller, gen_random_uuid() other_seller,
  gen_random_uuid() shop, gen_random_uuid() other_shop \gset
insert into auth.users(id) values(:'seller'),(:'other_seller');
insert into buykub.profiles(id) values(:'seller'),(:'other_seller');
insert into buykub.shops(id,owner_id,slug,name,published) values
  (:'shop',:'seller','payout-'||:'shop','Payout owner',true),
  (:'other_shop',:'other_seller','payout-'||:'other_shop','Other owner',true);
select set_config('request.jwt.claim.sub',:'seller',true),
  set_config('test.payout.shop',:'shop',true), set_config('test.payout.other_shop',:'other_shop',true);
set local role authenticated;
insert into buykub.seller_payout_profiles
  (shop_id,payout_method,promptpay_id,full_name_th,contact_phone,national_id,address_line,subdistrict,district,province,postal_code)
values (:'shop','promptpay','0812345678','สมชาย ใจดี','0812345678','1101700207030','12/3 หมู่ 4','คลองตัน','คลองเตย','กรุงเทพมหานคร','10110')
on conflict(shop_id) do update set contact_phone = excluded.contact_phone;
do $$
declare denied boolean; affected integer; field text; bad text;
begin
  assert current_user = 'authenticated';
  assert (select count(*) = 1 from buykub.seller_payout_profiles), 'owner sees own profile';
  assert not has_table_privilege('anon','buykub.seller_payout_profiles','SELECT'), 'anon has no select grant';
  assert not has_table_privilege('anon','buykub.seller_payout_profiles','INSERT'), 'anon has no insert grant';
  assert not has_table_privilege('anon','buykub.seller_payout_profiles','UPDATE'), 'anon has no update grant';
  assert not has_table_privilege('authenticated','buykub.seller_payout_profiles','DELETE'), 'owner has only required grants';

  for field, bad in select * from (values
    ('full_name_th','John Smith'),('full_name_th','สมชาย'),('full_name_th','สมชาย ใจดี๑'),('full_name_th','่่ ่่'),
    ('full_name_th','สมชาย ใจๆ'),('contact_phone','081-2345678'),('contact_phone','1234567890'),
    ('national_id','1101700207031'),('national_id','0000000000000'),('national_id','110170020703'),
    ('postal_code','1234'),('postal_code','๑๐๑๑๐'),('address_line','  '),('subdistrict',''),('district',''),('province',''),
    ('address_line', E'\t\n'),('subdistrict', E'\t'),('full_name_th',null),('national_id',null),('address_line',null),('contact_phone',null),('postal_code',null),
    ('promptpay_id','123')) as invalid(field,bad)
  loop
    denied := false;
    begin
      execute format('update buykub.seller_payout_profiles set %I = $1 where shop_id = $2',field)
        using bad, current_setting('test.payout.shop')::uuid;
    exception when check_violation then denied := true;
    end;
    assert denied, 'database rejects invalid ' || field;
  end loop;

  -- Invalid edits roll back as a whole and do not erase saved identity.
  assert (select national_id = '1101700207030' and full_name_th = 'สมชาย ใจดี'
    from buykub.seller_payout_profiles where shop_id=current_setting('test.payout.shop')::uuid);
  update buykub.seller_payout_profiles set payout_method='bank',promptpay_id=null,
    bank_details='{"version":1,"bankCode":"scb","accountNumber":"1234567890","accountName":"สมชาย ใจดี"}'
    where shop_id=current_setting('test.payout.shop')::uuid;
  assert (select payout_method='bank' and bank_details is not null from buykub.seller_payout_profiles);
  denied := false;
  begin
    update buykub.seller_payout_profiles set bank_details='{"version":1,"bankCode":"unknown","accountNumber":"1234567890","accountName":"สมชาย"}';
  exception when check_violation then denied := true;
  end;
  assert denied, 'invalid bank details rejected';
  update buykub.seller_payout_profiles set payout_method='promptpay',bank_details=null,promptpay_id='0812345678';

  denied := false;
  begin
    insert into buykub.seller_payout_profiles select current_setting('test.payout.other_shop')::uuid,
      payout_method,promptpay_id,bank_details,full_name_th,contact_phone,national_id,address_line,subdistrict,district,province,postal_code
      from buykub.seller_payout_profiles where shop_id=current_setting('test.payout.shop')::uuid;
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'owner cannot insert into another shop';
  denied := false;
  begin
    update buykub.seller_payout_profiles set shop_id=current_setting('test.payout.other_shop')::uuid;
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'owner cannot move profile into another shop';
  denied := false;
  begin
    update buykub.shops set promptpay_id='0812345678' where id=current_setting('test.payout.shop')::uuid;
  exception when check_violation then denied := true;
  end;
  assert denied, 'legacy shops cannot expose new payout details';
end $$;
reset role;
select set_config('request.jwt.claim.sub',:'other_seller',true);
set local role authenticated;
do $$declare affected integer; denied boolean := false;
begin
  assert (select count(*) = 0 from buykub.seller_payout_profiles), 'non-owner cannot read profile';
  update buykub.seller_payout_profiles set contact_phone='0898765432';
  get diagnostics affected = row_count;
  assert affected=0, 'non-owner cannot update profile';
  begin
    insert into buykub.seller_payout_profiles
      (shop_id,payout_method,promptpay_id,full_name_th,contact_phone,national_id,address_line,subdistrict,district,province,postal_code)
      values (current_setting('test.payout.shop')::uuid,'promptpay','0812345678','สมชาย ใจดี','0812345678','1101700207030','12/3','คลองตัน','คลองเตย','กรุงเทพมหานคร','10110')
      on conflict(shop_id) do update set contact_phone=excluded.contact_phone;
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'non-owner upsert is denied';
end $$;
reset role;
set local role anon;
do $$declare denied boolean := false;
begin
  begin perform * from buykub.seller_payout_profiles;
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'anonymous table reads are denied even for published shops';
end $$;
reset role;
rollback;
