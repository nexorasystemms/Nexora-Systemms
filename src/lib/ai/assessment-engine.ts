/**
 * AI Assessment Engine
 * Core system for automated loan application processing and qualification
 */

import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from '@anthropic-ai/sdk';

// Types for assessment system
export interface AssessmentCriteria {
  id: string;
  criteria_code: string;
  criteria_name: string;
  description: string;
  weight: number;
  min_score: number;
  max_score: number;
  is_mandatory: boolean;
}

export interface ScoringRule {
  id: string;
  criteria_id: string;
  rule_name: string;
  condition_type: string;
  condition_value: Record<string, any>;
  score_awarded: number;
  description: string;
}

export interface AssessmentResult {
  overall_score: number;
  qualification_status: 'qualified' | 'rejected' | 'pending_review' | 'requires_documents';
  confidence_level: number;
  criteria_scores: CriteriaScore[];
  processing_time_ms: number;
  recommendations: string[];
  next_actions: string[];
}

export interface CriteriaScore {
  criteria_id: string;
  criteria_code: string;
  raw_score: number;
  weighted_score: number;
  passed: boolean;
  extracted_data: Record<string, any>;
  calculation_details: Record<string, any>;
}

export interface ApplicationData {
  id: string;
  applicant_id: string;
  amount_requested: number;
  term_months: number;
  purpose: string;
  applicant: {
    full_name: string;
    id_number: string;
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
    storage_key: string;
    extracted_data_json?: Record<string, any>;
  }>;
}

export class AIAssessmentEngine {
  private supabase = createAdminClient();
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  /**
   * Main assessment function - processes a complete application
   */
  async assessApplication(applicationId: string): Promise<AssessmentResult> {
    const startTime = Date.now();

    try {
      // 1. Load application data
      const applicationData = await this.loadApplicationData(applicationId);
      
      // 2. Load qualification criteria for tenant
      const criteria = await this.loadQualificationCriteria(applicationData.applicant_id);
      
      // 3. Process each criteria
      const criteriaScores: CriteriaScore[] = [];
      
      for (const criterion of criteria) {
        const score = await this.assessCriteria(criterion, applicationData);
        criteriaScores.push(score);
      }
      
      // 4. Calculate overall assessment
      const result = await this.calculateOverallAssessment(criteriaScores, applicationData);
      result.processing_time_ms = Date.now() - startTime;
      
      // 5. Save assessment results
      await this.saveAssessmentResults(applicationId, result);
      
      // 6. Update application status
      await this.updateApplicationStatus(applicationId, result);
      
      return result;
      
    } catch (error) {
      console.error('Assessment failed:', error);
      throw new Error(`Assessment failed: ${error.message}`);
    }
  }

  /**
   * Load complete application data with related entities
   */
  private async loadApplicationData(applicationId: string): Promise<ApplicationData> {
    const { data: application, error } = await this.supabase
      .from('applications')
      .select(`
        *,
        applicant:applicants (*),
        employment:employment (*),
        documents (*)
      `)
      .eq('id', applicationId)
      .single();

    if (error || !application) {
      throw new Error(`Failed to load application: ${error?.message}`);
    }

    return {
      id: application.id,
      applicant_id: application.applicant_id,
      amount_requested: application.amount_requested,
      term_months: application.term_months,
      purpose: application.purpose,
      applicant: application.applicant,
      employment: application.employment?.[0] || {},
      documents: application.documents || []
    };
  }

  /**
   * Load qualification criteria for the tenant
   */
  private async loadQualificationCriteria(applicantId: string): Promise<AssessmentCriteria[]> {
    // Get tenant through applicant
    const { data: applicant } = await this.supabase
      .from('applicants')
      .select('tenant_id')
      .eq('id', applicantId)
      .single();

    if (!applicant) throw new Error('Applicant not found');

    const { data: criteria, error } = await this.supabase
      .from('qualification_criteria')
      .select('*, scoring_rules (*)')
      .eq('tenant_id', applicant.tenant_id)
      .eq('is_active', true)
      .order('weight', { ascending: false });

    if (error) throw new Error(`Failed to load criteria: ${error.message}`);
    
    return criteria || [];
  }

