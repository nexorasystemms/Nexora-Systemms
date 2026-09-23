-- Default Assessment Data Setup
-- Insert default qualification criteria, scoring rules, and workflow definitions

-- ============================================================================
-- DEFAULT QUALIFICATION CRITERIA FOR TMU CASHLOAN CC
-- ============================================================================

INSERT INTO public.qualification_criteria (tenant_id, criteria_code, criteria_name, description, weight, min_score, max_score, is_mandatory) VALUES
-- Get the first tenant (TMU CashLoan CC) for default setup
((SELECT id FROM public.tenants LIMIT 1), 'identity_verification', 'Identity Verification', 'Verification of identity documents and personal information', 15.0, 80.0, 100.0, true),
((SELECT id FROM public.tenants LIMIT 1), 'income_verification', 'Income Verification', 'Verification of income through payslips and bank statements', 25.0, 70.0, 100.0, true),
((SELECT id FROM public.tenants LIMIT 1), 'affordability_assessment', 'Affordability Assessment', 'Debt-to-income ratio and surplus income calculation', 30.0, 75.0, 100.0, true),
((SELECT id FROM public.tenants LIMIT 1), 'credit_history', 'Credit History', 'Credit bureau check and payment history assessment', 20.0, 60.0, 100.0, false),
((SELECT id FROM public.tenants LIMIT 1), 'employment_stability', 'Employment Stability', 'Employment tenure and job stability assessment', 10.0, 50.0, 100.0, false);

-- ============================================================================
-- SCORING RULES FOR EACH CRITERIA
-- ============================================================================

-- Identity Verification Rules
INSERT INTO public.scoring_rules (criteria_id, rule_name, condition_type, condition_value, score_awarded, description) VALUES
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'identity_verification'), 'Valid ID Document', 'boolean', '{"has_valid_id": true}', 40.0, 'Identity document is valid and verified'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'identity_verification'), 'ID Data Match', 'boolean', '{"data_matches": true}', 30.0, 'ID information matches application data'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'identity_verification'), 'Photo Quality', 'threshold', '{"min_quality_score": 80}', 20.0, 'Document photo quality is sufficient for verification'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'identity_verification'), 'Age Requirement', 'range', '{"min_age": 18, "max_age": 70}', 10.0, 'Applicant meets age requirements');

-- Income Verification Rules
INSERT INTO public.scoring_rules (criteria_id, rule_name, condition_type, condition_value, score_awarded, description) VALUES
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'income_verification'), 'Payslip Present', 'boolean', '{"has_payslip": true}', 25.0, 'Recent payslip provided and verified'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'income_verification'), 'Bank Statement Present', 'boolean', '{"has_bank_statement": true}', 25.0, 'Bank statement provided and verified'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'income_verification'), 'Income Consistency', 'percentage', '{"max_variance": 10}', 30.0, 'Declared income matches documented income within 10%'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'income_verification'), 'Regular Income Pattern', 'boolean', '{"regular_deposits": true}', 20.0, 'Bank statement shows regular income deposits');

-- Affordability Assessment Rules
INSERT INTO public.scoring_rules (criteria_id, rule_name, condition_type, condition_value, score_awarded, description) VALUES
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'affordability_assessment'), 'Debt Service Ratio', 'threshold', '{"max_dsr": 35}', 40.0, 'Total debt service ratio below 35%'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'affordability_assessment'), 'Surplus Income', 'calculation', '{"formula": "income - expenses > loan_payment * 1.2"}', 35.0, 'Sufficient surplus income after loan payment'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'affordability_assessment'), 'Dependant Provision', 'calculation', '{"min_per_dependant": 500}', 15.0, 'Adequate provision for dependants'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'affordability_assessment'), 'Emergency Buffer', 'percentage', '{"min_buffer": 15}', 10.0, 'Maintains 15% emergency buffer after loan payment');

-- Credit History Rules
INSERT INTO public.scoring_rules (criteria_id, rule_name, condition_type, condition_value, score_awarded, description) VALUES
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'credit_history'), 'No Defaults', 'boolean', '{"has_defaults": false}', 40.0, 'No payment defaults in credit history'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'credit_history'), 'Current Obligations', 'threshold', '{"max_current_loans": 3}', 30.0, 'Limited number of current loan obligations'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'credit_history'), 'Payment History', 'percentage', '{"on_time_payments": 80}', 20.0, 'Good payment history with 80%+ on-time payments'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'credit_history'), 'Credit Utilization', 'threshold', '{"max_utilization": 60}', 10.0, 'Credit utilization below 60%');

