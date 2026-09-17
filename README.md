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
5. In **Authentication → Providers**, keep email/password enabled. Staff sign-in also sends a
   second-factor code via **Authentication → Emails → Magic link or OTP** — replace that
   template's source with `supabase/email-templates/staff-signin-otp.html` (Nexora-branded,
   shows only the code). See the **Staff login** note below before treating this as
   equivalent to the SRS's original MFA requirement.
6. Copy `.env.local.example` to `.env.local` and fill in your project's URL + anon key +
   service role key (Project Settings → API).
7. Create your first Super Admin: in Supabase Auth, add a user (or use the app's own invite
   flow once a super admin exists), then run the `insert into public.users (...)` snippet at
   the bottom of `supabase/migrations/0006_seed_policy_params.sql`, filling in that user's
   auth UUID.
8. **Before go-live**, replace every `TODO` value in `0006_seed_policy_params.sql`
   (prime rate, penalty cap %, minimum living allowance, pilot volume/amount caps) with
   figures confirmed in writing with TMU — see SRS §10.2.

## 2. Run the app

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`. Every sign-in is password, then a
6-digit code emailed to the account (see **Staff login** below — this replaced the
authenticator-app TOTP flow FR-CORE-03 originally specified).

### Staff login — changed from the SRS's original FR-CORE-03 design

The SRS specifies authenticator-app TOTP as staff MFA, "mandatory... no exceptions." This
build instead emails a 6-digit code (`supabase.auth.signInWithOtp` / `verifyOtp`, using the
**Magic link or OTP** template — see above) as the second step after password sign-in, per an
explicit decision to drop the authenticator-app requirement.

**This is not a like-for-like swap — it's a real reduction in what the control guarantees**,
and should get the written decision-log entry the SRS itself requires for scope changes
(§9.3) before go-live, not just this README note:

- Supabase's session-enforced MFA (`auth.mfa.*`, AAL1/AAL2) only supports TOTP or SMS as
  factor types — there's no "email" factor to plug into that same enforcement path.
- `signInWithPassword` already returns a fully valid session before the emailed code is ever
  checked. The code step here is a **UI-level gate in this app's login form**, not something
  enforced at the session or RLS layer — anyone who already has a valid session (e.g. a
  stolen cookie, or a direct API call skipping the login form) isn't blocked by it the way
  AAL2-gated TOTP would block them.
- The old `/mfa-setup` enrolment screen and the `users.mfa_enrolled` enrolment concept are
  gone — every sign-in now triggers the emailed code automatically, there's no separate
  enrol-once step, and the Staff & Roles page no longer shows an MFA column since there's
  nothing per-account left to track.

## 3. Tests

```bash
npm test
```

Runs the deterministic rules-engine unit tests (`src/lib/rules-engine/engine.test.ts`) —
the sixteen-rule affordability/decisioning engine specified in SRS §4.4. This is pure,
network-free TypeScript; no Supabase connection needed to run it.

## What's built vs. what's left

**Also built, beyond the SRS's staff-console scope**: a borrower self-service portal
(`/portal`) — register, apply, and track application status — described in its own section
below.

**Built** (Must-priority items from SRS §9.1, end to end):

- Multi-tenant schema + RLS + audit log + document store + policy-parameter service
  (`supabase/migrations/`)
- Password + emailed-code auth (see **Staff login** note above), role-based console shell
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

## 4. Borrower portal (`/portal`)

A self-service track for borrowers, separate from the staff console — not part of the
original SRS pilot scope, added afterwards. Run `supabase/migrations/0009_portal_applicant_accounts.sql`
(after 0001-0008) to enable it; it's additive and safe to run against an existing pilot database.

- **`/portal/register`** — two steps: the borrower fills in the same fields staff capture at
  intake (identity, contact, household, next of kin) plus a password, then verifies a 6-digit
  code emailed to them before the applicant profile is actually written. This requires two
  things set in the Supabase dashboard, not in code: **Authentication → Providers → Email →
  "Confirm email"** must be **ON** (otherwise no code is ever sent, and verification will
  fail), and the **"Confirm signup" email template** (Authentication → Email Templates) must
  be replaced with `supabase/email-templates/confirm-signup.html` — Supabase's default only
  shows a confirmation *link*, not the 6-digit code this flow expects the borrower to type in,
  and deliberately has no fallback link either (there's no `/auth` callback route built to
  land on if someone clicked one instead of typing the code). If a staff member already
  created a walk-in profile for that ID number, verifying **claims** that existing record
  instead of duplicating it.
- **`/portal/login`** — email/password only, no second factor. The emailed 6-digit code at
  sign-in (see **Staff login** above) is staff-only.
- **`/portal`** — dashboard: a stage tracker (Submitted → Under Review → Decision →
  Agreement → Disbursed) for the borrower's current application, or a CTA to start one.
- **`/portal/apply`** — three-step wizard: loan amount/term with a live statutory
  finance-charge-cap disclosure, employment & income, then document upload (ID, payslip or
  alternative evidence, bank statement) and the five unbundled consents (FR-CONSENT-01)
  before submitting.

Access control is entirely RLS-driven, not role checks: a borrower's Supabase Auth user is
linked to exactly one `applicants` row via the new `auth_user_id` column, and every policy in
the 0009 migration scopes reads/writes to rows reachable from that link. A borrower never gets
broader tenant or cross-applicant visibility the way staff do — there's no `platform_role` or
`role` concept on this side at all.

**Known gaps, same spirit as the section above**: no email verification step is enforced (the
portal assumes Supabase's default signup behaviour, whatever the project has configured); no
password reset flow; the "claim an existing walk-in profile" path has no rate limiting; and the
Apply wizard's resume logic is a simple heuristic (draft exists → resume at the employment or
documents step), not a fully editable in-progress state.
