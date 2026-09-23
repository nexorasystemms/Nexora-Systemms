'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Users, 
  Eye,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Filter
} from 'lucide-react';
import ApplicationDetailModal from './ApplicationDetailModal';

interface QualifiedApplication {
  id: string;
  reference: string;
  applicant_name: string;
  amount_requested: number;
  ai_assessment_score: number;
  ai_confidence_level: number;
  assessment_completed_at: string;
  created_at: string;
  total_documents: number;
  verified_documents: number;
  processing_time_ms: number;
  risk_factors?: string[];
}

interface ReviewStats {
  qualified_pending: number;
  pending_manual_review: number;
  processing_issues: number;
  processed_today: number;
  avg_processing_time: number;
  success_rate: number;
}

export default function AIReviewDashboard() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [qualifiedApps, setQualifiedApps] = useState<QualifiedApplication[]>([]);
  const [pendingReviewApps, setPendingReviewApps] = useState<QualifiedApplication[]>([]);
  const [processingIssues, setProcessingIssues] = useState<any[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('qualified');

  const supabase = createClient();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStats(),
        loadQualifiedApplications(),
        loadPendingReviewApplications(),
        loadProcessingIssues(),
        loadRecentDecisions()
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const { data, error } = await supabase.rpc('get_ai_review_stats');
    if (error) {
      console.error('Failed to load stats:', error);
      return;
    }

    setStats(data || {
      qualified_pending: 0,
      pending_manual_review: 0,
      processing_issues: 0,
      processed_today: 0,
      avg_processing_time: 0,
      success_rate: 0
    });
  };

  const loadQualifiedApplications = async () => {
    const { data, error } = await supabase
      .from('qualified_applications')
      .select('*')
      .order('ai_assessment_score', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to load qualified applications:', error);
      return;
    }

    setQualifiedApps(data || []);
  };

  const loadPendingReviewApplications = async () => {
    const { data, error } = await supabase
      .from('applications_requiring_review')
      .select('*')
      .order('priority_score', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to load pending review applications:', error);
      return;
    }

    setPendingReviewApps(data || []);
  };

  const loadProcessingIssues = async () => {
    const { data, error } = await supabase
      .from('applications_with_issues')
      .select('*')
      .order('hours_since_started', { ascending: false })
      .limit(15);

    if (error) {
      console.error('Failed to load processing issues:', error);
      return;
    }

    setProcessingIssues(data || []);
  };

  const loadRecentDecisions = async () => {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        id,
        reference,
        applicant:applicants(full_name),
        amount_requested,
        status,
        ai_qualification_status,
        ai_assessment_score,
        updated_at
      `)
      .in('status', ['approved', 'rejected'])
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Failed to load recent decisions:', error);
      return;
    }

    setRecentDecisions(data || []);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `N$${amount.toLocaleString()}`;
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-blue-100 text-blue-800';
    if (confidence >= 75) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified Applications</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.qualified_pending || 0}</div>
            <p className="text-xs text-brand-muted">Ready for final approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending_manual_review || 0}</div>
            <p className="text-xs text-brand-muted">Need human assessment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processing_issues || 0}</div>
            <p className="text-xs text-brand-muted">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.success_rate?.toFixed(1)}%</div>
            <p className="text-xs text-brand-muted">AI qualification rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="qualified">
            Qualified ({qualifiedApps.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending Review ({pendingReviewApps.length})
          </TabsTrigger>
          <TabsTrigger value="issues">
            Processing Issues ({processingIssues.length})
          </TabsTrigger>
          <TabsTrigger value="recent">
            Recent Decisions ({recentDecisions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qualified" className="space-y-4">
          <div className="bg-brand-surface rounded-lg border border-brand-border">
            <div className="p-4 border-b border-brand-border">
              <h3 className="text-lg font-medium">AI-Qualified Applications</h3>
              <p className="text-sm text-brand-muted">
                Applications that passed AI assessment and are ready for final human approval
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-brand-surface border-b border-brand-border">
                  <tr className="text-left">
                    <th className="p-3 text-sm font-medium">Applicant</th>
                    <th className="p-3 text-sm font-medium">Amount</th>
                    <th className="p-3 text-sm font-medium">AI Score</th>
                    <th className="p-3 text-sm font-medium">Confidence</th>
                    <th className="p-3 text-sm font-medium">Documents</th>
                    <th className="p-3 text-sm font-medium">Assessed</th>
                    <th className="p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {qualifiedApps.map((app) => (
                    <tr key={app.id} className="hover:bg-brand-surface/50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{app.applicant_name}</div>
                          <div className="text-sm text-brand-muted">{app.reference}</div>
                        </div>
                      </td>
                      <td className="p-3 font-medium">
                        {formatCurrency(app.amount_requested)}
                      </td>
                      <td className="p-3">
                        <Badge className={getScoreBadgeColor(app.ai_assessment_score)}>
                          {app.ai_assessment_score}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={getConfidenceBadgeColor(app.ai_confidence_level)}>
                          {app.ai_confidence_level}%
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">
                          {app.verified_documents}/{app.total_documents} verified
                        </span>
                      </td>
                      <td className="p-3 text-sm text-brand-muted">
                        {formatDateTime(app.assessment_completed_at)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedApp(app.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {qualifiedApps.length === 0 && (
                <div className="p-8 text-center text-brand-muted">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No qualified applications</h3>
                  <p>Applications that pass AI assessment will appear here for final review.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="bg-brand-surface rounded-lg border border-brand-border">
            <div className="p-4 border-b border-brand-border">
              <h3 className="text-lg font-medium">Applications Requiring Manual Review</h3>
              <p className="text-sm text-brand-muted">
                Applications that need human assessment due to AI uncertainty or specific flags
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-brand-surface border-b border-brand-border">
                  <tr className="text-left">
                    <th className="p-3 text-sm font-medium">Applicant</th>
                    <th className="p-3 text-sm font-medium">Amount</th>
                    <th className="p-3 text-sm font-medium">Priority</th>
                    <th className="p-3 text-sm font-medium">Review Reason</th>
                    <th className="p-3 text-sm font-medium">Waiting</th>
                    <th className="p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {pendingReviewApps.map((app) => (
                    <tr key={app.id} className="hover:bg-brand-surface/50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{app.applicant_name}</div>
                          <div className="text-sm text-brand-muted">{app.reference}</div>
                        </div>
                      </td>
                      <td className="p-3 font-medium">
                        {formatCurrency(app.amount_requested)}
                      </td>
                      <td className="p-3">
                        <Badge className={
                          app.priority_score >= 80 ? 'bg-red-100 text-red-800' :
                          app.priority_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {app.priority_score}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm">
                        {app.human_review_reason || 'AI confidence below threshold'}
                      </td>
                      <td className="p-3 text-sm text-brand-muted">
                        {Math.round(app.hours_waiting)}h
                      </td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedApp(app.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pendingReviewApps.length === 0 && (
                <div className="p-8 text-center text-brand-muted">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No applications pending review</h3>
                  <p>Applications requiring manual assessment will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <div className="bg-brand-surface rounded-lg border border-brand-border">
            <div className="p-4 border-b border-brand-border">
              <h3 className="text-lg font-medium">Processing Issues</h3>
              <p className="text-sm text-brand-muted">
                Applications with processing problems that need attention
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-brand-surface border-b border-brand-border">
                  <tr className="text-left">
                    <th className="p-3 text-sm font-medium">Applicant</th>
                    <th className="p-3 text-sm font-medium">Stage</th>
                    <th className="p-3 text-sm font-medium">Issue Type</th>
                    <th className="p-3 text-sm font-medium">Duration</th>
                    <th className="p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {processingIssues.map((app) => (
                    <tr key={app.id} className="hover:bg-brand-surface/50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{app.full_name}</div>
                          <div className="text-sm text-brand-muted">{app.reference}</div>
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        {app.current_workflow_stage?.replace('_', ' ')}
                      </td>
                      <td className="p-3">
                        <Badge variant="destructive">
                          {app.issue_type?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-brand-muted">
                        {Math.round(app.hours_since_started)}h
                      </td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedApp(app.id)}
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Investigate
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {processingIssues.length === 0 && (
                <div className="p-8 text-center text-brand-muted">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No processing issues</h3>
                  <p>All applications are processing smoothly.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <div className="bg-brand-surface rounded-lg border border-brand-border">
            <div className="p-4 border-b border-brand-border">
              <h3 className="text-lg font-medium">Recent Decisions</h3>
              <p className="text-sm text-brand-muted">
                Recently approved or rejected applications
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-brand-surface border-b border-brand-border">
                  <tr className="text-left">
                    <th className="p-3 text-sm font-medium">Applicant</th>
                    <th className="p-3 text-sm font-medium">Amount</th>
                    <th className="p-3 text-sm font-medium">AI Score</th>
                    <th className="p-3 text-sm font-medium">Decision</th>
                    <th className="p-3 text-sm font-medium">Decided</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {recentDecisions.map((app) => (
                    <tr key={app.id} className="hover:bg-brand-surface/50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{app.applicant?.full_name}</div>
                          <div className="text-sm text-brand-muted">{app.reference}</div>
                        </div>
                      </td>
                      <td className="p-3 font-medium">
                        {formatCurrency(app.amount_requested)}
                      </td>
                      <td className="p-3">
                        {app.ai_assessment_score ? (
                          <Badge className={getScoreBadgeColor(app.ai_assessment_score)}>
                            {app.ai_assessment_score}
                          </Badge>
                        ) : (
                          <span className="text-sm text-brand-muted">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          {app.status === 'approved' ? (
                            <><ThumbsUp className="h-4 w-4 text-green-600" />
                            <Badge className="bg-green-100 text-green-800">Approved</Badge></>
                          ) : (
                            <><ThumbsDown className="h-4 w-4 text-red-600" />
                            <Badge className="bg-red-100 text-red-800">Rejected</Badge></>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-brand-muted">
                        {formatDateTime(app.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {recentDecisions.length === 0 && (
                <div className="p-8 text-center text-brand-muted">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No recent decisions</h3>
                  <p>Recent approval and rejection decisions will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Application Detail Modal */}
      {selectedApp && (
        <ApplicationDetailModal
          applicationId={selectedApp}
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          onDecision={loadDashboardData}
        />
      )}
    </div>
  );
}