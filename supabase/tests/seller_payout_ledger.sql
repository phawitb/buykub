\set ON_ERROR_STOP on
begin;
do $$ begin
  if has_table_privilege('anon','buykub.seller_payout_batches','select') or has_table_privilege('authenticated','buykub.seller_payout_observations','select') or has_table_privilege('authenticated','buykub.seller_payout_slips','select') then raise exception 'ledger leaked'; end if;
  if has_function_privilege('authenticated','buykub.prepare_seller_payout_batch(uuid,text,uuid)','execute') or has_function_privilege('authenticated','buykub.attach_seller_payout_slip(uuid,uuid,text,text,integer)','execute') then raise exception 'private operation exposed'; end if;
  if (select mode <> 'manual' or schedule_enabled from buykub.seller_payout_settings) then raise exception 'unsafe defaults'; end if;
  if (select public from storage.buckets where id='seller-payout-slips') then raise exception 'slips bucket is public'; end if;
end $$;
-- Complete runnable financial fixture. No external service calls.
insert into buykub.orders(id,shop_id,price_cents,status,mock,payment_method,stripe_payment_intent_id,paid_at)
values('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',10001,'paid',false,'stripe','pi_test',now()-interval '10 days');
update buykub.seller_payout_profiles set full_name_th='สมชาย ใจดี',contact_phone='0812345678',national_id='1234567890121',address_line='1',subdistrict='ก',district='ก',province='ก',postal_code='10110',payout_method='bank',promptpay_id=null,bank_details='{"version":1,"bankCode":"scb","accountNumber":"1234567890","accountName":"สมชาย ใจดี"}';
insert into buykub.seller_payout_observations(order_id,payment_intent_id,charge_id,balance_transaction_id,eligible,reason,gross_cents,refunded_cents,net_cents,checked_at)
values('10000000-0000-0000-0000-000000000001','pi_test','ch_test','txn_test',true,'eligible',10001,0,9501,now());
do $$ declare b uuid; b2 uuid; b3 uuid; observation jsonb; begin
 b:=buykub.prepare_seller_payout_batch(null,'test:1','00000000-0000-0000-0000-000000000002');
 b2:=buykub.prepare_seller_payout_batch(null,'test:1','00000000-0000-0000-0000-000000000002');
 if b is null or b<>b2 or (select amount_cents<>9501 from buykub.seller_payout_batches where id=b) then raise exception 'retry or amount failed'; end if;
 if (select recipient_snapshot ?| array['national_id','address_line','nationalId','address'] from buykub.seller_payout_batches where id=b) then raise exception 'identity leaked into instructions'; end if;
 if buykub.prepare_seller_payout_batch(null,'test:2','00000000-0000-0000-0000-000000000002') is not null then raise exception 'double allocation'; end if;
 begin perform buykub.complete_manual_seller_payout(null,b,'bank-reference-1',now()); raise exception 'accepted missing receipt'; exception when check_violation then if sqlerrm<>'payout_slip_required' then raise; end if; end;
 perform buykub.cancel_seller_payout_batch(null,b);
 b2:=buykub.prepare_seller_payout_batch(null,'test:3','00000000-0000-0000-0000-000000000002');
 if b2 is null then raise exception 'cancel did not release'; end if;
 perform buykub.attach_seller_payout_slip(null,b2,b2::text||'/20000000-0000-0000-0000-000000000001.png','image/png',100);
 begin perform buykub.cancel_seller_payout_batch(null,b2); raise exception 'cancelled possible real transfer'; exception when check_violation then if sqlerrm<>'slip_attached_possible_transfer_do_not_cancel' then raise; end if; end;
 -- The recipient changes AFTER a real transfer. Preserve truthful original
 -- payment record; never release its orders for a second transfer.
 update buykub.seller_payout_profiles set address_line='changed';
 perform buykub.review_seller_payout_batches();
 if (select status from buykub.seller_payout_batches where id=b2)<>'review_required' then raise exception 'recipient change not detected'; end if;
 perform buykub.complete_manual_seller_payout(null,b2,'bank-reference-1',date_trunc('minute',now()));
 perform buykub.complete_manual_seller_payout(null,b2,'bank-reference-1',now());
 if (select status<>'completed' or not completion_review_required from buykub.seller_payout_batches where id=b2) then raise exception 'actual transfer not recorded'; end if;
 if buykub.prepare_seller_payout_batch(null,'test:4','00000000-0000-0000-0000-000000000002') is not null then raise exception 'paid allocation released'; end if;
 begin perform buykub.cancel_seller_payout_batch(null,b2); raise exception 'cancelled paid batch'; exception when check_violation then null; end;
 begin perform buykub.attach_seller_payout_slip(null,b2,b2::text||'/20000000-0000-0000-0000-000000000002.png','image/png',100); raise exception 'replaced completed receipt'; exception when check_violation then if sqlerrm<>'completed_slip_immutable' then raise; end if; end;
 insert into buykub.orders values('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',1000,'paid',false,'stripe','pi_test2',now()-interval '10 days');
 insert into buykub.seller_payout_observations values('10000000-0000-0000-0000-000000000002','pi_test2','ch_test2','txn_test2',true,'eligible',1000,0,950,now());
 b3:=buykub.prepare_seller_payout_batch(null,'test:5','00000000-0000-0000-0000-000000000002');
 if b3 is null then raise exception 'historical warning permanently blocked fresh valid funds'; end if;
 perform buykub.attach_seller_payout_slip(null,b3,b3::text||'/20000000-0000-0000-0000-000000000003.pdf','application/pdf',100);
 begin perform buykub.complete_manual_seller_payout(null,b3,'BANK-REFERENCE-1',now()); raise exception 'accepted duplicate bank reference'; exception when unique_violation then null; end;
 perform buykub.complete_manual_seller_payout(null,b3,'bank-reference-2',now());
 -- A late, older successful response cannot erase a newer adverse response.
 select to_jsonb(v) into observation from buykub.seller_payout_observations v where order_id='10000000-0000-0000-0000-000000000001';
 perform buykub.record_seller_payout_observation(observation||jsonb_build_object('eligible',false,'reason','refund_pending','checked_at',now()+interval '1 second'));
 perform buykub.record_seller_payout_observation(observation);
 if (select eligible from buykub.seller_payout_observations where order_id='10000000-0000-0000-0000-000000000001') then raise exception 'older eligibility overwrote adverse state'; end if;
 if not buykub.seller_payout_shop_requires_review('00000000-0000-0000-0000-000000000002') then raise exception 'paid refund risk ignored'; end if;
 update buykub.seller_payout_observations set eligible=true,refunded_cents=100,net_cents=9406 where order_id='10000000-0000-0000-0000-000000000001';
 if not buykub.seller_payout_shop_requires_review('00000000-0000-0000-0000-000000000002') then raise exception 'refund debt ignored'; end if;
 begin perform buykub.configure_seller_payouts(null,'automatic',false); raise exception 'enabled unavailable provider'; exception when check_violation then null; end;
end $$;
rollback;
