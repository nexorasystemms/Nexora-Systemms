-- Enhance existing applications table for AI-powered workflow
-- Add fields to support automated processing and AI assessments

-- ============================================================================
-- ENHANCE APPLICATIONS TABLE
-- ============================================================================

-- Add AI workflow support columns to existing applications table
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS ai_processing_enabled boolean DEFAULT true;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS automated_assessment_completed boolean DEFAULT false;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS current_workflow_stage text DEFAULT 'document_upload';
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS ai_qualification_status text; -- 'qualified', 'rejected', 'pending_review', 'requires_documents'
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS ai_assessment_score numeric(5,2);
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS ai_confidence_level numeric(5,2);
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS requires_human_review boolean DEFAULT false;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS human_review_reason text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS automated_feedback_sent boolean DEFAULT false;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS assessment_started_at timestamptz;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS assessment_completed_at timestamptz;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS next_action_required text; -- What needs to happen next
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS priority_score integer DEFAULT 50; -- For human review queue prioritization

-- Add constraints
ALTER TABLE public.applications ADD CONSTRAINT applications_ai_score_check 
    CHECK (ai_assessment_score IS NULL OR (ai_assessment_score >= 0 AND ai_assessment_score <= 100));
ALTER TABLE public.applications ADD CONSTRAINT applications_confidence_check 
    CHECK (ai_confidence_level IS NULL OR (ai_confidence_level >= 0 AND ai_confidence_level <= 100));
ALTER TABLE public.applications ADD CONSTRAINT applications_priority_check 
    CHECK (priority_score >= 1 AND priority_score <= 100);

-- ============================================================================
-- ENHANCE APPLICANTS TABLE
-- ============================================================================

-- Add applicant risk profile and history tracking
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS risk_profile text; -- 'low', 'medium', 'high'
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS previous_applications_count integer DEFAULT 0;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS previous_approvals_count integer DEFAULT 0;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS previous_rejections_count integer DEFAULT 0;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS last_application_date timestamptz;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS credit_score integer;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS preferred_communication_method text DEFAULT 'email'; -- 'email', 'sms', 'whatsapp'
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS communication_language text DEFAULT 'en';
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS blacklisted boolean DEFAULT false;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS blacklist_reason text;
ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS last_credit_check_date timestamptz;

-- ============================================================================
-- ENHANCE DOCUMENTS TABLE
-- ============================================================================

-- Add AI processing status and metadata
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ai_processing_status text DEFAULT 'pending'; -- 'pending', 'processing', 'completed', 'failed'
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ai_extraction_confidence numeric(5,2);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ai_verification_status text; -- 'verified', 'suspicious', 'failed', 'manual_review_required'
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extracted_data_json jsonb;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS quality_score numeric(5,2);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS requires_manual_review boolean DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS manual_review_reason text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS processing_attempts integer DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS last_processing_attempt_at timestamptz;

-- Add constraints for documents
ALTER TABLE public.documents ADD CONSTRAINT documents_extraction_confidence_check 
    CHECK (ai_extraction_confidence IS NULL OR (ai_extraction_confidence >= 0 AND ai_extraction_confidence <= 100));
ALTER TABLE public.documents ADD CONSTRAINT documents_quality_score_check 
    CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100));

-- ============================================================================
-- CREATE APPLICATION STATUS TRACKING TABLE
-- ============================================================================

-- Track detailed status history for applications
CREATE TABLE public.application_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    previous_status text,
    new_status text NOT NULL,
    changed_by_type text NOT NULL, -- 'ai', 'human', 'system'
    changed_by_id uuid REFERENCES public.users(id), -- null if changed by AI
    change_reason text,
    metadata jsonb, -- Additional context about the status change
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "application_status_history_tenant_isolation" ON public.application_status_history
    FOR ALL USING (
        application_id IN (
            SELECT id FROM public.applications 
            WHERE tenant_id = (SELECT tenant_id FROM auth.jwt() ->> 'tenant_id'::text)::uuid
        )
    );

-- Index for performance
CREATE INDEX idx_application_status_history_application_id ON public.application_status_history(application_id);
CREATE INDEX idx_application_status_history_created_at ON public.application_status_history(created_at DESC);

-- ============================================================================
-- CREATE VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for applications requiring human review
CREATE OR REPLACE VIEW public.applications_requiring_review AS
SELECT 
    a.id,
    a.reference,
    ap.full_name,
    ap.mobile,
    a.amount_requested,
    a.ai_qualification_status,
    a.ai_assessment_score,
    a.ai_confidence_level,
    a.requires_human_review,
    a.human_review_reason,
    a.priority_score,
    a.assessment_completed_at,
    a.created_at,
    -- Calculate how long it's been waiting for review
    EXTRACT(EPOCH FROM (now() - a.assessment_completed_at))/3600 as hours_waiting,
    -- Get the latest feedback if any
    af.primary_reason as latest_feedback_reason,
    af.created_at as feedback_sent_at
