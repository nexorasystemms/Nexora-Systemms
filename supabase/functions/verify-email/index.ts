import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerificationRequest {
  action: 'generate' | 'verify' | 'resend'
  email?: string
  userId?: string
  code?: string
  type?: 'registration' | 'login' | 'password_reset'
}

// Generate random 8-digit code
function generateVerificationCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, email, userId, code, type = 'registration' }: VerificationRequest = await req.json()

    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (action) {
      case 'generate':
        if (!email || !userId) {
          return new Response(
            JSON.stringify({ error: 'Email and userId are required for generate action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Generate new verification code
        const verificationCode = generateVerificationCode()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        // Store verification code in database
        const { error: insertError } = await supabase
          .from('email_verifications')
          .insert({
            user_id: userId,
            email: email,
            code: verificationCode,
            expires_at: expiresAt.toISOString(),
            type: type
          })

        if (insertError) {
          console.error('Failed to store verification code:', insertError)
          return new Response(
            JSON.stringify({ error: 'Failed to generate verification code' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Send email via the send-email function
        const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            to: email,
            subject: getEmailSubject(type),
            html: getEmailTemplate(verificationCode, type),
            type: 'verification'
          })
        })

        if (!emailResponse.ok) {
          console.error('Failed to send email:', await emailResponse.text())
          return new Response(
            JSON.stringify({ error: 'Failed to send verification email' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Verification code sent successfully',
            expiresAt: expiresAt.toISOString()
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'verify':
        if (!userId || !code) {
          return new Response(
            JSON.stringify({ error: 'UserId and code are required for verify action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Find and validate verification code
        const { data: verification, error: verifyError } = await supabase
          .from('email_verifications')
          .select('*')
          .eq('user_id', userId)
          .eq('code', code)
          .gte('expires_at', new Date().toISOString())
          .is('used_at', null)
          .single()

        if (verifyError || !verification) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Invalid or expired verification code' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Mark verification as used
        const { error: updateError } = await supabase
          .from('email_verifications')
          .update({ used_at: new Date().toISOString() })
          .eq('id', verification.id)

        if (updateError) {
          console.error('Failed to mark verification as used:', updateError)
        }

        // If this is registration verification, activate the user
        if (verification.type === 'registration') {
          const { error: userUpdateError } = await supabase
            .from('users')
            .update({ status: 'active' })
            .eq('id', userId)

          if (userUpdateError) {
            console.error('Failed to activate user:', userUpdateError)
          }

          // Also confirm email in auth
          const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
            userId,
            { email_confirm: true }
          )

          if (authUpdateError) {
            console.error('Failed to confirm email in auth:', authUpdateError)
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Email verified successfully',
            verificationType: verification.type
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'resend':
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'UserId is required for resend action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get user email
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('email')
          .eq('id', userId)
          .single()

        if (userError || !user) {
          return new Response(
            JSON.stringify({ error: 'User not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Mark old codes as expired
        await supabase
          .from('email_verifications')
          .update({ expires_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('type', type)
          .is('used_at', null)

        // Generate and send new code
        const newCode = generateVerificationCode()
        const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

        const { error: newInsertError } = await supabase
          .from('email_verifications')
          .insert({
            user_id: userId,
            email: user.email,
            code: newCode,
            expires_at: newExpiresAt.toISOString(),
            type: type
          })

        if (newInsertError) {
          return new Response(
            JSON.stringify({ error: 'Failed to generate new verification code' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Send new email
        const newEmailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            to: user.email,
            subject: getEmailSubject(type),
            html: getEmailTemplate(newCode, type),
            type: 'verification'
          })
        })

        if (!newEmailResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to send new verification email' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'New verification code sent successfully' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: generate, verify, or resend' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Verification function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getEmailSubject(type: string): string {
  switch (type) {
    case 'registration':
      return 'Welcome to Nexora Systems - Verify Your Email'
    case 'login':
      return 'Nexora Systems - Login Verification'
    case 'password_reset':
      return 'Nexora Systems - Password Reset'
    default:
      return 'Nexora Systems - Email Verification'
  }
}

function getEmailTemplate(code: string, type: string): string {
  const isReset = type === 'password_reset'
  const headerColor = isReset ? '#dc2626' : '#1e293b'
  const headerGradient = isReset 
    ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' 
    : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
  const codeColor = isReset ? '#dc2626' : '#1e293b'
  const codeBackground = isReset ? '#fef2f2' : '#f1f5f9'
  const codeBorder = isReset ? '#fca5a5' : '#cbd5e1'
  const codeLabel = isReset ? '#dc2626' : '#64748b'
  
  const title = type === 'registration' 
    ? 'Verify Your Email Address'
    : type === 'login'
    ? 'Login Verification Code'
    : 'Password Reset Code'
    
  const description = type === 'registration'
    ? 'Thank you for creating an account with Nexora Systems. To complete your registration and secure your account, please enter the verification code below.'
    : type === 'login'
    ? 'We received a login attempt for your account. Please enter the verification code below to complete your login.'
    : 'We received a request to reset your password. Enter the verification code below to proceed with creating a new password.'

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${getEmailSubject(type)}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f8fafc;
                color: #334155;
                line-height: 1.6;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 16px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background: ${headerGradient};
                color: white;
                padding: 32px;
                text-align: center;
            }
            .logo {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 8px;
            }
            .tagline {
                opacity: 0.9;
                font-size: 14px;
            }
            .content {
                padding: 32px;
                text-align: center;
            }
            .title {
                font-size: 24px;
                font-weight: 600;
                color: ${headerColor};
                margin: 0 0 16px 0;
            }
            .description {
                font-size: 16px;
                color: #64748b;
                margin: 0 0 32px 0;
            }
            .code-container {
                background: ${codeBackground};
                border: 2px dashed ${codeBorder};
                border-radius: 12px;
                padding: 24px;
                margin: 24px 0;
            }
            .code {
                font-size: 32px;
                font-weight: 700;
                color: ${codeColor};
                letter-spacing: 6px;
                font-family: 'Courier New', monospace;
                margin: 0;
            }
            .code-label {
                font-size: 12px;
                color: ${codeLabel};
                margin-top: 8px;
                text-transform: uppercase;
                font-weight: 500;
                letter-spacing: 1px;
            }
            .warning {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 16px;
                margin: 24px 0;
                border-radius: 0 8px 8px 0;
                text-align: left;
                font-size: 14px;
                color: #92400e;
            }
            .footer {
                background: #f8fafc;
                padding: 24px 32px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
                font-size: 12px;
                color: #64748b;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">Nexora Systems</div>
                <div class="tagline">Digital Financial Solutions</div>
            </div>
            
            <div class="content">
                <h1 class="title">${title}</h1>
                <p class="description">${description}</p>
                
                <div class="code-container">
                    <div class="code">${code}</div>
                    <div class="code-label">Verification Code</div>
                </div>
                
                <div class="warning">
                    <strong>Important:</strong> This code will expire in 10 minutes. ${isReset ? 'If you didn\'t request a password reset, please ignore this email.' : 'If you didn\'t request this verification, please contact our support team.'}
                </div>
            </div>
            
            <div class="footer">
                <p>This is an automated message from Nexora Systems.</p>
            </div>
        </div>
    </body>
    </html>
  `
}