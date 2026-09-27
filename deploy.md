# Quick deployment (Netlify)

This app is a Vite SPA. Do not commit real credentials. Set secrets in the Netlify UI only.

## Build settings

These are already in `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`

## Environment variables

In **Site configuration → Environment variables**, add:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

SMTP is used by **Supabase Edge Functions**, not by the Vite client bundle. Set these on the **Supabase** project (or function secrets), not as `VITE_` variables:

```
CUSTOM_SMTP_HOST=
CUSTOM_SMTP_PORT=587
CUSTOM_SMTP_USER=
CUSTOM_SMTP_PASSWORD=
CUSTOM_SMTP_FROM=
```

Never prefix SMTP or service-role keys with `VITE_`. Never paste live passwords into markdown or commit `.env.local`.
