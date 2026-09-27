import { sendVerificationCode, verifyCode } from './admin'
import { createClient } from './client'

function supabase() {
  // RPCs and columns used here are not all present in generated Database types.
  return createClient() as any
}

export interface AuthResponse {
  success: boolean
  error?: string
  tempUserId?: string
  requiresVerification?: boolean
}

// Admin login with email verification for elevated roles
export async function loginAdmin(email: string, password: string): Promise<AuthResponse> {
  try {
    // First authenticate with Supabase
    const { data: authData, error: authError } = await supabase().auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      return { success: false, error: authError.message }
    }

    // Check user role
    const { data: profile, error: profileError } = await supabase()
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      await supabase().auth.signOut()
      return { success: false, error: 'User profile not found' }
    }

    // Require email verification for admin and super_admin
    if (profile.role === 'admin' || profile.role === 'super_admin') {
      // Generate verification code using Edge Function
      const verificationResult = await sendVerificationCode(authData.user.email!, authData.user.id, 'login')
      
      if (!verificationResult.success) {
        return { success: false, error: verificationResult.error || 'Failed to send verification code' }
      }

      return {
        success: true,
        tempUserId: authData.user.id,
        requiresVerification: true
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Verify admin login
export async function verifyAdminLogin(tempUserId: string, code: string): Promise<AuthResponse> {
  try {
    const result = await verifyCode(tempUserId, code)
    
    if (result.success) {
      return { success: true }
    } else {
      return { success: false, error: result.error || 'Verification failed' }
    }
  } catch (error) {
    console.error('Verification error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Borrower registration
export async function registerBorrower(data: {
  full_name: string
  id_type: string
  id_number: string
  mobile: string
  email: string
  password: string
}): Promise<AuthResponse> {
  try {
    // Check if applicant exists with this ID
    const { data: existingApplicant } = await supabase()
      .from('applicants')
      .select('id')
      .eq('id_number', data.id_number)
      .single()

    // Create auth user
    const { data: authData, error: authError } = await supabase().auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: undefined // Disable default email confirmation
      }
    })

    if (authError) {
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' }
    }

    // Create user profile
    const { error: profileError } = await supabase()
      .from('users')
      .insert({
        id: authData.user.id,
        email: data.email,
        full_name: data.full_name,
        role: 'borrower',
        status: 'inactive' // Inactive until email verified
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
    }

    // Create or link applicant record
    if (existingApplicant) {
      // Link existing applicant to user
      await supabase()
        .from('applicants')
        .update({ 
          user_id: authData.user.id,
          email: data.email,
          full_name: data.full_name,
          mobile: data.mobile
        })
        .eq('id', existingApplicant.id)
    } else {
      // Create new applicant
      await supabase()
        .from('applicants')
        .insert({
          user_id: authData.user.id,
          full_name: data.full_name,
          id_type: data.id_type,
          id_number: data.id_number,
          mobile: data.mobile,
          email: data.email,
          status: 'draft'
        })
    }

    // Generate verification code using Edge Function
    const verificationResult = await sendVerificationCode(data.email, authData.user.id, 'registration')
    
    if (!verificationResult.success) {
      return { success: false, error: verificationResult.error || 'Failed to send verification code' }
    }

    return {
      success: true,
      tempUserId: authData.user.id,
      requiresVerification: true
    }
  } catch (error) {
    console.error('Registration error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Verify borrower email
export async function verifyBorrowerEmail(tempUserId: string, code: string): Promise<AuthResponse> {
  try {
    const result = await verifyCode(tempUserId, code)
    
    if (result.success) {
      return { success: true }
    } else {
      return { success: false, error: result.error || 'Verification failed' }
    }
  } catch (error) {
    console.error('Email verification error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Send password reset code
export async function sendPasswordResetCode(email: string): Promise<AuthResponse> {
  try {
    // Check if user exists
    const { data: profile, error: profileError } = await supabase()
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      // Don't reveal if email exists for security
      return { success: true }
    }

    // Generate password reset code using Edge Function
    const verificationResult = await sendVerificationCode(email, profile.id, 'password_reset')
    
    if (!verificationResult.success) {
      return { success: false, error: verificationResult.error || 'Failed to send reset code' }
    }

    return { success: true }
  } catch (error) {
    console.error('Password reset error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Verify password reset code and reset password
export async function resetPassword(email: string, code: string, newPassword: string): Promise<AuthResponse> {
  try {
    // Find user by email
    const { data: user, error: userError } = await supabase()
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return { success: false, error: 'User not found' }
    }

    // Verify the reset code first
    const verifyResult = await verifyCode(user.id, code)
    
    if (!verifyResult.success) {
      return { success: false, error: verifyResult.error || 'Invalid or expired reset code' }
    }

    // Update password using Supabase Admin API
    const { error: updateError } = await supabase().auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateError) {
      return { success: false, error: 'Failed to update password' }
    }

    return { success: true }
  } catch (error) {
    console.error('Password reset error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Borrower login
export async function loginBorrower(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data: authData, error: authError } = await supabase().auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      return { success: false, error: authError.message }
    }

    // Verify user is a borrower
    const { data: profile, error: profileError } = await supabase()
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile || profile.role !== 'borrower') {
      await supabase().auth.signOut()
      return { success: false, error: 'Invalid credentials' }
    }

    return { success: true }
  } catch (error) {
    console.error('Borrower login error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Get current user
export async function getCurrentUser() {
  const { data: { user } } = await supabase().auth.getUser()
  return user
}

// Sign out
export async function signOut() {
  await supabase().auth.signOut()
}