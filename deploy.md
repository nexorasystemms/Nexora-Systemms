# Quick Deployment Guide

## 🚀 Deploy to Vercel (Recommended)

### Step 1: Commit and Push Changes
Run these commands in PowerShell:

```bash
git status
git add .
git commit -m "Fix build errors, add forgot password feature, and prepare for deployment"
git push origin main
```

### Step 2: Deploy to Vercel
1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up/login with GitHub**
3. **Click "New Project"**
4. **Import `nexora-systems` repository**
5. **Framework preset**: Next.js (auto-detected)
6. **Build command**: `npm run build` (auto-detected)
7. **Leave all other settings as default**

### Step 3: Add Environment Variables in Vercel
In the Vercel dashboard, go to **Settings > Environment Variables** and add:

```
NEXT_PUBLIC_SUPABASE_URL=https://gpxzadahxdivuvktjjne.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xFIWJiWtd4rfUL3bX7PFjw_vMtynKwG
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY_FROM_ENV_LOCAL]

SUPABASE_SERVICE_ROLE_KEY=[YOUR_SUPABASE_SERVICE_ROLE_KEY_FROM_ENV_LOCAL]

GMAIL_USER=mubianasaya@gmail.com
GMAIL_APP_PASSWORD=[YOUR_GMAIL_APP_PASSWORD]

CUSTOM_SMTP_HOST=smtp.zoho.com
CUSTOM_SMTP_PORT=587
CUSTOM_SMTP_USER=info@nexorasystems.solutions
CUSTOM_SMTP_PASSWORD=[YOUR_ZOHO_PASSWORD]
CUSTOM_SMTP_FROM=Nexora Systems <info@nexorasystems.solutions>
```

**Note**: Copy the actual values from your `.env.local` file for the bracketed placeholders.

### Step 4: Deploy
Click **Deploy** and wait 2-3 minutes.

## ✅ What You'll Get
- **Live website** at `https://nexora-systems.vercel.app`
- **All features working**: login, registration, forgot password, email verification
- **Free SSL certificate**
- **Custom domain** support (optional)
- **Automatic deployments** from GitHub

## 🔧 If You Want Custom Domain
1. **In Vercel dashboard** → **Settings** → **Domains**
2. **Add your domain** (e.g., `nexorasystems.solutions`)
3. **Update DNS** with provided records
4. **SSL certificate** added automatically

---

## 🎯 Alternative: Cloudflare Pages with Functions

If you prefer Cloudflare, use **Cloudflare Pages + Functions** (not static):

### Cloudflare Settings:
- **Framework preset**: Next.js
- **Build command**: `npm run build`
- **Build output directory**: `.next`
- **Node.js version**: 18.x

Add the same environment variables in Cloudflare Pages dashboard.

---

## 📝 What I Fixed:
✅ **Removed duplicate function** causing build error
✅ **Fixed useEffect setState issue** in borrower registration
✅ **Added forgot password** for both admin and borrower portals
✅ **Added email verification** for borrower registration
✅ **SMTP configuration** ready (Gmail fallback when Zoho is blocked)

The application is ready to deploy!