-- AI-Powered Automated Loan Assessment System
-- This migration creates tables for automated loan processing, AI assessments, and detailed feedback

-- ============================================================================
-- QUALIFICATION CRITERIA AND SCORING SYSTEM
-- ============================================================================

-- Define qualification criteria with weights and thresholds
CREATE TABLE public.qualification_criteria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    criteria_code text NOT NULL, -- e.g., 'income_verification', 'debt_ratio', 'credit_history'
    criteria_name text NOT NULL,
    description text NOT NULL,
    weight numeric(5,2) NOT NULL DEFAULT 1.0, -- Weight in scoring algorithm
    min_score numeric(5,2) NOT NULL DEFAULT 0.0, -- Minimum score to pass this criteria
    max_score numeric(5,2) NOT NULL DEFAULT 100.0, -- Maximum possible score
    is_mandatory boolean NOT NULL DEFAULT false, -- Must pass to qualify
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT qualification_criteria_weight_check CHECK (weight >= 0),
    CONSTRAINT qualification_criteria_score_range_check CHECK (min_score <= max_score),
    UNIQUE(tenant_id, criteria_code)
);

-- Store scoring rules and thresholds for each criteria
CREATE TABLE public.scoring_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    criteria_id uuid NOT NULL REFERENCES public.qualification_criteria(id) ON DELETE CASCADE,
    rule_name text NOT NULL,
    condition_type text NOT NULL, -- 'range', 'threshold', 'percentage', 'boolean', 'calculation'
    condition_value jsonb NOT NULL, -- Flexible storage for different rule types
    score_awarded numeric(5,2) NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT scoring_rules_score_check CHECK (score_awarded >= 0)
);

-- ============================================================================
-- AI ASSESSMENT RESULTS AND DECISION TRACKING
-- ============================================================================

-- Track AI assessment attempts for each application
CREATE TABLE public.ai_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    assessment_type text NOT NULL, -- 'initial_screening', 'document_verification', 'final_assessment'
    status text NOT NULL, -- 'in_progress', 'completed', 'failed', 'requires_manual_review'
    overall_score numeric(5,2),
    qualification_status text NOT NULL, -- 'qualified', 'rejected', 'pending_review', 'requires_documents'
    confidence_level numeric(5,2), -- AI confidence in the assessment (0-100)
    processing_time_ms integer,
    model_version text,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    created_by uuid REFERENCES public.users(id),
    CONSTRAINT ai_assessments_score_check CHECK (overall_score >= 0 AND overall_score <= 100),
    CONSTRAINT ai_assessments_confidence_check CHECK (confidence_level >= 0 AND confidence_level <= 100)
);

-- Individual criteria scores for each assessment
CREATE TABLE public.assessment_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL REFERENCES public.ai_assessments(id) ON DELETE CASCADE,
    criteria_id uuid NOT NULL REFERENCES public.qualification_criteria(id),
    raw_score numeric(5,2) NOT NULL,
    weighted_score numeric(5,2) NOT NULL,
    passed boolean NOT NULL,
    extracted_data jsonb, -- Raw data extracted by AI for this criteria
    calculation_details jsonb, -- How the score was calculated
    created_at timestamptz DEFAULT now(),
    CONSTRAINT assessment_scores_score_check CHECK (raw_score >= 0),
    UNIQUE(assessment_id, criteria_id)
);

-- ============================================================================
-- AUTOMATED FEEDBACK AND REJECTION REASONS
-- ============================================================================

-- Store detailed feedback for rejected applications
CREATE TABLE public.application_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    assessment_id uuid REFERENCES public.ai_assessments(id),
    feedback_type text NOT NULL, -- 'rejection', 'conditional_approval', 'improvement_suggestions'
    primary_reason text NOT NULL,
    detailed_explanation text NOT NULL,
    improvement_suggestions jsonb, -- Array of specific actionable suggestions
    alternative_options jsonb, -- Alternative loan products or amounts
    estimated_approval_probability numeric(5,2), -- If they improve certain areas
    language text NOT NULL DEFAULT 'en',
    created_at timestamptz DEFAULT now(),
    sent_to_applicant_at timestamptz,
    applicant_acknowledged_at timestamptz,
    CONSTRAINT feedback_probability_check CHECK (estimated_approval_probability >= 0 AND estimated_approval_probability <= 100)
);

-- Template-based feedback messages for consistency
CREATE TABLE public.feedback_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    template_code text NOT NULL,
    template_name text NOT NULL,
    criteria_codes text[], -- Which criteria this template applies to
    message_template text NOT NULL, -- Template with placeholders
    improvement_suggestions jsonb, -- Standard suggestions for this issue
    is_active boolean NOT NULL DEFAULT true,
    language text NOT NULL DEFAULT 'en',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, template_code, language)
);

