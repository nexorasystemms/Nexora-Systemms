import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { LandingFooter, LandingHeader } from "./LandingChrome";
import LoanCalculator from "./LoanCalculator";
import { Icon } from "./landingUi";
import { usePageTitle } from "../../lib/usePageTitle";

export default function LandingPage() {
  usePageTitle("TMU CashLoan CC — Fast Cash Loans in Namibia", true);
  return (
    <div data-surface="portal" id="top" className="bg-surface font-sans text-on-surface antialiased">
      <LandingHeader />
      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-80px)]">
        <Hero />
        <TrustStrip />
        <Advantages />
        <Products />
        <Steps />
        <Eligibility />
        <Branch />
        <BottomCta />
      </main>
      <LandingFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-surface-container-high/40 via-surface to-surface pb-8 pt-4">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-secondary-container/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 relative z-10">
        <div className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-surface-container-highest shadow-sm mb-4">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="font-mono text-[11px] text-primary uppercase font-bold tracking-wider">
            NAMFISA Registered Microlender · Licence No. 25/11/1138 · Usury Act Compliant
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] uppercase text-secondary font-bold tracking-widest block">
                Audited Microfinance Infrastructure
              </span>
              <h1 className="font-headline text-3xl md:text-[40px] md:leading-[48px] text-primary font-bold tracking-tight">
                Fast, Transparent Cash Loans for Working Namibians
              </h1>
            </div>
            <p className="text-base text-on-surface-variant max-w-[620px] leading-relaxed">
              Borrow from <span className="text-on-surface font-semibold">N$500</span> up to{" "}
              <span className="text-on-surface font-semibold">N$25,000</span> with strictly capped statutory
              finance charges, zero hidden initiation fees, and automated same-day EFT direct to your Namibian
              bank account.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                to="/portal/register"
                className="inline-flex items-center gap-1 px-6 py-3 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold shadow-lg shadow-primary/10 transition-all hover:-translate-y-px"
              >
                <span>Apply Online Now (3 Mins)</span>
                <Icon name="arrow_forward" className="text-[18px]" />
              </Link>
              <a
                href="#calculator"
                className="inline-flex items-center gap-1 px-6 py-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-sm font-semibold transition-colors"
              >
                <Icon name="calculate" className="text-[18px]" />
                <span>Simulate Repayments</span>
              </a>
            </div>
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Proof icon="bolt" title="< 24h Turnaround" subtitle="Automated EFT clearance" />
              <Proof icon="verified_user" title="Capped Max 30%" subtitle="Act 7/2018 Statutory limit" />
              <Proof icon="account_balance" title="Major Banks" subtitle="FNB, BW, Standard, Nedbank" />
            </div>
          </div>
          <div className="lg:col-span-5">
            <LoanCalculator />
          </div>
        </div>
      </div>
    </section>
  );
}

function Proof({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="p-2 rounded-lg bg-surface-container-lowest shadow-sm flex items-center gap-1">
      <Icon name={icon} className="text-secondary text-[22px] shrink-0" />
      <div>
        <span className="font-mono text-sm font-semibold text-on-surface block">{title}</span>
        <span className="text-xs text-on-surface-variant">{subtitle}</span>
      </div>
    </div>
  );
}

function TrustStrip() {
  return (
    <section className="w-full bg-primary text-on-primary py-6 shadow-inner">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-on-primary/10">
          <Stat kicker="Statutory Limit" value="N$ 25,000" note="Max Microlender Facility" />
          <Stat kicker="Usury Ceiling" value="30.0% Capped" note="Act 7 of 2018 Statutory Cap" />
          <Stat kicker="Disbursement" value="< 4 Hours" note="Post-Agreement Clearing" />
          <Stat
            kicker="Consumer Protection"
            value="100% Zero"
            note="No Card or PIN Retention"
            accent
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  kicker,
  value,
  note,
  accent,
}: {
  kicker: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="p-2 space-y-1">
      <span className="font-mono text-[11px] uppercase tracking-wider text-secondary-fixed block">{kicker}</span>
      <span className={`font-headline text-3xl font-bold block ${accent ? "text-secondary-container" : "text-on-primary"}`}>
        {value}
      </span>
      <span className="text-xs text-primary-fixed-dim">{note}</span>
    </div>
  );
}

