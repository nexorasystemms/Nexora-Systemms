/**
 * Document Processing System
 * AI-powered document extraction and verification for loan applications
 */

import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from '@anthropic-ai/sdk';

export interface DocumentExtractionResult {
  success: boolean;
  extracted_data: Record<string, any>;
  confidence_score: number;
  verification_status: 'verified' | 'suspicious' | 'failed' | 'manual_review_required';
  quality_score: number;
  processing_notes: string[];
  flags: string[];
}

export interface PayslipData {
  employee_name: string;
  employer_name: string;
  pay_period: string;
  gross_salary: number;
  net_salary: number;
  deductions: {
    tax: number;
    pension: number;
    medical: number;
    other: number;
    total: number;
  };
  is_valid: boolean;
  quality_score: number;
}

export interface BankStatementData {
  account_holder: string;
  account_number: string; // Will be tokenized
  bank_name: string;
  statement_period: string;
  salary_deposits: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
  average_salary_deposit: number;
  regular_deposits: boolean;
  recurring_debits: Array<{
    description: string;
    amount: number;
    frequency: string;
  }>;
  total_monthly_debits: number;
  account_balance: number;
  is_valid: boolean;
  quality_score: number;
}

export interface IdentityDocumentData {
  full_name: string;
  id_number: string; // Will be tokenized
  date_of_birth: string;
  nationality: string;
  document_type: 'id' | 'passport';
  expiry_date?: string;
  is_valid: boolean;
  quality_score: number;
}

export class DocumentProcessor {
  private supabase = createAdminClient();
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  /**
   * Process a document and extract relevant data
   */
  async processDocument(documentId: string): Promise<DocumentExtractionResult> {
    try {
      // Get document details
      const { data: document, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !document) {
        throw new Error(`Document not found: ${error?.message}`);
      }

      // Mark as processing
      await this.updateDocumentStatus(documentId, 'processing');

      // Get the document file
      const { data: fileData } = await this.supabase.storage
        .from('documents')
        .download(document.storage_key);

      if (!fileData) {
        throw new Error('Failed to download document file');
      }

      // Convert to base64 for Claude vision
      const buffer = await fileData.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = fileData.type;

      // Process based on document type
      let result: DocumentExtractionResult;
      
      switch (document.doc_type) {
        case 'payslip':
          result = await this.processPayslip(base64, mimeType);
          break;
        case 'bank_statement':
          result = await this.processBankStatement(base64, mimeType);
          break;
        case 'id':
          result = await this.processIdentityDocument(base64, mimeType);
          break;
        case 'proof_of_address':
          result = await this.processProofOfAddress(base64, mimeType);
          break;
        default:
          throw new Error(`Unsupported document type: ${document.doc_type}`);
      }

      // Save results
      await this.saveExtractionResults(documentId, result);
      await this.updateDocumentStatus(documentId, 'completed');

      return result;

    } catch (error) {
      console.error('Document processing failed:', error);
      await this.updateDocumentStatus(documentId, 'failed');
      throw error;
    }
  }