  /**
   * Assess a specific criteria for the application
   */
  private async assessCriteria(
    criterion: AssessmentCriteria,
    applicationData: ApplicationData
  ): Promise<CriteriaScore> {
    
    switch (criterion.criteria_code) {
      case 'identity_verification':
        return await this.assessIdentityVerification(criterion, applicationData);
      
      case 'income_verification':
        return await this.assessIncomeVerification(criterion, applicationData);
      
      case 'affordability_assessment':
        return await this.assessAffordability(criterion, applicationData);
      
      case 'credit_history':
        return await this.assessCreditHistory(criterion, applicationData);
      
      case 'employment_stability':
        return await this.assessEmploymentStability(criterion, applicationData);
      
      default:
        return {
          criteria_id: criterion.id,
          criteria_code: criterion.criteria_code,
          raw_score: 0,
          weighted_score: 0,
          passed: false,
          extracted_data: {},
          calculation_details: { error: `Unknown criteria: ${criterion.criteria_code}` }
        };
    }
  }

  /**
   * Identity verification assessment
   */
  private async assessIdentityVerification(
    criterion: AssessmentCriteria,
    applicationData: ApplicationData
  ): Promise<CriteriaScore> {
    
    let score = 0;
    const extractedData: Record<string, any> = {};
    const calculationDetails: Record<string, any> = {};

    // Find ID document
    const idDocument = applicationData.documents.find(doc => doc.doc_type === 'id');
    
    if (!idDocument) {
      calculationDetails.missing_id_document = true;
      return {
        criteria_id: criterion.id,
        criteria_code: criterion.criteria_code,
        raw_score: 0,
        weighted_score: 0,
        passed: false,
        extracted_data,
        calculation_details
      };
    }

    // Check if document has been processed
    if (idDocument.extracted_data_json) {
      const idData = idDocument.extracted_data_json;
      
      // Valid ID Document (40 points)
      if (idData.is_valid) {
        score += 40;
        extractedData.has_valid_id = true;
        calculationDetails.valid_id_document = 40;
      }
      
      // ID Data Match (30 points)
      if (this.compareIdDataWithApplication(idData, applicationData)) {
        score += 30;
        extractedData.data_matches = true;
        calculationDetails.id_data_match = 30;
      }
      
      // Photo Quality (20 points)
      if (idData.quality_score && idData.quality_score >= 80) {
        score += 20;
        extractedData.quality_score = idData.quality_score;
        calculationDetails.photo_quality = 20;
      }
      
      // Age Requirement (10 points)
      const age = this.calculateAge(idData.date_of_birth);
      if (age >= 18 && age <= 70) {
        score += 10;
        extractedData.age = age;
        calculationDetails.age_requirement = 10;
      }
    } else {
      // Document needs processing
      calculationDetails.document_needs_processing = true;
    }

    return {
      criteria_id: criterion.id,
      criteria_code: criterion.criteria_code,
      raw_score: score,
      weighted_score: score * criterion.weight,
      passed: score >= criterion.min_score,
      extracted_data,
      calculation_details
    };
  }

  /**
   * Income verification assessment
   */
  private async assessIncomeVerification(
    criterion: AssessmentCriteria,
    applicationData: ApplicationData
  ): Promise<CriteriaScore> {
    
    let score = 0;
    const extractedData: Record<string, any> = {};
    const calculationDetails: Record<string, any> = {};

    const payslipDoc = applicationData.documents.find(doc => doc.doc_type === 'payslip');
    const bankStatementDoc = applicationData.documents.find(doc => doc.doc_type === 'bank_statement');

    // Payslip Present (25 points)
    if (payslipDoc?.extracted_data_json?.net_salary) {
      score += 25;
      extractedData.has_payslip = true;
      extractedData.payslip_net_salary = payslipDoc.extracted_data_json.net_salary;
      calculationDetails.payslip_present = 25;
    }

    // Bank Statement Present (25 points)
    if (bankStatementDoc?.extracted_data_json?.salary_deposits) {
      score += 25;
      extractedData.has_bank_statement = true;
      extractedData.bank_salary_deposits = bankStatementDoc.extracted_data_json.salary_deposits;
      calculationDetails.bank_statement_present = 25;
    }

    // Income Consistency (30 points)
    if (payslipDoc?.extracted_data_json && bankStatementDoc?.extracted_data_json) {
      const declaredSalary = applicationData.employment.monthly_net_salary;
      const payslipSalary = payslipDoc.extracted_data_json.net_salary;
      const bankSalary = bankStatementDoc.extracted_data_json.average_salary_deposit;

      const variance = this.calculateVariance(declaredSalary, payslipSalary, bankSalary);
      
      if (variance <= 10) {
        score += 30;
        extractedData.income_variance = variance;
        calculationDetails.income_consistency = 30;
      } else {
        calculationDetails.income_variance_too_high = variance;
      }
    }

    // Regular Income Pattern (20 points)
    if (bankStatementDoc?.extracted_data_json?.regular_deposits === true) {
      score += 20;
      extractedData.regular_deposits = true;
      calculationDetails.regular_income_pattern = 20;
    }

    return {
      criteria_id: criterion.id,
      criteria_code: criterion.criteria_code,
      raw_score: score,
      weighted_score: score * criterion.weight,
      passed: score >= criterion.min_score,
      extracted_data,
      calculation_details
    };
  }

