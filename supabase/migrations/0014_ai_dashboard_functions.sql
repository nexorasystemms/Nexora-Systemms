CREATE OR REPLACE FUNCTION get_ai_review_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    qualified_pending integer := 0;
    pending_manual_review integer := 0;
    processing_issues integer := 0;
    processed_today integer := 0;
    avg_processing_time numeric := 0;
    success_rate numeric := 0;
    total_processed_week integer := 0;
    qualified_week integer := 0;
BEGIN
    -- Count qualified applications pending approval
    SELECT COUNT(*) INTO qualified_pending
    FROM public.applications
    WHERE ai_qualification_status = 'qualified'
    AND status NOT IN ('approved', 'rejected')
    AND automated_assessment_completed = true;

    -- Count applications requiring manual review
    SELECT COUNT(*) INTO pending_manual_review
    FROM public.applications
    WHERE requires_human_review = true
    AND status NOT IN ('approved', 'rejected');

    -- Count processing issues
    SELECT COUNT(*) INTO processing_issues
    FROM public.applications
    WHERE (
        (assessment_started_at IS NOT NULL 
         AND assessment_completed_at IS NULL 
         AND assessment_started_at < now() - interval '2 hours')
        OR EXISTS (
            SELECT 1 FROM public.documents d 
            WHERE d.application_id = applications.id 
            AND d.requires_manual_review = true
        )
        OR ai_qualification_status = 'requires_documents'
    )
    AND status NOT IN ('approved', 'rejected');

    -- Count processed today
    SELECT COUNT(*) INTO processed_today
    FROM public.applications
    WHERE automated_assessment_completed = true
    AND assessment_completed_at >= CURRENT_DATE;

    -- Calculate average processing time for completed assessments in last 7 days
    SELECT COALESCE(AVG(processing_time_ms), 0) INTO avg_processing_time
    FROM public.ai_assessments
    WHERE created_at >= CURRENT_DATE - interval '7 days'
    AND processing_time_ms IS NOT NULL;

    -- Calculate success rate (qualified applications / total processed) for last 7 days
    SELECT COUNT(*) INTO total_processed_week
    FROM public.applications
    WHERE automated_assessment_completed = true
    AND assessment_completed_at >= CURRENT_DATE - interval '7 days';

    SELECT COUNT(*) INTO qualified_week
    FROM public.applications
    WHERE ai_qualification_status = 'qualified'
    AND assessment_completed_at >= CURRENT_DATE - interval '7 days';

    IF total_processed_week > 0 THEN
        success_rate := (qualified_week::numeric / total_processed_week::numeric) * 100;
    END IF;

    -- Return JSON object with all statistics
    RETURN json_build_object(
        'qualified_pending', qualified_pending,
        'pending_manual_review', pending_manual_review,
        'processing_issues', processing_issues,
        'processed_today', processed_today,
        'avg_processing_time', ROUND(avg_processing_time),
        'success_rate', ROUND(success_rate, 1),
        'total_processed_week', total_processed_week,
        'qualified_week', qualified_week
    );
END;
$$;

-- ============================================================================
-- ENHANCED APPLICATION VIEWS WITH COMPUTED FIELDS
-- ============================================================================

-- Update qualified applications view with additional computed fields
DROP VIEW IF EXISTS public.qualified_applications;
CREATE VIEW public.qualified_applications AS
SELECT 
    a.id,
    a.reference,
    ap.full_name as applicant_name,
    ap.mobile,
    ap.email,
    a.amount_requested,
    a.term_months,
    a.purpose,
    a.ai_assessment_score,
    a.ai_confidence_level,
    a.assessment_completed_at,
    a.created_at,
    -- Document statistics
    COUNT(d.id) as total_documents,
    COUNT(CASE WHEN dv.status = 'verified' THEN 1 END) as verified_documents,
    -- Processing time from latest assessment
    aa.processing_time_ms,
    aa.overall_score,
    -- Risk factors (computed)
    CASE 
        WHEN a.ai_confidence_level < 80 THEN ARRAY['Low AI Confidence']
        WHEN EXISTS (SELECT 1 FROM public.documents doc WHERE doc.application_id = a.id AND doc.ai_verification_status = 'suspicious') 
            THEN ARRAY['Document Concerns']
        WHEN EXISTS (SELECT 1 FROM public.consistency_checks cc WHERE cc.application_id = a.id AND cc.discrepancy_found = true)
            THEN ARRAY['Data Inconsistencies']
        ELSE ARRAY[]::text[]
    END as risk_factors,
    -- Priority score for sorting
    CASE 
        WHEN a.ai_confidence_level < 70 THEN 100
        WHEN a.ai_assessment_score >= 90 THEN 95
        WHEN a.ai_assessment_score >= 80 THEN 90
        ELSE 85
    END as priority_score
