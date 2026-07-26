# send-product-key

Sends an assigned product key through Resend. The request contains only the
order ID and the one-time fulfilment token returned by the atomic checkout RPC.
The function reloads the key using the Supabase service role.

Required production secrets:

```sh
npx supabase secrets set RESEND_API_KEY=re_xxx
npx supabase secrets set RESEND_FROM_EMAIL='Framelink <orders@your-verified-domain.com>'
```

Deploy as a public checkout endpoint; request authorization is provided by the
unpredictable order/token pair:

```sh
npx supabase functions deploy send-product-key --no-verify-jwt
```
