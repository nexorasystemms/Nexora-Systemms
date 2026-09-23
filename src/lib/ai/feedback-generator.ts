/**
 * Automated Feedback and Rejection Reason System
 * Generates detailed, personalized feedback for loan applicants with improvement suggestions
 */

import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from '@anthropic-ai/sdk';
import { AssessmentResult, CriteriaScore } from "./assessment-engine";

export interface FeedbackOptions {
  language?: 'en' | 'af' | 'oshiwambo';
  include_alternative_amounts?: boolean;
  include_improvement_timeline?: boolean;
  tone?: 'formal' | 'friendly' | 'supportive';
}

export interface GeneratedFeedback {
  primary_reason: string;
  detailed_explanation: string;
  improvement_suggestions: ImprovementSuggestion[];
  alternative_options: AlternativeOption[];
  estimated_approval_probability?: number;
  improvement_timeline?: string;
  next_steps: string[];
}

export interface ImprovementSuggestion {
  category: string;
  suggestion: string;
  details: string;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  specific_actions: string[];
}

export interface AlternativeOption {
  option_type: 'smaller_amount' | 'longer_term' | 'guarantor' | 'different_product';
  description: string;
  details: string;
  requirements?: string[];
  estimated_approval_chance?: number;
}

export interface ApplicantContext {
  full_name: string;
  amount_requested: number;
  term_months: number;
  monthly_income: number;
  dependants_count: number;
  employment_months?: number;
  marital_status: string;
}

export class FeedbackGenerator {
  private supabase = createAdminClient();
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  /**
   * Generate and send comprehensive feedback for a rejected application
   */
  async generateAndSendFeedback(
    applicationId: string,
    assessmentResult: AssessmentResult,
    options: FeedbackOptions = {}
  ): Promise<void> {
    try {
      // Load application context
      const context = await this.loadApplicantContext(applicationId);
      
      // Generate personalized feedback
      const feedback = await this.generatePersonalizedFeedback(
        context,
        assessmentResult,
        options
      );

      // Save feedback to database
      await this.saveFeedback(applicationId, feedback, options.language || 'en');

      // Send feedback to applicant
      await this.sendFeedbackToApplicant(applicationId, feedback, context);

      console.log(`Feedback generated and sent for application ${applicationId}`);

    } catch (error) {
      console.error('Failed to generate feedback:', error);
      throw new Error(`Feedback generation failed: ${error.message}`);
    }
  }

  /**
   * Generate personalized feedback based on assessment results
   */
  private async generatePersonalizedFeedback(
    context: ApplicantContext,
    assessmentResult: AssessmentResult,
    options: FeedbackOptions
  ): Promise<GeneratedFeedback> {

    // Identify the main rejection reasons
    const failedCriteria = assessmentResult.criteria_scores.filter(score => !score.passed);
    const primaryFailure = this.identifyPrimaryFailureReason(failedCriteria, assessmentResult.overall_score);

    // Generate detailed explanation using AI
    const detailedExplanation = await this.generateDetailedExplanation(
      context,
      assessmentResult,
      primaryFailure,
      options
    );

    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestions(
      failedCriteria,
      context,
      assessmentResult
    );

    // Generate alternative options
    const alternativeOptions = await this.generateAlternativeOptions(
      context,
      assessmentResult,
      failedCriteria
    );

    // Calculate improvement probability
    const estimatedApprovalProbability = this.calculateImprovementProbability(
      assessmentResult,
      improvementSuggestions
    );

    // Generate next steps
    const nextSteps = this.generateNextSteps(improvementSuggestions, alternativeOptions);

    return {
      primary_reason: primaryFailure.reason,
      detailed_explanation: detailedExplanation,
      improvement_suggestions: improvementSuggestions,
      alternative_options: alternativeOptions,
      estimated_approval_probability: estimatedApprovalProbability,
      improvement_timeline: this.generateImprovementTimeline(improvementSuggestions),
      next_steps: nextSteps
    };
  }

