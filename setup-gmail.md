# Gmail SMTP setup (Supabase Edge Functions)

Use this only as a server-side secret store (Supabase function secrets). Do not add these to Vite or prefix them with `VITE_`.

## 1. Enable 2-Step Verification

In [Google Account Settings](https://myaccount.google.com/) → Security → 2-Step Verification.

## 2. Create an app password

Security → App passwords → Mail → Generate.

## 3. Store secrets outside the repo

Put values in `.env.local` locally (gitignored) and in Supabase secrets for production:

```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=
```

Do not commit the app password or paste it into docs.
