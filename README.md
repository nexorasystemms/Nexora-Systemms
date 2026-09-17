# Nexora Intelligent Operations Platform — Cash Loan Module (Pilot)

Staff console for TMU CashLoan CC's one-month live pilot, built against
`Nexora_Systems_SRS_Cash_Loan_Pilot.docx` v1.0. Next.js 16 (App Router) + Supabase
(Postgres, Auth, Storage), deployed to Vercel.

Three-tier roles, per the SRS's own role catalogue (Table 1):

| Platform tier | Maps to `users.role` | Who |
|---|---|---|
| **Super Admin** | `super_admin` | Nexora — cross-tenant, `tenant_id` is null |
| **Admin** | `admin` | Tenant compliance / principal officer / owner |
| **User** | `intake`, `officer`, `approver`, `finance` | TMU's day-to-day staff (segregated by function — see NFR-SEC-10) |

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `supabase/ALL_MIGRATIONS_COMBINED.sql` once, top to bottom
   (or run each file in `supabase/migrations/` in numeric order if you prefer the CLI —
   `supabase db push`).
3. **Enable pg_cron** (Database → Extensions) if you want the arrears job (migration `0008`)
   to run automatically, then uncomment the `cron.schedule(...)` line at the bottom of that
   file and re-run it. Otherwise, call `select public.raise_arrears_events();` from an
   external daily scheduler.
4. **Replace the tokenisation key** — migration `0005` seeds `encryption_keys` with a random
   value at creation time, which is fine to keep, but note it down / back it up somewhere
   safe (losing it makes every T3 field permanently unreadable). Do **not** run
   `insert into encryption_keys` again after go-live.
5. In **Authentication → Providers**, keep email/password enabled. Admin and super admin
   accounts get a 6-digit code emailed to them on every login. The admin code is generated via
   `auth.admin.generateLink()` (a privileged server call — see `src/app/login/actions.ts`)
   and emailed by Gmail SMTP or Resend (see step 6), not by Supabase's own (rate-limited) OTP
   email sender, so there's nothing to configure on the Supabase side for this.
6. Copy `.env.local.example` to `.env.local` and fill in your project's URL + anon key +
   service role key (Project Settings → API).
7. Pick an email sender for the admin login code (`src/lib/email/send.ts` tries Gmail first,
   falls back to Resend):
   - **Gmail SMTP** — the right choice while Nexora has no custom domain, since it needs
     none and can email any recipient. Turn on 2-Step Verification on the sending Google
     account, then Google Account → Security → 2-Step Verification → App passwords → generate
     one for "Mail" (16 characters, no spaces). Set `GMAIL_USER` (the Gmail address) and
     `GMAIL_APP_PASSWORD` (the generated password — **not** the account's normal password).
   - **Resend** — free at [resend.com](https://resend.com), no card needed. Works immediately
     from the shared `onboarding@resend.dev` address, but that address can only deliver to the
     email on the Resend account itself — fine for one admin, not for several, until a real
     domain is verified there (Resend dashboard → Domains) and `RESEND_FROM_EMAIL` is set to
     it. Keep the key in `RESEND_API_KEY` either way — it's a harmless, ready-to-switch-to
     fallback for once Nexora has a domain, even while Gmail is the active sender.
8. Create your first Super Admin: in Supabase Auth, add a user (**check "Auto Confirm User"**
   — an unconfirmed email can't receive a login code), then run the
   `insert into public.users (...)` snippet at the bottom of
   `supabase/migrations/0006_seed_policy_params.sql`, filling in that user's auth UUID.
9. **Before go-live**, replace every `TODO` value in `0006_seed_policy_params.sql`
   (prime rate, penalty cap %, minimum living allowance, pilot volume/amount caps) with
   figures confirmed in writing with TMU — see SRS §10.2.

## 2. Run the app

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`. Admin/super admin accounts get emailed
a 6-digit code on every sign-in.

## 3. Tests

```bash
npm test
```

Runs the deterministic rules-engine unit tests (`src/lib/rules-engine/engine.test.ts`) —
the sixteen-rule affordability/decisioning engine specified in SRS §4.4. This is pure,
network-free TypeScript; no Supabase connection needed to run it.

## What's built vs. what's left

**Built** (Must-priority items from SRS §9.1, end to end):

- Multi-tenant schema + RLS + audit log + document store + policy-parameter service
  (`supabase/migrations/`)
- Email-based authentication for admin accounts, role-based console shell
- Applicant intake with ID-number duplicate detection (tokenised, HMAC blind index)
- Application intake: employment, credit history, bank details (tokenised), income/expenditure
  with live A–E–S computation
- Document upload, checklist, staff review (no AI extraction — by design, SRS §1.2)
- The full sixteen-rule deterministic affordability engine, unit-tested
- Decision capture with mandatory reason codes, regulatory hard-block enforcement, logged
  overrides
- Agreement generation (finance-charge-cap enforced) + acceptance-evidence capture
- Disbursement recording with database-enforced segregation of duties (+ logged role-switch
  path for single-person operations)
- Repayment recording with automatic variance computation
- Arrears/penalty-cap automation (`raise_arrears_events()` — needs a daily scheduler, see above)
- Consent unbundling (five separate records)
- Audit log viewer, policy-parameter admin, staff/role management, basic reporting

**Explicitly out of scope for the pilot** (SRS §9.5 — do not build these without a written
decision-log entry per §9.3): conversational AI intake, AI document extraction, AI-drafted
credit memos, live bureau/bank API integration, automated collections, MLR-1/MLR-2 drafting.

**Known gaps to close before go-live** (flagged, not silently skipped):

- The arrears job needs a scheduler wired up (see step 3 above) — the function itself is done.
- No automated test coverage yet for RLS policies themselves (the SQL is written to spec, but
  hasn't been exercised against a live Supabase project in this build pass).
- Bureau capture screen (FR-BUR-01, a Should) and the override/portfolio reports (FR-DEC-07/
  FR-RPT-03, also Should) are minimal first passes — check them against real week-4 data.
- Every `TODO` policy-parameter value in `0006_seed_policy_params.sql` (see step 8 above).
