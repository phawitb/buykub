# send-product-key

Sends an assigned product key through Resend. The request contains only the
order ID and the one-time fulfilment token returned by the atomic checkout RPC.
The function reloads the key using the Supabase service role.

Required production secrets:

```sh
npx supabase secrets set RESEND_API_KEY=re_xxx
npx supabase secrets set RESEND_FROM_EMAIL='BUYKUB <orders@mail.buykub.com>'
```

Replies default to `support@buykub.com`. Set `RESEND_REPLY_TO_EMAIL` only when
the support address needs to change.

Deploy as a public checkout endpoint; request authorization is provided by the
unpredictable order/token pair:

```sh
npx supabase functions deploy send-product-key --no-verify-jwt
```
