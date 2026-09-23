/**
 * Workflow Orchestrator
 * Coordinates the automated loan application assessment workflow
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { assessmentEngine } from "./assessment-engine";
import { documentProcessor } from "./document-processor";
import { feedbackGenerator } from "./feedback-generator";

export interface WorkflowStage {
  stage_code: string;
  stage_name: string;
  description: string;
  automated: boolean;
  processor?: 'ai' | 'human' | 'system';
  required_documents?: string[];
  confidence_threshold?: number;
  manual_review_threshold?: number;
  next_stage?: string;
}

export interface WorkflowResult {
  success: boolean;
  current_stage: string;
  next_stage?: string;
  requires_human_intervention: boolean;
  processing_notes: string[];
  errors: string[];
}

export class WorkflowOrchestrator {
  private supabase = createAdminClient();

  /**
   * Process an application through the automated workflow
   */
  async processApplication(applicationId: string): Promise<WorkflowResult> {
    try {
      console.log(`Starting workflow processing for application: ${applicationId}`);

      // Get application and current workflow stage
      const { data: application } = await this.supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (!application) {
        throw new Error('Application not found');
      }

      // Get workflow definition
      const workflowStages = await this.getWorkflowDefinition(application.tenant_id);
      const currentStage = workflowStages.find(stage => stage.stage_code === application.current_workflow_stage);

      if (!currentStage) {
        throw new Error(`Unknown workflow stage: ${application.current_workflow_stage}`);
      }

      console.log(`Processing stage: ${currentStage.stage_name}`);

      // Process the current stage
      const stageResult = await this.processWorkflowStage(applicationId, currentStage, workflowStages);

      return stageResult;

    } catch (error) {
      console.error('Workflow processing failed:', error);
      return {
        success: false,
        current_stage: 'error',
        requires_human_intervention: true,
        processing_notes: [],
        errors: [error.message]
      };
    }
  }

  /**
   * Process a specific workflow stage
   */
  private async processWorkflowStage(
    applicationId: string,
    currentStage: WorkflowStage,
    allStages: WorkflowStage[]
  ): Promise<WorkflowResult> {
    
    const processingNotes: string[] = [];
    let success = true;
    let requiresHumanIntervention = false;
    let nextStage = currentStage.next_stage;

    // Mark stage as started
    await this.recordStageStart(applicationId, currentStage);

    try {
      switch (currentStage.stage_code) {
        case 'document_upload':
          const uploadResult = await this.processDocumentUploadStage(applicationId, currentStage);
          success = uploadResult.success;
          requiresHumanIntervention = uploadResult.requires_human_intervention;
          processingNotes.push(...uploadResult.processing_notes);
          break;

        case 'document_verification':
          const verificationResult = await this.processDocumentVerificationStage(applicationId, currentStage);
          success = verificationResult.success;
          requiresHumanIntervention = verificationResult.requires_human_intervention;
          processingNotes.push(...verificationResult.processing_notes);
          break;

        case 'consistency_check':
          const consistencyResult = await this.processConsistencyCheckStage(applicationId);
          success = consistencyResult.success;
          requiresHumanIntervention = consistencyResult.requires_human_intervention;
          processingNotes.push(...consistencyResult.processing_notes);
          break;

        case 'affordability_assessment':
        case 'credit_check':
        case 'final_assessment':
          const assessmentResult = await this.processAssessmentStage(applicationId);
          success = assessmentResult.success;
          requiresHumanIntervention = assessmentResult.requires_human_intervention;
          processingNotes.push(...assessmentResult.processing_notes);
          break;

        case 'human_review':
          // This stage requires human intervention by definition
          success = true;
          requiresHumanIntervention = true;
          processingNotes.push('Application queued for human review');
          nextStage = undefined; // Don't auto-advance from human review
          break;

        default:
          throw new Error(`Unsupported workflow stage: ${currentStage.stage_code}`);
      }

      // Mark stage as completed
      await this.recordStageCompletion(applicationId, currentStage, success);

      // Advance to next stage if successful and not requiring human intervention
      if (success && !requiresHumanIntervention && nextStage) {
        await this.advanceToNextStage(applicationId, nextStage);
        
        // If the next stage is also automated, continue processing
        const nextStageInfo = allStages.find(stage => stage.stage_code === nextStage);
        if (nextStageInfo?.automated && nextStageInfo.processor !== 'human') {
          processingNotes.push(`Automatically continuing to ${nextStageInfo.stage_name}`);
          
          // Recursively process next stage
          const nextResult = await this.processWorkflowStage(applicationId, nextStageInfo, allStages);
          success = success && nextResult.success;
          requiresHumanIntervention = requiresHumanIntervention || nextResult.requires_human_intervention;
          processingNotes.push(...nextResult.processing_notes);
        }
      }

      return {
        success,
        current_stage: nextStage || currentStage.stage_code,
        next_stage: nextStage,
        requires_human_intervention: requiresHumanIntervention,
        processing_notes: processingNotes,
        errors: []
      };

    } catch (error) {
      await this.recordStageCompletion(applicationId, currentStage, false);
      throw error;
    }
  }

  /**
   * Process document upload stage
   */
  private async processDocumentUploadStage(
    applicationId: string,
    stage: WorkflowStage
  ): Promise<WorkflowResult> {
    
    const requiredDocs = stage.required_documents || ['id', 'payslip', 'bank_statement'];
    
    // Check if all required documents are uploaded
    const { data: documents } = await this.supabase
      .from('documents')
      .select('doc_type')
      .eq('application_id', applicationId);

    const uploadedTypes = new Set(documents?.map(doc => doc.doc_type) || []);
    const missingDocs = requiredDocs.filter(docType => !uploadedTypes.has(docType));

    if (missingDocs.length > 0) {
      // Update application to require documents
      await this.supabase
        .from('applications')
        .update({
          ai_qualification_status: 'requires_documents',
          next_action_required: `Upload missing documents: ${missingDocs.join(', ')}`
        })
        .eq('id', applicationId);

      return {
        success: false,
        current_stage: 'document_upload',
        requires_human_intervention: false,
        processing_notes: [`Missing required documents: ${missingDocs.join(', ')}`],
        errors: []
      };
    }

    return {
      success: true,
      current_stage: 'document_upload',
      requires_human_intervention: false,
      processing_notes: ['All required documents uploaded'],
      errors: []
    };
  }

  /**
   * Process document verification stage
   */
  private async processDocumentVerificationStage(
    applicationId: string,
    stage: WorkflowStage
  ): Promise<WorkflowResult> {
    
    const processingNotes: string[] = [];
    let requiresManualReview = false;

    // Get all documents for this application
    const { data: documents } = await this.supabase
      .from('documents')
      .select('*')
      .eq('application_id', applicationId)
      .in('doc_type', ['id', 'payslip', 'bank_statement']);

    if (!documents || documents.length === 0) {
      throw new Error('No documents found for verification');
    }

    // Process each document
    for (const document of documents) {
      if (document.ai_processing_status !== 'completed') {
        try {
          const result = await documentProcessor.processDocument(document.id);
          
          if (result.verification_status === 'manual_review_required' || 
              result.verification_status === 'suspicious') {
            requiresManualReview = true;
          }
          
          processingNotes.push(`Processed ${document.doc_type}: ${result.verification_status}`);
          
          // Check confidence threshold
          if (stage.confidence_threshold && result.confidence_score < stage.confidence_threshold) {
            requiresManualReview = true;
            processingNotes.push(`${document.doc_type} confidence below threshold`);
          }
          
        } catch (error) {
          processingNotes.push(`Failed to process ${document.doc_type}: ${error.message}`);
          requiresManualReview = true;
        }
      } else {
        processingNotes.push(`${document.doc_type} already processed`);
      }
    }

    return {
      success: true,
      current_stage: 'document_verification',
      requires_human_intervention: requiresManualReview,
      processing_notes,
      errors: []
    };
  }

  /**
   * Process consistency check stage
   */
  private async processConsistencyCheckStage(applicationId: string): Promise<WorkflowResult> {
    const processingNotes: string[] = [];
    let requiresManualReview = false;

    // Get application with extracted document data
    const { data: application } = await this.supabase
      .from('applications')
      .select(`
        *,
        employment (*),
        documents (*)
      `)
      .eq('id', applicationId)
      .single();

    if (!application) {
      throw new Error('Application not found');
    }

    // Check income consistency across documents
    const payslipDoc = application.documents.find((doc: any) => doc.doc_type === 'payslip');
    const bankDoc = application.documents.find((doc: any) => doc.doc_type === 'bank_statement');
    const declaredSalary = application.employment?.[0]?.monthly_net_salary;

    if (payslipDoc?.extracted_data_json && bankDoc?.extracted_data_json && declaredSalary) {
      const payslipSalary = payslipDoc.extracted_data_json.net_salary;
      const bankSalary = bankDoc.extracted_data_json.average_salary_deposit;

      // Calculate variance
      const salaries = [declaredSalary, payslipSalary, bankSalary];
      const avgSalary = salaries.reduce((sum, sal) => sum + sal, 0) / salaries.length;
      const maxVariance = Math.max(...salaries.map(sal => Math.abs(sal - avgSalary) / avgSalary));

      if (maxVariance > 0.1) { // 10% variance tolerance
        requiresManualReview = true;
        processingNotes.push(`Income variance detected: ${(maxVariance * 100).toFixed(1)}%`);
        
        // Record consistency check
        await this.supabase
          .from('consistency_checks')
          .insert({
            application_id: applicationId,
            check_type: 'income_consistency',
            source_document_ids: [payslipDoc.id, bankDoc.id],
            discrepancy_found: true,
            discrepancy_severity: maxVariance > 0.2 ? 'major' : 'moderate',
            details: {
              declared_salary: declaredSalary,
              payslip_salary: payslipSalary,
              bank_salary: bankSalary,
              variance_percentage: maxVariance * 100
            },
            resolution_required: true
          });
      } else {
        processingNotes.push('Income consistency check passed');
      }
    }

    return {
      success: true,
      current_stage: 'consistency_check',
      requires_human_intervention: requiresManualReview,
      processing_notes,
      errors: []
    };
  }

  /**
   * Process assessment stages (affordability, credit, final)
   */
  private async processAssessmentStage(applicationId: string): Promise<WorkflowResult> {
    const processingNotes: string[] = [];

    try {
      // Run the full AI assessment
      const assessmentResult = await assessmentEngine.assessApplication(applicationId);
      
      processingNotes.push(`Assessment completed with score: ${assessmentResult.overall_score}`);
      processingNotes.push(`Qualification status: ${assessmentResult.qualification_status}`);
      
      const requiresHumanIntervention = 
        assessmentResult.qualification_status === 'pending_review' ||
        assessmentResult.confidence_level < 80;

      // Generate and send feedback if rejected
      if (assessmentResult.qualification_status === 'rejected') {
        await feedbackGenerator.generateAndSendFeedback(applicationId, assessmentResult);
        processingNotes.push('Rejection feedback sent to applicant');
      }

      return {
        success: true,
        current_stage: 'final_assessment',
        requires_human_intervention: requiresHumanIntervention,
        processing_notes,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        current_stage: 'final_assessment',
        requires_human_intervention: true,
        processing_notes: ['Assessment failed - requires manual review'],
        errors: [error.message]
      };
    }
  }

  /**
   * Get workflow definition for tenant
   */
  private async getWorkflowDefinition(tenantId: string): Promise<WorkflowStage[]> {
    const { data: workflow } = await this.supabase
      .from('workflow_definitions')
      .select('stage_sequence')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (!workflow) {
      throw new Error('No workflow definition found for tenant');
    }

    return workflow.stage_sequence as WorkflowStage[];
  }

  /**
   * Record workflow stage start
   */
  private async recordStageStart(applicationId: string, stage: WorkflowStage): Promise<void> {
    await this.supabase
      .from('workflow_stages')
      .insert({
        application_id: applicationId,
        stage_code: stage.stage_code,
        stage_name: stage.stage_name,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        processed_by: stage.processor || 'ai'
      });
  }

  /**
   * Record workflow stage completion
   */
  private async recordStageCompletion(
    applicationId: string,
    stage: WorkflowStage,
    success: boolean
  ): Promise<void> {
    await this.supabase
      .from('workflow_stages')
      .update({
        status: success ? 'completed' : 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('application_id', applicationId)
      .eq('stage_code', stage.stage_code)
      .eq('status', 'in_progress');
  }

  /**
   * Advance application to next workflow stage
   */
  private async advanceToNextStage(applicationId: string, nextStage: string): Promise<void> {
    await this.supabase
      .from('applications')
      .update({
        current_workflow_stage: nextStage,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId);
  }

  /**
   * Trigger automated processing for applications that need it
   */
  async processQueuedApplications(): Promise<void> {
    console.log('Processing queued applications...');

    // Get applications that need processing
    const { data: applications } = await this.supabase
      .from('applications')
      .select('id, current_workflow_stage, ai_processing_enabled')
      .eq('ai_processing_enabled', true)
      .eq('automated_assessment_completed', false)
      .in('current_workflow_stage', [
        'document_upload', 
        'document_verification', 
        'consistency_check', 
        'affordability_assessment',
        'final_assessment'
      ])
      .limit(10); // Process in batches

    if (!applications || applications.length === 0) {
      console.log('No applications to process');
      return;
    }

    console.log(`Processing ${applications.length} applications`);

    // Process each application
    for (const application of applications) {
      try {
        console.log(`Processing application ${application.id}`);
        await this.processApplication(application.id);
        
        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to process application ${application.id}:`, error);
        
        // Mark application as needing human review
        await this.supabase
          .from('applications')
          .update({
            requires_human_review: true,
            human_review_reason: `Automated processing failed: ${error.message}`,
            next_action_required: 'Manual review required due to processing error'
          })
          .eq('id', application.id);
      }
    }

    console.log('Batch processing completed');
  }
}

// Export singleton instance
export const workflowOrchestrator = new WorkflowOrchestrator();