-- Employment Stability Rules
INSERT INTO public.scoring_rules (criteria_id, rule_name, condition_type, condition_value, score_awarded, description) VALUES
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'employment_stability'), 'Employment Duration', 'range', '{"min_months": 6, "bonus_months": 24}', 40.0, 'Employment tenure of 6+ months'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'employment_stability'), 'Employer Verification', 'boolean', '{"employer_confirmed": true}', 30.0, 'Employer contact details verified'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'employment_stability'), 'Stable Industry', 'boolean', '{"stable_sector": true}', 20.0, 'Employment in stable industry sector'),
((SELECT id FROM public.qualification_criteria WHERE criteria_code = 'employment_stability'), 'Income Trend', 'boolean', '{"income_increasing": true}', 10.0, 'Income shows stable or increasing trend');

-- ============================================================================
-- FEEDBACK TEMPLATES FOR COMMON REJECTION REASONS
-- ============================================================================

INSERT INTO public.feedback_templates (tenant_id, template_code, template_name, criteria_codes, message_template, improvement_suggestions, language) VALUES
-- Income-related rejections
((SELECT id FROM public.tenants LIMIT 1), 'insufficient_income', 'Insufficient Income', 
 ARRAY['income_verification', 'affordability_assessment'], 
 'Thank you for your loan application. After careful review, we are unable to approve your application at this time due to insufficient income to support the requested loan amount.

Based on our assessment:
- Your monthly net income: N${{monthly_income}}
- Requested loan payment: N${{loan_payment}}
- Your current debt service ratio: {{dsr_percentage}}%
- Required surplus after loan payment: N${{required_surplus}}
- Your calculated surplus: N${{actual_surplus}}

We require applicants to maintain a debt service ratio below 35% and have adequate surplus income for living expenses.',
 '[{"suggestion": "Consider applying for a smaller loan amount", "details": "A loan of N${{affordable_amount}} would be within your affordability range"}, {"suggestion": "Increase your income", "details": "Additional income sources or a salary increase would improve your application"}, {"suggestion": "Reduce existing debt obligations", "details": "Paying off some existing debts would improve your debt service ratio"}, {"suggestion": "Include spouse income", "details": "If married in community of property, including spouse income may help"}]',
 'en'),

