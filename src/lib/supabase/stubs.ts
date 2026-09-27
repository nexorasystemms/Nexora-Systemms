// Stub functions — replace with real implementations as features are built out.

// Portal action stubs
export async function borrowerUploadDocument(_formData: FormData) {
  console.warn('borrowerUploadDocument: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function borrowerAcceptAgreement(_applicationId: string, _agreementId: string) {
  console.warn('borrowerAcceptAgreement: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function submitBorrowerApplication(_formData: FormData) {
  console.warn('submitBorrowerApplication: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

// Admin action stubs
export async function inviteStaff(_formData: FormData) {
  console.warn('inviteStaff: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function setStaffStatus(_userId: string, _status: string) {
  console.warn('setStaffStatus: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function createTenant(_formData: FormData) {
  console.warn('createTenant: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function addPolicyParam(_formData: FormData) {
  console.warn('addPolicyParam: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function activateTemplate(_templateId: string) {
  console.warn('activateTemplate: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function recordAttorneyReview(_formData: FormData) {
  console.warn('recordAttorneyReview: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function createTemplate(_formData: FormData) {
  console.warn('createTemplate: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function runApplicationAssessment(_applicationId: string) {
  console.warn('runApplicationAssessment: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function recordDecision(_applicationId: string, _assessmentId: string, _formData: FormData) {
  console.warn('recordDecision: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function generateAgreement(_applicationId: string, _decisionId: string) {
  console.warn('generateAgreement: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function recordAcceptance(_applicationId: string, _agreementId: string, _formData: FormData) {
  console.warn('recordAcceptance: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function recordDisbursement(_applicationId: string, _agreementId: string, _decidedBy: string, _formData: FormData) {
  console.warn('recordDisbursement: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function recordRepayment(_applicationId: string, _loanId: string, _scheduleId: string, _amountDue: number, _formData: FormData) {
  console.warn('recordRepayment: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function saveConsents(_applicantId: string, _applicationId: string, _formData: FormData) {
  console.warn('saveConsents: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function uploadDocument(_applicationId: string, _formData: FormData) {
  console.warn('uploadDocument: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function getDocumentSignedUrl(_path: string) {
  console.warn('getDocumentSignedUrl: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function reviewDocument(_applicationId: string, _documentId: string, _status: string, _notes: string) {
  console.warn('reviewDocument: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function saveEmployment(_applicationId: string, _formData: FormData) {
  console.warn('saveEmployment: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function addCreditHistoryRow(_applicationId: string, _formData: FormData) {
  console.warn('addCreditHistoryRow: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function removeCreditHistoryRow(_applicationId: string, _rowId: string) {
  console.warn('removeCreditHistoryRow: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function saveBankDetails(_applicationId: string, _formData: FormData) {
  console.warn('saveBankDetails: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function saveIncomeExpenditure(_applicationId: string, _formData: FormData) {
  console.warn('saveIncomeExpenditure: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}

export async function transitionApplication(_applicationId: string, _status: string) {
  console.warn('transitionApplication: Not yet implemented');
  return { success: false, error: 'Not implemented' };
}
