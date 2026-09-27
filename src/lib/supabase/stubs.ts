// Temporary stub functions for components that haven't been fully converted yet
// These should be replaced with proper implementations

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabase = createSupabaseClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Portal action stubs
export async function borrowerUploadDocument(formData: FormData) {
  console.warn('borrowerUploadDocument: Not implemented - use uploadDocument from applications.ts')
  return { success: false, error: 'Not implemented' }
}

export async function borrowerAcceptAgreement(applicationId: string, agreementId: string) {
  console.warn('borrowerAcceptAgreement: Not implemented - need to create RPC function')
  return { success: false, error: 'Not implemented' }
}

export async function submitBorrowerApplication(formData: FormData) {
  console.warn('submitBorrowerApplication: Not implemented - need to create application submission function')
  return { success: false, error: 'Not implemented' }
}

// Admin action stubs
export async function inviteStaff(formData: FormData) {
  console.warn('inviteStaff: Not implemented - use createUser from admin.ts')
  return { success: false, error: 'Not implemented' }
}

export async function setStaffStatus(userId: string, status: string) {
  console.warn('setStaffStatus: Not implemented - use updateUserStatus from admin.ts')
  return { success: false, error: 'Not implemented' }
}

export async function createTenant(formData: FormData) {
  console.warn('createTenant: Not implemented - use upsertTenant from admin.ts')
  return { success: false, error: 'Not implemented' }
}

export async function addPolicyParam(formData: FormData) {
  console.warn('addPolicyParam: Not implemented - use updatePolicyParam from admin.ts')
  return { success: false, error: 'Not implemented' }
}

export async function activateTemplate(templateId: string) {
  console.warn('activateTemplate: Not implemented')
  return { success: false, error: 'Not implemented' }
}

export async function recordAttorneyReview(formData: FormData) {
  console.warn('recordAttorneyReview: Not implemented')
  return { success: false, error: 'Not implemented' }
}

export async function createTemplate(formData: FormData) {
  console.warn('createTemplate: Not implemented')
  return { success: false, error: 'Not implemented' }
}

// Application detail action stubs  
export async function runApplicationAssessment(applicationId: string) {
  console.warn('runApplicationAssessment: Use runAIAssessment from applications.ts instead')
  return { success: false, error: 'Use runAIAssessment from applications.ts instead' }
}

export async function recordDecision(applicationId: string, assessmentId: string, formData: FormData) {
  console.warn('recordDecision: Not fully implemented - use recordDecision from applications.ts')
  return { success: false, error: 'Not implemented' }
}

export async function generateAgreement(applicationId: string, decisionId: string) {
  console.warn('generateAgreement: Not implemented - need to create Edge Function')
  return { success: false, error: 'Not implemented' }
}

export async function recordAcceptance(applicationId: string, agreementId: string, formData: FormData) {
  console.warn('recordAcceptance: Not implemented - need to create RPC function')
  return { success: false, error: 'Not implemented' }
}

export async function recordDisbursement(applicationId: string, agreementId: string, decidedBy: string, formData: FormData) {
  console.warn('recordDisbursement: Not implemented - need to create RPC function')
  return { success: false, error: 'Not implemented' }
}

export async function recordRepayment(applicationId: string, loanId: string, scheduleId: string, amountDue: number, formData: FormData) {
  console.warn('recordRepayment: Not implemented - need to create RPC function')
  return { success: false, error: 'Not implemented' }
}

export async function saveConsents(applicantId: string, applicationId: string, formData: FormData) {
  console.warn('saveConsents: Not implemented - need to create RPC function')
  return { success: false, error: 'Not implemented' }
}

export async function uploadDocument(applicationId: string, formData: FormData) {
  console.warn('uploadDocument: Use uploadDocument from applications.ts instead')
  return { success: false, error: 'Use uploadDocument from applications.ts instead' }
}

export async function getDocumentSignedUrl(path: string) {
  console.warn('getDocumentSignedUrl: Use getDocumentSignedUrl from admin.ts instead')
  return { success: false, error: 'Use getDocumentSignedUrl from admin.ts instead' }
}

export async function reviewDocument(applicationId: string, documentId: string, status: string, notes: string) {
  console.warn('reviewDocument: Use reviewDocument from applications.ts instead')
  return { success: false, error: 'Use reviewDocument from applications.ts instead' }
}

export async function saveEmployment(applicationId: string, formData: FormData) {
  console.warn('saveEmployment: Use saveEmployment from applications.ts instead')
  return { success: false, error: 'Use saveEmployment from applications.ts instead' }
}

export async function addCreditHistoryRow(applicationId: string, formData: FormData) {
  console.warn('addCreditHistoryRow: Use addCreditHistoryRow from applications.ts instead')
  return { success: false, error: 'Use addCreditHistoryRow from applications.ts instead' }
}

export async function removeCreditHistoryRow(applicationId: string, rowId: string) {
  console.warn('removeCreditHistoryRow: Use removeCreditHistoryRow from applications.ts instead')
  return { success: false, error: 'Use removeCreditHistoryRow from applications.ts instead' }
}

export async function saveBankDetails(applicationId: string, formData: FormData) {
  console.warn('saveBankDetails: Use saveBankDetails from applications.ts instead')
  return { success: false, error: 'Use saveBankDetails from applications.ts instead' }
}

export async function saveIncomeExpenditure(applicationId: string, formData: FormData) {
  console.warn('saveIncomeExpenditure: Use saveIncomeExpenditure from applications.ts instead')
  return { success: false, error: 'Use saveIncomeExpenditure from applications.ts instead' }
}

export async function transitionApplication(applicationId: string, status: string) {
  console.warn('transitionApplication: Use updateApplicationStatus from applications.ts instead')
  return { success: false, error: 'Use updateApplicationStatus from applications.ts instead' }
}