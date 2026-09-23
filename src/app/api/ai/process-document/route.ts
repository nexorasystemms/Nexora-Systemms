/**
 * API endpoint to trigger document processing for uploaded files
 */

import { NextRequest, NextResponse } from 'next/server';
import { documentProcessor } from '@/lib/ai/document-processor';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    console.log(`Processing document: ${documentId}`);

    // Process the document
    const result = await documentProcessor.processDocument(documentId);

    return NextResponse.json({
      success: result.success,
      document_id: documentId,
      verification_status: result.verification_status,
      confidence_score: result.confidence_score,
      quality_score: result.quality_score,
      extracted_data: result.extracted_data,
      processing_notes: result.processing_notes,
      flags: result.flags
    });

  } catch (error) {
    console.error('Document processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Document processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const documentId = url.searchParams.get('documentId');
    const applicationId = url.searchParams.get('applicationId');

    const supabase = createAdminClient();

    if (documentId) {
      // Get specific document processing status
      const { data: document, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_verifications (*)
        `)
        .eq('id', documentId)
        .single();

      if (error || !document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        document_id: documentId,
        doc_type: document.doc_type,
        processing_status: document.ai_processing_status,
        verification_status: document.ai_verification_status,
        confidence_score: document.ai_extraction_confidence,
        quality_score: document.quality_score,
        requires_manual_review: document.requires_manual_review,
        extracted_data: document.extracted_data_json,
        processing_attempts: document.processing_attempts,
        last_processing_attempt: document.last_processing_attempt_at,
        verifications: document.document_verifications
      });

    } else if (applicationId) {
      // Get all documents for application
      const { data: documents, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_verifications (*)
        `)
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch documents' },
          { status: 500 }
        );
      }

      const documentSummary = documents?.map(doc => ({
        id: doc.id,
        doc_type: doc.doc_type,
        processing_status: doc.ai_processing_status,
        verification_status: doc.ai_verification_status,
        confidence_score: doc.ai_extraction_confidence,
        quality_score: doc.quality_score,
        requires_manual_review: doc.requires_manual_review,
        uploaded_at: doc.created_at,
        processing_attempts: doc.processing_attempts
      })) || [];

      return NextResponse.json({
        application_id: applicationId,
        documents: documentSummary,
        total_documents: documents?.length || 0,
        processed_documents: documents?.filter(d => d.ai_processing_status === 'completed').length || 0,
        pending_documents: documents?.filter(d => d.ai_processing_status === 'pending').length || 0,
        failed_documents: documents?.filter(d => d.ai_processing_status === 'failed').length || 0,
        needs_manual_review: documents?.filter(d => d.requires_manual_review).length || 0
      });

    } else {
      return NextResponse.json(
        { error: 'Either documentId or applicationId is required' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Document status error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get document status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}