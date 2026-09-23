/**
 * AI Review Dashboard - Admin interface for reviewing AI-qualified loan applications
 */

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/current-staff';
import AIReviewDashboard from './AIReviewDashboard';

export const metadata = {
  title: 'AI Review Dashboard - Nexora Systems',
  description: 'Review AI-qualified loan applications'
};

export default async function AIReviewPage() {
  await requireRole(['approver', 'admin', 'super_admin']);
  
  return (
    <div className="space-y-6">
      <div className="border-b border-brand-border pb-4">
        <h1 className="text-2xl font-semibold text-brand-navy">AI Review Dashboard</h1>
        <p className="text-brand-muted mt-1">
          Review and approve applications processed by our AI assessment system
        </p>
      </div>

      <Suspense fallback={<AIReviewDashboardSkeleton />}>
        <AIReviewDashboard />
      </Suspense>
    </div>
  );
}

function AIReviewDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-brand-surface rounded-lg p-4 border border-brand-border">
            <div className="animate-pulse">
              <div className="h-4 bg-brand-border rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-brand-border rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="border-b border-brand-border">
        <div className="flex space-x-8">
          {['Qualified', 'Pending Review', 'Processing Issues', 'Recent Decisions'].map((tab) => (
            <div key={tab} className="animate-pulse">
              <div className="h-4 bg-brand-border rounded w-20 mb-3"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-brand-surface rounded-lg border border-brand-border">
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 bg-brand-border rounded w-1/4"></div>
                <div className="h-4 bg-brand-border rounded w-1/6"></div>
                <div className="h-4 bg-brand-border rounded w-1/6"></div>
                <div className="h-4 bg-brand-border rounded w-1/4"></div>
                <div className="h-4 bg-brand-border rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}