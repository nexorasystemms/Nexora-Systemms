'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  Briefcase, 
  FileText, 
  Calculator,
  MessageSquare,
  Clock,
  DollarSign,
  Download
} from 'lucide-react';

interface ApplicationDetail {
  id: string;
  reference: string;
  amount_requested: number;
  term_months: number;
  purpose: string;
  status: string;
  ai_assessment_score: number;
  ai_confidence_level: number;
  ai_qualification_status: string;
  assessment_completed_at: string;
  applicant: {
    full_name: string;
    mobile: string;
    email: string;
    dependants_count: number;
    marital_status: string;
  };
  employment: {
    employer_name: string;
    occupation: string;
    monthly_net_salary: number;
    employment_start_date: string;
  };
  documents: Array<{
    id: string;
    doc_type: string;
    ai_verification_status: string;
    ai_extraction_confidence: number;
    quality_score: number;
    extracted_data_json: any;
  }>;
  ai_assessments: Array<{
    overall_score: number;
    confidence_level: number;
    processing_time_ms: number;
    assessment_scores: Array<{
      criteria_id: string;
      raw_score: number;
      passed: boolean;
      qualification_criteria: {
        criteria_name: string;
        criteria_code: string;
      };
    }>;
  }>;
  application_feedback?: Array<{
    primary_reason: string;
    detailed_explanation: string;
    improvement_suggestions: any[];
  }>;
}

interface Props {
  applicationId: string;
  isOpen: boolean;
  onClose: () => void;
  onDecision: () => void;
}

