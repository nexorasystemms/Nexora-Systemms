import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./landingUi";

const NAV = [
  { href: "#loans", label: "Loans" },
  { href: "#calculator", label: "Repayment Calculator" },
  { href: "#compliance", label: "NAMFISA Compliance" },
  { href: "#about", label: "About Us" },
  { href: "#branch", label: "Branch Locator" },
  { href: "#contact", label: "Contact" },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-3 shrink-0">
      <img
        alt="Nexora Systems"
        className="h-8 w-auto object-contain"
        src="/brand/nexora-logo-horizontal.png"
      />
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="font-headline text-lg font-bold text-primary tracking-tight">TMU CashLoan</span>
          <span className="px-1 py-0.5 rounded-full bg-surface-container-high text-on-surface text-[11px] font-semibold">
            CC
          </span>
        </div>
        <span className="font-mono text-[11px] text-on-surface-variant">Powered by Nexora Systems</span>
      </div>
    </div>
  );
}

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-[1280px] mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
        <a href="#top" className="shrink-0">
          <BrandMark />
        </a>
        <nav className="hidden xl:flex items-center gap-1" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/portal/login"
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm text-primary hover:bg-surface-container transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/portal/register"
            className="inline-flex items-center justify-center px-6 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold shadow-[0_1px_3px_rgba(36,28,91,0.08)] transition-all"
          >
            Apply Now
          </Link>
          <Link
            to="/portal/login"
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 ml-1"
            aria-label="Sign in"
          >
            <Icon name="person" className="text-on-primary text-[18px]" />
          </Link>
          <button
            type="button"
            className="xl:hidden p-2 rounded-lg text-primary hover:bg-surface-container"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" className="xl:hidden border-t border-outline-variant/30 bg-surface px-4 py-3 space-y-1">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-lg text-sm text-on-surface hover:bg-surface-container"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer id="contact" className="w-full bg-surface-container-low text-on-surface">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-8 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img alt="" className="h-7 w-auto object-contain" src="/brand/nexora-logo-horizontal.png" />
              <span className="font-headline text-lg font-bold text-primary">TMU CashLoan CC</span>
            </div>
            <p className="text-sm text-on-surface-variant">
              Dignity-first retail micro-lending engineered for transparent credit access and statutory
              reliability across Namibia.
            </p>
            <div className="inline-flex items-center px-2 py-1 rounded-full bg-surface-container text-on-surface font-mono text-[11px]">
              NAMFISA REG: 25/11/1138
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-headline text-lg font-semibold text-primary">Corporate &amp; Contact</h4>
            <p className="text-sm text-on-surface-variant flex items-start gap-1">
              <Icon name="location_on" className="text-[18px] text-primary shrink-0" />
              Independence Avenue, Windhoek Central, Namibia
            </p>
            <p className="text-sm text-on-surface-variant flex items-center gap-1">
              <Icon name="phone" className="text-[18px] text-primary shrink-0" />
              +264 (61) 299-4000
            </p>
            <p className="text-sm text-on-surface-variant flex items-center gap-1">
              <Icon name="mail" className="text-[18px] text-primary shrink-0" />
              support@tmucashloan.com.na
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-headline text-lg font-semibold text-primary">Operating Hours</h4>
            <p className="text-sm text-on-surface-variant">
              Monday – Friday:
              <br />
              <span className="font-mono text-on-surface">08:00 – 17:00 CAT</span>
            </p>
            <p className="text-sm text-on-surface-variant">
              Saturday:
              <br />
              <span className="font-mono text-on-surface">08:30 – 12:30 CAT</span>
            </p>
            <p className="text-sm text-on-surface-variant">Sunday &amp; Public Holidays: Closed</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-headline text-lg font-semibold text-primary">Consumer Protection</h4>
            <p className="text-sm text-on-surface-variant">
              Complaints &amp; Escalation Hotline:
              <br />
              <span className="font-mono text-primary font-semibold">+264 (800) 868-227</span>
            </p>
            <p className="text-xs text-on-surface-variant">
              Direct NAMFISA Consumer Desk escalations permitted under Chapter 4 statutory provisions.
            </p>
          </div>
        </div>
        <div id="compliance" className="p-4 rounded-xl bg-surface-container-high space-y-2 mb-6">
          <div className="flex items-center gap-1 text-primary font-headline text-lg font-semibold">
            <Icon name="verified_user" className="text-[20px]" />
            <span>Statutory &amp; Regulatory Disclosures</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            TMU CashLoan CC is a registered microlender with the Namibia Financial Institutions Supervisory
            Authority (NAMFISA Registration No. 25/11/1138) operating in strict conformity with the
            Microlending Act, No. 7 of 2018, and the Usury Act, No. 73 of 1968. All loan disbursements, APR
            calculations, collection protocols, and penalty rate ceilings comply with published NAMFISA
            determinations and Bank of Namibia prime lending rate benchmarks. Credit assessments require
            verified proof of income and identity.
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/30 text-on-surface-variant text-xs">
          <p>© {new Date().getFullYear()} TMU CashLoan CC. Infrastructure engineered by Nexora Systems. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a className="hover:text-on-surface transition-colors" href="#compliance">
              Privacy Policy
            </a>
            <a className="hover:text-on-surface transition-colors" href="#compliance">
              Terms of Service
            </a>
            <a className="hover:text-on-surface transition-colors" href="#compliance">
              Statutory Filings
            </a>
            <Link className="hover:text-on-surface transition-colors" to="/login">
              Staff portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
