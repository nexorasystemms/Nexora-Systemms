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

    if (profile.role === 'admin' || profile.role === 'super_admin') {
      const userId = authData.user.id
      const userEmail = (authData.user.email || email).trim().toLowerCase()
      await supabase().auth.signOut()

      const verificationResult = await sendVerificationCode(userEmail, userId, 'login')
      if (!verificationResult.success) {
        return { success: false, error: verificationResult.error || 'Failed to send verification code' }
      }

      return {
        success: true,
        tempUserId: userId,
        requiresVerification: true,
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Verify admin login
export async function verifyAdminLogin(
  tempUserId: string,
  code: string,
  email?: string,
  _password?: string,
): Promise<AuthResponse> {
  try {
    const digits = String(code || '').replace(/\D/g, '')
    const addr = (email || '').trim().toLowerCase()
    if (digits.length < 8) {
      return { success: false, error: 'Enter the 8-digit code from your email' }
    }
    if (!addr) {
      return { success: false, error: 'Session expired. Sign in again.' }
    }

    let lastError = 'Invalid or expired verification code'
    for (const otpType of ['email', 'magiclink'] as const) {
      const { data, error } = await supabase().auth.verifyOtp({
        email: addr,
        token: digits,
        type: otpType,
      })
      if (error) {
        lastError = error.message
        continue
      }
      const { data: sessionData } = await supabase().auth.getSession()
      if (data.session || sessionData.session) {
        await supabase().from('users').update({ status: 'active' }).eq('id', tempUserId)
        return { success: true }
      }
    }

    return { success: false, error: lastError }
  } catch (error) {
    console.error('Verification error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function resendAdminLoginCode(email: string, userId: string): Promise<AuthResponse> {
  const result = await sendVerificationCode(email.trim().toLowerCase(), userId, 'login')
  if (result.success) return { success: true }
  return { success: false, error: result.error || 'Failed to resend verification code' }
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
    const { data: authData, error: authError } = await supabase().auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          mobile: data.mobile,
          id_type: data.id_type,
          id_number: data.id_number,
        },
        emailRedirectTo: `${window.location.origin}/tmu-investments/portal`,
      },
    })

    if (authError) {
      const already = /already registered|already been registered|user already exists/i.test(authError.message)
      if (!already) {
        return { success: false, error: authError.message }
      }
      const { data: signedIn, error: signInError } = await supabase().auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (signInError || !signedIn.user) {
        return { success: false, error: authError.message }
      }
      await sendVerificationCode(data.email, signedIn.user.id, 'registration').catch((err) => {
        console.error('Verification email send failed:', err)
      })
      return {
        success: true,
        tempUserId: signedIn.user.id,
        requiresVerification: true,
      }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' }
    }

    // Confirm-email is on: Auth already sent the OTP. Do not issue a second code.
    // Confirm-email is off: session is present, so send our own code.
    if (authData.session) {
      await sendVerificationCode(data.email, authData.user.id, 'registration').catch((err) => {
        console.error('Verification email send failed:', err)
      })
    }
    return {
      success: true,
      tempUserId: authData.user.id,
      requiresVerification: true,
    }
  } catch (error) {
    console.error('Registration error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return {
        success: false,
        error: 'Could not reach the server. Check your internet connection and try again.',
      }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Verify borrower email
export async function verifyBorrowerEmail(tempUserId: string, code: string, email?: string): Promise<AuthResponse> {
  try {
    const result = await verifyCode(tempUserId, code, email)
    
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

function digitsOnly(code: string): string {
  return String(code || '').replace(/\D/g, '')
}

export async function sendPasswordResetCode(email: string): Promise<AuthResponse> {
  try {
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase())
    if (error && /rate|too many|seconds/i.test(error.message)) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error) {
    console.error('Password reset error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function verifyPasswordResetCode(email: string, code: string): Promise<AuthResponse> {
  try {
    const { error } = await supabase().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: digitsOnly(code),
      type: 'recovery',
    })
    if (error) {
      return { success: false, error: error.message || 'Invalid or expired verification code' }
    }
    return { success: true }
  } catch (error) {
    console.error('Password reset verify error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function completePasswordReset(newPassword: string): Promise<AuthResponse> {
  try {
    if (newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' }
    }
    const { error } = await supabase().auth.updateUser({ password: newPassword })
    if (error) {
      return { success: false, error: error.message || 'Failed to update password' }
    }
    await supabase().auth.signOut()
    return { success: true }
  } catch (error) {
    console.error('Password reset complete error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function requestEmailChange(newEmail: string): Promise<AuthResponse> {
  try {
    const { data: { user } } = await supabase().auth.getUser()
    if (!user) {
      return { success: false, error: 'Sign in to change your email address.' }
    }
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Enter a valid email address.' }
    }
    if (user.email && user.email.toLowerCase() === email) {
      return { success: false, error: 'Enter a different email address.' }
    }
    const { error } = await supabase().auth.updateUser({ email })
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error) {
    console.error('Email change request error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function verifyEmailChange(newEmail: string, code: string): Promise<AuthResponse> {
  try {
    const email = newEmail.trim().toLowerCase()
    const { data, error } = await supabase().auth.verifyOtp({
      email,
      token: digitsOnly(code),
      type: 'email_change',
    })
    if (error) {
      return { success: false, error: error.message || 'Invalid or expired verification code' }
    }
    const userId = data.user?.id
    if (userId) {
      await supabase().from('users').update({ email }).eq('id', userId)
      const { data: profile } = await supabase().from('users').select('applicant_id').eq('id', userId).maybeSingle()
      if (profile?.applicant_id) {
        await supabase().from('applicants').update({ email }).eq('id', profile.applicant_id)
      }
    }
    await supabase().auth.signOut()
    return { success: true }
  } catch (error) {
    console.error('Email change verify error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function resendEmailChangeCode(newEmail: string): Promise<AuthResponse> {
  try {
    const email = newEmail.trim().toLowerCase()
    const { error } = await supabase().auth.resend({ type: 'email_change', email })
    if (error) {
      const retry = await supabase().auth.updateUser({ email })
      if (retry.error) {
        return { success: false, error: retry.error.message }
      }
    }
    return { success: true }
  } catch (error) {
    console.error('Email change resend error:', error)
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