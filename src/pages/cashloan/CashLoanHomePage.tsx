import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TMU_ROOT, tmuAssets, tmuContact, tmuPortal } from "../../lib/tenants";
import { usePageTitle } from "../../lib/usePageTitle";
import { LOAN_PRODUCTS } from "../../lib/loan-products";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden>
      {name}
    </span>
  );
}

function useTmuReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll("[data-surface='tmu'] .tmu-reveal"));
    const show = (el: Element) => el.classList.add("visible");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            show(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px 80px 0px" },
    );
    elements.forEach((el) => obs.observe(el));
    const immediate = window.setTimeout(() => {
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 120) show(el);
      });
    }, 50);
    const failsafe = window.setTimeout(() => elements.forEach(show), 900);
    return () => {
      obs.disconnect();
      window.clearTimeout(immediate);
      window.clearTimeout(failsafe);
    };
  }, []);
}

export default function CashLoanHomePage() {
  usePageTitle("TMU Investments | Cash Loans", true);
  useTmuReveal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [amount, setAmount] = useState(4000);
  const [nextPay, setNextPay] = useState("");

  const namfisa = Math.round(amount * 0.0103 * 100) / 100;
  const stamp = 5;
  const interest = Math.round(amount * 0.3 * 100) / 100;
  const total = Math.round((amount + namfisa + stamp + interest) * 100) / 100;
  const payout = Math.round((amount - namfisa - stamp) * 100) / 100;

  const quoteRows = useMemo(
    () => [
      ["Total loan amount", formatN(total)],
      ["Payout amount", formatN(payout)],
      ["NAMFISA Levy (1.03%)", formatN(namfisa)],
      ["Stamp duty (N$)", formatN(stamp)],
      ["Capital (N$)", formatN(amount)],
      ["Interest (30%)", formatN(interest)],
      ["Loan Term", "1 Month"],
    ],
    [amount, interest, namfisa, payout, stamp, total],
  );

  return (
    <div data-surface="tmu" className="min-h-screen bg-background text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex h-[88px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to={TMU_ROOT} className="flex items-center h-14 shrink-0 transition-transform duration-300 hover:scale-[1.03]">
            <img src={tmuAssets.logo} alt="TMU Capital Pty Ltd" className="h-12 w-auto max-w-[240px] object-contain object-left" />
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm font-bold">
            <a href="#home" className="tmu-nav-link is-active text-primary">Home</a>
            <a href="#loans" className="tmu-nav-link text-on-surface hover:text-primary">Our services</a>
            <a href="#about" className="tmu-nav-link text-on-surface hover:text-primary">About us</a>
            <a href="#contact" className="tmu-nav-link text-on-surface hover:text-primary">Contact us</a>
            <Link
              to={tmuPortal.login}
              className="tmu-btn tmu-btn-olive ml-2 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-bold"
            >
              <span>Log in</span>
            </Link>
            <Link
              to={tmuPortal.register}
              className="tmu-btn tmu-btn-navy inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-bold"
            >
              <span>Register</span>
            </Link>
          </nav>
          <button
            type="button"
            className="lg:hidden tmu-menu-btn tmu-btn tmu-btn-gold h-11 w-11 rounded-md flex items-center justify-center"
            aria-label="Open menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span>
              <Icon name={menuOpen ? "close" : "menu"} className="text-[26px]" />
            </span>
          </button>
        </div>
        {menuOpen && (
          <div className="lg:hidden border-t border-outline-variant px-4 py-3 space-y-3 animate-fade-up">
            <a href="#loans" className="block py-2 font-bold" onClick={() => setMenuOpen(false)}>Our services</a>
            <a href="#about" className="block py-2 font-bold" onClick={() => setMenuOpen(false)}>About us</a>
            <a href="#contact" className="block py-2 font-bold" onClick={() => setMenuOpen(false)}>Contact us</a>
            <div className="flex flex-col gap-2 pt-1">
              <Link
                to={tmuPortal.login}
                className="tmu-btn tmu-btn-olive flex h-11 items-center justify-center rounded-md text-sm font-bold"
                onClick={() => setMenuOpen(false)}
              >
                <span>Log in</span>
              </Link>
              <Link
                to={tmuPortal.register}
                className="tmu-btn tmu-btn-navy flex h-11 items-center justify-center rounded-md text-sm font-bold"
                onClick={() => setMenuOpen(false)}
              >
                <span>Register</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main id="home">
        <section className="relative overflow-hidden min-h-[300px] sm:min-h-[380px] flex items-end">
          <img
            src={tmuAssets.office}
            alt=""
            className="tmu-hero-kenburns absolute inset-0 h-full w-full object-cover"
          />
          <div className="tmu-hero-overlay absolute inset-0" />
          <div className="tmu-orb bg-primary/70 h-28 w-28 -left-6 top-10" />
          <div className="tmu-orb bg-secondary/50 h-20 w-20 right-16 top-16 delay-300" />
          <div className="tmu-orb bg-primary/40 h-16 w-16 right-[18%] bottom-10 delay-500" />
          <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-16 sm:px-6 sm:pb-14">
            <p className="animate-fade-up text-xs font-bold uppercase tracking-[0.22em] text-primary">
              TMU Cash Loan CC · Namibia
            </p>
            <h1 className="tmu-display animate-fade-up delay-100 mt-3 max-w-2xl text-4xl leading-tight text-white sm:text-5xl">
              Convenient finance. <span className="tmu-gold-shimmer">Human review.</span>
            </h1>
            <p className="animate-fade-up delay-200 mt-4 max-w-xl text-sm leading-7 text-white/90 sm:text-base">
              Personal loans with no payslip, first-time applications with a credit check, and tender finance against a purchase order.
            </p>
            <div className="animate-fade-up delay-300 mt-7">
              <Link
                to={tmuPortal.register}
                className="tmu-btn tmu-btn-navy inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-bold"
              >
                <span>Create your account</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="tmu-reveal relative overflow-hidden shadow-sm animate-slide-left">
              <div className="bg-secondary text-on-secondary p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">TMU Cash Loan CC</p>
                <h2 className="tmu-display mt-2 text-3xl sm:text-4xl leading-tight">
                  About our <span className="text-primary">company</span>
                </h2>
                <div className="tmu-gold-rule mt-4" />
                <p className="mt-4 text-sm leading-7 text-white/95">
                  TMU Cash Loan is a microfinance company established in 2016 with a mission to provide convenient
                  and accessible financial solutions. We offer personal loans with no payslip, first-time applications
                  with a credit check, and tender finance that requires a purchase order.
                </p>
                <p className="mt-3 text-sm leading-7 text-white/95">
                  Apply online, upload the documents for your facility, and a person on the lending team reviews every request.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
                  <span className="tmu-chip inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
                    <Icon name="call" className="text-[18px]" />
                    {tmuContact.landline} Landline
                  </span>
                  <span className="tmu-chip inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
                    <Icon name="chat" className="text-[18px]" />
                    {tmuContact.phone} WhatsApp
                  </span>
                </div>
              </div>
            </div>

            <div id="quote" className="tmu-reveal delay-200 animate-slide-right">
              <h2 className="tmu-display text-3xl text-on-surface mb-6">Loan Details</h2>
              <div className="space-y-4">
                <label className="block text-sm font-semibold">How much do you need?</label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min={500}
                    max={250000}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    className="w-28 rounded-md border border-outline px-3 py-2 text-sm transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_rgba(237,181,12,0.25)] focus:outline-none"
                  />
                  <input
                    type="range"
                    min={500}
                    max={25000}
                    step={100}
                    value={Math.min(amount, 25000)}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                </div>
                <label className="block text-sm font-semibold">When is your next salary payment date?</label>
                <input
                  type="date"
                  value={nextPay}
                  onChange={(e) => setNextPay(e.target.value)}
                  className="w-full rounded-md border border-outline px-3 py-2.5 text-sm transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_rgba(237,181,12,0.25)] focus:outline-none"
                />
                <div className="overflow-hidden rounded-sm border border-secondary-container">
                  {quoteRows.map(([label, value]) => (
                    <div key={label} className="tmu-quote-row flex justify-between gap-4 px-4 py-3 text-sm font-semibold">
                      <span>{label}</span>
                      <span key={value} className="tmu-quote-flash">{value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-on-surface-variant">Already have an account?</p>
                <Link
                  to={tmuPortal.login}
                  className="tmu-btn tmu-btn-olive flex h-12 items-center justify-center rounded-md text-sm font-bold"
                >
                  <span>Log in</span>
                </Link>
                <p className="text-center text-xs text-on-surface-variant">OR</p>
                <Link
                  to={`${tmuPortal.register}${nextPay ? `?next_pay=${nextPay}` : ""}`}
                  className="tmu-btn tmu-btn-navy flex h-12 items-center justify-center rounded-md text-sm font-bold"
                >
                  <span>Create your account</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="loans" className="bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="tmu-reveal">
              <h2 className="tmu-display text-3xl mb-2">Our loan facilities</h2>
              <div className="tmu-gold-rule mb-4" />
              <p className="text-on-surface-variant mb-8 max-w-2xl">
                Choose the application that matches your situation. Documents and checks differ for each type.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {LOAN_PRODUCTS.map((p, i) => (
                <Link
                  key={p.id}
                  to={`${tmuPortal.apply}?product=${p.id}`}
                  className={`tmu-facility-card tmu-reveal delay-${(i + 1) * 100} bg-surface-container-lowest border border-outline-variant p-6`}
                >
                  <span className="inline-block bg-primary text-on-primary text-[11px] font-bold px-2 py-0.5 mb-3">{p.badge}</span>
                  <h3 className="tmu-display text-lg">{p.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">{p.summary}</p>
                  <p className="mt-4 text-sm font-bold text-secondary">
                    Apply for {p.title} <span className="tmu-apply-arrow">→</span>
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 grid gap-8 md:grid-cols-3">
            <div className="tmu-reveal">
              <h2 className="tmu-display text-2xl mb-3">About us</h2>
              <div className="tmu-gold-rule mb-3" />
              <p className="text-sm leading-7 text-on-surface-variant">
                Accounting &amp; financial services · Purchase order financing · Supply &amp; delivery ·
                Immigration services · Company secretarial services · Company consultancy
              </p>
            </div>
            <div className="tmu-reveal delay-100">
              <h2 className="tmu-display text-2xl mb-3">Get in touch</h2>
              <div className="tmu-gold-rule mb-3" />
              <ul className="text-sm leading-7 text-on-surface-variant space-y-1">
                <li>{tmuContact.address}</li>
                <li><a className="hover:text-primary" href={`mailto:${tmuContact.email}`}>{tmuContact.email}</a></li>
                <li><a className="hover:text-primary" href={`tel:${tmuContact.phone.replace(/\s/g, "")}`}>{tmuContact.phone}</a></li>
              </ul>
            </div>
            <div className="tmu-reveal delay-200">
              <h2 className="tmu-display text-2xl mb-3">Operating hours</h2>
              <div className="tmu-gold-rule mb-3" />
              <ul className="text-sm leading-7 text-on-surface-variant space-y-1">
                <li>Monday – Friday: 8am–17h00</li>
                <li>Saturday: 9am–13h00</li>
                <li>Sunday: Closed</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="bg-inverse-surface text-[#acacac] py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm">Copyrights © {new Date().getFullYear()} TMU Holdings Pty Ltd. All Rights Reserved.</p>
          <Link to="/" className="text-xs hover:text-primary">Powered by Nexora Systems</Link>
        </div>
      </footer>
    </div>
  );
}

function formatN(n: number) {
  return n.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
