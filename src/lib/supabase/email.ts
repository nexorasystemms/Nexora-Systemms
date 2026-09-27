import { createClient } from './client'

function supabase() {
  return createClient() as any
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  type?: 'verification' | 'password_reset' | 'general'
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase().functions.invoke('send-email', {
      body: options
    })

    if (error) {
      console.error('Supabase function error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Email sending error:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

export function generateVerificationEmail(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - Nexora Systems</title>
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
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
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
                color: #1e293b;
                margin: 0 0 16px 0;
            }
            .description {
                font-size: 16px;
                color: #64748b;
                margin: 0 0 32px 0;
            }
            .code-container {
                background: #f1f5f9;
                border: 2px dashed #cbd5e1;
                border-radius: 12px;
                padding: 24px;
                margin: 24px 0;
            }
            .code {
                font-size: 32px;
                font-weight: 700;
                color: #1e293b;
                letter-spacing: 6px;
                font-family: 'Courier New', monospace;
                margin: 0;
            }
            .code-label {
                font-size: 12px;
                color: #64748b;
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
            .footer-links {
                margin-top: 16px;
            }
            .footer-links a {
                color: #3b82f6;
                text-decoration: none;
                margin: 0 12px;
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
                <h1 class="title">Verify Your Email Address</h1>
                <p class="description">
                    Thank you for creating an account with Nexora Systems. To complete your registration and secure your account, please enter the verification code below.
                </p>
                
                <div class="code-container">
                    <div class="code">${code}</div>
                    <div class="code-label">Verification Code</div>
                </div>
                
                <div class="warning">
                    <strong>Important:</strong> This code will expire in 10 minutes. If you didn't request this verification, please ignore this email or contact our support team.
                </div>
            </div>
            
            <div class="footer">
                <p>This is an automated message from Nexora Systems.</p>
                <div class="footer-links">
                    <a href="#" onclick="return false;">Privacy Policy</a>
                    <a href="#" onclick="return false;">Terms of Service</a>
                    <a href="#" onclick="return false;">Contact Support</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `
}

export function generatePasswordResetEmail(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Nexora Systems</title>
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
                background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
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
                color: #1e293b;
                margin: 0 0 16px 0;
            }
            .description {
                font-size: 16px;
                color: #64748b;
                margin: 0 0 32px 0;
            }
            .code-container {
                background: #fef2f2;
                border: 2px dashed #fca5a5;
                border-radius: 12px;
                padding: 24px;
                margin: 24px 0;
            }
            .code {
                font-size: 32px;
                font-weight: 700;
                color: #dc2626;
                letter-spacing: 6px;
                font-family: 'Courier New', monospace;
                margin: 0;
            }
            .code-label {
                font-size: 12px;
                color: #dc2626;
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
            .footer-links {
                margin-top: 16px;
            }
            .footer-links a {
                color: #3b82f6;
                text-decoration: none;
                margin: 0 12px;
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
                <h1 class="title">Password Reset Request</h1>
                <p class="description">
                    We received a request to reset your password. Enter the verification code below to proceed with creating a new password.
                </p>
                
                <div class="code-container">
                    <div class="code">${code}</div>
                    <div class="code-label">Reset Code</div>
                </div>
                
                <div class="warning">
                    <strong>Security Notice:</strong> This code will expire in 10 minutes. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
                </div>
            </div>
            
            <div class="footer">
                <p>This is an automated message from Nexora Systems.</p>
                <div class="footer-links">
                    <a href="#" onclick="return false;">Privacy Policy</a>
                    <a href="#" onclick="return false;">Terms of Service</a>
                    <a href="#" onclick="return false;">Contact Support</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `
}