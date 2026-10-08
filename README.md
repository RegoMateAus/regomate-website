# RegoMate website

Static customer website. Node 24 builds twelve allowlisted pages into `dist/`, separates JavaScript from HTML, adds a strict script policy, bundles the pinned Supabase client, and generates page metadata, `robots.txt` and the public sitemap.

## Checks

```sh
npm ci --ignore-scripts
npm run build
npm test
npm audit --audit-level=high
```

Netlify must publish `dist`, using the committed `netlify.toml`. Never publish the repository root. The backend lives in the separate private `regomate-backend` repository.

## Configuration

Production needs `API_URL`, `SUPABASE_PUBLIC_URL`, `SUPABASE_PUBLIC_KEY` and `STRIPE_PUBLIC_KEY`. Use only verified **publishable** keys. Never put a service-role, Stripe secret, Twilio token, admin password or print secret in this repository or a browser build.

Deploy previews use separate `PREVIEW_API_URL`, `PREVIEW_SUPABASE_URL`, `PREVIEW_SUPABASE_PUBLIC_KEY` and `PREVIEW_STRIPE_PUBLIC_KEY`. If they are absent, previews display the public design but cannot contact production accounts or providers. Keep previews password protected and excluded from indexing.

## Release order

1. Verify the backend migration and API in an isolated environment with synthetic data. Exercise paid, declined and cancelled Stripe checkout, webhook replay and database failures, two different customer identities, signed SMS STOP/delivery callbacks and a print stub.
2. Deploy backend 2.0 with checkout and the worker disabled. Verify `/ready`, ownership checks, provider modes and recovery queues. Set production public values in Netlify.
3. Deploy this frontend and verify account login/recovery, checkout, order status, cancellation, mobile navigation and script policy in the protected preview.
4. Enable billing only after renewal notices and account emails have been verified. Enable SMS/printing only after the sender and print bridge are tested and duplicate jobs reconciled.
5. After the functioning release is reviewed, remove the production password gate so public pages can be indexed. Keep admin/account authentication and preview protection. Submit `/sitemap.xml` to Search Console and inspect real field performance.

An administrator signs in with an individual Supabase account; the backend requires server-managed `app_metadata.role=regomate_admin`. Never grant this role through browser-editable `user_metadata`. Existing shared credentials in Git history must be retired and rotated wherever reused.

The business domain transfer and mail-provider setup are pending. Keep the release closed until support, login and billing messages reach the correct inboxes.