-- ============================================================================
-- DOCUMENT PROCESSING AND VERIFICATION
-- ============================================================================

-- Enhanced document processing with AI verification
CREATE TABLE public.document_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    verification_type text NOT NULL, -- 'authenticity', 'data_extraction', 'consistency_check'
    status text NOT NULL, -- 'pending', 'verified', 'failed', 'suspicious', 'requires_manual_review'
    confidence_score numeric(5,2), -- AI confidence in verification
    extracted_data jsonb, -- Structured data extracted from document
    verification_flags jsonb, -- Any issues or warnings found
    processing_notes text,
    verified_at timestamptz,
    verified_by_ai boolean DEFAULT true,
    manual_review_required boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT verification_confidence_check CHECK (confidence_score >= 0 AND confidence_score <= 100)
);

-- Track data consistency across multiple documents
CREATE TABLE public.consistency_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    check_type text NOT NULL, -- 'income_consistency', 'identity_match', 'employment_verification'
    source_document_ids uuid[], -- Documents being compared
    discrepancy_found boolean NOT NULL DEFAULT false,
    discrepancy_severity text, -- 'minor', 'moderate', 'major', 'critical'
    details jsonb, -- Specific discrepancies found
    resolution_required boolean NOT NULL DEFAULT false,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- AUTOMATED DECISION WORKFLOW
-- ============================================================================

-- Track the automated decision workflow stages
CREATE TABLE public.workflow_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    stage_code text NOT NULL, -- 'document_upload', 'verification', 'assessment', 'final_review'
    stage_name text NOT NULL,
    status text NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed', 'skipped'
    started_at timestamptz,
    completed_at timestamptz,
    duration_ms integer,
    processed_by text, -- 'ai', 'human', 'system'
    processor_id uuid REFERENCES public.users(id), -- If processed by human
    stage_data jsonb, -- Any stage-specific data
    error_details text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT workflow_stages_duration_check CHECK (duration_ms >= 0)
);

-- Define the workflow sequence for each tenant
CREATE TABLE public.workflow_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    workflow_name text NOT NULL,
    stage_sequence jsonb NOT NULL, -- Ordered array of stage configurations
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, workflow_name)
);

-- ============================================================================
-- APPLICANT COMMUNICATION TRACKING
-- ============================================================================

-- Enhanced communication log with AI-generated content
CREATE TABLE public.applicant_communications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    communication_type text NOT NULL, -- 'status_update', 'document_request', 'rejection_notice', 'approval_notice'
    channel text NOT NULL, -- 'email', 'sms', 'whatsapp', 'portal'
    direction text NOT NULL, -- 'outbound', 'inbound'
    subject text,
    content text NOT NULL,
    is_ai_generated boolean NOT NULL DEFAULT false,
    template_used uuid REFERENCES public.feedback_templates(id),
    personalization_data jsonb, -- Data used to personalize the message
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    response_received_at timestamptz,
    response_content text,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Application processing indexes
CREATE INDEX idx_ai_assessments_application_id ON public.ai_assessments(application_id);
CREATE INDEX idx_ai_assessments_status ON public.ai_assessments(status);
CREATE INDEX idx_ai_assessments_qualification_status ON public.ai_assessments(qualification_status);
CREATE INDEX idx_assessment_scores_assessment_id ON public.assessment_scores(assessment_id);
CREATE INDEX idx_application_feedback_application_id ON public.application_feedback(application_id);
CREATE INDEX idx_document_verifications_document_id ON public.document_verifications(document_id);
CREATE INDEX idx_document_verifications_status ON public.document_verifications(status);
CREATE INDEX idx_workflow_stages_application_id ON public.workflow_stages(application_id);
CREATE INDEX idx_workflow_stages_status ON public.workflow_stages(status);
CREATE INDEX idx_consistency_checks_application_id ON public.consistency_checks(application_id);
CREATE INDEX idx_applicant_communications_application_id ON public.applicant_communications(application_id);

-- Multi-tenant indexes
CREATE INDEX idx_qualification_criteria_tenant_id ON public.qualification_criteria(tenant_id);
CREATE INDEX idx_feedback_templates_tenant_id ON public.feedback_templates(tenant_id);
CREATE INDEX idx_workflow_definitions_tenant_id ON public.workflow_definitions(tenant_id);

