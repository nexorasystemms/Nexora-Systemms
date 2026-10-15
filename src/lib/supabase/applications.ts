import { createClient } from './client'
import { requestAssessment } from '../nexora'

function supabase() {
  // RPCs and columns used here are not all present in generated Database types.
  return createClient() as any
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  status?: string
  applicationId?: string
}

// Applicant management
export interface CreateApplicantData {
  tenant_id: string
  full_name: string
  sex?: 'M' | 'F'
  id_type: 'personal_id' | 'passport'
  id_number: string
  document_number?: string
  mobile: string
  email?: string
  residential_address: string
  marital_status: 'single' | 'married_in_cop' | 'married_out_of_cop'
  dependants_count: number
  next_of_kin_name: string
  next_of_kin_mobile: string
  created_by: string
}

export async function createApplicant(data: CreateApplicantData): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().rpc('create_applicant_profile', {
      p_tenant_id: data.tenant_id,
      p_full_name: data.full_name,
      p_sex: data.sex || null,
      p_id_type: data.id_type,
      p_id_number: data.id_number,
      p_document_number: data.document_number || null,
      p_mobile: data.mobile,
      p_email: data.email || null,
      p_residential_address: data.residential_address,
      p_marital_status: data.marital_status,
      p_dependants_count: data.dependants_count,
      p_next_of_kin_name: data.next_of_kin_name,
      p_next_of_kin_mobile: data.next_of_kin_mobile,
      p_created_by: data.created_by
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to create applicant' }
  }
}

// Application management
export interface CreateApplicationData {
  tenant_id: string
  applicant_id: string
  amount_requested: number
  term_months: number
  product_type: 'once_off' | 'instalment'
  loan_product?: 'personal_no_payslip' | 'first_time_credit_check' | 'tender_purchase_order'
  next_pay_date?: string
  purpose_category?: string
  purpose_text?: string
  referral_source?: string
  has_prior_credit?: 'no' | 'had' | 'have'
  created_by: string
  duplicate_override_reason?: string
}

export async function createApplication(data: CreateApplicationData): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().rpc('create_loan_application', {
      p_tenant_id: data.tenant_id,
      p_applicant_id: data.applicant_id,
      p_amount_requested: data.amount_requested,
      p_term_months: data.term_months,
      p_product_type: data.product_type,
      p_next_pay_date: data.next_pay_date ? new Date(data.next_pay_date) : null,
      p_purpose_category: data.purpose_category || null,
      p_purpose_text: data.purpose_text || null,
      p_referral_source: data.referral_source || null,
      p_has_prior_credit: data.has_prior_credit || null,
      p_created_by: data.created_by,
      p_duplicate_override_reason: data.duplicate_override_reason || null,
      p_loan_product: data.loan_product || null,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to create application' }
  }
}

export async function updateApplicationStatus(
  applicationId: string, 
  status: string, 
  updatedBy: string
): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().rpc('update_application_status', {
      p_application_id: applicationId,
      p_status: status,
      p_updated_by: updatedBy
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to update application status' }
  }
}

export async function getApplicationDetails(applicationId: string): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().rpc('get_application_details', {
      p_application_id: applicationId
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to get application details' }
  }
}

// Employment information
export interface EmploymentData {
  employer_name: string
  job_title?: string
  employment_type?: 'permanent' | 'temporary' | 'contract' | 'self_employed'
  monthly_salary?: number
  years_employed?: number
}

export async function saveEmployment(
  applicationId: string, 
  data: EmploymentData, 
  updatedBy: string
): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().rpc('save_employment_info', {
      p_application_id: applicationId,
      p_employer_name: data.employer_name,
      p_job_title: data.job_title || null,
      p_employment_type: data.employment_type || null,
      p_monthly_salary: data.monthly_salary || null,
      p_years_employed: data.years_employed || null,
      p_updated_by: updatedBy
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to save employment information' }
  }
}

// Bank details
export interface BankDetailsData {
  bank_name?: string
  account_number?: string
  account_type?: 'savings' | 'current' | 'transmission'
}