  /**
   * Generate detailed, AI-powered explanation
   */
  private async generateDetailedExplanation(
    context: ApplicantContext,
    assessmentResult: AssessmentResult,
    primaryFailure: { reason: string; criteria: CriteriaScore[] },
    options: FeedbackOptions
  ): Promise<string> {

    const tone = options.tone || 'supportive';
    const language = options.language || 'en';

    const prompt = `
    Write a detailed, ${tone} loan application rejection explanation for ${context.full_name}.

    Application Details:
    - Name: ${context.full_name}
    - Requested Amount: N$${context.amount_requested.toLocaleString()}
    - Term: ${context.term_months} month(s)
    - Monthly Income: N$${context.monthly_income.toLocaleString()}
    - Dependants: ${context.dependants_count}
    - Overall Assessment Score: ${assessmentResult.overall_score}/100

    Primary Rejection Reason: ${primaryFailure.reason}

    Failed Assessment Criteria:
    ${primaryFailure.criteria.map(criteria => 
      `- ${criteria.criteria_code}: Score ${criteria.raw_score}/${criteria.criteria_id} (Required: minimum passing score)`
    ).join('\n')}

    Requirements:
    1. Be ${tone} and understanding
    2. Explain in clear, simple language
    3. Focus on the main reasons without being overly technical
    4. Acknowledge their application effort
    5. Be encouraging about future possibilities
    6. Use ${language === 'en' ? 'English' : language === 'af' ? 'Afrikaans' : 'Oshiwambo-influenced English'}
    7. Keep it concise but comprehensive
    8. Avoid legal jargon

    Write a 2-3 paragraph explanation that helps them understand why their application was not approved.
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-sonnet-20241022",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: prompt
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';

    } catch (error) {
      console.error('AI explanation generation failed:', error);
      // Fallback to template-based explanation
      return this.generateTemplateBasedExplanation(context, primaryFailure);
    }
  }

  /**
   * Identify the primary failure reason from assessment results
   */
  private identifyPrimaryFailureReason(
    failedCriteria: CriteriaScore[],
    overallScore: number
  ): { reason: string; criteria: CriteriaScore[] } {

    if (failedCriteria.length === 0) {
      return {
        reason: 'Overall assessment score below qualification threshold',
        criteria: []
      };
    }

    // Group failures by category
    const failureGroups = new Map<string, CriteriaScore[]>();
    
    failedCriteria.forEach(criteria => {
      const category = this.categorizeCriteria(criteria.criteria_code);
      if (!failureGroups.has(category)) {
        failureGroups.set(category, []);
      }
      failureGroups.get(category)!.push(criteria);
    });

    // Identify primary failure (most critical or impactful)
    let primaryCategory = '';
    let maxImpact = 0;

    for (const [category, criteria] of failureGroups.entries()) {
      const impact = this.calculateCategoryImpact(category, criteria);
      if (impact > maxImpact) {
        maxImpact = impact;
        primaryCategory = category;
      }
    }

    const primaryCriteria = failureGroups.get(primaryCategory) || [];
    const reason = this.getCategoryReason(primaryCategory);

    return { reason, criteria: primaryCriteria };
  }

  /**
   * Generate improvement suggestions based on failed criteria
   */
  private generateImprovementSuggestions(
    failedCriteria: CriteriaScore[],
    context: ApplicantContext,
    assessmentResult: AssessmentResult
  ): ImprovementSuggestion[] {

    const suggestions: ImprovementSuggestion[] = [];

    failedCriteria.forEach(criteria => {
      const suggestion = this.generateCriteriaSpecificSuggestion(criteria, context);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    });

    // Add general suggestions based on overall profile
    if (assessmentResult.overall_score < 50) {
      suggestions.push({
        category: 'General Financial Health',
        suggestion: 'Focus on improving overall financial stability',
        details: 'Consider working on multiple areas simultaneously for better results',
        impact: 'high',
        timeframe: '6-12 months',
        specific_actions: [
          'Create a detailed monthly budget',
          'Build an emergency fund',
          'Reduce unnecessary expenses',
          'Consider additional income sources'
        ]
      });
    }

    return suggestions.sort((a, b) => this.getImpactScore(b.impact) - this.getImpactScore(a.impact));
  }

  /**
   * Generate criteria-specific improvement suggestions
   */
  private generateCriteriaSpecificSuggestion(
    criteria: CriteriaScore,
    context: ApplicantContext
  ): ImprovementSuggestion | null {

    switch (criteria.criteria_code) {
      case 'affordability_assessment':
        if (criteria.calculation_details.debt_service_ratio_fail) {
          const dsr = criteria.calculation_details.debt_service_ratio_fail;
          return {
            category: 'Debt Management',
            suggestion: 'Reduce your debt-to-income ratio',
            details: `Your current debt service ratio is ${dsr.toFixed(1)}%, but we require it to be below 35%`,
            impact: 'high',
            timeframe: '3-6 months',
            specific_actions: [
              'Pay off high-interest debts first',
              'Consider debt consolidation',
              'Avoid taking on new credit obligations',
              `Reduce monthly debt payments by N$${Math.ceil((dsr - 35) * context.monthly_income / 100)}`
            ]
          };
        }

        if (criteria.calculation_details.insufficient_surplus) {
          const shortfall = Math.abs(criteria.calculation_details.insufficient_surplus);
          return {
            category: 'Income & Expenses',
            suggestion: 'Improve your surplus income',
            details: `You need an additional N$${Math.ceil(shortfall)} monthly surplus for this loan`,
            impact: 'high',
            timeframe: '2-4 months',
            specific_actions: [
              'Increase your monthly income through overtime or side work',
              'Reduce monthly expenses where possible',
              'Consider a smaller loan amount',
              'Extend the loan term to reduce monthly payments'
            ]
          };
        }
        break;

      case 'income_verification':
        return {
          category: 'Income Documentation',
          suggestion: 'Provide better income verification',
          details: 'Clear, consistent income documentation strengthens your application',
          impact: 'medium',
          timeframe: '1-2 weeks',
          specific_actions: [
            'Submit recent, clear payslip copies',
            'Provide 3-month bank statement showing salary deposits',
            'Ensure declared income matches documented income',
            'Get employer confirmation letter if payslips are unclear'
          ]
        };

      case 'employment_stability':
        const monthsNeeded = Math.max(0, 6 - (context.employment_months || 0));
        return {
          category: 'Employment Stability',
          suggestion: 'Build employment history',
          details: monthsNeeded > 0 
            ? `Continue with current employer for ${monthsNeeded} more months` 
            : 'Strengthen employment verification',
          impact: monthsNeeded > 3 ? 'high' : 'medium',
          timeframe: monthsNeeded > 0 ? `${monthsNeeded} months` : '1-2 weeks',
          specific_actions: [
            monthsNeeded > 0 ? 'Maintain stable employment' : 'Provide employer contact details',
            'Avoid changing jobs before reapplying',
            'Document any salary increases',
            'Consider career advancement opportunities'
          ]
        };

      case 'identity_verification':
        return {
          category: 'Documentation Quality',
          suggestion: 'Improve document quality',
          details: 'Clear, high-quality documents speed up processing',
          impact: 'low',
          timeframe: '1 week',
          specific_actions: [
            'Take clear, well-lit photos of documents',
            'Ensure all text is readable',
            'Use a scanner if available',
            'Check that documents are not expired'
          ]
        };

      default:
        return null;
    }
  }

  /**
   * Generate alternative loan options
   */
  private async generateAlternativeOptions(
    context: ApplicantContext,
    assessmentResult: AssessmentResult,
    failedCriteria: CriteriaScore[]
  ): Promise<AlternativeOption[]> {

    const alternatives: AlternativeOption[] = [];

    // Calculate affordable amount based on income
    const maxAffordablePayment = context.monthly_income * 0.25; // Conservative 25%
    const maxAffordableLoan = context.term_months === 1 
      ? maxAffordablePayment / 1.3 // Account for 30% finance charge
      : (maxAffordablePayment * context.term_months) / 1.3;

    // Smaller amount option
    if (maxAffordableLoan > 1000 && maxAffordableLoan < context.amount_requested) {
      alternatives.push({
        option_type: 'smaller_amount',
        description: `Apply for N$${Math.floor(maxAffordableLoan / 500) * 500}`,
        details: `Based on your income of N$${context.monthly_income.toLocaleString()}, this amount would be more affordable`,
        estimated_approval_chance: Math.min(85, assessmentResult.overall_score + 30)
      });
    }

    // Longer term option (if currently short-term)
    if (context.term_months <= 3 && context.amount_requested <= 20000) {
      const longerTermPayment = (context.amount_requested * 1.3) / 6; // 6 months
      if (longerTermPayment < maxAffordablePayment) {
        alternatives.push({
          option_type: 'longer_term',
          description: 'Extend loan term to 6 months',
          details: `Monthly payment would be N$${Math.ceil(longerTermPayment)}, which fits better with your budget`,
          estimated_approval_chance: Math.min(80, assessmentResult.overall_score + 25)
        });
      }
    }

    // Guarantor option for employment/stability issues
    const hasEmploymentIssues = failedCriteria.some(c => 
      c.criteria_code === 'employment_stability' || 
      c.criteria_code === 'income_verification'
    );

    if (hasEmploymentIssues && context.amount_requested <= 10000) {
      alternatives.push({
        option_type: 'guarantor',
        description: 'Apply with an employed guarantor',
        details: 'A guarantor with stable employment can strengthen your application',
        requirements: [
          'Guarantor must be employed for 12+ months',
          'Guarantor monthly income > N$5,000',
          'Guarantor must sign guarantee agreement'
        ],
        estimated_approval_chance: Math.min(75, assessmentResult.overall_score + 35)
      });
    }

    return alternatives;
  }

  /**
   * Calculate estimated approval probability after improvements
   */
  private calculateImprovementProbability(
    assessmentResult: AssessmentResult,
    improvements: ImprovementSuggestion[]
  ): number {

    let baseScore = assessmentResult.overall_score;
    let potentialIncrease = 0;

    improvements.forEach(improvement => {
      switch (improvement.impact) {
        case 'high':
          potentialIncrease += 20;
          break;
        case 'medium':
          potentialIncrease += 10;
          break;
        case 'low':
          potentialIncrease += 5;
          break;
      }
    });

    // Cap the potential score and convert to probability
    const potentialScore = Math.min(95, baseScore + potentialIncrease);
    
    if (potentialScore >= 70) return Math.min(90, potentialScore);
    if (potentialScore >= 60) return Math.min(70, potentialScore - 10);
    return Math.min(50, potentialScore - 20);
  }

  /**
   * Generate improvement timeline
   */
  private generateImprovementTimeline(suggestions: ImprovementSuggestion[]): string {
    if (suggestions.length === 0) return '';

    const timeframes = suggestions.map(s => s.timeframe);
    const hasShortTerm = timeframes.some(t => t.includes('week'));
    const hasLongTerm = timeframes.some(t => t.includes('month') && !t.includes('1-2'));

    if (hasShortTerm && hasLongTerm) {
      return 'Some improvements can be made immediately, while others may take 3-6 months to implement fully.';
    } else if (hasShortTerm) {
      return 'Most improvements can be implemented within 1-2 months.';
    } else if (hasLongTerm) {
      return 'Significant improvements will require 3-6 months of consistent effort.';
    } else {
      return 'Timeline varies based on your specific situation and commitment to improvement.';
    }
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(
    improvements: ImprovementSuggestion[],
    alternatives: AlternativeOption[]
  ): string[] {

    const steps: string[] = [];

    // Immediate actions from high-impact improvements
    const immediateActions = improvements
      .filter(imp => imp.impact === 'high' && imp.timeframe.includes('week'))
      .flatMap(imp => imp.specific_actions.slice(0, 2));

    steps.push(...immediateActions.slice(0, 3));

    // Alternative options
    if (alternatives.length > 0) {
      steps.push(`Consider applying for ${alternatives[0].description}`);
    }

    // General advice
    if (improvements.length > 2) {
      steps.push('Focus on 1-2 key areas for maximum impact');
    }

    steps.push('Reapply once you have made the recommended improvements');

    return steps.slice(0, 5); // Limit to 5 steps
  }

  /**
   * Save feedback to database
   */
  private async saveFeedback(
    applicationId: string,
    feedback: GeneratedFeedback,
    language: string
  ): Promise<void> {

    await this.supabase
      .from('application_feedback')
      .insert({
        application_id: applicationId,
        feedback_type: 'rejection',
        primary_reason: feedback.primary_reason,
        detailed_explanation: feedback.detailed_explanation,
        improvement_suggestions: feedback.improvement_suggestions,
        alternative_options: feedback.alternative_options,
        estimated_approval_probability: feedback.estimated_approval_probability,
        language: language
      });
  }

  /**
   * Send feedback to applicant
   */
  private async sendFeedbackToApplicant(
    applicationId: string,
    feedback: GeneratedFeedback,
    context: ApplicantContext
  ): Promise<void> {

    // Get applicant communication preferences
    const { data: application } = await this.supabase
      .from('applications')
      .select(`
        applicant:applicants (
          full_name,
          email,
          mobile,
          preferred_communication_method,
          communication_language
        )
      `)
      .eq('id', applicationId)
      .single();

    if (!application?.applicant) {
      throw new Error('Applicant information not found');
    }

    const applicant = application.applicant;

    // Format message based on preferred method
    const subject = `Loan Application Update - ${context.full_name}`;
    const message = this.formatFeedbackMessage(feedback, context);

    // Send via preferred communication method
    await this.supabase
      .from('applicant_communications')
      .insert({
        application_id: applicationId,
        communication_type: 'rejection_notice',
        channel: applicant.preferred_communication_method || 'email',
        direction: 'outbound',
        subject: subject,
        content: message,
        is_ai_generated: true,
        sent_at: new Date().toISOString()
      });

    console.log(`Feedback sent to ${applicant.full_name} via ${applicant.preferred_communication_method || 'email'}`);
  }

  /**
   * Format feedback message for communication
   */
  private formatFeedbackMessage(feedback: GeneratedFeedback, context: ApplicantContext): string {
    let message = `Dear ${context.full_name},\n\n`;
    message += `Thank you for your loan application for N$${context.amount_requested.toLocaleString()}.\n\n`;
    message += `${feedback.detailed_explanation}\n\n`;

    if (feedback.improvement_suggestions.length > 0) {
      message += `To improve your chances of approval in the future, consider these suggestions:\n\n`;
      feedback.improvement_suggestions.slice(0, 3).forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion.suggestion}\n`;
        message += `   ${suggestion.details}\n`;
        if (suggestion.specific_actions.length > 0) {
          message += `   Actions: ${suggestion.specific_actions.slice(0, 2).join(', ')}\n`;
        }
        message += '\n';
      });
    }

    if (feedback.alternative_options.length > 0) {
      message += `Alternative options you might consider:\n\n`;
      feedback.alternative_options.slice(0, 2).forEach((option, index) => {
        message += `${index + 1}. ${option.description}\n`;
        message += `   ${option.details}\n\n`;
      });
    }

    if (feedback.estimated_approval_probability) {
      message += `With improvements, your estimated approval probability could be ${feedback.estimated_approval_probability}%.\n\n`;
    }

    message += `We encourage you to reapply once you have addressed these areas. `;
    message += `Our team is here to help you succeed.\n\n`;
    message += `Best regards,\nTMU CashLoan CC`;

    return message;
  }

  // Utility methods
  private categorizeCriteria(criteriaCode: string): string {
    const categoryMap: Record<string, string> = {
      'identity_verification': 'Documentation',
      'income_verification': 'Income',
      'affordability_assessment': 'Affordability',
      'credit_history': 'Credit',
      'employment_stability': 'Employment'
    };
    return categoryMap[criteriaCode] || 'General';
  }

  private calculateCategoryImpact(category: string, criteria: CriteriaScore[]): number {
    const weights: Record<string, number> = {
      'Affordability': 10,
      'Income': 8,
      'Employment': 6,
      'Credit': 5,
      'Documentation': 3
    };
    return (weights[category] || 1) * criteria.length;
  }

  private getCategoryReason(category: string): string {
    const reasons: Record<string, string> = {
      'Affordability': 'Insufficient affordability based on income and existing obligations',
      'Income': 'Income verification requirements not met',
      'Employment': 'Employment stability concerns',
      'Credit': 'Credit history does not meet our requirements',
      'Documentation': 'Required documentation not provided or unclear'
    };
    return reasons[category] || 'Assessment criteria not met';
  }

  private getImpactScore(impact: string): number {
    const scores = { 'high': 3, 'medium': 2, 'low': 1 };
    return scores[impact as keyof typeof scores] || 1;
  }

  private generateTemplateBasedExplanation(
    context: ApplicantContext,
    primaryFailure: { reason: string; criteria: CriteriaScore[] }
  ): string {
    return `Dear ${context.full_name}, thank you for your loan application. After careful review, we are unable to approve your application for N$${context.amount_requested.toLocaleString()} at this time due to ${primaryFailure.reason.toLowerCase()}. We encourage you to address the areas mentioned and consider reapplying in the future.`;
  }
}

// Export singleton instance
export const feedbackGenerator = new FeedbackGenerator();