export default function ApplicationDetailModal({ applicationId, isOpen, onClose, onDecision }: Props) {
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const supabase = createClient();

  useEffect(() => {
    if (isOpen && applicationId) {
      loadApplicationDetail();
    }
  }, [isOpen, applicationId]);

  const loadApplicationDetail = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          applicant:applicants (*),
          employment:employment (*),
          documents (*),
          ai_assessments (
            *,
            assessment_scores (
              *,
              qualification_criteria (*)
            )
          ),
          application_feedback (*)
        `)
        .eq('id', applicationId)
        .single();

      if (error) throw error;
      
      setApplication(data);
    } catch (error) {
      console.error('Failed to load application detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!application) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) throw error;

      // Log the decision
      await supabase.from('decisions').insert({
        application_id: applicationId,
        outcome: 'approved',
        approved_amount: application.amount_requested,
        approved_term: application.term_months,
        decided_by: (await supabase.auth.getUser()).data.user?.id,
        decided_at: new Date().toISOString(),
        reason_codes: ['ai_qualified'],
        memo: decisionReason || 'Approved based on AI assessment and human review'
      });

      onDecision();
      onClose();
    } catch (error) {
      console.error('Failed to approve application:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!application) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) throw error;

      // Log the decision
      await supabase.from('decisions').insert({
        application_id: applicationId,
        outcome: 'rejected',
        decided_by: (await supabase.auth.getUser()).data.user?.id,
        decided_at: new Date().toISOString(),
        reason_codes: ['human_review_rejection'],
        memo: decisionReason || 'Rejected after human review'
      });

      onDecision();
      onClose();
    } catch (error) {
      console.error('Failed to reject application:', error);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => `N$${amount?.toLocaleString() || 0}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-NA');
  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString('en-NA');

  const getVerificationIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'suspicious':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getScoreBadge = (score: number) => {
    const color = score >= 85 ? 'bg-green-100 text-green-800' :
                  score >= 70 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800';
    return <Badge className={color}>{score}</Badge>;
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Application Details...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-32 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!application) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Application Not Found</DialogTitle>
          </DialogHeader>
          <p>Could not load application details.</p>
        </DialogContent>
      </Dialog>
    );
  }

  const latestAssessment = application.ai_assessments?.[0];
  const feedback = application.application_feedback?.[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Application Review: {application.applicant?.full_name}
          </DialogTitle>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>{application.reference}</span>
            <Badge className={
              application.ai_qualification_status === 'qualified' ? 'bg-green-100 text-green-800' :
              application.ai_qualification_status === 'pending_review' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }>
              {application.ai_qualification_status?.replace('_', ' ')}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assessment">AI Assessment</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="decision">Decision</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Applicant Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Applicant Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Name:</span>
                    <span className="font-medium">{application.applicant?.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Mobile:</span>
                    <span>{application.applicant?.mobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span>{application.applicant?.email || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Marital Status:</span>
                    <span>{application.applicant?.marital_status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Dependants:</span>
                    <span>{application.applicant?.dependants_count}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Employment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Briefcase className="h-5 w-5 mr-2" />
                    Employment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Employer:</span>
                    <span className="font-medium">{application.employment?.[0]?.employer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Occupation:</span>
                    <span>{application.employment?.[0]?.occupation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Monthly Salary:</span>
                    <span className="font-medium">
                      {formatCurrency(application.employment?.[0]?.monthly_net_salary)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Start Date:</span>
                    <span>{formatDate(application.employment?.[0]?.employment_start_date)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Loan Request */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Loan Request
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Amount:</span>
                    <span className="font-medium text-lg">
                      {formatCurrency(application.amount_requested)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Term:</span>
                    <span>{application.term_months} month(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Purpose:</span>
                    <span>{application.purpose}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Applied:</span>
                    <span>{formatDate(application.created_at)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* AI Assessment Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calculator className="h-5 w-5 mr-2" />
                    AI Assessment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Overall Score:</span>
                    {getScoreBadge(application.ai_assessment_score)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Confidence:</span>
                    <Badge className="bg-blue-100 text-blue-800">
                      {application.ai_confidence_level}%
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className="font-medium capitalize">
                      {application.ai_qualification_status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Assessed:</span>
                    <span>{formatDateTime(application.assessment_completed_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="assessment" className="space-y-4">
            {latestAssessment ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Assessment Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{latestAssessment.overall_score}</div>
                        <div className="text-sm text-gray-600">Overall Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{latestAssessment.confidence_level}%</div>
                        <div className="text-sm text-gray-600">Confidence</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{Math.round(latestAssessment.processing_time_ms / 1000)}s</div>
                        <div className="text-sm text-gray-600">Processing Time</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Criteria Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {latestAssessment.assessment_scores?.map((score, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center space-x-3">
                            {score.passed ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <div className="font-medium">
                                {score.qualification_criteria?.criteria_name}
                              </div>
                              <div className="text-sm text-gray-600">
                                {score.qualification_criteria?.criteria_code}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{score.raw_score}</div>
                            <div className="text-sm text-gray-600">
                              {score.passed ? 'Passed' : 'Failed'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No AI assessment data available
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {application.documents?.map((doc) => (
                <Card key={doc.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="capitalize">{doc.doc_type.replace('_', ' ')}</span>
                      {getVerificationIcon(doc.ai_verification_status)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Confidence:</span>
                      <span className="text-xs font-medium">
                        {doc.ai_extraction_confidence}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Quality:</span>
                      <span className="text-xs font-medium">
                        {doc.quality_score}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Status:</span>
                      <Badge variant="secondary" className="text-xs">
                        {doc.ai_verification_status}
                      </Badge>
                    </div>
                    {doc.extracted_data_json && (
                      <div className="mt-2">
                        <Button variant="outline" size="sm" className="w-full">
                          <FileText className="h-3 w-3 mr-1" />
                          View Data
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4">
            {feedback ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    AI-Generated Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Primary Reason:</h4>
                    <p className="text-sm text-gray-700">{feedback.primary_reason}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Detailed Explanation:</h4>
                    <p className="text-sm text-gray-700">{feedback.detailed_explanation}</p>
                  </div>

                  {feedback.improvement_suggestions?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Improvement Suggestions:</h4>
                      <ul className="space-y-2">
                        {feedback.improvement_suggestions.map((suggestion: any, index: number) => (
                          <li key={index} className="text-sm text-gray-700">
                            <strong>{suggestion.category}:</strong> {suggestion.suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No feedback generated for this application
              </div>
            )}
          </TabsContent>

          <TabsContent value="decision" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Make Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Decision Reason (Optional)
                  </label>
                  <Textarea
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder="Enter any additional notes about this decision..."
                    rows={4}
                  />
                </div>

                <div className="flex items-center space-x-3">
                  <Button
                    onClick={handleApprove}
                    disabled={processing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {processing ? 'Processing...' : 'Approve'}
                  </Button>
                  
                  <Button
                    onClick={handleReject}
                    disabled={processing}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {processing ? 'Processing...' : 'Reject'}
                  </Button>
                </div>

                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <strong>Note:</strong> This decision will be logged and the applicant will be notified.
                  If approved, the application will proceed to agreement generation and disbursement workflow.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}