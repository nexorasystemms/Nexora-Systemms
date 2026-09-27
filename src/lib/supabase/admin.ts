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

// Convenience functions for common verification operations
export async function sendVerificationCode(email: string, userId: string, type: 'registration' | 'login' | 'password_reset' = 'registration'): Promise<ApiResponse> {
  return callVerificationFunction({
    action: 'generate',
    email,
    userId,
    type
  })
}

export async function verifyCode(userId: string, code: string): Promise<ApiResponse> {
  return callVerificationFunction({
    action: 'verify',
    userId,
    code
  })
}

export async function resendVerificationCode(userId: string, type: 'registration' | 'login' | 'password_reset' = 'registration'): Promise<ApiResponse> {
  return callVerificationFunction({
    action: 'resend',
    userId,
    type
  })
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
      .createSignedUrl(path, 60) // 1 hour expiry

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: { signedUrl: data.signedUrl } }
  } catch (error) {
    return { success: false, error: 'Failed to get document signed URL' }
  }
}