# Application Detail Actions - Conversion Status

This directory previously contained `actions.ts` with the following server actions that need to be converted to client-side Supabase calls:

## Functions Converted ✅
- `saveEmployment` → Available in `src/lib/supabase/applications.ts`

## Functions Still Needed 🚧
- `addCreditHistoryRow` → Available in `src/lib/supabase/applications.ts`
- `removeCreditHistoryRow` → Available in `src/lib/supabase/applications.ts`
- `saveBankDetails` → Available in `src/lib/supabase/applications.ts`
- `saveIncomeExpenditure` → Available in `src/lib/supabase/applications.ts`
- `transitionApplication` → Available as `updateApplicationStatus`
- `runApplicationAssessment` → Available as `runAIAssessment`
- `recordDecision` → Available in `src/lib/supabase/applications.ts`
- `generateAgreement` → **Need to create Edge Function**
- `recordAcceptance` → **Need to create RPC function**
- `recordDisbursement` → **Need to create RPC function**
- `recordRepayment` → **Need to create RPC function**
- `saveConsents` → **Need to create RPC function**
- `uploadDocument` → Available in `src/lib/supabase/applications.ts`
- `getDocumentSignedUrl` → Available in `src/lib/supabase/admin.ts`
- `reviewDocument` → Available in `src/lib/supabase/applications.ts`

## Components Still Using Old Actions
- `DecisionFlow.tsx`
- `DocumentsSection.tsx`
- `IntakeSections.tsx` (partially converted)

## Next Steps
1. Create missing RPC functions for agreements, disbursements, repayments
2. Convert remaining components to use client-side functions
3. Test all functionality works with new backend architecture