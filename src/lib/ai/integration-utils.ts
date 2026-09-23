/**
 * Integration utilities for AI-powered loan processing
 * Helper functions to integrate AI assessment with existing application workflow
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { workflowOrchestrator } from "./workflow-orchestrator";
import { documentProcessor } from "./document-processor";

export interface AutoProcessingOptions {
  enable_document_auto_processing?: boolean;
  enable_assessment_auto_processing?: boolean;
  confidence_threshold?: number;
  manual_review_threshold?: number;
}

/**
 * Initialize AI processing for a new application
 */
export async function initializeAIProcessing(
  applicationId: string,
  options: AutoProcessingOptions = {}
): Promise<{ success: boolean; message: string }> {
  
  const supabase = createAdminClient();

  try {
    // Update application to enable AI processing
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        ai_processing_enabled: true,
        current_workflow_stage: 'document_upload',
        assessment_started_at: new Date().toISOString(),
        next_action_required: 'Upload required documents (ID, payslip, bank statement)'
      })
      .eq('id', applicationId);

    if (updateError) {
      throw new Error(`Failed to initialize AI processing: ${updateError.message}`);
    }

    console.log(`AI processing initialized for application ${applicationId}`);

    return {
      success: true,
      message: 'AI processing initialized successfully'
    };

  } catch (error) {
    console.error('AI initialization error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Trigger processing when a document is uploaded
 */
export async function onDocumentUpload(
  documentId: string,
  applicationId: string,
  autoProcess: boolean = true
): Promise<{ success: boolean; message: string; should_continue_workflow?: boolean }> {

  try {
    console.log(`Document uploaded: ${documentId} for application ${applicationId}`);

    let shouldContinueWorkflow = false;

    if (autoProcess) {
      // Process the document immediately
      const processingResult = await documentProcessor.processDocument(documentId);
      
      if (!processingResult.success) {
        console.warn(`Document processing failed for ${documentId}`);
      }

      // Check if all required documents are now uploaded and processed
      const allDocsReady = await checkAllDocumentsReady(applicationId);
      
      if (allDocsReady) {
        shouldContinueWorkflow = true;
        
        // Advance workflow to next stage
        await workflowOrchestrator.processApplication(applicationId);
      }
    }

    return {
      success: true,
      message: 'Document uploaded and processed successfully',
      should_continue_workflow: shouldContinueWorkflow
    };

  } catch (error) {
    console.error('Document upload handler error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Document processing failed'
    };
  }
}

/**
 * Check if all required documents are uploaded and processed
 */
export async function checkAllDocumentsReady(applicationId: string): Promise<boolean> {
  const supabase = createAdminClient();
  
  const requiredDocuments = ['id', 'payslip', 'bank_statement'];
  
  const { data: documents } = await supabase
    .from('documents')
    .select('doc_type, ai_processing_status')
    .eq('application_id', applicationId)
    .in('doc_type', requiredDocuments);

  if (!documents) return false;

  // Check that all required documents are present and processed
  const processedDocs = new Set(
    documents
      .filter(doc => doc.ai_processing_status === 'completed')
      .map(doc => doc.doc_type)
  );

  return requiredDocuments.every(docType => processedDocs.has(docType));
}

/**
 * Get AI assessment summary for an application
 */
export async function getAIAssessmentSummary(applicationId: string): Promise<{
  overall_score?: number;
  qualification_status?: string;
  confidence_level?: number;
  failed_criteria: string[];
  improvement_suggestions: string[];
  next_actions: string[];
  requires_human_review: boolean;
} | null> {

  const supabase = createAdminClient();

  try {
    // Get latest assessment
    const { data: assessment } = await supabase
      .from('ai_assessments')
      .select(`
        *,
        assessment_scores (
          *,
          qualification_criteria (criteria_name, criteria_code)
        )
      `)
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!assessment) return null;

    // Get failed criteria
    const failedCriteria = assessment.assessment_scores
      ?.filter((score: any) => !score.passed)
      .map((score: any) => score.qualification_criteria?.criteria_name || score.criteria_id) || [];

    // Get feedback if available
    const { data: feedback } = await supabase
      .from('application_feedback')
      .select('improvement_suggestions, alternative_options')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const improvementSuggestions = feedback?.improvement_suggestions?.map((s: any) => s.suggestion) || [];
    
    // Get application status
    const { data: application } = await supabase
      .from('applications')
      .select('requires_human_review, next_action_required')
      .eq('id', applicationId)
      .single();

    return {
      overall_score: assessment.overall_score,
      qualification_status: assessment.qualification_status,
      confidence_level: assessment.confidence_level,
      failed_criteria: failedCriteria,
      improvement_suggestions: improvementSuggestions,
      next_actions: application?.next_action_required ? [application.next_action_required] : [],
      requires_human_review: application?.requires_human_review || false
    };

  } catch (error) {
    console.error('Failed to get AI assessment summary:', error);
    return null;
  }
}

/**
 * Retry failed processing for an application
 */
export async function retryFailedProcessing(applicationId: string): Promise<{
  success: boolean;
  message: string;
  retry_count: number;
}> {
  
  const supabase = createAdminClient();

  try {
    // Get current retry count
    const { data: application } = await supabase
      .from('applications')
      .select('processing_attempts')
      .eq('id', applicationId)
      .single();

    const retryCount = (application?.processing_attempts || 0) + 1;

    if (retryCount > 3) {
      return {
        success: false,
        message: 'Maximum retry attempts exceeded. Manual review required.',
        retry_count: retryCount
      };
    }

    // Reset processing status
    await supabase
      .from('applications')
      .update({
        automated_assessment_completed: false,
        current_workflow_stage: 'document_verification',
        requires_human_review: false,
        processing_attempts: retryCount,
        assessment_started_at: new Date().toISOString()
      })
      .eq('id', applicationId);

    // Restart workflow
    const result = await workflowOrchestrator.processApplication(applicationId);

    return {
      success: result.success,
      message: result.success ? 'Processing restarted successfully' : 'Retry failed',
      retry_count: retryCount
    };

  } catch (error) {
    console.error('Retry processing error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Retry failed',
      retry_count: 0
    };
  }
}

/**
 * Generate assessment report for human reviewers
 */
export async function generateAssessmentReport(applicationId: string): Promise<{
  application_summary: any;
  assessment_details: any;
  document_verification: any;
  recommendation: string;
  risk_factors: string[];
  approval_conditions?: string[];
} | null> {

  const supabase = createAdminClient();

  try {
    // Get comprehensive application data
    const { data: application } = await supabase
      .from('applications')
      .select(`
        *,
        applicant:applicants (*),
        employment:employment (*),
        documents (*, document_verifications (*)),
        ai_assessments (
          *,
          assessment_scores (
            *,
            qualification_criteria (*)
          )
        ),
        application_feedback (*),
        consistency_checks (*)
      `)
      .eq('id', applicationId)
      .single();

    if (!application) return null;

    const latestAssessment = application.ai_assessments?.[0];
    const latestFeedback = application.application_feedback?.[0];

    // Generate summary
    const applicationSummary = {
      applicant_name: application.applicant?.full_name,
      requested_amount: application.amount_requested,
      monthly_income: application.employment?.[0]?.monthly_net_salary,
      employment_duration: application.employment?.[0]?.employment_start_date,
      dependants: application.applicant?.dependants_count,
      ai_score: application.ai_assessment_score,
      qualification_status: application.ai_qualification_status
    };

    // Assessment details
    const assessmentDetails = {
      overall_score: latestAssessment?.overall_score,
      confidence_level: latestAssessment?.confidence_level,
      criteria_scores: latestAssessment?.assessment_scores || [],
      processing_time: latestAssessment?.processing_time_ms
    };

    // Document verification summary
    const documentVerification = {
      total_documents: application.documents?.length || 0,
      verified_documents: application.documents?.filter((d: any) => 
        d.ai_verification_status === 'verified'
      ).length || 0,
      suspicious_documents: application.documents?.filter((d: any) => 
        d.ai_verification_status === 'suspicious'
      ).length || 0,
      manual_review_required: application.documents?.filter((d: any) => 
        d.requires_manual_review
      ).length || 0
    };

    // Generate recommendation
    let recommendation = 'APPROVE';
    const riskFactors: string[] = [];
    const approvalConditions: string[] = [];

    if (application.ai_qualification_status === 'rejected') {
      recommendation = 'DECLINE';
    } else if (application.ai_qualification_status === 'pending_review') {
      recommendation = 'CONDITIONAL APPROVAL';
      approvalConditions.push('Verify income documentation');
      approvalConditions.push('Confirm employment status');
    }

    // Identify risk factors
    if (application.ai_confidence_level && application.ai_confidence_level < 80) {
      riskFactors.push('Low AI confidence in assessment');
    }

    if (documentVerification.suspicious_documents > 0) {
      riskFactors.push('Document authenticity concerns');
    }

    if (application.consistency_checks?.some((check: any) => check.discrepancy_found)) {
      riskFactors.push('Data inconsistencies detected');
    }

    return {
      application_summary: applicationSummary,
      assessment_details: assessmentDetails,
      document_verification: documentVerification,
      recommendation,
      risk_factors: riskFactors,
      approval_conditions: approvalConditions.length > 0 ? approvalConditions : undefined
    };

  } catch (error) {
    console.error('Failed to generate assessment report:', error);
    return null;
  }
}

/**
 * Bulk process multiple applications
 */
export async function bulkProcessApplications(
  applicationIds: string[],
  maxConcurrent: number = 5
): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{ application_id: string; success: boolean; message: string }>;
}> {

  const results: Array<{ application_id: string; success: boolean; message: string }> = [];
  let successful = 0;
  let failed = 0;

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < applicationIds.length; i += maxConcurrent) {
    const batch = applicationIds.slice(i, i + maxConcurrent);
    
    const batchPromises = batch.map(async (applicationId) => {
      try {
        const result = await workflowOrchestrator.processApplication(applicationId);
        
        const success = result.success && !result.errors.length;
        if (success) successful++;
        else failed++;

        return {
          application_id: applicationId,
          success,
          message: success 
            ? `Processed successfully - ${result.current_stage}` 
            : `Failed: ${result.errors.join(', ')}`
        };
      } catch (error) {
        failed++;
        return {
          application_id: applicationId,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches
    if (i + maxConcurrent < applicationIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return {
    total: applicationIds.length,
    successful,
    failed,
    results
  };
}

/**
 * Get processing statistics for monitoring
 */
export async function getProcessingStatistics(
  tenantId?: string,
  days: number = 7
): Promise<{
  total_processed: number;
  qualified: number;
  rejected: number;
  pending_review: number;
  average_processing_time: number;
  success_rate: number;
  document_processing_rate: number;
}> {

  const supabase = createAdminClient();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('applications')
    .select('ai_qualification_status, assessment_completed_at, ai_assessments(processing_time_ms)')
    .eq('automated_assessment_completed', true)
    .gte('assessment_completed_at', startDate.toISOString());

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: applications } = await query;

  if (!applications) {
    return {
      total_processed: 0,
      qualified: 0,
      rejected: 0,
      pending_review: 0,
      average_processing_time: 0,
      success_rate: 0,
      document_processing_rate: 0
    };
  }

  const totalProcessed = applications.length;
  const qualified = applications.filter(app => app.ai_qualification_status === 'qualified').length;
  const rejected = applications.filter(app => app.ai_qualification_status === 'rejected').length;
  const pendingReview = applications.filter(app => app.ai_qualification_status === 'pending_review').length;

  const processingTimes = applications
    .map(app => app.ai_assessments?.[0]?.processing_time_ms)
    .filter(time => time != null);
  
  const averageProcessingTime = processingTimes.length > 0 
    ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
    : 0;

  const successRate = totalProcessed > 0 ? (qualified / totalProcessed) * 100 : 0;

  // Get document processing statistics
  const { data: documents } = await supabase
    .from('documents')
    .select('ai_processing_status')
    .gte('created_at', startDate.toISOString());

  const totalDocs = documents?.length || 0;
  const processedDocs = documents?.filter(doc => doc.ai_processing_status === 'completed').length || 0;
  const documentProcessingRate = totalDocs > 0 ? (processedDocs / totalDocs) * 100 : 0;

  return {
    total_processed: totalProcessed,
    qualified,
    rejected,
    pending_review: pendingReview,
    average_processing_time: Math.round(averageProcessingTime),
    success_rate: Math.round(successRate * 100) / 100,
    document_processing_rate: Math.round(documentProcessingRate * 100) / 100
  };
}