  /**
   * Affordability assessment
   */
  private async assessAffordability(
    criterion: AssessmentCriteria,
    applicationData: ApplicationData
  ): Promise<CriteriaScore> {
    
    let score = 0;
    const extractedData: Record<string, any> = {};
    const calculationDetails: Record<string, any> = {};

    const monthlyIncome = applicationData.employment.monthly_net_salary;
    const loanAmount = applicationData.amount_requested;
    const termMonths = applicationData.term_months;
    
    // Calculate monthly payment (assuming 30% finance charge as per documentation)
    const financeCharge = loanAmount * 0.30;
    const monthlyPayment = termMonths === 1 ? (loanAmount + financeCharge) : (loanAmount + financeCharge) / termMonths;
    
    // Get existing obligations from bank statement or declared
    const existingObligations = await this.calculateExistingObligations(applicationData);
    
    // Calculate debt service ratio
    const totalMonthlyDebt = monthlyPayment + existingObligations;
    const debtServiceRatio = (totalMonthlyDebt / monthlyIncome) * 100;
    
    extractedData.monthly_income = monthlyIncome;
    extractedData.monthly_payment = monthlyPayment;
    extractedData.existing_obligations = existingObligations;
    extractedData.debt_service_ratio = debtServiceRatio;

    // Debt Service Ratio (40 points)
    if (debtServiceRatio <= 35) {
      score += 40;
      calculationDetails.debt_service_ratio_pass = 40;
    } else {
      calculationDetails.debt_service_ratio_fail = debtServiceRatio;
    }

    // Surplus Income (35 points)
    const estimatedExpenses = monthlyIncome * 0.7; // Rough estimate if not available
    const surplusIncome = monthlyIncome - estimatedExpenses - totalMonthlyDebt;
    
    if (surplusIncome > monthlyPayment * 1.2) {
      score += 35;
      extractedData.surplus_income = surplusIncome;
      calculationDetails.surplus_income_adequate = 35;
    } else {
      calculationDetails.insufficient_surplus = surplusIncome;
    }

    // Dependant Provision (15 points)
    const dependantProvision = applicationData.applicant.dependants_count * 500; // N$500 per dependant
    if (surplusIncome >= dependantProvision) {
      score += 15;
      calculationDetails.dependant_provision_adequate = 15;
    }

    // Emergency Buffer (10 points)
    const emergencyBuffer = monthlyIncome * 0.15;
    if (surplusIncome >= emergencyBuffer) {
      score += 10;
      calculationDetails.emergency_buffer_adequate = 10;
    }

    return {
      criteria_id: criterion.id,
      criteria_code: criterion.criteria_code,
      raw_score: score,
      weighted_score: score * criterion.weight,
      passed: score >= criterion.min_score,
      extracted_data,
      calculation_details
    };
  }

  /**
   * Credit history assessment (placeholder - would integrate with credit bureau)
   */
  private async assessCreditHistory(
    criterion: AssessmentCriteria,
    applicationData: ApplicationData
  ): Promise<CriteriaScore> {
    
    // This would integrate with actual credit bureau API
    // For now, returning a neutral score
    
    return {
      criteria_id: criterion.id,
      criteria_code: criterion.criteria_code,
      raw_score: 70, // Neutral score
      weighted_score: 70 * criterion.weight,
      passed: 70 >= criterion.min_score,
      extracted_data: { credit_check_pending: true },
      calculation_details: { note: 'Credit bureau integration pending' }
    };
  }