export async function saveBankDetails(
  applicationId: string, 
  data: BankDetailsData, 
  updatedBy: string
): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().rpc('save_bank_details', {
      p_application_id: applicationId,
      p_bank_name: data.bank_name || null,
      p_account_number: data.account_number || null,
      p_account_type: data.account_type || null,
      p_updated_by: updatedBy
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to save bank details' }
  }
}

// Income and expenditure
export interface IncomeExpenditureData {
  gross_monthly_income?: number
  net_monthly_income?: number
  monthly_expenses?: number
  other_income?: number
}

export async function saveIncomeExpenditure(
  applicationId: string, 
  data: IncomeExpenditureData, 
  updatedBy: string
): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().rpc('save_income_expenditure', {
      p_application_id: applicationId,
      p_gross_monthly_income: data.gross_monthly_income || null,
      p_net_monthly_income: data.net_monthly_income || null,
      p_monthly_expenses: data.monthly_expenses || null,
      p_other_income: data.other_income || null,
      p_updated_by: updatedBy
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to save income and expenditure' }
  }
}

// Credit history
export interface CreditHistoryData {
  lender_name: string
  amount: number
  status: 'current' | 'paid_off' | 'defaulted'
}

export async function addCreditHistoryRow(
  applicationId: string, 
  data: CreditHistoryData, 
  updatedBy: string
): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().rpc('add_credit_history_row', {
      p_application_id: applicationId,
      p_lender_name: data.lender_name,
      p_amount: data.amount,
      p_status: data.status,
      p_updated_by: updatedBy
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to add credit history row' }
  }
}

export async function removeCreditHistoryRow(rowId: string, updatedBy: string): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().rpc('remove_credit_history_row', {
      p_row_id: rowId,
      p_updated_by: updatedBy
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to remove credit history row' }
  }
}

