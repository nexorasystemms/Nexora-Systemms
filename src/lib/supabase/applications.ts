import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabase = createSupabaseClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  status?: string
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
    const { data: result, error } = await supabase.rpc('create_applicant_profile', {
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
    const { data: result, error } = await supabase.rpc('create_loan_application', {
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
      p_duplicate_override_reason: data.duplicate_override_reason || null
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
    const { data: result, error } = await supabase.rpc('update_application_status', {
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
    const { data: result, error } = await supabase.rpc('get_application_details', {
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
    const { data: result, error } = await supabase.rpc('save_employment_info', {
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
    const { data: result, error } = await supabase.rpc('save_bank_details', {
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
    const { data: result, error } = await supabase.rpc('save_income_expenditure', {
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
    const { data: result, error } = await supabase.rpc('add_credit_history_row', {
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
    const { data: result, error } = await supabase.rpc('remove_credit_history_row', {
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
    const { data, error } = await supabase.functions.invoke('ai-assessment', {
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
    const { data, error } = await supabase.functions.invoke('ai-assessment', {
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
    const { data: result, error } = await supabase.functions.invoke('ai-assessment', {
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
export async function uploadDocument(
  applicationId: string,
  file: File,
  documentType: string
): Promise<ApiResponse> {
  try {
    // Generate file path
    const timestamp = new Date().getTime()
    const filePath = `applications/${applicationId}/${documentType}_${timestamp}.${file.name.split('.').pop()}`
    
    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    // Save document record
    const { data: docData, error: docError } = await supabase
      .from('application_documents')
      .insert({
        application_id: applicationId,
        document_type: documentType,
        filename: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        status: 'pending_review',
        uploaded_at: new Date().toISOString()
      })
      .select()
      .single()

    if (docError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage.from('documents').remove([filePath])
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
    const { error } = await supabase
      .from('application_documents')
      .update({
        status,
        review_notes: notes,
        reviewed_at: new Date().toISOString()
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