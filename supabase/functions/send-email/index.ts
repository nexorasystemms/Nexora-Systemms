import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string
  subject: string
  html: string
  type?: 'verification' | 'password_reset' | 'general'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, type = 'general' }: EmailRequest = await req.json()

    // Validate required fields
    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get environment variables
    const smtpHost = Deno.env.get('CUSTOM_SMTP_HOST') || 'smtp.gmail.com'
    const smtpPort = parseInt(Deno.env.get('CUSTOM_SMTP_PORT') || '587')
    const smtpUser = Deno.env.get('CUSTOM_SMTP_USER')
    const smtpPass = Deno.env.get('CUSTOM_SMTP_PASS')
    const fromEmail = Deno.env.get('CUSTOM_SMTP_FROM') || smtpUser

    if (!smtpUser || !smtpPass || !fromEmail) {
      console.error('SMTP configuration missing')
      return new Response(
        JSON.stringify({ error: 'SMTP configuration not found' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create SMTP client
    const client = new SmtpClient()

    try {
      // Connect to SMTP server
      await client.connectTLS({
        hostname: smtpHost,
        port: smtpPort,
        username: smtpUser,
        password: smtpPass,
      })

      // Send email
      await client.send({
        from: fromEmail,
        to: [to],
        subject: subject,
        content: html,
        html: html,
      })

      await client.close()

      console.log(`Email sent successfully to ${to} (type: ${type})`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email sent successfully',
          type 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (smtpError) {
      console.error('SMTP Error:', smtpError)
      
      // Try to close connection if it's open
      try {
        await client.close()
      } catch (closeError) {
        console.error('Error closing SMTP connection:', closeError)
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email', 
          details: smtpError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Email function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})