FROM public.applications a
JOIN public.applicants ap ON a.applicant_id = ap.id
LEFT JOIN public.documents d ON a.id = d.application_id
LEFT JOIN public.document_verifications dv ON d.id = dv.document_id
LEFT JOIN (
    SELECT DISTINCT ON (application_id) 
        application_id, processing_time_ms, overall_score
    FROM public.ai_assessments 
    ORDER BY application_id, created_at DESC
) aa ON a.id = aa.application_id
WHERE a.ai_qualification_status = 'qualified'
  AND a.automated_assessment_completed = true
  AND a.status NOT IN ('approved', 'rejected')
GROUP BY 
    a.id, ap.full_name, ap.mobile, ap.email, a.amount_requested, 
    a.term_months, a.purpose, a.ai_assessment_score, a.ai_confidence_level,
    a.assessment_completed_at, a.created_at, aa.processing_time_ms, aa.overall_score
ORDER BY priority_score DESC, a.ai_assessment_score DESC, a.created_at ASC;

-- Update applications requiring review view
DROP VIEW IF EXISTS public.applications_requiring_review;
CREATE VIEW public.applications_requiring_review AS
SELECT 
    a.id,
    a.reference,
    ap.full_name as applicant_name,
    ap.mobile,
    a.amount_requested,
    a.ai_qualification_status,
    a.ai_assessment_score,
    a.ai_confidence_level,
    a.requires_human_review,
    a.human_review_reason,
    a.priority_score,
    a.assessment_completed_at,
    a.assessment_started_at,
    a.created_at,
    -- Calculate waiting time
    EXTRACT(EPOCH FROM (now() - COALESCE(a.assessment_completed_at, a.assessment_started_at)))/3600 as hours_waiting,
    -- Get latest feedback if any
    af.primary_reason as latest_feedback_reason,
    af.created_at as feedback_sent_at,
    -- Get failed criteria count
    (SELECT COUNT(*) FROM public.assessment_scores asc 
     JOIN public.ai_assessments ass ON asc.assessment_id = ass.id
     WHERE ass.application_id = a.id AND asc.passed = false) as failed_criteria_count
FROM public.applications a
JOIN public.applicants ap ON a.applicant_id = ap.id
LEFT JOIN (
    SELECT DISTINCT ON (application_id) 
        application_id, primary_reason, created_at
    FROM public.application_feedback 
    ORDER BY application_id, created_at DESC
) af ON a.id = af.application_id
WHERE (a.requires_human_review = true OR a.ai_qualification_status = 'pending_review')
  AND a.status NOT IN ('approved', 'rejected')
ORDER BY a.priority_score DESC NULLS LAST, 
         COALESCE(a.assessment_completed_at, a.assessment_started_at) ASC NULLS LAST;

-- Update applications with issues view
DROP VIEW IF EXISTS public.applications_with_issues;
CREATE VIEW public.applications_with_issues AS
SELECT 
    a.id,
    a.reference,
    ap.full_name,
    a.current_workflow_stage,
    a.ai_qualification_status,
    a.next_action_required,
    a.assessment_started_at,
    a.assessment_completed_at,
    -- Identify the type of issue with priority
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
        WHEN a.ai_processing_enabled = true AND a.current_workflow_stage = 'document_upload'
            AND NOT EXISTS (SELECT 1 FROM public.documents WHERE application_id = a.id)
            THEN 'no_documents_uploaded'
        ELSE 'other'
    END as issue_type,
    -- Time since issue started
    EXTRACT(EPOCH FROM (now() - COALESCE(a.assessment_started_at, a.created_at)))/3600 as hours_since_started,
    -- Issue severity
    CASE 
        WHEN a.assessment_started_at IS NOT NULL AND a.assessment_completed_at IS NULL 
            AND a.assessment_started_at < now() - interval '6 hours' THEN 'high'
        WHEN EXISTS (SELECT 1 FROM public.consistency_checks cc WHERE cc.application_id = a.id AND cc.discrepancy_severity = 'major')
            THEN 'high'
        WHEN EXISTS (SELECT 1 FROM public.documents d WHERE d.application_id = a.id AND d.ai_verification_status = 'suspicious')
            THEN 'medium'
        ELSE 'low'
    END as severity,
    -- Count of processing attempts
    COALESCE((SELECT processing_attempts FROM public.applications WHERE id = a.id), 0) as processing_attempts
