-- Read-only deployment check; includes no customer rows or secrets.
select
  has_function_privilege('anon','buykub.begin_stripe_product_checkout(uuid,uuid)','EXECUTE') as anon_can_reserve,
  has_function_privilege('authenticated','buykub.begin_stripe_product_checkout(uuid,uuid)','EXECUTE') as authenticated_can_reserve,
  has_function_privilege('service_role','buykub.begin_stripe_product_checkout(uuid,uuid)','EXECUTE') as service_role_can_reserve,
  pg_get_functiondef('buykub.begin_stripe_product_checkout(uuid,uuid)'::regprocedure) as reservation_function,
  pg_get_functiondef('buykub.bind_course_order()'::regprocedure) as order_identity_function;
-- Expected privileges: false, true, true. The function must check Google identity
-- and auth.users.email_confirmed_at before selecting/locking the product.
-- New contexts bind buyer_user_id for all delivery types; the order trigger uses
-- that account email for fulfillment and leaves legacy contexts with no buyer alone.