FROM public.applications a
JOIN public.applicants ap ON a.applicant_id = ap.id
LEFT JOIN public.application_feedback af ON a.id = af.application_id 
    AND af.created_at = (SELECT MAX(created_at) FROM public.application_feedback WHERE application_id = a.id)
WHERE a.requires_human_review = true 
   OR a.ai_qualification_status = 'pending_review'
ORDER BY a.priority_score DESC, a.assessment_completed_at ASC;

-- View for qualified applications ready for final approval
CREATE OR REPLACE VIEW public.qualified_applications AS
SELECT 
    a.id,
    a.reference,
    ap.full_name,
    ap.mobile,
    ap.email,
    a.amount_requested,
    a.term_months,
    a.purpose,
    a.ai_assessment_score,
    a.ai_confidence_level,
    a.assessment_completed_at,
    a.created_at,
    -- Get document verification status
    COUNT(d.id) as total_documents,
    COUNT(CASE WHEN dv.status = 'verified' THEN 1 END) as verified_documents,
    -- Get latest assessment details
    aa.overall_score,
    aa.processing_time_ms
FROM public.applications a
JOIN public.applicants ap ON a.applicant_id = ap.id
LEFT JOIN public.documents d ON a.id = d.application_id
LEFT JOIN public.document_verifications dv ON d.id = dv.document_id
LEFT JOIN public.ai_assessments aa ON a.id = aa.application_id 
    AND aa.created_at = (SELECT MAX(created_at) FROM public.ai_assessments WHERE application_id = a.id)
WHERE a.ai_qualification_status = 'qualified'
  AND a.automated_assessment_completed = true
GROUP BY a.id, ap.full_name, ap.mobile, ap.email, a.amount_requested, 
         a.term_months, a.purpose, a.ai_assessment_score, a.ai_confidence_level,
         a.assessment_completed_at, a.created_at, aa.overall_score, aa.processing_time_ms
ORDER BY a.ai_assessment_score DESC, a.created_at ASC;

-- View for applications with processing issues
CREATE OR REPLACE VIEW public.applications_with_issues AS
SELECT 
    a.id,
    a.reference,
    ap.full_name,
    a.current_workflow_stage,
    a.ai_qualification_status,
    a.next_action_required,
    a.assessment_started_at,
    -- Identify the type of issue
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.documents d WHERE d.application_id = a.id AND d.requires_manual_review = true) 
            THEN 'document_review_required'
        WHEN EXISTS (SELECT 1 FROM public.consistency_checks cc WHERE cc.application_id = a.id AND cc.resolution_required = true)
            THEN 'data_consistency_issue'
        WHEN a.assessment_started_at IS NOT NULL AND a.assessment_completed_at IS NULL 
            AND a.assessment_started_at < now() - interval '2 hours'
            THEN 'processing_timeout'
        WHEN a.ai_qualification_status = 'requires_documents'
            THEN 'missing_documents'
        ELSE 'other'
    END as issue_type,
    -- Time since issue started
    EXTRACT(EPOCH FROM (now() - a.assessment_started_at))/3600 as hours_since_started
FROM public.applications a
JOIN public.applicants ap ON a.applicant_id = ap.id
WHERE 
    (a.assessment_started_at IS NOT NULL AND a.assessment_completed_at IS NULL AND a.assessment_started_at < now() - interval '1 hour')
    OR EXISTS (SELECT 1 FROM public.documents d WHERE d.application_id = a.id AND d.requires_manual_review = true)
    OR EXISTS (SELECT 1 FROM public.consistency_checks cc WHERE cc.application_id = a.id AND cc.resolution_required = true)
    OR a.ai_qualification_status = 'requires_documents'
ORDER BY hours_since_started DESC;

-- ============================================================================
-- FUNCTIONS FOR WORKFLOW MANAGEMENT
-- ============================================================================

