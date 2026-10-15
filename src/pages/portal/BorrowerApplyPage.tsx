import { useEffect, useMemo, useState, useTransition } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { tmuPortal } from "../../lib/tenants";
import { submitBorrowerApplication } from "../../lib/supabase/stubs";
import { getLoanProduct, LOAN_PRODUCTS, type LoanProduct, type LoanProductId } from "../../lib/loan-products";
import type { FormFields } from "../../lib/nexora";
import DocumentAutofill from "./DocumentAutofill";

export default function BorrowerApplyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState<LoanProductId | null>(null);

  const product = getLoanProduct(productId);

  const [amount, setAmount] = useState(4000);
  const [termMonths, setTermMonths] = useState(1);
  const [nextPayDate, setNextPayDate] = useState("");
  const [purposeCategory, setPurposeCategory] = useState("emergency");
  const [purposeText, setPurposeText] = useState("");
  const [referralSource, setReferralSource] = useState("");

  const [employerName, setEmployerName] = useState("");
  const [employerAddress, setEmployerAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [monthlyNetSalary, setMonthlyNetSalary] = useState(8500);
  const [employmentStartDate, setEmploymentStartDate] = useState("");
  const [employerPhone, setEmployerPhone] = useState("");
  const [employerContact, setEmployerContact] = useState("");
  const [employerEmail, setEmployerEmail] = useState("");

  const [grossSalary, setGrossSalary] = useState(0);
  const [otherIncome, setOtherIncome] = useState(0);
  const [spouseNet, setSpouseNet] = useState(0);
  const [totalExpenditure, setTotalExpenditure] = useState(0);

  const [hasPriorCredit, setHasPriorCredit] = useState<"no" | "had" | "have">("no");
  const [priorLender, setPriorLender] = useState("");
  const [priorInstalment, setPriorInstalment] = useState("");
  const [priorOutstanding, setPriorOutstanding] = useState("");
  const [priorRepayDate, setPriorRepayDate] = useState("");

  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [tenderReference, setTenderReference] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [securityDescription, setSecurityDescription] = useState("");

  const [files, setFiles] = useState<Record<string, File | null>>({});

  const [consentCredit, setConsentCredit] = useState(true);
  const [consentBureau, setConsentBureau] = useState(false);
  const [consentDebt, setConsentDebt] = useState(true);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentEft, setConsentEft] = useState(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    const fromQuery = getLoanProduct(searchParams.get("product"));
    if (fromQuery) selectProduct(fromQuery);
  }, [searchParams]);

  function selectProduct(next: LoanProduct) {
    setProductId(next.id);
    setAmount(next.defaultAmount);
    setTermMonths(next.defaultTerm);
    setFiles({});
    setEligible(false);
    setError(null);
    setConsentBureau(next.requiresCreditCheckConsent);
    setStep(1);
  }

  // Values read from uploaded documents by Nexora pre-fill the matching form fields.
  function applyExtracted(f: FormFields) {
    if (f.employerName) setEmployerName(f.employerName);
    if (f.employerAddress) setEmployerAddress(f.employerAddress);
    if (f.occupation) setOccupation(f.occupation);
    if (f.monthlyNetSalary) setMonthlyNetSalary(f.monthlyNetSalary);
    if (f.grossSalary) setGrossSalary(f.grossSalary);
    if (f.employmentStartDate) setEmploymentStartDate(f.employmentStartDate);
    if (f.bankName) setBankName(f.bankName);
    if (f.accountName) setAccountName(f.accountName);
    if (f.bankBranch) setBankBranch(f.bankBranch);
    if (f.accountNumber) setAccountNumber(f.accountNumber);
    if (f.businessName) setBusinessName(f.businessName);
    if (f.tenderReference) setTenderReference(f.tenderReference);
  }

  const isShortTerm = termMonths <= 5;
  const financeCharge = isShortTerm
    ? Math.round(amount * 0.30 * 100) / 100
    : Math.round(amount * 0.1075 * 2 * (termMonths / 12) * 100) / 100;
  const totalRepayable = Math.round((amount + financeCharge) * 100) / 100;
  const monthlyInstalment = Math.round((totalRepayable / termMonths) * 100) / 100;
  const totalNetIncome = monthlyNetSalary + spouseNet + otherIncome;
  const netSurplus = totalNetIncome - totalExpenditure;

  const amountMarks = useMemo(() => {
    if (!product) return [];
    return [product.minAmount, Math.round((product.minAmount + product.maxAmount) / 2), product.maxAmount];
  }, [product]);

  function handleNext() {
    if (!product) return;
    setError(null);
    if (step === 1) {
      if (!eligible) { setError("Confirm that you meet the eligibility checklist for this loan type."); return; }
      if (amount < product.minAmount || amount > product.maxAmount) {
        setError(`Amount must be between N$${product.minAmount.toLocaleString()} and N$${product.maxAmount.toLocaleString()}.`);
        return;
      }
      if (product.requiresNextPayDate && !nextPayDate) {
        setError(product.productType === "once_off" ? "Please provide the first repayment date." : "Please provide your next pay date.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (product.requiresEmployment && !employerName.trim()) {
        setError("Please provide your employer's name.");
        return;
      }
      if (product.requiresEmployment && monthlyNetSalary <= 0) {
        setError("Please enter your monthly net salary.");
        return;
      }
      if (product.requiresReferral && !referralSource.trim()) {
        setError("Please tell us where you heard about us.");
        return;
      }
      if (product.requiresCreditHistory && hasPriorCredit !== "no" && !priorLender.trim()) {
        setError("Enter the other lender's name for your prior credit.");
        return;
      }
      if (product.requiresBankDetails) {
        if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
          setError("Complete bank name, account name, and account number.");
          return;
        }
      }
      if (product.requiresCollateral && !securityDescription.trim()) {
        setError("Describe the security or collateral for this tender loan.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const missing = product.documents.filter((doc) => !files[doc.key]);
      if (missing.length) {
        setError(`Upload every required document: ${missing.map((d) => d.label).join(", ")}.`);
        return;
      }
      setStep(4);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setError(null);
    if (!consentCredit || !consentDebt) {
      setError("Please grant the required consents to submit your application.");
      return;
    }
    if (product.requiresCreditCheckConsent && !consentBureau) {
      setError("First-time applications require consent for a credit background check.");
      return;
    }
    if (product.requiresEftMandate && !consentEft) {
      setError("Authorise the bank EFT / debit-order mandate to continue.");
      return;
    }
    const formData = new FormData();
    formData.set("loan_product", product.id);
    formData.set("amount_requested", String(amount));
    formData.set("term_months", String(termMonths));
    formData.set("product_type", product.productType);
    if (nextPayDate) formData.set("next_pay_date", nextPayDate);
    formData.set("purpose_category", product.id === "tender_purchase_order" ? "tender" : purposeCategory);
    formData.set("purpose_text", purposeText);
    if (referralSource) formData.set("referral_source", referralSource);
    formData.set("has_prior_credit", hasPriorCredit);
    if (product.requiresEmployment) {
      formData.set("employer_name", employerName);
      formData.set("employer_address", employerAddress);
      formData.set("occupation", occupation);
      formData.set("monthly_net_salary", String(monthlyNetSalary));
      if (employmentStartDate) formData.set("employment_start_date", employmentStartDate);
      formData.set("employer_phone", employerPhone);
      formData.set("employer_contact", employerContact);
      formData.set("employer_email", employerEmail);
    }
    if (product.requiresIncomeExpenditure) {
      formData.set("gross_salary", String(grossSalary));
      formData.set("other_income", String(otherIncome));
      formData.set("spouse_net", String(spouseNet));
      formData.set("total_expenditure", String(totalExpenditure));
      formData.set("net_salary", String(monthlyNetSalary));
    }
    if (product.requiresCreditHistory && hasPriorCredit !== "no") {
      formData.set("prior_lender", priorLender);
      formData.set("prior_instalment", priorInstalment);
      formData.set("prior_outstanding", priorOutstanding);
      formData.set("prior_repay_date", priorRepayDate);
    }
    if (product.requiresBankDetails) {
      formData.set("bank_name", bankName);
      formData.set("account_name", accountName);
      formData.set("bank_branch", bankBranch);
      formData.set("account_number", accountNumber);
    }
    if (product.id === "tender_purchase_order") {
      formData.set("business_name", businessName);
      formData.set("tender_reference", tenderReference);
      formData.set("security_description", securityDescription);
    }
    for (const [key, file] of Object.entries(files)) {
      if (file) formData.set(`${key}_document`, file);
    }
    if (consentCredit) formData.set("consent_credit_assessment", "on");
    if (consentBureau) formData.set("consent_bureau", "on");
    if (consentDebt) formData.set("consent_debt_collection", "on");
    if (consentMarketing) formData.set("consent_marketing", "on");
    if (consentEft) formData.set("consent_eft_mandate", "on");

    startTransition(async () => {
      const result = await submitBorrowerApplication(formData);
      if (!result.success) {
        setError(result.error || "Failed to submit application.");
        return;
      }
      navigate(tmuPortal.home);
    });
  }

  const totalSteps = 4;
  const stepLabel =
    step === 1 ? `${product?.title ?? "Loan"} terms`
    : step === 2 ? (product?.step2Title ?? "Details")
    : step === 3 ? "Documents"
    : "Consents & submission";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-on-surface mb-2">Apply for a Cash Loan</h1>
        <p className="text-sm text-slate-500 mb-6">
          Choose the TMU facility that matches your situation. Documents and checks differ for each type.
        </p>

        {step === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {LOAN_PRODUCTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProduct(p)}
                className="text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-primary hover:shadow-md transition"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-100 text-secondary">{p.badge}</span>
                  {p.side && <span className="text-[11px] font-semibold text-slate-500">{p.side}</span>}
                </div>
                <h2 className="text-lg font-extrabold text-slate-900">{p.title}</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.summary}</p>
                <div className="mt-4 space-y-1.5 text-xs">
                  <Row label="Lender" value={p.lender} />
                  <Row label="Loan range" value={`N$ ${p.minAmount.toLocaleString()} – N$ ${p.maxAmount.toLocaleString()}`} />
                  <Row label="Settlement" value={p.settlement} />
                  <Row label={p.extraRow[0]} value={p.extraRow[1]} />
                </div>
                <div className="mt-4 text-xs font-semibold text-secondary">Apply for this facility →</div>
              </button>
            ))}
          </div>
        )}

        {step > 0 && product && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                  Step {step} of {totalSteps}: {stepLabel}
                </span>
                <button type="button" onClick={() => { setStep(0); setError(null); }} className="text-[11px] text-secondary hover:underline">
                  Change loan type
                </button>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-secondary h-full transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
              </div>
            </div>

            {error && (
              <div className="m-6 mb-0 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
            )}

            <div className="p-6 sm:p-8">
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">{product.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{product.summary}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Lender: {product.lender}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <p className="text-xs font-bold text-slate-800">Eligibility for this facility</p>
                    {product.eligibility.map((item) => (
                      <p key={item} className="text-xs text-slate-600">• {item}</p>
                    ))}
                    <label className="flex items-start gap-2 pt-2 text-xs text-slate-800">
                      <input type="checkbox" checked={eligible} onChange={(e) => setEligible(e.target.checked)} className="mt-0.5" />
                      I confirm I meet these requirements for {product.title}.
                    </label>
                  </div>

                  <DocumentAutofill
                    product={product}
                    files={files}
                    onFile={(key, file) => setFiles((prev) => ({ ...prev, [key]: file }))}
                    onFill={applyExtracted}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">Requested loan (NAD)</label>
                          <span className="text-base font-extrabold text-secondary">N${amount.toLocaleString()}</span>
                        </div>
                        <input
                          type="range"
                          min={product.minAmount}
                          max={product.maxAmount}
                          step={product.amountStep}
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                          {amountMarks.map((n) => <span key={n}>N${n.toLocaleString()}</span>)}
                        </div>
                      </div>

                      {product.minTerm !== product.maxTerm && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Loan duration (months): {termMonths}</label>
                          <input type="range" min={product.minTerm} max={product.maxTerm} step={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} className="w-full accent-primary" />
                          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                            <span>{product.minTerm} months</span>
                            <span>{product.maxTerm} months</span>
                          </div>
                        </div>
                      )}

                      {product.requiresNextPayDate && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {product.productType === "once_off" ? "First repayment date *" : "Next pay date *"}
                          </label>
                          <input type="date" required value={nextPayDate} onChange={(e) => setNextPayDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      )}

                      {product.requiresReferral && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Where did you hear about us? *</label>
                          <input type="text" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
                        </div>
                      )}

                      {product.id !== "tender_purchase_order" && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for loan</label>
                          <select value={purposeCategory} onChange={(e) => setPurposeCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white mb-2">
                            <option value="emergency">Family / Medical Emergency</option>
                            <option value="education">School / Tuition Fees</option>
                            <option value="vehicle">Vehicle Repair / Transport</option>
                            <option value="living_expenses">Household Expenses</option>
                            <option value="other">Other</option>
                          </select>
                          <input type="text" placeholder="Brief description (optional)" value={purposeText} onChange={(e) => setPurposeText(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs" />
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Cost summary</div>
                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                            <span className="text-slate-600">Principal</span>
                            <span className="font-bold text-slate-900">N${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                            <div>
                              <span className="text-slate-600">Finance charge</span>
                              <div className="text-[10px] text-secondary">{isShortTerm ? "Indicative 30% short-term cap" : "Indicative longer-term charge"}</div>
                            </div>
                            <span className="font-bold text-slate-900">N${financeCharge.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b-2 border-slate-300 font-extrabold text-sm text-slate-900">
                            <span>Total repayable</span>
                            <span className="text-secondary">N${totalRepayable.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                          </div>
                          {product.productType === "instalment" && (
                            <div className="flex justify-between py-1.5 text-xs text-secondary bg-secondary-container p-2.5 rounded-lg border border-secondary-container">
                              <span>Monthly instalment ({termMonths}x)</span>
                              <span className="font-bold">N${monthlyInstalment.toFixed(2)} / mo</span>
                            </div>
                          )}
                          {product.productType === "once_off" && (
                            <div className="flex justify-between py-1.5 text-xs text-secondary bg-secondary-container p-2.5 rounded-lg border border-secondary-container">
                              <span>Single repayment (once off)</span>
                              <span className="font-bold">N${totalRepayable.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-6 p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500">
                        {product.settlement}. {product.extraRow[0]}: {product.extraRow[1]}.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">{product.step2Title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{product.step2Hint}</p>
                  </div>

                  {product.id === "tender_purchase_order" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Borrower / business name</label>
                        <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Tender / agreement reference</label>
                        <input type="text" value={tenderReference} onChange={(e) => setTenderReference(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Security / collateral *</label>
                        <textarea
                          rows={3}
                          value={securityDescription}
                          onChange={(e) => setSecurityDescription(e.target.value)}
                          placeholder="Describe the security interest or collateral for this loan"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (optional)</label>
                        <input type="text" value={purposeText} onChange={(e) => setPurposeText(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                    </div>
                  )}

                  {product.requiresEmployment && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Name of employer *</label>
                        <input type="text" required value={employerName} onChange={(e) => setEmployerName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Address of employer</label>
                        <input type="text" value={employerAddress} onChange={(e) => setEmployerAddress(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation / designation</label>
                        <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly net salary (NAD) *</label>
                        <input type="number" required min={1} value={monthlyNetSalary} onChange={(e) => setMonthlyNetSalary(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Date of employment</label>
                        <input type="date" value={employmentStartDate} onChange={(e) => setEmploymentStartDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Phone number of employer</label>
                        <input type="text" value={employerPhone} onChange={(e) => setEmployerPhone(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Employer contact person</label>
                        <input type="text" value={employerContact} onChange={(e) => setEmployerContact(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Employer e-mail</label>
                        <input type="email" value={employerEmail} onChange={(e) => setEmployerEmail(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                      </div>
                    </div>
                  )}

                  {product.requiresIncomeExpenditure && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-800">Income and expenditure (N$ per month)</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Gross basic salary</label>
                          <input type="number" min={0} value={grossSalary} onChange={(e) => setGrossSalary(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Net salary (A)</label>
                          <input type="number" min={0} value={monthlyNetSalary} onChange={(e) => setMonthlyNetSalary(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Spouse’s salary net (B)</label>
                          <input type="number" min={0} value={spouseNet} onChange={(e) => setSpouseNet(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Other income net (C)</label>
                          <input type="number" min={0} value={otherIncome} onChange={(e) => setOtherIncome(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Total expenditure (E)</label>
                          <input type="number" min={0} value={totalExpenditure} onChange={(e) => setTotalExpenditure(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                        </div>
                        <div className="flex items-end">
                          <p className="text-xs text-slate-600">
                            Total net income (A+B+C): <strong>N${totalNetIncome.toLocaleString()}</strong>
                            <br />
                            Net surplus (D−E): <strong>N${netSurplus.toLocaleString()}</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {product.requiresCreditHistory && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-800">Credit history</p>
                      <p className="text-[11px] text-slate-500">Have you ever had a loan with another financial institution?</p>
                      <div className="flex flex-wrap gap-4 text-xs">
                        {([
                          ["no", "No"],
                          ["had", "Yes, I had"],
                          ["have", "Yes, I have"],
                        ] as const).map(([value, label]) => (
                          <label key={value} className="flex items-center gap-2">
                            <input type="radio" name="prior_credit" checked={hasPriorCredit === value} onChange={() => setHasPriorCredit(value)} />
                            {label}
                          </label>
                        ))}
                      </div>
                      {hasPriorCredit !== "no" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Lender’s name *</label>
                            <input type="text" value={priorLender} onChange={(e) => setPriorLender(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly instalment (NAD)</label>
                            <input type="number" min={0} value={priorInstalment} onChange={(e) => setPriorInstalment(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount outstanding (NAD)</label>
                            <input type="number" min={0} value={priorOutstanding} onChange={(e) => setPriorOutstanding(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Date of full repay</label>
                            <input type="date" value={priorRepayDate} onChange={(e) => setPriorRepayDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {product.requiresBankDetails && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-800">Bank details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Client bank name *</label>
                          <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Account name *</label>
                          <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
                          <input type="text" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Account number *</label>
                          <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Documents for {product.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {product.id === "personal_no_payslip"
                        ? "No payslip is required for this application."
                        : product.id === "tender_purchase_order"
                          ? "A purchase order (P.O.) is required for this facility."
                          : "Upload the documents from the new-client application form."}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {product.documents.map((doc) => (
                      <div key={doc.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-800">{doc.label}</span>
                          <span className="text-[10px] text-slate-400">JPG, PNG, PDF</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">{doc.hint}</p>
                        {files[doc.key] && (
                          <p className="text-[11px] text-secondary mb-1">Selected: {files[doc.key]?.name}</p>
                        )}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setFiles((prev) => ({ ...prev, [doc.key]: e.target.files?.[0] ?? null }))}
                          className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Consents & disclosures</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Required acknowledgements for {product.title}.</p>
                  </div>
                  <div className="space-y-3">
                    <ConsentBox
                      label="Data accuracy & loan contract *"
                      desc="I confirm the information is true and accurate and that I intend to enter into a loan contract with the lender if this application is approved."
                      checked={consentCredit}
                      onChange={setConsentCredit}
                    />
                    {product.requiresCreditCheckConsent && (
                      <ConsentBox
                        label="Credit background check *"
                        desc="I provide permission to TMU CashLoan CC for personal data processing, including checking my credit history with third parties — credit bureaus, databases and other information sources — and for marketing and assignment of rights if the application is approved."
                        checked={consentBureau}
                        onChange={setConsentBureau}
                      />
                    )}
                    {product.requiresEftMandate && (
                      <ConsentBox
                        label="Bank EFT / debit-order mandate *"
                        desc="I authorise payments through the computerised system provided by the Namibian banks. I acknowledge that payment instructions issued under this mandate will be treated by my bank as if issued by me personally, and that cancelling the mandate does not cancel the loan agreement."
                        checked={consentEft}
                        onChange={setConsentEft}
                      />
                    )}
                    <ConsentBox
                      label="Default & debt collection *"
                      desc="I acknowledge that in the event of default, information may be disclosed for collection, and that amounts legally owing remain payable."
                      checked={consentDebt}
                      onChange={setConsentDebt}
                    />
                    <ConsentBox
                      label="Marketing (optional)"
                      desc="I would like to receive notifications regarding loan products from TMU."
                      checked={consentMarketing}
                      onChange={setConsentMarketing}
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { setError(null); setStep((s) => s - 1); }}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 min-h-[44px]"
                >
                  ← Back
                </button>
                {step < 4 ? (
                  <button type="button" onClick={handleNext} className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg bg-secondary hover:opacity-90 text-on-secondary text-xs font-semibold min-h-[44px]">
                    Continue →
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={pending} className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg bg-tertiary hover:opacity-90 text-on-tertiary text-xs font-bold disabled:opacity-50 min-h-[44px]">
                    {pending ? "Submitting…" : `Submit ${product.title}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{value}</span>
    </div>
  );
}

function ConsentBox({
  label, desc, checked, onChange,
}: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-secondary" />
      <div className="text-xs">
        <strong className="text-slate-900 block mb-0.5">{label}</strong>
        <span className="text-slate-500 leading-relaxed">{desc}</span>
      </div>
    </label>
  );
}