FROM public.applications a
JOIN public.applicants ap ON a.applicant_id = ap.id
WHERE a.status NOT IN ('approved', 'rejected')
AND (
    -- Processing timeout
    (a.assessment_started_at IS NOT NULL AND a.assessment_completed_at IS NULL 
     AND a.assessment_started_at < now() - interval '1 hour')
    -- Document review required
    OR EXISTS (SELECT 1 FROM public.documents d WHERE d.application_id = a.id AND d.requires_manual_review = true)
    -- Data consistency issues
    OR EXISTS (SELECT 1 FROM public.consistency_checks cc WHERE cc.application_id = a.id AND cc.resolution_required = true)
    -- Missing documents
    OR a.ai_qualification_status = 'requires_documents'
    -- No documents uploaded for AI-enabled applications
    OR (a.ai_processing_enabled = true AND a.current_workflow_stage = 'document_upload'
        AND NOT EXISTS (SELECT 1 FROM public.documents WHERE application_id = a.id)
        AND a.created_at < now() - interval '24 hours')
)
ORDER BY 
    CASE 
        WHEN severity = 'high' THEN 1
        WHEN severity = 'medium' THEN 2
        ELSE 3
    END,
    hours_since_started DESC;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to get application processing summary
CREATE OR REPLACE FUNCTION get_application_processing_summary(app_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'application_id', a.id,
        'reference', a.reference,
        'current_stage', a.current_workflow_stage,
        'qualification_status', a.ai_qualification_status,
        'assessment_score', a.ai_assessment_score,
        'confidence_level', a.ai_confidence_level,
        'requires_review', a.requires_human_review,
        'processing_time', aa.processing_time_ms,
        'document_count', (SELECT COUNT(*) FROM public.documents WHERE application_id = a.id),
        'verified_documents', (SELECT COUNT(*) FROM public.documents d 
                              WHERE d.application_id = a.id 
                              AND d.ai_verification_status = 'verified'),
        'failed_criteria', (SELECT COUNT(*) FROM public.assessment_scores asc 
                           JOIN public.ai_assessments ass ON asc.assessment_id = ass.id
                           WHERE ass.application_id = a.id AND asc.passed = false),
        'has_feedback', EXISTS(SELECT 1 FROM public.application_feedback WHERE application_id = a.id),
        'processing_issues', CASE 
            WHEN a.assessment_started_at IS NOT NULL AND a.assessment_completed_at IS NULL 
                AND a.assessment_started_at < now() - interval '2 hours' THEN true
            WHEN EXISTS (SELECT 1 FROM public.documents d WHERE d.application_id = a.id AND d.requires_manual_review = true) THEN true
            ELSE false
        END
    ) INTO result
    FROM public.applications a
    LEFT JOIN (
        SELECT DISTINCT ON (application_id) application_id, processing_time_ms
        FROM public.ai_assessments 
        ORDER BY application_id, created_at DESC
    ) aa ON a.id = aa.application_id
    WHERE a.id = app_id;

    RETURN result;
END;
$$;

-- ============================================================================
-- BATCH PROCESSING FUNCTIONS
-- ============================================================================