  /**
   * Process payslip document
   */
  private async processPayslip(base64: string, mimeType: string): Promise<DocumentExtractionResult> {
    const prompt = `
    Analyze this payslip image and extract the following information in JSON format:
    
    {
      "employee_name": "Full name of employee",
      "employer_name": "Name of employer/company", 
      "pay_period": "Pay period (e.g., 'March 2024')",
      "gross_salary": "Gross salary amount (number only)",
      "net_salary": "Net salary amount (number only)", 
      "deductions": {
        "tax": "Tax deduction amount",
        "pension": "Pension/retirement deduction",
        "medical": "Medical aid deduction", 
        "other": "Other deductions total",
        "total": "Total deductions"
      },
      "quality_assessment": {
        "is_legible": "boolean - is the document clearly readable",
        "is_complete": "boolean - are all key fields visible",
        "is_recent": "boolean - is this from the last 3 months",
        "quality_score": "number 1-100 - overall document quality"
      }
    }
    
    Important:
    - Extract only numbers for salary amounts (no currency symbols or text)
    - If any field is unclear or not visible, set it to null
    - Be conservative with quality assessment
    - Look for signs of tampering or falsification
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-sonnet-20241022",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as any,
                data: base64
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }]
      });

      const extractedText = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from response');
      }

      const extracted = JSON.parse(jsonMatch[0]);
      const qualityAssessment = extracted.quality_assessment;

      // Validate and structure the data
      const payslipData: PayslipData = {
        employee_name: extracted.employee_name || '',
        employer_name: extracted.employer_name || '',
        pay_period: extracted.pay_period || '',
        gross_salary: Number(extracted.gross_salary) || 0,
        net_salary: Number(extracted.net_salary) || 0,
        deductions: {
          tax: Number(extracted.deductions?.tax) || 0,
          pension: Number(extracted.deductions?.pension) || 0,
          medical: Number(extracted.deductions?.medical) || 0,
          other: Number(extracted.deductions?.other) || 0,
          total: Number(extracted.deductions?.total) || 0
        },
        is_valid: qualityAssessment?.is_legible && qualityAssessment?.is_complete,
        quality_score: qualityAssessment?.quality_score || 0
      };

      // Perform validation checks
      const flags: string[] = [];
      let verification_status: 'verified' | 'suspicious' | 'failed' | 'manual_review_required' = 'verified';

      // Check calculation consistency
      if (payslipData.gross_salary > 0 && payslipData.deductions.total > 0) {
        const calculatedNet = payslipData.gross_salary - payslipData.deductions.total;
        const variance = Math.abs(calculatedNet - payslipData.net_salary) / payslipData.net_salary;
        
        if (variance > 0.05) { // 5% variance tolerance
          flags.push('Net salary calculation inconsistent');
          verification_status = 'suspicious';
        }
      }

      // Check for unrealistic values
      if (payslipData.net_salary > 100000 || payslipData.net_salary < 1000) {
        flags.push('Salary amount outside expected range');
        verification_status = 'manual_review_required';
      }

      // Check quality score
      if (payslipData.quality_score < 60) {
        verification_status = 'manual_review_required';
        flags.push('Low document quality score');
      }

      return {
        success: true,
        extracted_data: payslipData,
        confidence_score: Math.min(95, payslipData.quality_score + 10),
        verification_status,
        quality_score: payslipData.quality_score,
        processing_notes: [`Processed payslip for ${payslipData.employee_name}`],
        flags
      };

    } catch (error) {
      return {
        success: false,
        extracted_data: {},
        confidence_score: 0,
        verification_status: 'failed',
        quality_score: 0,
        processing_notes: [`Processing failed: ${error.message}`],
        flags: ['processing_error']
      };
    }
  }

  /**
   * Process bank statement document
   */
  private async processBankStatement(base64: string, mimeType: string): Promise<DocumentExtractionResult> {
    const prompt = `
    Analyze this bank statement and extract the following information in JSON format:
    
    {
      "account_holder": "Name of account holder",
      "account_number": "Last 4 digits only (for privacy)",
      "bank_name": "Name of the bank",
      "statement_period": "Statement period (e.g., 'January 2024')",
      "salary_deposits": [
        {
          "date": "YYYY-MM-DD",
          "amount": "deposit amount (number only)",
          "description": "transaction description"
        }
      ],
      "recurring_debits": [
        {
          "description": "debit description", 
          "amount": "debit amount (number only)",
          "frequency": "monthly/weekly/etc"
        }
      ],
      "account_balance": "Closing balance (number only)",
      "quality_assessment": {
        "is_legible": "boolean",
        "is_complete": "boolean", 
        "is_recent": "boolean - within last 3 months",
        "quality_score": "number 1-100"
      }
    }
    
    Look specifically for:
    - Regular salary deposits (usually monthly, similar amounts)
    - Recurring debt payments (loan installments, credit cards)
    - Account fees and charges
    - Opening and closing balances
    
    Only include transactions that appear to be salary (regular, similar amounts from employer)
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-sonnet-20241022",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as any,
                data: base64
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }]
      });

      const extractedText = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from response');
      }

      const extracted = JSON.parse(jsonMatch[0]);
      const qualityAssessment = extracted.quality_assessment;

      // Calculate average salary deposit
      const salaryDeposits = extracted.salary_deposits || [];
      const averageSalary = salaryDeposits.length > 0 
        ? salaryDeposits.reduce((sum: number, dep: any) => sum + Number(dep.amount), 0) / salaryDeposits.length
        : 0;

      // Check for regular deposits (same amount, regular intervals)
      const regularDeposits = salaryDeposits.length >= 2 && 
        salaryDeposits.every((dep: any, index: number) => {
          if (index === 0) return true;
          const variance = Math.abs(Number(dep.amount) - Number(salaryDeposits[0].amount)) / Number(salaryDeposits[0].amount);
          return variance <= 0.1; // 10% variance tolerance
        });

      const bankData: BankStatementData = {
        account_holder: extracted.account_holder || '',
        account_number: extracted.account_number || '', // Will be tokenized
        bank_name: extracted.bank_name || '',
        statement_period: extracted.statement_period || '',
        salary_deposits: salaryDeposits,
        average_salary_deposit: averageSalary,
        regular_deposits: regularDeposits,
        recurring_debits: extracted.recurring_debits || [],
        total_monthly_debits: (extracted.recurring_debits || []).reduce((sum: number, debit: any) => sum + Number(debit.amount), 0),
        account_balance: Number(extracted.account_balance) || 0,
        is_valid: qualityAssessment?.is_legible && qualityAssessment?.is_complete,
        quality_score: qualityAssessment?.quality_score || 0
      };

      // Validation and flags
      const flags: string[] = [];
      let verification_status: 'verified' | 'suspicious' | 'failed' | 'manual_review_required' = 'verified';

      if (!regularDeposits && salaryDeposits.length > 0) {
        flags.push('Irregular salary deposit pattern');
        verification_status = 'manual_review_required';
      }

      if (bankData.quality_score < 60) {
        verification_status = 'manual_review_required';
        flags.push('Low document quality');
      }

      if (salaryDeposits.length === 0) {
        flags.push('No salary deposits identified');
        verification_status = 'manual_review_required';
      }

      return {
        success: true,
        extracted_data: bankData,
        confidence_score: Math.min(95, bankData.quality_score + 5),
        verification_status,
        quality_score: bankData.quality_score,
        processing_notes: [`Processed bank statement with ${salaryDeposits.length} salary deposits`],
        flags
      };

    } catch (error) {
      return {
        success: false,
        extracted_data: {},
        confidence_score: 0,
        verification_status: 'failed',
        quality_score: 0,
        processing_notes: [`Processing failed: ${error.message}`],
        flags: ['processing_error']
      };
    }
  }

  /**
   * Process identity document
   */
  private async processIdentityDocument(base64: string, mimeType: string): Promise<DocumentExtractionResult> {
    const prompt = `
    Analyze this identity document (ID card or passport) and extract the following information in JSON format:
    
    {
      "full_name": "Complete name as shown on document",
      "id_number": "ID number or passport number", 
      "date_of_birth": "Date of birth in YYYY-MM-DD format",
      "nationality": "Nationality",
      "document_type": "id or passport",
      "expiry_date": "Document expiry date if visible (YYYY-MM-DD)",
      "quality_assessment": {
        "is_legible": "boolean - all text clearly readable",
        "is_complete": "boolean - all required fields visible", 
        "appears_authentic": "boolean - no obvious signs of tampering",
        "quality_score": "number 1-100 - overall quality"
      }
    }
    
    Pay attention to:
    - Document security features
    - Text clarity and consistency
    - Signs of tampering or alteration
    - Photo quality and authenticity
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-sonnet-20241022",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as any,
                data: base64
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }]
      });

      const extractedText = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from response');
      }

      const extracted = JSON.parse(jsonMatch[0]);
      const qualityAssessment = extracted.quality_assessment;

      const idData: IdentityDocumentData = {
        full_name: extracted.full_name || '',
        id_number: extracted.id_number || '', // Will be tokenized
        date_of_birth: extracted.date_of_birth || '',
        nationality: extracted.nationality || '',
        document_type: extracted.document_type || 'id',
        expiry_date: extracted.expiry_date,
        is_valid: qualityAssessment?.is_legible && qualityAssessment?.is_complete && qualityAssessment?.appears_authentic,
        quality_score: qualityAssessment?.quality_score || 0
      };

      // Validation
      const flags: string[] = [];
      let verification_status: 'verified' | 'suspicious' | 'failed' | 'manual_review_required' = 'verified';

      // Check if document is expired
      if (idData.expiry_date) {
        const expiryDate = new Date(idData.expiry_date);
        if (expiryDate < new Date()) {
          flags.push('Document expired');
          verification_status = 'failed';
        }
      }

      // Check authenticity assessment
      if (!qualityAssessment?.appears_authentic) {
        flags.push('Authenticity concerns');
        verification_status = 'suspicious';
      }

      // Check age calculation
      if (idData.date_of_birth) {
        const age = this.calculateAge(idData.date_of_birth);
        if (age < 18 || age > 80) {
          flags.push('Age outside acceptable range');
          verification_status = 'manual_review_required';
        }
      }

      if (idData.quality_score < 70) {
        verification_status = 'manual_review_required';
        flags.push('Low quality score');
      }

      return {
        success: true,
        extracted_data: idData,
        confidence_score: Math.min(95, idData.quality_score + 10),
        verification_status,
        quality_score: idData.quality_score,
        processing_notes: [`Processed ${idData.document_type} for ${idData.full_name}`],
        flags
      };

    } catch (error) {
      return {
        success: false,
        extracted_data: {},
        confidence_score: 0,
        verification_status: 'failed',
        quality_score: 0,
        processing_notes: [`Processing failed: ${error.message}`],
        flags: ['processing_error']
      };
    }
  }

  /**
   * Process proof of address document (basic implementation)
   */
  private async processProofOfAddress(base64: string, mimeType: string): Promise<DocumentExtractionResult> {
    // Basic implementation - could be expanded
    return {
      success: true,
      extracted_data: { document_type: 'proof_of_address', needs_manual_review: true },
      confidence_score: 50,
      verification_status: 'manual_review_required',
      quality_score: 50,
      processing_notes: ['Proof of address requires manual verification'],
      flags: ['manual_review_required']
    };
  }

  /**
   * Save document extraction results
   */
  private async saveExtractionResults(
    documentId: string,
    result: DocumentExtractionResult
  ): Promise<void> {
    
    // Update document with extraction results
    await this.supabase
      .from('documents')
      .update({
        ai_extraction_confidence: result.confidence_score,
        ai_verification_status: result.verification_status,
        extracted_data_json: result.extracted_data,
        quality_score: result.quality_score,
        requires_manual_review: result.verification_status === 'manual_review_required' || result.verification_status === 'suspicious'
      })
      .eq('id', documentId);

    // Save detailed verification record
    await this.supabase
      .from('document_verifications')
      .insert({
        document_id: documentId,
        verification_type: 'data_extraction',
        status: result.success ? 'verified' : 'failed',
        confidence_score: result.confidence_score,
        extracted_data: result.extracted_data,
        verification_flags: result.flags,
        processing_notes: result.processing_notes.join('; '),
        verified_at: new Date().toISOString(),
        manual_review_required: result.verification_status === 'manual_review_required'
      });
  }

  /**
   * Update document processing status
   */
  private async updateDocumentStatus(documentId: string, status: string): Promise<void> {
    await this.supabase
      .from('documents')
      .update({
        ai_processing_status: status,
        last_processing_attempt_at: new Date().toISOString(),
        processing_attempts: this.supabase.raw('processing_attempts + 1')
      })
      .eq('id', documentId);
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
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();