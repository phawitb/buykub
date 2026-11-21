-- Run with psql against an isolated database after the BUYKUB migrations.
-- Only the shop owner can arrange its products, and only as a complete list.
-- Fixtures and all session settings roll back.
\set ON_ERROR_STOP on
begin;
select gen_random_uuid() seller, gen_random_uuid() outsider, gen_random_uuid() shop, gen_random_uuid() other_shop,
  gen_random_uuid() a, gen_random_uuid() b, gen_random_uuid() c, gen_random_uuid() foreign_product \gset
insert into auth.users(id) values(:'seller'),(:'outsider');
insert into buykub.profiles(id) values(:'seller'),(:'outsider');
insert into buykub.shops(id,owner_id,slug,name,published) values
  (:'shop',:'seller','pos-'||:'shop','Arranged',true),(:'other_shop',:'outsider','pos-'||:'other_shop','Other',true);
insert into buykub.products(id,shop_id,slug,name,price_cents,published) values
  (:'a',:'shop','a','A',100,true),(:'b',:'shop','b','B',100,true),(:'c',:'shop','c','C',100,false),
  (:'foreign_product',:'other_shop','f','F',100,true);
select set_config('test.shop',:'shop',true),set_config('test.a',:'a',true),set_config('test.b',:'b',true),
  set_config('test.c',:'c',true),set_config('test.foreign',:'foreign_product',true);

-- Someone else cannot arrange the shop.
select set_config('request.jwt.claim.sub',:'outsider',true);
set local role authenticated;
do $$declare denied boolean:=false; begin
  begin perform buykub.reorder_products(current_setting('test.shop')::uuid,
    array[current_setting('test.c'),current_setting('test.b'),current_setting('test.a')]::uuid[]);
  exception when insufficient_privilege then denied:=sqlerrm='not_shop_owner'; end;
  assert denied,'outsider cannot reorder';
end$$;
reset role;

select set_config('request.jwt.claim.sub',:'seller',true);
set local role authenticated;
do $$declare s uuid:=current_setting('test.shop')::uuid; a uuid:=current_setting('test.a')::uuid;
  b uuid:=current_setting('test.b')::uuid; c uuid:=current_setting('test.c')::uuid; f uuid:=current_setting('test.foreign')::uuid;
  bad uuid[]; denied boolean;
begin
  foreach bad slice 1 in array array[array[c,b,null],array[c,b,b],array[c,b,f]] loop
    denied:=false;
    begin perform buykub.reorder_products(s,bad);
    exception when invalid_parameter_value then denied:=sqlerrm='product_list_changed'; end;
    assert denied,format('incomplete or foreign list %s is refused',bad);
  end loop;
  denied:=false;
  begin perform buykub.reorder_products(s,array[c,b]);
  exception when invalid_parameter_value then denied:=true; end;
  assert denied,'a list missing a product is refused';

  perform buykub.reorder_products(s,array[c,a,b]);
  assert (select array_agg(id order by position) from buykub.products where shop_id=s)=array[c,a,b],'new order is saved';
  assert (select array_agg(position order by position) from buykub.products where shop_id=s)=array[0,1,2],'positions are dense';
end$$;
reset role;
select position is null as untouched from buykub.products where id=:'foreign_product' \gset
\if :untouched
\else
  \echo 'another shop was changed'
  select 1/0;
\endif
rollback;
