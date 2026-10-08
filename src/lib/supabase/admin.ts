import { createClient } from './client'

function supabase() {
  // RPCs and columns used here are not all present in generated Database types.
  return createClient() as any
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// User management functions
export interface CreateUserData {
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'intake' | 'officer' | 'approver' | 'finance' | 'borrower'
  tenant_id?: string
}

export async function createUser(userData: CreateUserData): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().rpc('create_user_account', {
      p_email: userData.email,
      p_full_name: userData.full_name,
      p_role: userData.role,
      p_tenant_id: userData.tenant_id || null
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to create user' }
  }
}

export async function updateUserStatus(userId: string, status: 'active' | 'inactive' | 'suspended'): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().rpc('update_user_status', {
      p_user_id: userId,
      p_status: status
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to update user status' }
  }
}

export async function updateUserRole(userId: string, role: string): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().rpc('update_user_role', {
      p_user_id: userId,
      p_role: role
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to update user role' }
  }
}

export async function getUserByEmail(email: string): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().rpc('get_user_by_email', {
      p_email: email
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to get user' }
  }
}

export interface ListUsersParams {
  limit?: number
  offset?: number
  role?: string
  status?: string
}

export async function listUsers(params: ListUsersParams = {}): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().rpc('list_users', {
      p_limit: params.limit || 50,
      p_offset: params.offset || 0,
      p_role: params.role || null,
      p_status: params.status || null
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to list users' }
  }
}

// Tenant management functions
export interface TenantData {
  id?: string
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  status?: 'active' | 'inactive'
}

export async function upsertTenant(tenantData: TenantData): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().rpc('upsert_tenant', {
      p_id: tenantData.id || null,
      p_name: tenantData.name,
      p_code: tenantData.code,
      p_address: tenantData.address || null,
      p_phone: tenantData.phone || null,
      p_email: tenantData.email || null,
      p_status: tenantData.status || 'active'
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to save tenant' }
  }
}

export async function listTenants(): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().rpc('list_tenants')

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to list tenants' }
  }
}

// Email verification functions
export interface VerificationRequest {
  action: 'generate' | 'verify' | 'resend'
  email?: string
  userId?: string
  code?: string
  type?: 'registration' | 'login' | 'password_reset'
}

export async function callVerificationFunction(request: VerificationRequest): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().functions.invoke('verify-email', {
      body: request
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return data as ApiResponse
  } catch (error) {
    return { success: false, error: 'Failed to process verification request' }
  }
}

function digitsOnly(code: string): string {
  return String(code || '').replace(/\D/g, '')
}

async function lookupEmail(userId: string): Promise<string | undefined> {
  const { data } = await supabase().from('users').select('email').eq('id', userId).maybeSingle()
  return data?.email as string | undefined
}

export async function sendVerificationCode(email: string, userId: string, type: 'registration' | 'login' | 'password_reset' = 'registration'): Promise<ApiResponse> {
  const addr = email.trim().toLowerCase()

  // Same SMTP as borrower signup: Auth emails the OTP the inbox can actually receive.
  if (type === 'registration') {
    const { error } = await supabase().auth.resend({ type: 'signup', email: addr })
    if (!error) return { success: true }
  }
  if (type === 'password_reset') {
    const { error } = await supabase().auth.resetPasswordForEmail(addr)
    if (!error) return { success: true }
  }
  if (type === 'login') {
    const { error } = await supabase().auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: false },
    })
    if (!error) return { success: true }
    const generated = await callVerificationFunction({ action: 'generate', email: addr, userId, type })
    if (generated.success) return generated
    return {
      success: false,
      error: error?.message || generated.error || 'Failed to send verification code',
    }
  }

  const generated = await callVerificationFunction({ action: 'generate', email: addr, userId, type })
  if (generated.success) return generated
  return { success: false, error: generated.error || 'Failed to send verification code' }
}

export async function verifyCode(userId: string, code: string, email?: string): Promise<ApiResponse> {
  const digits = digitsOnly(code)
  if (digits.length < 8) {
    return { success: false, error: 'Enter the 8-digit code from your email' }
  }

  const addr = email || await lookupEmail(userId)
  if (addr) {
    for (const otpType of ['signup', 'email'] as const) {
      const { error } = await supabase().auth.verifyOtp({
        email: addr,
        token: digits,
        type: otpType,
      })
      if (!error) {
        await supabase().from('users').update({ status: 'active' }).eq('id', userId)
        return { success: true }
      }
    }
  }

  const { data, error } = await supabase().rpc('verify_email_code', {
    p_user_id: userId,
    p_code: digits,
  })
  if (!error && data?.success) return { success: true, data }
  return {
    success: false,
    error: (data && data.error) || error?.message || 'Invalid or expired verification code',
  }
}

export async function resendVerificationCode(userId: string, type: 'registration' | 'login' | 'password_reset' = 'registration', email?: string): Promise<ApiResponse> {
  const addr = email || await lookupEmail(userId)
  if (addr) {
    const issued = await sendVerificationCode(addr, userId, type)
    if (issued.success) return issued
  }
  return callVerificationFunction({ action: 'resend', userId, type })
}

// Policy parameters management
export async function updatePolicyParam(key: string, value: string): Promise<ApiResponse> {
  try {
    const { error } = await supabase()
      .from('policy_params')
      .upsert({ 
        key, 
        value,
        updated_at: new Date().toISOString() 
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, message: 'Policy parameter updated successfully' }
  } catch (error) {
    return { success: false, error: 'Failed to update policy parameter' }
  }
}

export async function getPolicyParams(): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase()
      .from('policy_params')
      .select('*')
      .order('key')

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to get policy parameters' }
  }
}

// Document management
export async function getDocumentSignedUrl(path: string): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase().storage
      .from('documents')
      .createSignedUrl(path, 3600)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: { signedUrl: data.signedUrl } }
  } catch (error) {
    return { success: false, error: 'Failed to get document signed URL' }
  }
}