-- Function to advance application to next workflow stage
CREATE OR REPLACE FUNCTION advance_workflow_stage(
    app_id uuid,
    current_stage text,
    next_stage text,
    processor_type text DEFAULT 'ai',
    processor_id uuid DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
    stage_updated boolean := false;
BEGIN
    -- Update the application's current workflow stage
    UPDATE public.applications 
    SET current_workflow_stage = next_stage,
        updated_at = now()
    WHERE id = app_id AND current_workflow_stage = current_stage;
    
    GET DIAGNOSTICS stage_updated = ROW_COUNT;
    
    -- Log the workflow stage completion
    IF stage_updated THEN
        INSERT INTO public.workflow_stages (
            application_id, 
            stage_code, 
            stage_name,
            status,
            started_at,
            completed_at,
            processed_by,
            processor_id
        ) VALUES (
            app_id,
            current_stage,
            current_stage, -- Will be updated by calling code with proper name
            'completed',
            now() - interval '1 minute', -- Approximate start time
            now(),
            processor_type,
            processor_id
        );
        
        -- Start the next stage
        INSERT INTO public.workflow_stages (
            application_id,
            stage_code,
            stage_name, 
            status,
            started_at,
            processed_by
        ) VALUES (
            app_id,
            next_stage,
            next_stage, -- Will be updated by calling code with proper name
            'in_progress',
            now(),
            processor_type
        );
    END IF;
    
    RETURN stage_updated;
END;
$$ LANGUAGE plpgsql;

-- Function to update application status with history tracking
CREATE OR REPLACE FUNCTION update_application_status(
    app_id uuid,
    new_status text,
    changer_type text DEFAULT 'system',
    changer_id uuid DEFAULT NULL,
    change_reason text DEFAULT NULL,
    change_metadata jsonb DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
    old_status text;
    update_success boolean := false;
BEGIN
    -- Get current status
    SELECT status INTO old_status FROM public.applications WHERE id = app_id;
    
    -- Update application status
    UPDATE public.applications 
    SET status = new_status,
        updated_at = now()
    WHERE id = app_id;
    
    GET DIAGNOSTICS update_success = ROW_COUNT;
    
    -- Log the status change
    IF update_success THEN
        INSERT INTO public.application_status_history (
            application_id,
            previous_status,
            new_status,
            changed_by_type,
            changed_by_id,
            change_reason,
            metadata
        ) VALUES (
            app_id,
            old_status,
            new_status,
            changer_type,
            changer_id,
            change_reason,
            change_metadata
        );
    END IF;
    
    RETURN update_success;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR ENHANCED PERFORMANCE
-- ============================================================================

-- Indexes for AI workflow queries
CREATE INDEX idx_applications_ai_qualification_status ON public.applications(ai_qualification_status);
CREATE INDEX idx_applications_current_workflow_stage ON public.applications(current_workflow_stage);
CREATE INDEX idx_applications_requires_review ON public.applications(requires_human_review) WHERE requires_human_review = true;
CREATE INDEX idx_applications_assessment_completed ON public.applications(assessment_completed_at) WHERE assessment_completed_at IS NOT NULL;
CREATE INDEX idx_applications_ai_processing ON public.applications(ai_processing_enabled, automated_assessment_completed);

-- Indexes for applicant queries
CREATE INDEX idx_applicants_risk_profile ON public.applicants(risk_profile);
CREATE INDEX idx_applicants_blacklisted ON public.applicants(blacklisted) WHERE blacklisted = true;
CREATE INDEX idx_applicants_last_application ON public.applicants(last_application_date);

-- Indexes for document processing
CREATE INDEX idx_documents_ai_processing_status ON public.documents(ai_processing_status);
CREATE INDEX idx_documents_verification_status ON public.documents(ai_verification_status);
CREATE INDEX idx_documents_manual_review ON public.documents(requires_manual_review) WHERE requires_manual_review = true;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger to update applicant history when applications are created
CREATE OR REPLACE FUNCTION update_applicant_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.applicants 
        SET previous_applications_count = previous_applications_count + 1,
            last_application_date = NEW.created_at
        WHERE id = NEW.applicant_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        -- Update approval/rejection counts based on status changes
        IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
            UPDATE public.applicants 
            SET previous_approvals_count = previous_approvals_count + 1
            WHERE id = NEW.applicant_id;
        ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
            UPDATE public.applicants 
            SET previous_rejections_count = previous_rejections_count + 1
            WHERE id = NEW.applicant_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_applicant_history_trigger
    AFTER INSERT OR UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION update_applicant_history();

-- Trigger to automatically set assessment started timestamp
CREATE OR REPLACE FUNCTION set_assessment_started()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assessment_started_at IS NULL AND NEW.current_workflow_stage != 'document_upload' THEN
        NEW.assessment_started_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_assessment_started_trigger
    BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION set_assessment_started();

-- ============================================================================
-- COMMENTS FOR NEW FIELDS
-- ============================================================================

COMMENT ON COLUMN public.applications.ai_processing_enabled IS 'Whether this application should use AI-powered assessment';
COMMENT ON COLUMN public.applications.automated_assessment_completed IS 'Whether AI assessment pipeline has completed';
COMMENT ON COLUMN public.applications.current_workflow_stage IS 'Current stage in the automated assessment workflow';
COMMENT ON COLUMN public.applications.ai_qualification_status IS 'AI-determined qualification status: qualified, rejected, pending_review, requires_documents';
COMMENT ON COLUMN public.applications.ai_assessment_score IS 'Overall AI assessment score (0-100)';
COMMENT ON COLUMN public.applications.ai_confidence_level IS 'AI confidence in the assessment (0-100)';
COMMENT ON COLUMN public.applications.requires_human_review IS 'Whether this application needs human review';
COMMENT ON COLUMN public.applications.next_action_required IS 'Description of what needs to happen next';
COMMENT ON COLUMN public.applications.priority_score IS 'Priority score for human review queue (1-100, higher = more urgent)';

COMMENT ON VIEW public.applications_requiring_review IS 'Applications that need human review, ordered by priority';
COMMENT ON VIEW public.qualified_applications IS 'Applications that passed AI assessment and are ready for final approval';
COMMENT ON VIEW public.applications_with_issues IS 'Applications with processing issues that need attention';