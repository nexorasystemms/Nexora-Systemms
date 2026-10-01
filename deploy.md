# Deploy from GitHub to Namecheap (Stellar Plus)

This is a Vite SPA. The live site must receive the **built** `dist/` folder, not the source `index.html` (that file points at `/src/main.tsx` and shows a blank page).

The recommended path is: **push to GitHub → GitHub Actions builds → FTP upload to cPanel**. Building on GitHub avoids Namecheap shared-hosting memory and Node version limits.

## One-time GitHub setup

1. Push this repo to GitHub (`origin` is already `nexorasystemms/Nexora-Systemms`).
2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**. Add:

| Secret | What to put |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NAMECHEAP_FTP_SERVER` | FTP host from cPanel (often `ftp.yourdomain.com` or `*.web-hosting.com`) |
| `NAMECHEAP_FTP_USERNAME` | cPanel username |
| `NAMECHEAP_FTP_PASSWORD` | cPanel / FTP password |
| `NAMECHEAP_FTP_SERVER_DIR` | Document root **as FTP sees it**, with a trailing slash, e.g. `/public_html/` or `/nexorasystems.solutions/` |

The workflow uses **FTP on port 21** (always available on Stellar Plus). `public/.htaccess` is copied into `dist/` by Vite so React Router paths keep working.

## Everyday updates

```bash
git add .
git commit -m "Your message"
git push origin main
```

That runs **Deploy to Namecheap**. You can also run it by hand: **Actions → Deploy to Namecheap → Run workflow**.

## Optional: pull-and-build on the server

`.cpanel.yml` still runs `scripts/cpanel-deploy.sh` if you clone the repo **outside** the document root in **cPanel → Git Version Control**, then **Deploy HEAD Commit**. That requires **Setup Node.js App** with Node 20+ and `$HOME/.nexora.env` for Vite keys. Prefer GitHub Actions if `npm run build` dies on the shared server.

## Deploy from this computer over FTP (you own the server)

FTP **uploads** the live site. It does **not** create a Git commit. Keep Git for history; use FTP only to publish `dist/`.

1. Copy the FTP lines from `.env.example` into `.env.local` (already gitignored) and fill in host, user, password, and `NAMECHEAP_FTP_SERVER_DIR`.
2. Run:

```bash
npm install
npm run deploy:ftp
```

That builds the app, then uploads `dist/` to the document root. You can also use FileZilla: connect with the same FTP details and upload **everything inside `dist/`** (not the `dist` folder itself) into the document root.

Do not FTP the project source (`src/`, root `index.html`). Visitors would get a blank page.

If FTPS fails with `ERR_TLS_CERT_ALTNAME_INVALID`, Node is checking `ftp.yourdomain.com` against Namecheap’s `*.web-hosting.com` certificate. The deploy script already accepts that shared cert. Prefer the `ftp.` hostname from cPanel (it usually connects faster than the `premiumNNN-N.web-hosting.com` name). Set `NAMECHEAP_FTP_SECURE=0` only if you must use plain FTP.

If you both `git push` (GitHub Actions) and `npm run deploy:ftp`, they publish the same kind of files — pick one as your main path so you do not overwrite yourself by accident.
