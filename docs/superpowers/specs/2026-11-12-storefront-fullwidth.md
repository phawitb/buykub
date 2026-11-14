# Full-width storefront and buyer workspace

User authorizes design and implementation without another approval step.

- Public storefront fills viewport width; seller storefront fills available workspace width.
- Management is the real storefront with discreet, labelled icon controls. Appearance editing uses an accessible floating dialog; customer preview hides editing controls.
- All new purchases require verified Google sign-in. Delivery and receipt email is taken from that account on the server, never a typed checkout email.
- Accounts without a shop see purchases and an explicit Open shop action. Merchant navigation and merchant landing pages stay hidden until a shop exists.
- Preserve existing private purchases, course access, refunds, seller ownership checks, draft recovery, and storefront cache invalidation.

Validate targeted regressions, full test suite/lint/build, authenticated browser UI and anonymous checkout gate. Deploy to Vercel without alias first, inspect, then promote and verify buykub.com.