  /**
   * Employment stability assessment
   */
  private async assessEmploymentStability(
    criterion: AssessmentCriteria,
    applicationData: ApplicationData
  ): Promise<CriteriaScore> {
    
    let score = 0;
    const extractedData: Record<string, any> = {};
    const calculationDetails: Record<string, any> = {};

    const employmentStartDate = new Date(applicationData.employment.employment_start_date);
    const monthsEmployed = this.calculateMonthsBetweenDates(employmentStartDate, new Date());
    
    extractedData.months_employed = monthsEmployed;

    // Employment Duration (40 points)
    if (monthsEmployed >= 6) {
      const bonusScore = Math.min(20, Math.floor((monthsEmployed - 6) / 6) * 5); // Bonus for longer tenure
      score += 40 + bonusScore;
      calculationDetails.employment_duration = 40 + bonusScore;
    } else {
      calculationDetails.employment_too_short = monthsEmployed;
    }

    // Employer Verification (30 points) - would need actual verification
    if (applicationData.employment.employer_name && applicationData.employment.employer_name.trim() !== '') {
      score += 30;
      calculationDetails.employer_verification = 30;
    }

    // Stable Industry (20 points) - basic check
    const stableIndustries = ['government', 'banking', 'education', 'healthcare', 'mining'];
    const occupation = applicationData.employment.occupation?.toLowerCase() || '';
    
    if (stableIndustries.some(industry => occupation.includes(industry))) {
      score += 20;
      extractedData.stable_industry = true;
      calculationDetails.stable_industry = 20;
    }

    // Income Trend (10 points) - would need historical data
    score += 10; // Neutral score for now
    calculationDetails.income_trend_neutral = 10;

    return {
      criteria_id: criterion.id,
      criteria_code: criterion.criteria_code,
      raw_score: score,
      weighted_score: score * criterion.weight,
      passed: score >= criterion.min_score,
      extracted_data,
      calculation_details
    };
  }

