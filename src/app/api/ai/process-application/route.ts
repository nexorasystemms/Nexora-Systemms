/**
 * API endpoint to trigger automated loan application processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowOrchestrator } from '@/lib/ai/workflow-orchestrator';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { applicationId, forceReprocess = false } = await request.json();

    if (!applicationId) {
      return NextResponse.json(
        { error: 'Application ID is required' },
        { status: 400 }
      );
    }

    // Verify application exists and check if processing is needed
    const supabase = createAdminClient();
    const { data: application, error } = await supabase
      .from('applications')
      .select('id, ai_processing_enabled, automated_assessment_completed, current_workflow_stage')
      .eq('id', applicationId)
      .single();

    if (error || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    if (!application.ai_processing_enabled) {
      return NextResponse.json(
        { error: 'AI processing is not enabled for this application' },
        { status: 400 }
      );
    }

    if (application.automated_assessment_completed && !forceReprocess) {
      return NextResponse.json(
        { 
          message: 'Application already processed',
          current_stage: application.current_workflow_stage,
          processed: true
        },
        { status: 200 }
      );
    }

    // Start processing
    console.log(`Starting AI processing for application ${applicationId}`);
    
    const result = await workflowOrchestrator.processApplication(applicationId);

    return NextResponse.json({
      success: result.success,
      application_id: applicationId,
      current_stage: result.current_stage,
      next_stage: result.next_stage,
      requires_human_intervention: result.requires_human_intervention,
      processing_notes: result.processing_notes,
      errors: result.errors,
      processed: true
    });

  } catch (error) {
    console.error('API processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        processed: false
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const applicationId = url.searchParams.get('applicationId');

    if (!applicationId) {
      return NextResponse.json(
        { error: 'Application ID is required' },
        { status: 400 }
      );
    }

    // Get processing status
    const supabase = createAdminClient();
    const { data: application, error } = await supabase
      .from('applications')
      .select(`
        id,
        current_workflow_stage,
        ai_qualification_status,
        ai_assessment_score,
        ai_confidence_level,
        automated_assessment_completed,
        requires_human_review,
        next_action_required,
        assessment_started_at,
        assessment_completed_at
      `)
      .eq('id', applicationId)
      .single();

    if (error || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    // Get latest workflow stages
    const { data: workflowStages } = await supabase
      .from('workflow_stages')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get latest assessment if available
    const { data: latestAssessment } = await supabase
      .from('ai_assessments')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      application_id: applicationId,
      current_stage: application.current_workflow_stage,
      qualification_status: application.ai_qualification_status,
      assessment_score: application.ai_assessment_score,
      confidence_level: application.ai_confidence_level,
      completed: application.automated_assessment_completed,
      requires_human_review: application.requires_human_review,
      next_action_required: application.next_action_required,
      assessment_started_at: application.assessment_started_at,
      assessment_completed_at: application.assessment_completed_at,
      recent_workflow_stages: workflowStages || [],
      latest_assessment: latestAssessment
    });

  } catch (error) {
    console.error('API status error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}