// AI Assessment functions
export async function runAIAssessment(applicationId: string): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().functions.invoke('ai-assessment', {
      body: {
        applicationId,
        action: 'run_assessment'
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to run AI assessment' }
  }
}

export async function getAIAssessment(applicationId: string): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().functions.invoke('ai-assessment', {
      body: {
        applicationId,
        action: 'get_assessment'
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to get AI assessment' }
  }
}

export interface RecordDecisionData {
  assessmentId: string
  decision: 'approved' | 'declined' | 'conditional'
  approvedAmount?: number
  reason?: string
  conditions?: string
  decidedBy: string
}

export async function recordDecision(
  applicationId: string, 
  data: RecordDecisionData
): Promise<ApiResponse> {
  try {
    const { data: result, error } = await supabase().functions.invoke('ai-assessment', {
      body: {
        applicationId,
        action: 'record_decision',
        decisionData: data
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return result as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to record decision' }
  }
}

// Document management
async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function uploadDocument(
  applicationId: string,
  file: File,
  documentType: string,
  tenantId?: string
): Promise<ApiResponse> {
  try {
    const { data: { user } } = await supabase().auth.getUser()
    if (!user) return { success: false, error: 'Sign in to upload documents' }

    let tenant = tenantId
    if (!tenant) {
      const { data: app } = await supabase().from('applications').select('tenant_id').eq('id', applicationId).maybeSingle()
      tenant = app?.tenant_id
    }
    if (!tenant) return { success: false, error: 'Application not found' }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const filePath = `${tenant}/${applicationId}/${documentType}_${Date.now()}.${ext}`
    const hash = await sha256Hex(file)

    const { error: uploadError } = await supabase().storage
      .from('documents')
      .upload(filePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data: docData, error: docError } = await supabase()
      .from('documents')
      .insert({
        tenant_id: tenant,
        entity_type: 'application',
        entity_id: applicationId,
        doc_type: documentType,
        file_path: filePath,
        sha256_hash: hash,
        original_filename: file.name,
        status: 'pending',
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (docError) {
      await supabase().storage.from('documents').remove([filePath])
      return { success: false, error: docError.message }
    }

    return { success: true, data: docData, message: 'Document uploaded successfully' }
  } catch (error) {
    return { success: false, error: 'Failed to upload document' }
  }
}

export async function reviewDocument(
  documentId: string,
  status: 'reviewed_accepted' | 'rejected',
  notes: string
): Promise<ApiResponse> {
  try {
    const { data: { user } } = await supabase().auth.getUser()
    const { error } = await supabase()
      .from('documents')
      .update({
        status,
        review_notes: notes,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, message: 'Document reviewed successfully' }
  } catch (error) {
    return { success: false, error: 'Failed to review document' }
  }
}

export async function openDocument(filePath: string): Promise<ApiResponse<{ signedUrl: string }>> {
  const { data, error } = await supabase().storage.from('documents').createSignedUrl(filePath, 3600)
  if (error || !data?.signedUrl) {
    return { success: false, error: error?.message || 'Could not open document' }
  }
  return { success: true, data: { signedUrl: data.signedUrl } }
}

export async function recordStaffDecision(input: {
  applicationId: string
  outcome: 'approved' | 'approved_with_changes' | 'declined'
  reasonCode: string
  notes?: string
  amountApproved?: number
  termApproved?: number
}): Promise<ApiResponse> {
  const { data, error } = await supabase().rpc('record_staff_decision', {
    p_application_id: input.applicationId,
    p_outcome: input.outcome,
    p_reason_code: input.reasonCode,
    p_notes: input.notes || null,
    p_amount_approved: input.amountApproved ?? null,
    p_term_approved: input.termApproved ?? null,
  })
  if (error) return { success: false, error: error.message }
  if (data?.success === false) return { success: false, error: data.error || 'Could not record decision' }
  return { success: true, data }
}

export async function submitBorrowerApplication(formData: FormData): Promise<ApiResponse> {
  const { data: { user } } = await supabase().auth.getUser()
  if (!user) return { success: false, error: 'Sign in to submit an application' }

  const { data: profile } = await supabase()
    .from('users')
    .select('id, tenant_id, applicant_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.applicant_id || !profile.tenant_id) {
    return { success: false, error: 'Complete registration before applying for a loan.' }
  }

  const loanProduct = String(formData.get('loan_product') || '')
  const productType = (formData.get('product_type') as 'once_off' | 'instalment') || 'instalment'
  const purposeBits = [
    String(formData.get('purpose_text') || '').trim(),
    formData.get('tender_reference') ? `Tender: ${formData.get('tender_reference')}` : '',
    formData.get('business_name') ? `Business: ${formData.get('business_name')}` : '',
    formData.get('security_description') ? `Security: ${formData.get('security_description')}` : '',
  ].filter(Boolean)

  const created = await createApplication({
    tenant_id: profile.tenant_id,
    applicant_id: profile.applicant_id,
    amount_requested: Number(formData.get('amount_requested')),
    term_months: Number(formData.get('term_months')),
    product_type: productType,
    loan_product: loanProduct as CreateApplicationData['loan_product'],
    next_pay_date: (formData.get('next_pay_date') as string) || undefined,
    purpose_category: (formData.get('purpose_category') as string) || undefined,
    purpose_text: purposeBits.join('\n') || undefined,
    referral_source: (formData.get('referral_source') as string) || undefined,
    has_prior_credit: (formData.get('has_prior_credit') as CreateApplicationData['has_prior_credit']) || undefined,
    created_by: user.id,
  })

  if (!created.success) {
    return { success: false, error: created.error || created.message || 'Could not create application' }
  }

  const applicationId = created.applicationId || created.data?.applicationId
  if (!applicationId) {
    return { success: false, error: 'Application was created without an id' }
  }

  const employerName = String(formData.get('employer_name') || '').trim()
  if (employerName) {
    const payrollNote = formData.get('payroll_number')
      ? `Payroll ${formData.get('payroll_employer_type') || ''}: ${formData.get('payroll_number')}`
      : null
    await supabase().from('employment').upsert({
      tenant_id: profile.tenant_id,
      application_id: applicationId,
      employer_name: employerName,
      employer_address: String(formData.get('employer_address') || '') || null,
      occupation: String(formData.get('occupation') || '') || null,
      monthly_net_salary: Number(formData.get('monthly_net_salary') || 0) || null,
      employment_start_date: (formData.get('employment_start_date') as string) || null,
      employer_phone: String(formData.get('employer_phone') || '') || null,
      employer_contact: String(formData.get('employer_contact') || payrollNote || '') || null,
      employer_email: String(formData.get('employer_email') || '') || null,
    }, { onConflict: 'application_id' })
  }

  const incomeLines: Array<[string, number]> = [
    ['gross_basic_salary', Number(formData.get('gross_salary') || 0)],
    ['net_salary', Number(formData.get('net_salary') || formData.get('monthly_net_salary') || 0)],
    ['spouse_net', Number(formData.get('spouse_net') || 0)],
    ['other_income', Number(formData.get('other_income') || 0)],
    ['total_expenditure', Number(formData.get('total_expenditure') || 0)],
  ]
  if (incomeLines.some(([, amount]) => amount > 0)) {
    await supabase().from('income_expenditure').upsert(
      incomeLines.map(([line_code, amount]) => ({
        tenant_id: profile.tenant_id,
        application_id: applicationId,
        line_code,
        amount,
        source: 'declared',
      })),
      { onConflict: 'application_id,line_code' }
    )
  }

  const priorLender = String(formData.get('prior_lender') || '').trim()
  if (priorLender) {
    await supabase().from('credit_history').insert({
      tenant_id: profile.tenant_id,
      application_id: applicationId,
      lender_name: priorLender,
      monthly_instalment: Number(formData.get('prior_instalment') || 0),
      amount_outstanding: Number(formData.get('prior_outstanding') || 0) || null,
      expected_repayment_date: (formData.get('prior_repay_date') as string) || null,
    })
  }

  const bankName = String(formData.get('bank_name') || '').trim()
  const accountNumber = String(formData.get('account_number') || '').trim()
  if (bankName && accountNumber) {
    let accountToken = accountNumber
    try {
      const { data: token } = await supabase().rpc('tokenize_secure_value', {
        p_tenant_id: profile.tenant_id,
        p_field_type: 'account_number',
        p_plaintext: accountNumber,
      })
      if (token) accountToken = String(token)
    } catch {
      /* keep plaintext token fallback only if RPC is unavailable */
    }
    await supabase().from('bank_details').upsert({
      tenant_id: profile.tenant_id,
      application_id: applicationId,
      bank_name: bankName,
      account_name: String(formData.get('account_name') || 'Account holder'),
      branch: String(formData.get('bank_branch') || '') || null,
      account_number_token: accountToken,
    }, { onConflict: 'application_id' })
  }

  const consentMap: Array<[string, string]> = [
    ['consent_credit_assessment', 'credit_assessment'],
    ['consent_bureau', 'bureau_enquiry_and_submission'],
    ['consent_debt_collection', 'debt_collection_disclosure'],
    ['consent_marketing', 'marketing'],
    ['consent_payroll_deduction', 'cession_disclosure'],
    ['consent_eft_mandate', 'eft_mandate'],
  ]
  for (const [field, consentType] of consentMap) {
    if (formData.get(field) === 'on') {
      await supabase().from('consents').insert({
        tenant_id: profile.tenant_id,
        applicant_id: profile.applicant_id,
        application_id: applicationId,
        consent_type: consentType,
        granted: true,
        channel: 'digital_form',
        granted_at: new Date().toISOString(),
        recorded_by: user.id,
      })
    }
  }

  for (const [key, value] of formData.entries()) {
    if (!key.endsWith('_document') || !(value instanceof File) || value.size === 0) continue
    const docType = key.replace(/_document$/, '')
    const uploaded = await uploadDocument(applicationId, value, docType, profile.tenant_id)
    if (!uploaded.success) {
      return { success: false, error: uploaded.error || `Failed to upload ${docType}` }
    }
  }

  await updateApplicationStatus(applicationId, 'submitted', user.id)
  // Hand the application to Nexora's rules engine; never blocks or fails the submission.
  void requestAssessment(applicationId)
  return { success: true, data: { applicationId } }
}