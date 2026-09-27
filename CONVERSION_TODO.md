# Next.js Server Actions to Supabase Conversion - Remaining Work

## Completed ✅
- Authentication (login, registration, password reset)
- Applicant creation and management  
- Application creation and basic management
- User management RPC functions
- Email verification Edge Functions
- AI Assessment Edge Functions

## Remaining Components to Convert 🚧

### High Priority
1. **DecisionFlow.tsx** - Complex workflow component with multiple server actions
   - `runApplicationAssessment` → Use `runAIAssessment` from applications.ts
   - `recordDecision` → Use `recordDecision` from applications.ts
   - `generateAgreement` → Need to create Edge Function
   - `recordAcceptance` → Need to create RPC function
   - `recordDisbursement` → Need to create RPC function
   - `recordRepayment` → Need to create RPC function

2. **DocumentsSection.tsx** - Document upload and review
   - `uploadDocument` → Use `uploadDocument` from applications.ts
   - `reviewDocument` → Use `reviewDocument` from applications.ts
   - `getDocumentSignedUrl` → Use `getDocumentSignedUrl` from admin.ts

3. **IntakeSections.tsx** - Multiple form sections (partially done)
   - Employment section ✅ (converted)
   - Bank details section → Use `saveBankDetails` from applications.ts
   - Income/expenditure → Use `saveIncomeExpenditure` from applications.ts
   - Credit history → Use `addCreditHistoryRow`/`removeCreditHistoryRow`
   - Consents → Need to create RPC function
   - Application transition → Use `updateApplicationStatus`

### Medium Priority
4. **Portal Components**
   - `BorrowerDocumentsCard.tsx` → Use document functions from applications.ts
   - `ApplyForm.tsx` → Create borrower application submission function
   - `AgreementCard.tsx` → Create agreement acceptance function

5. **Admin Pages** (Server Components - Lower Priority)
   - `users/page.tsx` → Convert to client component with admin functions
   - `tenants/page.tsx` → Convert to client component with tenant functions  
   - `policy-params/page.tsx` → Convert to client component with policy functions

## Missing RPC Functions to Create
1. `save_consents` - For applicant consent management
2. `record_agreement_acceptance` - For loan agreement acceptance
3. `record_disbursement` - For loan disbursement tracking
4. `record_repayment` - For repayment processing
5. `generate_agreement` - For loan agreement generation

## Missing Edge Functions to Create
1. `loan-agreement` - For generating loan agreements and contracts
2. `disbursement-processor` - For handling loan disbursements
3. `repayment-processor` - For processing loan repayments

## Cleanup Actions Needed
- Remove remaining actions.ts files after components are converted
- Update all import statements
- Test all functionality
- Update deployment configuration for static export

## Notes
- Some server components may need to be converted to client components
- Consider using React Server Components for read-only data where appropriate
- Ensure proper error handling and loading states
- Test authentication and authorization flows