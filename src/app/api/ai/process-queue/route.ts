/**
 * Background job processor for automated loan application assessments
 * Processes applications that are ready for AI assessment
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowOrchestrator } from '@/lib/ai/workflow-orchestrator';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting queue processing...');
    
    // Verify this is an internal request or has proper authorization
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.INTERNAL_API_TOKEN;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process queued applications
    await workflowOrchestrator.processQueuedApplications();

    return NextResponse.json({
      success: true,
      message: 'Queue processing completed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Queue processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Queue processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Return queue status for monitoring
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    // Get applications in various states
    const { data: queuedApps } = await supabase
      .from('applications')
      .select('id, current_workflow_stage, ai_qualification_status, assessment_started_at')
      .eq('ai_processing_enabled', true)
      .eq('automated_assessment_completed', false);

    const { data: processingApps } = await supabase
      .from('applications')
      .select('id, current_workflow_stage, assessment_started_at')
      .eq('ai_processing_enabled', true)
      .eq('automated_assessment_completed', false)
      .not('assessment_started_at', 'is', null);

    const { data: reviewQueue } = await supabase
      .from('applications_requiring_review')
      .select('*');

    const { data: qualifiedApps } = await supabase
      .from('qualified_applications')
      .select('*');

    // Get processing statistics for last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: recentlyProcessed } = await supabase
      .from('applications')
      .select('id, ai_qualification_status, assessment_completed_at')
      .eq('automated_assessment_completed', true)
      .gte('assessment_completed_at', yesterday.toISOString());

    // Calculate statistics
    const stats = {
      total_queued: queuedApps?.length || 0,
      currently_processing: processingApps?.length || 0,
      awaiting_human_review: reviewQueue?.length || 0,
      qualified_pending_approval: qualifiedApps?.length || 0,
      processed_last_24h: recentlyProcessed?.length || 0,
      qualified_last_24h: recentlyProcessed?.filter(app => app.ai_qualification_status === 'qualified').length || 0,
      rejected_last_24h: recentlyProcessed?.filter(app => app.ai_qualification_status === 'rejected').length || 0
    };

    return NextResponse.json({
      queue_status: 'active',
      timestamp: new Date().toISOString(),
      statistics: stats,
      queued_applications: queuedApps?.slice(0, 10), // Show first 10 for monitoring
      processing_applications: processingApps?.slice(0, 5)
    });

  } catch (error) {
    console.error('Queue status error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get queue status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}