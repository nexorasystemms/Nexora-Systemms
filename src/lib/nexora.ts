import { createClient } from './supabase/client'

// Client for the Nexora automation service (./Nexora): document reading and automated assessment.
const NEXORA_URL = (import.meta.env.VITE_NEXORA_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:4000'

export const MAX_AUTOFILL_BYTES = 8 * 1024 * 1024

export interface FormFields {
  employerName?: string
  employerAddress?: string
  occupation?: string
  monthlyNetSalary?: number
  grossSalary?: number
  employmentStartDate?: string
  bankName?: string
  accountName?: string
  bankBranch?: string
  accountNumber?: string
  businessName?: string
  tenderReference?: string
}

export interface ExtractedDocument {
  docType: string
  formFields: FormFields
  holderName: string | null
  looksLikeExpectedDocument: boolean
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await createClient().auth.getSession()
  const token = data.session?.access_token
  return token ? { authorization: `Bearer ${token}` } : {}
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

/** Ask Nexora to read one uploaded document. Throws an Error with a borrower-friendly message. */
export async function extractDocument(docType: string, file: File): Promise<ExtractedDocument> {
  if (file.size > MAX_AUTOFILL_BYTES) throw new Error('That file is too large to read (limit 8 MB).')

  let res: Response
  try {
    res = await fetch(`${NEXORA_URL}/api/documents/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ docType, mimeType: file.type, data: await toBase64(file) }),
    })
  } catch {
    throw new Error('Auto-fill is unavailable right now. You can still fill in the form yourself.')
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Could not read this document.')
  return body as ExtractedDocument
}

/** Fire-and-forget: ask Nexora to run the rules engine on a submitted application. */
export async function requestAssessment(applicationId: string): Promise<void> {
  try {
    await fetch(`${NEXORA_URL}/api/loan/assess-application`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ applicationId }),
    })
  } catch {
    // The application is already saved; staff can re-run the assessment if this service was down.
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Ask the customer assistant. Throws an Error with a customer-friendly message. */
export async function sendChat(messages: ChatMessage[]): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${NEXORA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ messages }),
    })
  } catch {
    throw new Error('The assistant is unavailable right now. Please try again shortly.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'The assistant is unavailable right now.')
  return String(body.reply ?? '')
}
