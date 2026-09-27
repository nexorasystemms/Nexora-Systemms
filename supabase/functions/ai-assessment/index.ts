import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssessmentRequest {
  applicationId: string
  action: 'run_assessment' | 'get_assessment' | 'record_decision'
  decisionData?: {
    assessmentId: string
    decision: 'approved' | 'declined' | 'conditional'
    approvedAmount?: number
    reason?: string
    conditions?: string
    decidedBy: string
  }
}

interface PolicyParams {
  [key: string]: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { applicationId, action, decisionData }: AssessmentRequest = await req.json()

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (action) {
      case 'run_assessment':
        return await runAssessment(supabase, applicationId)
      
      case 'get_assessment':
        return await getAssessment(supabase, applicationId)
      
      case 'record_decision':
        if (!decisionData) {
          return new Response(
            JSON.stringify({ error: 'Decision data is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await recordDecision(supabase, applicationId, decisionData)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('AI Assessment error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function runAssessment(supabase: any, applicationId: string) {
  try {
    // Get application and applicant data
    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select(`
        *,
        applicants (*)
      `)
      .eq('id', applicationId)
      .single()

    if (appError || !appData) {
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get policy parameters
    const { data: policyParams, error: policyError } = await supabase
      .from('policy_params')
      .select('key, value')

    if (policyError) {
      console.error('Failed to get policy params:', policyError)
    }

    const policies: PolicyParams = {}
    if (policyParams) {
      policyParams.forEach((param: any) => {
        policies[param.key] = param.value
      })
    }

    // Get credit history
    const { data: creditHistory, error: creditError } = await supabase
      .from('application_credit_history')
      .select('*')
      .eq('application_id', applicationId)

    if (creditError) {
      console.error('Failed to get credit history:', creditError)
    }

    // Run AI assessment
    const assessment = await performAIAssessment(appData, policies, creditHistory || [])
    
    // Save assessment to database
    const { data: savedAssessment, error: saveError } = await supabase
      .from('ai_assessments')
      .insert({
        application_id: applicationId,
        assessment_data: assessment,
        risk_score: assessment.riskScore,
        recommended_decision: assessment.recommendation,
        confidence_score: assessment.confidence,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save assessment:', saveError)
      return new Response(
        JSON.stringify({ error: 'Failed to save assessment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        assessment: savedAssessment,
        details: assessment
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Assessment run error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to run assessment' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getAssessment(supabase: any, applicationId: string) {
  try {
    const { data: assessment, error } = await supabase
      .from('ai_assessments')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: 'No assessment found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        assessment
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Get assessment error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get assessment' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function recordDecision(supabase: any, applicationId: string, decisionData: any) {
  try {
    // Insert decision
    const { data: decision, error: decisionError } = await supabase
      .from('loan_decisions')
      .insert({
        application_id: applicationId,
        assessment_id: decisionData.assessmentId,
        decision: decisionData.decision,
        approved_amount: decisionData.approvedAmount || null,
        reason: decisionData.reason || null,
        conditions: decisionData.conditions || null,
        decided_by: decisionData.decidedBy,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (decisionError) {
      return new Response(
        JSON.stringify({ error: 'Failed to record decision' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update application status based on decision
    const newStatus = decisionData.decision === 'approved' ? 'approved' : 
                     decisionData.decision === 'conditional' ? 'conditional' : 'declined'
    
    await supabase
      .from('applications')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString(),
        updated_by: decisionData.decidedBy
      })
      .eq('id', applicationId)

    return new Response(
      JSON.stringify({
        success: true,
        decision,
        message: 'Decision recorded successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Record decision error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to record decision' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function performAIAssessment(appData: any, policies: PolicyParams, creditHistory: any[]) {
  // AI Assessment Algorithm - This is a simplified version
  // In production, you would integrate with actual AI/ML services
  
  const applicant = appData.applicants
  const application = appData
  
  let riskScore = 50 // Base risk score (0-100, higher is riskier)
  const factors: string[] = []
  const warnings: string[] = []
  
  // Age assessment
  if (applicant.age) {
    if (applicant.age < 21) {
      riskScore += 15
      factors.push('Young applicant (under 21)')
    } else if (applicant.age > 65) {
      riskScore += 10
      factors.push('Senior applicant (over 65)')
    } else if (applicant.age >= 25 && applicant.age <= 45) {
      riskScore -= 5
      factors.push('Prime age group (25-45)')
    }
  }
  
  // Employment and income assessment
  if (application.monthly_salary) {
    const salary = parseFloat(application.monthly_salary)
    const requestedAmount = parseFloat(application.amount_requested)
    const debtToIncomeRatio = (requestedAmount / application.term_months) / salary
    
    if (debtToIncomeRatio > 0.3) {
      riskScore += 20
      factors.push(`High debt-to-income ratio: ${(debtToIncomeRatio * 100).toFixed(1)}%`)
    } else if (debtToIncomeRatio < 0.1) {
      riskScore -= 10
      factors.push(`Low debt-to-income ratio: ${(debtToIncomeRatio * 100).toFixed(1)}%`)
    }
    
    if (salary < 10000) {
      riskScore += 15
      factors.push('Low income (under N$10,000)')
    } else if (salary > 50000) {
      riskScore -= 10
      factors.push('High income (over N$50,000)')
    }
  }
  
  // Employment type assessment
  if (application.employment_type) {
    if (application.employment_type === 'permanent') {
      riskScore -= 10
      factors.push('Permanent employment')
    } else if (application.employment_type === 'temporary') {
      riskScore += 15
      factors.push('Temporary employment')
    } else if (application.employment_type === 'self_employed') {
      riskScore += 10
      factors.push('Self-employed')
    }
  }
  
  // Years employed
  if (application.years_employed) {
    const years = parseFloat(application.years_employed)
    if (years < 1) {
      riskScore += 20
      factors.push('Recently employed (less than 1 year)')
    } else if (years > 5) {
      riskScore -= 15
      factors.push('Long employment history (over 5 years)')
    }
  }
  
  // Credit history assessment
  if (creditHistory.length > 0) {
    const activeCredits = creditHistory.filter(c => c.status === 'current')
    const defaultedCredits = creditHistory.filter(c => c.status === 'defaulted')
    
    if (defaultedCredits.length > 0) {
      riskScore += 30
      factors.push(`${defaultedCredits.length} defaulted credit(s)`)
    }
    
    if (activeCredits.length > 3) {
      riskScore += 15
      factors.push(`Multiple active credits (${activeCredits.length})`)
    } else if (activeCredits.length > 0) {
      riskScore += 5
      factors.push(`${activeCredits.length} active credit(s)`)
    }
  } else if (application.has_prior_credit === 'no') {
    riskScore += 5
    factors.push('No credit history')
  }
  
  // Marital status and dependants
  if (applicant.dependants_count > 0) {
    if (applicant.dependants_count > 3) {
      riskScore += 10
      factors.push(`Many dependants (${applicant.dependants_count})`)
    } else {
      riskScore += 2
      factors.push(`${applicant.dependants_count} dependant(s)`)
    }
  }
  
  // Loan amount assessment
  const requestedAmount = parseFloat(application.amount_requested)
  const maxLoanLimit = parseFloat(policies['MAX_LOAN_AMOUNT'] || '100000')
  
  if (requestedAmount > maxLoanLimit * 0.8) {
    riskScore += 15
    factors.push('High loan amount requested')
  } else if (requestedAmount < maxLoanLimit * 0.2) {
    riskScore -= 5
    factors.push('Conservative loan amount')
  }
  
  // Term assessment
  if (application.term_months > 36) {
    riskScore += 10
    factors.push('Long loan term (over 36 months)')
  } else if (application.term_months < 12) {
    riskScore -= 5
    factors.push('Short loan term (under 12 months)')
  }
  
  // Clamp risk score
  riskScore = Math.max(0, Math.min(100, riskScore))
  
  // Determine recommendation
  let recommendation: 'approved' | 'declined' | 'conditional' = 'approved'
  let confidence = 0.8
  
  if (riskScore > 70) {
    recommendation = 'declined'
    confidence = 0.9
  } else if (riskScore > 50) {
    recommendation = 'conditional'
    confidence = 0.7
  } else {
    recommendation = 'approved'
    confidence = 0.85
  }
  
  // Generate explanation
  const explanation = `Risk assessment completed. Score: ${riskScore}/100. ` +
    `Key factors: ${factors.slice(0, 5).join(', ')}. ` +
    `Recommendation: ${recommendation} with ${(confidence * 100).toFixed(0)}% confidence.`
  
  return {
    riskScore,
    recommendation,
    confidence,
    factors,
    warnings,
    explanation,
    assessmentDate: new Date().toISOString(),
    version: '1.0'
  }
}