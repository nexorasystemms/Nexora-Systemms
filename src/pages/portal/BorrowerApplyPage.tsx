import { useState, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { submitBorrowerApplication } from "../../lib/supabase/stubs";

export default function BorrowerApplyPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [amount, setAmount] = useState<number>(3000);
  const [termMonths, setTermMonths] = useState<number>(1);
  const [productType, setProductType] = useState<"once_off" | "instalment">("once_off");
  const [nextPayDate, setNextPayDate] = useState<string>("");
  const [purposeCategory, setPurposeCategory] = useState<string>("emergency");
  const [purposeText, setPurposeText] = useState<string>("");

  // Step 2
  const [employerName, setEmployerName] = useState<string>("");
  const [occupation, setOccupation] = useState<string>("");
  const [monthlyNetSalary, setMonthlyNetSalary] = useState<number>(8500);
  const [employmentStartDate, setEmploymentStartDate] = useState<string>("");

  // Step 3
  const [idFile, setIdFile] = useState<File | null>(null);
  const [payslipFile, setPayslipFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);

  // Step 4
  const [consentCredit, setConsentCredit] = useState(true);
  const [consentBureau, setConsentBureau] = useState(true);
  const [consentDebt, setConsentDebt] = useState(true);
  const [consentMarketing, setConsentMarketing] = useState(false);

  const isShortTerm = termMonths <= 5;
  const financeCharge = isShortTerm
    ? Math.round(amount * 0.30 * 100) / 100
    : Math.round(amount * 0.1075 * 2 * (termMonths / 12) * 100) / 100;
  const totalRepayable = Math.round((amount + financeCharge) * 100) / 100;
  const monthlyInstalment = Math.round((totalRepayable / termMonths) * 100) / 100;

  function handleNext() {
    setError(null);
    if (step === 1) {
      if (amount <= 0 || amount > 100000) { setError("Loan amount must be between N$100 and N$100,000."); return; }
      if (productType === "once_off" && !nextPayDate) { setError("Please provide your next pay date for once-off payday loans."); return; }
      setStep(2);
    } else if (step === 2) {
      if (!employerName.trim()) { setError("Please provide your employer's name."); return; }
      if (monthlyNetSalary <= 0) { setError("Please enter your declared monthly net salary."); return; }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consentCredit || !consentBureau || !consentDebt) {
      setError("Please grant the required regulatory consents to submit your application.");
      return;
    }
    const formData = new FormData();
    formData.set("amount_requested", String(amount));
    formData.set("term_months", String(termMonths));
    formData.set("product_type", productType);
    if (nextPayDate) formData.set("next_pay_date", nextPayDate);
    formData.set("purpose_category", purposeCategory);
    formData.set("purpose_text", purposeText);
    formData.set("employer_name", employerName);
    formData.set("occupation", occupation);
    formData.set("monthly_net_salary", String(monthlyNetSalary));
    if (employmentStartDate) formData.set("employment_start_date", employmentStartDate);
    if (idFile) formData.set("id_document", idFile);
    if (payslipFile) formData.set("payslip_document", payslipFile);
    if (bankFile) formData.set("bank_document", bankFile);
    if (consentCredit) formData.set("consent_credit_assessment", "on");
    if (consentBureau) formData.set("consent_bureau", "on");
    if (consentDebt) formData.set("consent_debt_collection", "on");
    if (consentMarketing) formData.set("consent_marketing", "on");

    startTransition(async () => {
      try {
        await submitBorrowerApplication(formData);
        navigate("/portal");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit application.");
      }
    });
  }

  const stepLabel =
    step === 1 ? "Loan Request & Calculator"
    : step === 2 ? "Employment & Financial Details"
    : step === 3 ? "Document Verification"
    : "Consents & Final Submission";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-on-surface mb-6">Apply for a Cash Loan</h1>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Step Header */}
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Step {step} of 4: {stepLabel}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-teal-700 h-full transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="m-6 mb-0 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
          )}

          <div className="p-6 sm:p-8">
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Choose Your Loan Terms</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Transparent interest rates adhering strictly to statutory NAMFISA ceilings.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">Amount Requested (NAD)</label>
                        <span className="text-base font-extrabold text-teal-900">N${amount.toLocaleString()}</span>
                      </div>
                      <input type="range" min={500} max={25000} step={250} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full accent-teal-700" />
                      <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>N$500</span><span>N$10,000</span><span>N$25,000</span></div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Product Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["once_off", "instalment"] as const).map((pt) => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => { setProductType(pt); setTermMonths(pt === "once_off" ? 1 : 3); }}
                            className={`p-3 rounded-xl border text-left text-xs font-semibold transition ${productType === pt ? "border-teal-700 bg-teal-50/60 text-teal-900 ring-2 ring-teal-600/20" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                          >
                            <div>{pt === "once_off" ? "Once-off Payday" : "Monthly Instalment"}</div>
                            <div className="text-[10px] font-normal text-slate-500 mt-0.5">{pt === "once_off" ? "Repay in full on next pay date" : "Split across 2 to 12 months"}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {productType === "instalment" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Term (Months): {termMonths}</label>
                        <input type="range" min={2} max={12} step={1} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} className="w-full accent-teal-700" />
                        <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>2 months</span><span>6 months</span><span>12 months</span></div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Next Pay Date *</label>
                      <input type="date" required value={nextPayDate} onChange={(e) => setNextPayDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose for Loan</label>
                      <select value={purposeCategory} onChange={(e) => setPurposeCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white mb-2">
                        <option value="emergency">Family / Medical Emergency</option>
                        <option value="education">School / Tuition Fees</option>
                        <option value="vehicle">Vehicle Repair / Transport</option>
                        <option value="living_expenses">Household Expenses</option>
                        <option value="other">Other</option>
                      </select>
                      <input type="text" placeholder="Brief description (optional)" value={purposeText} onChange={(e) => setPurposeText(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue" />
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Statutory Cost Summary</div>
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                          <span className="text-slate-600">Principal Disbursed</span>
                          <span className="font-bold text-slate-900">N${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                          <div>
                            <span className="text-slate-600">Total Finance Charge</span>
                            <div className="text-[10px] text-teal-700">{isShortTerm ? "30.0% statutory cap" : "2x prime rate long-term"}</div>
                          </div>
                          <span className="font-bold text-slate-900">N${financeCharge.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-slate-300 font-extrabold text-sm text-slate-900">
                          <span>Total Amount Repayable</span>
                          <span className="text-teal-900">N${totalRepayable.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </div>
                        {productType === "instalment" && (
                          <div className="flex justify-between py-1.5 text-xs text-teal-800 bg-teal-50 p-2.5 rounded-lg border border-teal-200">
                            <span>Monthly Instalment ({termMonths}x)</span>
                            <span className="font-bold">N${monthlyInstalment.toFixed(2)} / mo</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-6 p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500">
                      🛡️ <strong>NAMFISA Compliance:</strong> TMU CashLoan CC guarantees zero hidden initiation, admin, or insurance fees beyond the quoted finance charge.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Employment & Monthly Income</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Required for our deterministic affordability assessment (Section 4.3).</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Employer Name *</label>
                    <input type="text" required placeholder="e.g. Ministry of Health / Retail Corp" value={employerName} onChange={(e) => setEmployerName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation / Job Title</label>
                    <input type="text" placeholder="e.g. Administrative Officer" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Net Take-Home Salary (NAD) *</label>
                    <input type="number" required min={1} placeholder="e.g. 8500" value={monthlyNetSalary} onChange={(e) => setMonthlyNetSalary(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue" />
                    <span className="text-[10px] text-slate-400">Amount deposited into your bank account after deductions.</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Start Date</label>
                    <input type="date" value={employmentStartDate} onChange={(e) => setEmploymentStartDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue" />
                  </div>
                </div>
                <div className="p-4 bg-teal-50/70 border border-teal-200/70 rounded-xl text-xs text-teal-900 leading-relaxed">
                  💡 <strong>Affordability Check:</strong> Based on your declared net salary of N${monthlyNetSalary.toLocaleString()}, our deterministic rules engine computes whether the proposed repayment aligns with the Debt-Service Ratio (DSR) threshold before advancing.
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Upload Verification Documents</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Upload clear photos or PDF scans. You can also upload or replace these later from your dashboard.</p>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "1. National ID or Passport Photo", state: idFile, setter: setIdFile },
                    { label: "2. Latest Monthly Payslip (or Proof of Income)", state: payslipFile, setter: setPayslipFile },
                    { label: "3. 3-Month Bank Statement", state: bankFile, setter: setBankFile },
                  ].map(({ label, state: _state, setter }) => (
                    <div key={label} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-800">{label}</span>
                        <span className="text-[10px] text-slate-400">JPG, PNG, PDF</span>
                      </div>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => setter(e.target.files?.[0] ?? null)} className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Mandatory Consents & Disclosures</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Unbundled statutory consents per the Microlending Act 7 of 2018 and POPIA design standards.</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Credit Assessment & Data Processing Consent *", desc: "I consent to TMU CashLoan CC processing my identity, employment, and income data to assess this loan application.", checked: consentCredit, setter: setConsentCredit },
                    { label: "Credit Bureau Enquiry & Performance Submission *", desc: "I authorize TMU CashLoan CC to perform credit checks with registered credit bureaus and report my loan repayment status.", checked: consentBureau, setter: setConsentBureau },
                    { label: "Default & Debt Collection Disclosure *", desc: "I acknowledge that in the event of default, information may be disclosed to legal counsel or registered debt collectors.", checked: consentDebt, setter: setConsentDebt },
                    { label: "Marketing & Future Promotions (Optional)", desc: "I would like to receive notifications regarding new loan products and rate promotions from TMU CashLoan CC.", checked: consentMarketing, setter: setConsentMarketing },
                  ].map(({ label, desc, checked, setter }) => (
                    <label key={label} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={(e) => setter(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-500" />
                      <div className="text-xs">
                        <strong className="text-slate-900 block mb-0.5">{label}</strong>
                        <span className="text-slate-500 leading-relaxed">{desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              {step > 1 ? (
                <button type="button" onClick={() => setStep((s) => s - 1)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition">← Back</button>
              ) : (
                <Link to="/portal" className="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancel</Link>
              )}
              {step < 4 ? (
                <button type="button" onClick={handleNext} className="px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition">Continue to Step {step + 1} →</button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={pending} className="px-6 py-2.5 rounded-lg bg-brand-navy hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition disabled:opacity-50">
                  {pending ? "Submitting Application..." : "Submit Application to TMU"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