-- Function to get applications ready for batch processing
CREATE OR REPLACE FUNCTION get_applications_for_batch_processing(batch_size integer DEFAULT 10)
RETURNS TABLE (
    application_id uuid,
    reference text,
    current_stage text,
    priority_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as application_id,
        a.reference,
        a.current_workflow_stage as current_stage,
        CASE 
            WHEN a.created_at < now() - interval '48 hours' THEN 100
            WHEN a.created_at < now() - interval '24 hours' THEN 80
            WHEN a.amount_requested > 10000 THEN 70
            ELSE 50
        END as priority_score
    FROM public.applications a
    WHERE a.ai_processing_enabled = true
    AND a.automated_assessment_completed = false
    AND a.status NOT IN ('approved', 'rejected')
    AND a.current_workflow_stage IN (
        'document_upload', 
        'document_verification', 
        'consistency_check', 
        'affordability_assessment',
        'final_assessment'
    )
    -- Exclude applications that are currently being processed (started within last 30 minutes)
    AND (a.assessment_started_at IS NULL OR a.assessment_started_at < now() - interval '30 minutes')
    -- Exclude applications with too many failed attempts
    AND COALESCE(a.processing_attempts, 0) < 3
    ORDER BY priority_score DESC, a.created_at ASC
    LIMIT batch_size;
END;
$$;

-- ============================================================================
-- REPORTING AND ANALYTICS FUNCTIONS
-- ============================================================================

-- Function to get processing performance metrics
CREATE OR REPLACE FUNCTION get_processing_performance_metrics(days_back integer DEFAULT 7)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    start_date timestamp := CURRENT_DATE - (days_back || ' days')::interval;
    metrics json;
BEGIN
    SELECT json_build_object(
        'period_days', days_back,
        'total_applications', COUNT(*),
        'completed_assessments', COUNT(*) FILTER (WHERE automated_assessment_completed = true),
        'qualified_applications', COUNT(*) FILTER (WHERE ai_qualification_status = 'qualified'),
        'rejected_applications', COUNT(*) FILTER (WHERE ai_qualification_status = 'rejected'),
        'pending_review', COUNT(*) FILTER (WHERE ai_qualification_status = 'pending_review'),
        'avg_processing_time_seconds', ROUND(AVG(aa.processing_time_ms / 1000.0), 2),
        'avg_assessment_score', ROUND(AVG(ai_assessment_score), 1),
        'avg_confidence_level', ROUND(AVG(ai_confidence_level), 1),
        'document_processing_rate', ROUND(
            (COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM public.documents d 
                WHERE d.application_id = applications.id 
                AND d.ai_processing_status = 'completed'
            ))::numeric / NULLIF(COUNT(*), 0)) * 100, 1
        ),
        'success_rate', ROUND(
            (COUNT(*) FILTER (WHERE ai_qualification_status = 'qualified')::numeric / 
             NULLIF(COUNT(*) FILTER (WHERE automated_assessment_completed = true), 0)) * 100, 1
        )
    ) INTO metrics
    FROM public.applications
    LEFT JOIN (
        SELECT DISTINCT ON (application_id) application_id, processing_time_ms
        FROM public.ai_assessments 
        ORDER BY application_id, created_at DESC
    ) aa ON applications.id = aa.application_id
    WHERE created_at >= start_date
    AND ai_processing_enabled = true;

    RETURN metrics;
END;
$$;

-- ============================================================================
-- INDEXES FOR DASHBOARD PERFORMANCE
-- ============================================================================

-- Additional indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_applications_ai_dashboard_stats ON public.applications(
    ai_qualification_status, 
    automated_assessment_completed, 
    requires_human_review, 
    status
) 
WHERE status NOT IN ('approved', 'rejected');

CREATE INDEX IF NOT EXISTS idx_applications_processing_timeline ON public.applications(
    assessment_started_at, 
    assessment_completed_at
) 
WHERE assessment_started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_applications_batch_processing ON public.applications(
    ai_processing_enabled, 
    automated_assessment_completed, 
    current_workflow_stage, 
    processing_attempts
)
WHERE ai_processing_enabled = true 
AND automated_assessment_completed = false 
AND status NOT IN ('approved', 'rejected');

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_ai_review_stats() IS 'Returns comprehensive statistics for the AI review dashboard';
COMMENT ON FUNCTION get_application_processing_summary(uuid) IS 'Returns detailed processing summary for a specific application';
COMMENT ON FUNCTION get_applications_for_batch_processing(integer) IS 'Returns applications ready for batch processing, ordered by priority';
COMMENT ON FUNCTION get_processing_performance_metrics(integer) IS 'Returns performance metrics for the specified number of days';