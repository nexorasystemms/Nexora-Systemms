# Deployment Guide - Next.js to Supabase Backend Migration

## Current Status

✅ **Completed:**
- All server actions converted to Supabase Edge Functions and RPC functions
- Authentication moved to client-side Supabase Auth
- Email functionality moved to Supabase Edge Functions  
- Application processing moved to Supabase functions
- User management moved to Supabase RPC functions

⚠️ **Partial:**
- Some components converted to client-side data fetching
- Static export configuration added but not fully implemented

🚧 **Still Needs Work:**
- Many dashboard pages still use server components
- Dynamic routes need client-side routing implementation
- Some complex components need full conversion

## Deployment Options

### Option 1: Hybrid Deployment (Recommended for Now)
Deploy to Vercel with Next.js server rendering for pages that haven't been converted yet:

```bash
npm run build
```

**Pros:**
- Works immediately with current codebase
- Server components still function
- Can gradually convert remaining pages

**Cons:** 
- Still requires server infrastructure
- Not fully serverless

### Option 2: Static Export (Future Goal)
Once all server components are converted:

```bash
npm run build:static
```

**Requirements:**
- Convert all server components to client components
- Implement client-side routing for dynamic routes
- Handle authentication state client-side
- Ensure all data fetching is client-side

## Environment Variables for Deployment

Required environment variables:

```
# Public Vite vars only (safe to expose in the browser bundle)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Server-only: set on Supabase Edge Functions, never prefix with VITE_
CUSTOM_SMTP_HOST=
CUSTOM_SMTP_PORT=587
CUSTOM_SMTP_USER=
CUSTOM_SMTP_PASSWORD=
CUSTOM_SMTP_FROM=
```

## Supabase Edge Functions Deployment

Deploy the Edge Functions to Supabase:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Deploy Edge Functions
supabase functions deploy send-email
supabase functions deploy verify-email  
supabase functions deploy ai-assessment

# Apply database migrations
supabase db push
```

## Current Architecture

```
Frontend (Next.js) → Supabase Edge Functions → Supabase Database
                  → Supabase Auth
                  → Supabase Storage
```

## Remaining Conversion Work

### Pages Still Using Server Components:
- `/dashboard/*` - All dashboard pages
- `/portal/layout.tsx` - Portal layout (partially converted)
- `/applications/[id]` - Application detail pages

### Components Still Using Server Actions:
- `DecisionFlow.tsx` - Uses stub functions
- `DocumentsSection.tsx` - Uses stub functions  
- `IntakeSections.tsx` - Partially converted
- Various admin pages

### Missing Edge Functions:
- Loan agreement generation
- Disbursement processing
- Repayment processing

### Missing RPC Functions:
- Consent management
- Agreement acceptance
- Disbursement recording
- Repayment processing

## Security Configuration

The current CSP allows Supabase connections:
```
connect-src 'self' https://*.supabase.co https://*.supabase.in;
```

## Performance Considerations

- Client-side data fetching may be slower than SSR initially
- Consider implementing proper loading states
- Use React Suspense for better UX
- Implement proper error boundaries

## Testing Checklist

Before deployment, verify:
- [ ] Authentication works (login, registration, password reset)
- [ ] Email verification works 
- [ ] Basic application creation works
- [ ] Applicant creation works
- [ ] All environment variables are set
- [ ] Supabase Edge Functions are deployed
- [ ] Database migrations are applied