-- Run with psql as an administrator against an isolated local database after
-- bootstrap-buykub.sql and the BUYKUB follow-up migrations. The test switches
-- to the real authenticated role for every seller operation and rolls back.
\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;

select gen_random_uuid() seller, gen_random_uuid() other_seller,
  gen_random_uuid() shop, gen_random_uuid() other_shop,
  gen_random_uuid() product, gen_random_uuid() same_owner_product,
  gen_random_uuid() other_product, gen_random_uuid() available_key,
  gen_random_uuid() other_key, gen_random_uuid() assigned_key,
  gen_random_uuid() ord \gset

insert into auth.users(id) values(:'seller'),(:'other_seller');
insert into buykub.profiles(id) values(:'seller'),(:'other_seller');
insert into buykub.shops(id,owner_id,slug,name,published) values
  (:'shop',:'seller','keys-'||:'shop','Owner inventory',true),
  (:'other_shop',:'other_seller','keys-'||:'other_shop','Other inventory',true);
insert into buykub.products(id,shop_id,slug,name,price_cents,delivery_type,published) values
  (:'product',:'shop','source','Source keys',100,'key',true),
  (:'same_owner_product',:'shop','destination','Same-owner keys',100,'key',true),
  (:'other_product',:'other_shop','destination','Other-owner keys',100,'key',true);
insert into buykub.orders(id,shop_id,product_id,buyer_email,price_cents,status)
  values(:'ord',:'shop',:'product','keys@example.invalid',100,'paid');
insert into buykub.product_keys(id,product_id,key_value,key_fingerprint,status,assigned_order_id,assigned_at) values
  (:'available_key',:'product','available-secret',:'available_key','available',null,null),
  (:'other_key',:'other_product','other-secret',:'other_key','available',null,null),
  (:'assigned_key',:'product','assigned-secret',:'assigned_key','assigned',:'ord',now());

select set_config('request.jwt.claim.sub',:'seller',true),
  set_config('test.keys.source',:'product',true),
  set_config('test.keys.destination',:'same_owner_product',true),
  set_config('test.keys.other_product',:'other_product',true),
  set_config('test.keys.available',:'available_key',true),
  set_config('test.keys.other',:'other_key',true),
  set_config('test.keys.assigned',:'assigned_key',true),
  set_config('test.keys.order',:'ord',true);

set local role authenticated;
do $$
declare
  denied boolean := false;
  affected integer;
begin
  assert current_user = 'authenticated', 'seller mutations must exercise RLS';
  assert (select count(*) = 2 from buykub.product_keys), 'seller sees only their own keys';

  -- No WHERE or RETURNING: these would require SELECT and can mask a missing
  -- UPDATE WITH CHECK by also applying the SELECT policy to the resulting row.
  -- RLS itself must filter the old rows and authorize the new product_id.
  begin
    update buykub.product_keys
      set product_id = current_setting('test.keys.other_product')::uuid;
  exception when insufficient_privilege then
    denied := true;
  end;
  assert denied, 'seller cannot move available keys to another owner product';
  assert (select product_id = current_setting('test.keys.source')::uuid
    from buykub.product_keys where id = current_setting('test.keys.available')::uuid),
    'denied transfer leaves the source inventory intact';

  update buykub.product_keys
    set product_id = current_setting('test.keys.destination')::uuid,
        key_value = 'edited-secret'
    where id = current_setting('test.keys.available')::uuid;
  get diagnostics affected = row_count;
  assert affected = 1, 'seller can move and edit an available key within their shop';
  assert buykub.product_available_key_count(current_setting('test.keys.source')::uuid) = 0,
    'assigned keys do not count as available source inventory';
  assert buykub.product_available_key_count(current_setting('test.keys.destination')::uuid) = 1,
    'same-owner transfer moves available inventory to the destination';

  update buykub.product_keys set status = 'disabled'
    where id = current_setting('test.keys.available')::uuid;
  assert buykub.product_available_key_count(current_setting('test.keys.destination')::uuid) = 0,
    'disabling a key removes it from available inventory';
  update buykub.product_keys set status = 'available'
    where id = current_setting('test.keys.available')::uuid;
  assert buykub.product_available_key_count(current_setting('test.keys.destination')::uuid) = 1,
    'seller can restore a disabled key to inventory';

  update buykub.product_keys set key_value = 'tampered'
    where id = current_setting('test.keys.other')::uuid;
  get diagnostics affected = row_count;
  assert affected = 0, 'seller cannot edit another owner key';

  update buykub.product_keys set product_id = current_setting('test.keys.destination')::uuid
    where id = current_setting('test.keys.assigned')::uuid;
  get diagnostics affected = row_count;
  assert affected = 0, 'seller cannot move an assigned key';
  update buykub.product_keys set status = 'available', assigned_order_id = null, assigned_at = null
    where id = current_setting('test.keys.assigned')::uuid;
  get diagnostics affected = row_count;
  assert affected = 0, 'seller cannot release an assigned key';

  denied := false;
  begin
    update buykub.product_keys
      set status = 'assigned', assigned_order_id = current_setting('test.keys.order')::uuid,
          assigned_at = now()
      where id = current_setting('test.keys.available')::uuid;
  exception when insufficient_privilege then
    denied := true;
  end;
  assert denied, 'seller cannot bypass fulfillment by assigning an available key';
end $$;
reset role;

-- Inspect as the administrator so RLS cannot hide any unauthorized side effect.
do $$begin
  assert (select key_value = 'other-secret'
    and product_id = current_setting('test.keys.other_product')::uuid
    from buykub.product_keys where id = current_setting('test.keys.other')::uuid),
    'other owner inventory is unchanged';
  assert (select status = 'assigned' and assigned_order_id = current_setting('test.keys.order')::uuid
    and product_id = current_setting('test.keys.source')::uuid
    from buykub.product_keys where id = current_setting('test.keys.assigned')::uuid),
    'assigned key remains attached to its original product and order';
  assert (select status = 'available' and key_value = 'edited-secret'
    and product_id = current_setting('test.keys.destination')::uuid
    from buykub.product_keys where id = current_setting('test.keys.available')::uuid),
    'valid inventory edits persist without changing assignment state';
end $$;
rollback;