-- Document-related rejections
((SELECT id FROM public.tenants LIMIT 1), 'insufficient_documentation', 'Insufficient Documentation',
 ARRAY['identity_verification', 'income_verification'],
 'Thank you for your loan application. We require additional documentation to process your application.

Missing or inadequate documents:
{{#missing_documents}}
- {{document_type}}: {{reason}}
{{/missing_documents}}

To proceed with your application, please provide:
{{#required_documents}}
- {{document_name}}: {{requirements}}
{{/required_documents}}',
 '[{"suggestion": "Submit clear, recent documents", "details": "Ensure all documents are clearly legible and not older than 3 months"}, {"suggestion": "Provide alternative income proof", "details": "If payslips are unavailable, employer confirmation letters may be accepted"}, {"suggestion": "Visit our branch for assistance", "details": "Our staff can help you understand document requirements"}]',
 'en'),

-- Employment stability issues
((SELECT id FROM public.tenants LIMIT 1), 'employment_concerns', 'Employment Stability Concerns',
 ARRAY['employment_stability', 'income_verification'],
 'Thank you for your loan application. We have concerns about employment stability that affect our ability to approve your application.

Our assessment found:
- Employment duration: {{employment_months}} months
- Employment verification status: {{verification_status}}
- Income stability: {{income_stability}}

We typically require at least 6 months of stable employment and verifiable income.',
 '[{"suggestion": "Wait until employment tenure reaches 6 months", "details": "Reapply once you have completed 6 months with your current employer"}, {"suggestion": "Provide employer confirmation", "details": "A letter from your employer confirming your position and salary can strengthen your application"}, {"suggestion": "Consider a guarantor", "details": "A employed guarantor may help support your application"}]',
 'en'),

-- Credit history concerns
((SELECT id FROM public.tenants LIMIT 1), 'credit_history_concerns', 'Credit History Concerns',
 ARRAY['credit_history'],
 'Thank you for your loan application. Our credit assessment identified concerns in your credit history that prevent approval at this time.

Credit assessment findings:
- Payment defaults: {{default_count}}
- Current loan obligations: {{current_loans}}
- Credit utilization: {{utilization_percentage}}%
- Payment history score: {{payment_score}}%

We require applicants to demonstrate responsible credit management.',
 '[{"suggestion": "Improve your credit score", "details": "Make on-time payments on existing obligations to improve your credit profile"}, {"suggestion": "Reduce current debt burden", "details": "Pay off some existing loans to reduce your total obligations"}, {"suggestion": "Wait 6 months and reapply", "details": "A period of good payment behavior will improve your credit standing"}, {"suggestion": "Consider a smaller loan amount", "details": "A reduced loan amount may be approved despite credit concerns"}]',
 'en');

-- ============================================================================
-- DEFAULT WORKFLOW DEFINITION
-- ============================================================================

INSERT INTO public.workflow_definitions (tenant_id, workflow_name, stage_sequence, is_active) VALUES
((SELECT id FROM public.tenants LIMIT 1), 'Standard Loan Assessment', 
 '[
   {
     "stage_code": "document_upload",
     "stage_name": "Document Upload",
     "description": "Applicant uploads required documents",
     "automated": false,
     "required_documents": ["id", "payslip", "bank_statement"],
     "next_stage": "document_verification"
   },
   {
     "stage_code": "document_verification", 
     "stage_name": "AI Document Verification",
     "description": "AI verifies and extracts data from uploaded documents",
     "automated": true,
     "processor": "ai",
     "confidence_threshold": 80,
     "manual_review_threshold": 60,
     "next_stage": "consistency_check"
   },
   {
     "stage_code": "consistency_check",
     "stage_name": "Data Consistency Check", 
     "description": "Cross-reference data across documents",
     "automated": true,
     "processor": "ai",
     "variance_tolerance": 10,
     "next_stage": "affordability_assessment"
   },
   {
     "stage_code": "affordability_assessment",
     "stage_name": "Affordability Assessment",
     "description": "Calculate debt service ratio and affordability",
     "automated": true,
     "processor": "ai",
     "mandatory_pass": true,
     "next_stage": "credit_check"
   },
   {
     "stage_code": "credit_check",
     "stage_name": "Credit Bureau Check",
     "description": "Verify credit history and current obligations", 
     "automated": true,
     "processor": "ai",
     "next_stage": "final_assessment"
   },
   {
     "stage_code": "final_assessment",
     "stage_name": "Final AI Assessment",
     "description": "Comprehensive scoring and qualification determination",
     "automated": true,
     "processor": "ai",
     "qualification_threshold": 70,
     "next_stage": "human_review"
   },
   {
     "stage_code": "human_review",
     "stage_name": "Human Review",
     "description": "Human review of qualified applications",
     "automated": false,
     "processor": "human",
     "required_for": ["qualified", "borderline"],
     "next_stage": "final_decision"
   }
 ]',
 true);

-- ============================================================================
-- UTILITY FUNCTIONS FOR ASSESSMENT ENGINE
-- ============================================================================

-- Function to calculate overall assessment score
CREATE OR REPLACE FUNCTION calculate_overall_assessment_score(assessment_uuid uuid)
RETURNS numeric AS $$
DECLARE
    total_weighted_score numeric := 0;
    total_weight numeric := 0;
    score_record RECORD;
BEGIN
    FOR score_record IN 
        SELECT ass.weighted_score, qc.weight
        FROM public.assessment_scores ass
        JOIN public.qualification_criteria qc ON ass.criteria_id = qc.id
        WHERE ass.assessment_id = assessment_uuid
    LOOP
        total_weighted_score := total_weighted_score + score_record.weighted_score;
        total_weight := total_weight + score_record.weight;
    END LOOP;
    
    IF total_weight = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND(total_weighted_score / total_weight, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to determine qualification status
CREATE OR REPLACE FUNCTION determine_qualification_status(assessment_uuid uuid, threshold numeric DEFAULT 70.0)
RETURNS text AS $$
DECLARE
    overall_score numeric;
    mandatory_failures integer;
    qualification_status text;
BEGIN
    -- Get overall score
    overall_score := calculate_overall_assessment_score(assessment_uuid);
    
    -- Check for mandatory criteria failures
    SELECT COUNT(*) INTO mandatory_failures
    FROM public.assessment_scores ass
    JOIN public.qualification_criteria qc ON ass.criteria_id = qc.id
    WHERE ass.assessment_id = assessment_uuid 
    AND qc.is_mandatory = true 
    AND ass.passed = false;
    
    -- Determine status
    IF mandatory_failures > 0 THEN
        qualification_status := 'rejected';
    ELSIF overall_score >= threshold THEN
        qualification_status := 'qualified';
    ELSIF overall_score >= (threshold * 0.8) THEN
        qualification_status := 'pending_review';
    ELSE
        qualification_status := 'rejected';
    END IF;
    
    RETURN qualification_status;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- ============================================================================

-- This would create some sample applications for testing the AI assessment system
-- Uncomment if you want sample data for development

/*
-- Sample test applications would go here
-- These would be used to validate the AI assessment pipeline
*/