  /**
   * Calculate overall assessment from criteria scores
   */
  private async calculateOverallAssessment(
    criteriaScores: CriteriaScore[],
    applicationData: ApplicationData
  ): Promise<AssessmentResult> {
    
    // Calculate weighted average score
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let mandatoryFailures = 0;

    for (const score of criteriaScores) {
      totalWeightedScore += score.weighted_score;
      
      // Get the original criteria to check weight and mandatory status
      const { data: criteria } = await this.supabase
        .from('qualification_criteria')
        .select('weight, is_mandatory')
        .eq('id', score.criteria_id)
        .single();

      if (criteria) {
        totalWeight += criteria.weight;
        if (criteria.is_mandatory && !score.passed) {
          mandatoryFailures++;
        }
      }
    }

    const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    
    // Determine qualification status
    let qualificationStatus: 'qualified' | 'rejected' | 'pending_review' | 'requires_documents';
    let confidenceLevel = 85; // Base confidence

    if (mandatoryFailures > 0) {
      qualificationStatus = 'rejected';
      confidenceLevel = 95; // High confidence in rejections due to mandatory failures
    } else if (overallScore >= 70) {
      qualificationStatus = 'qualified';
      confidenceLevel = Math.min(95, 70 + overallScore * 0.3);
    } else if (overallScore >= 56) { // 80% of 70
      qualificationStatus = 'pending_review';
      confidenceLevel = 60;
    } else {
      qualificationStatus = 'rejected';
      confidenceLevel = 80;
    }

    // Check for missing documents
    const requiredDocuments = ['id', 'payslip', 'bank_statement'];
    const providedDocuments = applicationData.documents.map(doc => doc.doc_type);
    const missingDocuments = requiredDocuments.filter(doc => !providedDocuments.includes(doc));
    
    if (missingDocuments.length > 0) {
      qualificationStatus = 'requires_documents';
      confidenceLevel = 95;
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(criteriaScores, overallScore);
    const nextActions = this.generateNextActions(qualificationStatus, criteriaScores);

    return {
      overall_score: Math.round(overallScore * 100) / 100,
      qualification_status: qualificationStatus,
      confidence_level: Math.round(confidenceLevel * 100) / 100,
      criteria_scores: criteriaScores,
      processing_time_ms: 0, // Will be set by caller
      recommendations,
      next_actions
    };
  }

  /**
   * Save assessment results to database
   */
  private async saveAssessmentResults(
    applicationId: string,
    result: AssessmentResult
  ): Promise<void> {
    
    // Create AI assessment record
    const { data: assessment, error: assessmentError } = await this.supabase
      .from('ai_assessments')
      .insert({
        application_id: applicationId,
        assessment_type: 'final_assessment',
        status: 'completed',
        overall_score: result.overall_score,
        qualification_status: result.qualification_status,
        confidence_level: result.confidence_level,
        processing_time_ms: result.processing_time_ms,
        model_version: 'claude-3-sonnet-20241022',
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (assessmentError) {
      throw new Error(`Failed to save assessment: ${assessmentError.message}`);
    }

    // Save individual criteria scores
    for (const criteriaScore of result.criteria_scores) {
      await this.supabase
        .from('assessment_scores')
        .insert({
          assessment_id: assessment.id,
          criteria_id: criteriaScore.criteria_id,
          raw_score: criteriaScore.raw_score,
          weighted_score: criteriaScore.weighted_score,
          passed: criteriaScore.passed,
          extracted_data: criteriaScore.extracted_data,
          calculation_details: criteriaScore.calculation_details
        });
    }
  }

  /**
   * Update application status based on assessment results
   */
  private async updateApplicationStatus(
    applicationId: string,
    result: AssessmentResult
  ): Promise<void> {
    
    const updates: any = {
      ai_qualification_status: result.qualification_status,
      ai_assessment_score: result.overall_score,
      ai_confidence_level: result.confidence_level,
      automated_assessment_completed: true,
      assessment_completed_at: new Date().toISOString(),
      requires_human_review: result.qualification_status === 'pending_review',
      next_action_required: result.next_actions.join('; ')
    };

    // Set priority for human review queue
    if (result.qualification_status === 'pending_review') {
      updates.priority_score = Math.max(50, Math.min(90, result.overall_score));
    } else if (result.qualification_status === 'qualified') {
      updates.priority_score = Math.min(95, 70 + result.overall_score * 0.3);
    }

    const { error } = await this.supabase
      .from('applications')
      .update(updates)
      .eq('id', applicationId);

    if (error) {
      throw new Error(`Failed to update application: ${error.message}`);
    }
  }

  // Utility functions
  private compareIdDataWithApplication(idData: any, applicationData: ApplicationData): boolean {
    // Basic comparison logic - would be more sophisticated in production
    return idData.full_name?.toLowerCase().includes(applicationData.applicant.full_name.toLowerCase().split(' ')[0]);
  }

  private calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  }

  private calculateVariance(declared: number, payslip: number, bank: number): number {
    const average = (payslip + bank) / 2;
    return Math.abs((declared - average) / average) * 100;
  }

  private async calculateExistingObligations(applicationData: ApplicationData): Promise<number> {
    // This would analyze bank statement for recurring debits
    // For now, return a placeholder
    return 1000; // N$1000 estimated existing obligations
  }

  private calculateMonthsBetweenDates(startDate: Date, endDate: Date): number {
    return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  }

  private generateRecommendations(criteriaScores: CriteriaScore[], overallScore: number): string[] {
    const recommendations: string[] = [];

    criteriaScores.forEach(score => {
      if (!score.passed) {
        switch (score.criteria_code) {
          case 'identity_verification':
            recommendations.push('Provide clear, high-quality identity document photos');
            break;
          case 'income_verification':
            recommendations.push('Submit recent payslips and bank statements');
            break;
          case 'affordability_assessment':
            recommendations.push('Consider applying for a smaller loan amount or longer term');
            break;
          case 'employment_stability':
            recommendations.push('Provide employer confirmation or wait for longer employment tenure');
            break;
        }
      }
    });

    if (overallScore < 70 && overallScore >= 50) {
      recommendations.push('Consider reapplying in 3-6 months with improved financial situation');
    }

    return recommendations;
  }

  private generateNextActions(
    qualificationStatus: string,
    criteriaScores: CriteriaScore[]
  ): string[] {
    const actions: string[] = [];

    switch (qualificationStatus) {
      case 'qualified':
        actions.push('Forward to human reviewer for final approval');
        actions.push('Generate loan agreement');
        break;
      case 'rejected':
        actions.push('Send detailed rejection feedback to applicant');
        actions.push('Provide improvement suggestions');
        break;
      case 'pending_review':
        actions.push('Queue for human assessment');
        actions.push('Request additional documentation if needed');
        break;
      case 'requires_documents':
        actions.push('Request missing documents from applicant');
        actions.push('Resume assessment once documents provided');
        break;
    }

    return actions;
  }
}

// Export singleton instance
export const assessmentEngine = new AIAssessmentEngine();