-- Performance indexes for common queries
CREATE INDEX idx_ai_assessments_completed_at ON public.ai_assessments(completed_at);
CREATE INDEX idx_applications_needs_review ON public.applications(id) WHERE status = 'pending_review';
CREATE INDEX idx_documents_needs_verification ON public.documents(id) 
    WHERE id IN (SELECT document_id FROM public.document_verifications WHERE status = 'pending');

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.qualification_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consistency_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_communications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant isolation
CREATE POLICY "qualification_criteria_tenant_isolation" ON public.qualification_criteria
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid);

CREATE POLICY "feedback_templates_tenant_isolation" ON public.feedback_templates
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid);

CREATE POLICY "workflow_definitions_tenant_isolation" ON public.workflow_definitions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid);

-- Application-based policies (inherit tenant through applications table)
CREATE POLICY "ai_assessments_tenant_isolation" ON public.ai_assessments
    FOR ALL USING (
        application_id IN (
            SELECT id FROM public.applications 
            WHERE tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid
        )
    );

CREATE POLICY "application_feedback_tenant_isolation" ON public.application_feedback
    FOR ALL USING (
        application_id IN (
            SELECT id FROM public.applications 
            WHERE tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid
        )
    );

-- Similar policies for other application-related tables
CREATE POLICY "workflow_stages_tenant_isolation" ON public.workflow_stages
    FOR ALL USING (
        application_id IN (
            SELECT id FROM public.applications 
            WHERE tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid
        )
    );

CREATE POLICY "consistency_checks_tenant_isolation" ON public.consistency_checks
    FOR ALL USING (
        application_id IN (
            SELECT id FROM public.applications 
            WHERE tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid
        )
    );

CREATE POLICY "applicant_communications_tenant_isolation" ON public.applicant_communications
    FOR ALL USING (
        application_id IN (
            SELECT id FROM public.applications 
            WHERE tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid
        )
    );

-- Document-based policies
CREATE POLICY "document_verifications_tenant_isolation" ON public.document_verifications
    FOR ALL USING (
        document_id IN (
            SELECT d.id FROM public.documents d
            JOIN public.applications a ON d.application_id = a.id
            WHERE a.tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid
        )
    );

-- Assessment and scoring policies
CREATE POLICY "assessment_scores_tenant_isolation" ON public.assessment_scores
    FOR ALL USING (
        assessment_id IN (
            SELECT ass.id FROM public.ai_assessments ass
            JOIN public.applications app ON ass.application_id = app.id
            WHERE app.tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid
        )
    );

CREATE POLICY "scoring_rules_tenant_isolation" ON public.scoring_rules
    FOR ALL USING (
        criteria_id IN (
            SELECT id FROM public.qualification_criteria
            WHERE tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid
        )
    );

-- ============================================================================
-- TRIGGERS FOR AUTOMATED UPDATES
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_qualification_criteria_updated_at BEFORE UPDATE ON public.qualification_criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_templates_updated_at BEFORE UPDATE ON public.feedback_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_definitions_updated_at BEFORE UPDATE ON public.workflow_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Automatically calculate weighted scores
CREATE OR REPLACE FUNCTION calculate_weighted_score()
RETURNS TRIGGER AS $$
DECLARE
    criteria_weight numeric(5,2);
BEGIN
    SELECT weight INTO criteria_weight 
    FROM public.qualification_criteria 
    WHERE id = NEW.criteria_id;
    
    NEW.weighted_score = NEW.raw_score * criteria_weight;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_assessment_weighted_score BEFORE INSERT OR UPDATE ON public.assessment_scores
    FOR EACH ROW EXECUTE FUNCTION calculate_weighted_score();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.qualification_criteria IS 'Defines the criteria used to assess loan applications automatically';
COMMENT ON TABLE public.scoring_rules IS 'Specific scoring rules and thresholds for each qualification criteria';
COMMENT ON TABLE public.ai_assessments IS 'AI-powered assessment attempts and results for applications';
COMMENT ON TABLE public.assessment_scores IS 'Individual criteria scores for each AI assessment';
COMMENT ON TABLE public.application_feedback IS 'Detailed feedback and rejection reasons for applicants';
COMMENT ON TABLE public.feedback_templates IS 'Reusable templates for generating consistent applicant feedback';
COMMENT ON TABLE public.document_verifications IS 'AI verification results for uploaded documents';
COMMENT ON TABLE public.consistency_checks IS 'Cross-document consistency verification results';
COMMENT ON TABLE public.workflow_stages IS 'Tracks progress through the automated assessment workflow';
COMMENT ON TABLE public.workflow_definitions IS 'Defines the assessment workflow sequence for each tenant';
COMMENT ON TABLE public.applicant_communications IS 'All communications with applicants including AI-generated messages';