function Advantages() {
  const cards = [
    {
      icon: "query_stats",
      title: "Deterministic Fair Underwriting",
      body: "Our automated Debt-Service Ratio engine benchmarks your disposable income with a strict 40% cap, safeguarding your household from predatory over-indebtedness.",
      tag: "DSR Engine 2.4",
    },
    {
      icon: "gavel",
      title: "Transparent Legal Rates",
      body: "Every single finance charge adheres strictly to Section 18 of the Microlending Act. What you calculate is exactly what you pay back. No surprise collection fees.",
      tag: "Microlending Act Cap",
    },
    {
      icon: "draw",
      title: "Digital Agreement & Instant EFT",
      body: "Sign an enforceable digital credit contract right from your mobile device or computer. Funds disburse instantly via domestic clearing directly into your local cheque or savings.",
      tag: "Namclear EFT Rail",
    },
    {
      icon: "storefront",
      title: "In-Branch or Online",
      body: "Apply 100% digitally from any town in Namibia or walk into our downtown Windhoek retail centre on Independence Avenue for face-to-face loan structuring.",
      tag: "Hybrid Branch Model",
    },
  ];

  return (
    <section id="about" className="w-full py-8 bg-surface">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 space-y-6">
        <div className="max-w-[720px] space-y-1">
          <span className="text-[11px] uppercase text-secondary font-bold tracking-widest block">
            Institutional Standards
          </span>
          <h2 className="font-headline text-3xl md:text-[40px] text-primary font-bold">
            Engineered for Mathematical Fair Play
          </h2>
          <p className="text-base text-on-surface-variant">
            Retail credit in Namibia should empower rather than burden. TMU CashLoan operates strictly under
            the legal umbrella of NAMFISA with automated safeguards built directly into our underwriting code.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="p-6 rounded-2xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                  <Icon name={card.icon} className="text-[28px]" />
                </div>
                <h3 className="font-headline text-lg font-semibold text-primary">{card.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{card.body}</p>
              </div>
              <span className="font-mono text-[11px] text-secondary font-bold uppercase tracking-wider">
                {card.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Products() {
  return (
    <section id="loans" className="w-full py-8 bg-surface-container-low">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1 max-w-[640px]">
            <span className="text-[11px] uppercase text-secondary font-bold tracking-widest block">
              Statutory Loan Classes
            </span>
            <h2 className="font-headline text-3xl md:text-[40px] text-primary font-bold">
              Tailored Facilities for Every Life Stage
            </h2>
            <p className="text-base text-on-surface-variant">
              Choose a registered financial instrument tailored to your employment contract and cashflow cycle.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-surface-container text-on-surface font-mono text-[11px]">
            <Icon name="verified" className="text-[16px] text-secondary" />
            Registered Under NAMFISA Act 7
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProductCard
            badge="1 MONTH"
            side="Payday Bridging"
            title="Payday Cash Advance"
            body="Rapid bridge capital for unexpected vehicle repairs, urgent medical fees, or family emergencies before your next scheduled salary run."
            rows={[
              ["Loan Range:", "N$ 500 – N$ 5,000"],
              ["Settlement:", "Bullet single payment"],
              ["Finance Rate:", "Max 30% Usury Ceiling"],
            ]}
            cta="Apply for Payday Advance"
            featured={false}
          />
          <ProductCard
            badge="2 TO 6 MONTHS"
            title="Short-Term Instalment"
            body="Smooth structured liquidity amortized evenly across multiple paychecks, lowering monthly pressure with equal principal balance paydowns."
            rows={[
              ["Loan Range:", "N$ 1,500 – N$ 15,000", true],
              ["Settlement:", "Equal monthly debit order"],
              ["Early Settlement:", "Zero penalty charges"],
            ]}
            cta="Apply for Instalment Loan"
            featured
          />
          <ProductCard
            badge="UP TO 12 MONTHS"
            side="Civil Service"
            title="Government & Payroll Scheme"
            body="Preferential tier for employees of Ministry of Health, Ministry of Education, Nampol, and confirmed corporate payroll agreements."
            rows={[
              ["Loan Range:", "N$ 5,000 – N$ 25,000"],
              ["Settlement:", "Payroll deduction / EFT"],
              ["Documentation:", "Government payslip"],
            ]}
            cta="Apply for Civil Payroll Facility"
            featured={false}
          />
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  badge,
  side,
  title,
  body,
  rows,
  cta,
  featured,
}: {
  badge: string;
  side?: string;
  title: string;
  body: string;
  rows: Array<[string, string] | [string, string, boolean]>;
  cta: string;
  featured: boolean;
}) {
  return (
    <div
      className={`p-6 rounded-2xl bg-surface-container-lowest flex flex-col justify-between space-y-6 relative overflow-hidden ${
        featured ? "shadow-lg" : "shadow-sm hover:shadow-md transition-shadow"
      }`}
    >
      {featured && (
        <div className="absolute top-0 right-0 bg-primary text-on-primary px-4 py-1 rounded-bl-xl font-mono text-[11px] uppercase tracking-wider font-bold">
          Most Popular
        </div>
      )}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span
            className={`px-2 py-1 rounded font-mono text-[11px] font-bold ${
              featured ? "bg-secondary-fixed text-on-secondary-fixed" : "bg-surface-container text-primary"
            }`}
          >
            {badge}
          </span>
          {side && <span className="font-mono text-sm font-bold text-on-surface">{side}</span>}
        </div>
        <div className="space-y-1">
          <h3 className="font-headline text-xl font-bold text-primary">{title}</h3>
          <p className="text-sm text-on-surface-variant">{body}</p>
        </div>
        <div className="p-4 rounded-xl bg-surface space-y-1 text-sm">
          {rows.map(([label, value, emphasize]) => (
            <div key={label} className="flex justify-between">
              <span className="text-on-surface-variant">{label}</span>
              <span
                className={`font-mono ${emphasize || (featured && label.startsWith("Loan")) ? "font-bold text-primary" : "font-medium text-on-surface"}`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
      <Link
        to="/portal/register"
        className={`w-full py-3 rounded-lg text-sm font-semibold text-center transition-all ${
          featured
            ? "bg-primary hover:bg-primary-container text-on-primary shadow-md"
            : "bg-surface-container hover:bg-surface-container-high text-primary"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function Steps() {
  const steps = [
    {
      n: "1",
      title: "Calculate & Apply",
      body: "Select your required amount and tenure on the portal. Fill in your basic identity and workplace credentials in just 3 minutes.",
      meta: "timer",
      metaLabel: "~3 Minutes",
      last: false,
    },
    {
      n: "2",
      title: "Upload 3 Documents",
      body: "Upload clear digital copies or phone photos of your Namibian ID, latest formal payslip, and official 3-month bank statement.",
      meta: "cloud_upload",
      metaLabel: "PDF or Photo",
      last: false,
    },
    {
      n: "3",
      title: "Automated Assessment",
      body: "Our platform evaluates affordability metrics in compliance with Usury Act rules. Instant notification of approval terms via SMS and email.",
      meta: "psychology",
      metaLabel: "Instant Scoring",
      last: false,
    },
    {
      n: "4",
      title: "Sign & Disburse",
      body: "Confirm and sign the statutory loan agreement on your device. Funds are pushed electronically direct to your bank account on the same day.",
      meta: "payments",
      metaLabel: "Same-Day EFT",
      last: true,
    },
  ];

  return (
    <section className="w-full py-8 bg-surface">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 space-y-6">
        <div className="text-center max-w-[680px] mx-auto space-y-1">
          <span className="text-[11px] uppercase text-secondary font-bold tracking-widest block">
            Streamlined Application
          </span>
          <h2 className="font-headline text-3xl md:text-[40px] text-primary font-bold">
            From Application to Disbursed in 4 Steps
          </h2>
          <p className="text-base text-on-surface-variant">
            No standing in winding queues. Our Nexora-powered credit engine processes documents
            deterministically with statutory compliance in real time.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => (
            <div key={step.n} className="p-6 rounded-2xl bg-surface-container-lowest shadow-sm space-y-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-lg font-bold ${
                  step.last ? "bg-secondary text-on-secondary" : "bg-primary text-on-primary"
                }`}
              >
                {step.n}
              </div>
              <h3 className="font-headline text-lg font-semibold text-primary">{step.title}</h3>
              <p className="text-sm text-on-surface-variant">{step.body}</p>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-secondary font-semibold">
                <Icon name={step.meta} className="text-[14px]" /> {step.metaLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Eligibility() {
  return (
    <section className="w-full py-8 bg-surface-container-high/30">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 space-y-6">
        <div className="max-w-[700px] space-y-1">
          <span className="text-[11px] uppercase text-secondary font-bold tracking-widest block">
            Transparent Criteria
          </span>
          <h2 className="font-headline text-3xl md:text-[40px] text-primary font-bold">
            Affordability &amp; Verification Checklist
          </h2>
          <p className="text-base text-on-surface-variant">
            In adherence to the Microlending Act, all applicants must pass our verified consumer eligibility
            requirements before disbursements can proceed.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-2xl bg-surface-container-lowest shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-surface-container">
              <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
                <Icon name="person_check" className="text-[22px]" />
              </div>
              <div>
                <h3 className="font-headline text-xl font-bold text-primary">Who is Eligible?</h3>
                <p className="text-xs text-on-surface-variant">Mandatory statutory qualifying parameters</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-on-surface">
              <CheckItem
                icon="check_circle"
                text={
                  <>
                    <strong>Namibian Citizen or Permanent Resident:</strong> Must possess a valid national
                    identity card or recognized permanent residency permit.
                  </>
                }
              />
              <CheckItem
                icon="check_circle"
                text={
                  <>
                    <strong>Age 18 Years or Older:</strong> Full legal contractual capacity under the Laws of
                    the Republic of Namibia.
                  </>
                }
              />
              <CheckItem
                icon="check_circle"
                text={
                  <>
                    <strong>Permanent Employment:</strong> Minimum 6 consecutive months with your current
                    employer, receiving verifiable salary credits.
                  </>
                }
              />
              <CheckItem
                icon="check_circle"
                text={
                  <>
                    <strong>Active Domestic Bank Account:</strong> In your own legal name with FNB, Bank
                    Windhoek, Standard Bank, Nedbank, or Trustco Bank.
                  </>
                }
              />
            </ul>
          </div>
          <div className="p-8 rounded-2xl bg-surface-container-lowest shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-surface-container">
              <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
                <Icon name="folder_shared" className="text-[22px]" />
              </div>
              <div>
                <h3 className="font-headline text-xl font-bold text-primary">What You&apos;ll Need to Submit</h3>
                <p className="text-xs text-on-surface-variant">Exact KYC &amp; earnings verification documents</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-on-surface">
              <CheckItem
                icon="assignment"
                text={
                  <>
                    <strong>Valid Identification Document:</strong> Original colored copy of your Namibian
                    National ID card, new smart card, or valid Passport.
                  </>
                }
              />
              <CheckItem
                icon="receipt_long"
                text={
                  <>
                    <strong>Latest Payslips:</strong> 1 most recent month for payday advance facilities; 3
                    consecutive months for loans exceeding N$5,000.
                  </>
                }
              />
              <CheckItem
                icon="account_balance_wallet"
                text={
                  <>
                    <strong>3-Month Bank Statements:</strong> Official stamped PDF statement from your
                    commercial bank showing salary deposits.
                  </>
                }
              />
              <CheckItem
                icon="contact_phone"
                text={
                  <>
                    <strong>Proof of Residential Address:</strong> Recent municipality bill, rental contract, or
                    police declaration not older than 3 months.
                  </>
                }
              />
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckItem({ icon, text }: { icon: string; text: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon name={icon} className="text-secondary text-[20px] shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
}

function Branch() {
  return (
    <section id="branch" className="w-full py-8 bg-surface">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8">
        <div className="p-8 rounded-3xl bg-surface-container shadow-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1">
                <span className="text-[11px] uppercase text-secondary font-bold tracking-widest block">
                  Physical Walk-In Center
                </span>
                <h2 className="font-headline text-3xl text-primary font-bold">Visit Our Windhoek Central Branch</h2>
                <p className="text-sm text-on-surface-variant">
                  Prefer speaking directly with a registered credit officer? Come visit our welcoming
                  consultation desk on Independence Avenue. Walk-ins are attended to immediately.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="font-mono text-[11px] uppercase text-on-surface-variant font-bold block">
                    Branch Location
                  </span>
                  <p className="text-sm text-on-surface font-semibold flex items-start gap-1">
                    <Icon name="pin_drop" className="text-primary text-[18px] shrink-0" />
                    TMU CashLoan CC, Shop 4, Independence Avenue, Windhoek Central, Namibia
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-mono text-[11px] uppercase text-on-surface-variant font-bold block">
                    Direct Hotline
                  </span>
                  <p className="text-sm text-primary font-bold flex items-center gap-1">
                    <Icon name="call" className="text-[18px]" />
                    +264 (61) 200 1100
                  </p>
                  <p className="text-xs text-on-surface-variant">Email: info@tmucashloan.na</p>
                </div>
                <div className="space-y-1">
                  <span className="font-mono text-[11px] uppercase text-on-surface-variant font-bold block">
                    Service Hours
                  </span>
                  <p className="text-xs text-on-surface">
                    <strong>Mon – Fri:</strong> 08:00 – 17:00 CAT
                    <br />
                    <strong>Sat:</strong> 08:30 – 12:30 CAT
                    <br />
                    <strong>Sun &amp; Holidays:</strong> Closed
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-mono text-[11px] uppercase text-error font-bold block">
                    NAMFISA Escalations
                  </span>
                  <p className="text-xs text-on-surface">
                    Statutory complaints desk:
                    <br />
                    <strong className="text-primary">0800 626 3472</strong> (Toll-Free)
                    <br />
                    <span className="text-on-surface-variant">Direct consumer protection channel</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="w-full h-72 rounded-2xl overflow-hidden relative shadow-inner bg-surface-container-high">
                <iframe
                  title="TMU CashLoan Windhoek branch map"
                  className="w-full h-full border-0 grayscale-[20%]"
                  loading="lazy"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=17.078%2C-22.575%2C17.090%2C-22.560&amp;layer=mapnik&amp;marker=-22.5678%2C17.0836"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-surface/95 backdrop-blur-md p-4 rounded-xl shadow-lg space-y-1">
                  <div className="flex items-center gap-1 text-primary font-headline text-lg">
                    <Icon name="store" className="text-[20px] text-secondary" />
                    <span>Independence Ave Retail Facility</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Wheelchair accessible · Private consultation booths · Document scanning kiosk on-site
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BottomCta() {
  return (
    <section className="w-full py-8 bg-primary text-on-primary relative overflow-hidden">
      <div className="absolute -right-20 -bottom-20 w-[450px] h-[450px] bg-secondary-container/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 relative z-10 text-center space-y-4">
        <div className="inline-flex items-center gap-1 px-4 py-1 rounded-full bg-primary-container text-secondary-fixed font-mono text-[11px]">
          <Icon name="lock" className="text-[16px]" />
          256-Bit Encrypted Statutory Banking Gateway
        </div>
        <div className="max-w-[760px] mx-auto space-y-1">
          <h2 className="font-headline text-3xl md:text-[40px] text-on-primary font-bold tracking-tight">
            Need emergency cash today? Apply online in under 3 minutes.
          </h2>
          <p className="text-base text-primary-fixed-dim">
            Immediate digital affordability assessment. Transparent statutory rates capped under NAMFISA
            License 25/11/1138.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Link
            to="/portal/register"
            className="inline-flex items-center gap-1 px-8 py-3.5 rounded-lg bg-secondary hover:bg-on-secondary-fixed text-on-secondary font-headline text-lg font-semibold shadow-xl transition-all hover:scale-[1.02]"
          >
            <span>Start Your Application Now</span>
            <Icon name="arrow_forward" className="text-[20px]" />
          </Link>
          <Link
            to="/portal/login"
            className="inline-flex items-center gap-1 px-6 py-3.5 rounded-lg bg-primary-container hover:bg-surface-container-high/20 text-on-primary text-sm font-medium transition-colors"
          >
            <Icon name="manage_accounts" className="text-[18px]" />
            <span>Track Existing Application (Sign In)</span>
          </Link>
        </div>
        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-primary-fixed-dim font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <Icon name="check" className="text-[16px] text-secondary-fixed" /> Instant Bank EFT
          </span>
          <span className="flex items-center gap-1">
            <Icon name="check" className="text-[16px] text-secondary-fixed" /> No Hidden Initiation Fees
          </span>
          <span className="flex items-center gap-1">
            <Icon name="check" className="text-[16px] text-secondary-fixed" /> Usury Act Cap Guaranteed
          </span>
        </div>
      </div>
    </section>
  );
}
