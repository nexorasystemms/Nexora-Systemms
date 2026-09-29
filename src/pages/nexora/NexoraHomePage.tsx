import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../../lib/usePageTitle";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Agent {
  id: string;
  name: string;
  roleId: string;
  category: "support" | "revenue" | "finance" | "operations";
  description: string;
  tags: string[];
  icon: string;
  color: string;
  bgImage: string;
}

/* ─── Data ───────────────────────────────────────────────────────────────── */
const AGENTS: Agent[] = [
  {
    id: "receptionist",
    name: "AI Receptionist",
    roleId: "NX-REC-01",
    category: "support",
    description:
      "Greets callers and visitors, routes calls, answers Tier-1 FAQs, schedules executive appointments, and manages front-desk communications 24/7.",
    tags: ["Voice IVR", "Calendar Sync", "VIP Routing", "Visitor Logs"],
    icon: "support_agent",
    color: "#1e40af",
    bgImage: "/agents/ai-receptionist.png",
  },
  {
    id: "support",
    name: "Customer Support",
    roleId: "NX-SUP-02",
    category: "support",
    description:
      "Resolves omnichannel support tickets across email, WhatsApp, and live chat. Diagnoses issues, processes returns, and escalates edge cases seamlessly.",
    tags: ["Multi-Language", "CRM Sync", "SLA 15s", "Sentiment Track"],
    icon: "forum",
    color: "#1e40af",
    bgImage: "/agents/customer-support.png",
  },
  {
    id: "sales",
    name: "Autonomous Sales",
    roleId: "NX-SLS-03",
    category: "revenue",
    description:
      "Engages inbound web leads in real-time, qualifies budget and decision authority, conducts customized email discovery sequences, and books direct calendar demos.",
    tags: ["Lead Scoring", "Outreach Engine", "CRM Enrichment", "Pipeline Sync"],
    icon: "trending_up",
    color: "#00563a",
    bgImage: "/agents/autonomous-sales.jpg",
  },
  {
    id: "booking",
    name: "Booking Coordinator",
    roleId: "NX-BKG-04",
    category: "operations",
    description:
      "Eliminates scheduling friction for healthcare clinics, consulting practices, and service providers. Sends SMS reminders and coordinates cancellations.",
    tags: ["Calendar Protocol", "SMS Reminders", "Reschedule Bot", "Deposit Intake"],
    icon: "calendar_month",
    color: "#565e74",
    bgImage: "/agents/booking-coordinator.jpg",
  },
  {
    id: "finance",
    name: "Finance & Arrears",
    roleId: "NX-FIN-05",
    category: "finance",
    description:
      "Automates accounts receivable, matches bank reconciliation statements, flags invoice anomalies, and generates statutory NAMFISA and tax audit cashflows.",
    tags: ["Reconciliation", "Statutory Audit", "Arrears Tracking", "Auto-Invoicing"],
    icon: "receipt_long",
    color: "#003d28",
    bgImage: "/agents/finance-arrears.jpg",
  },
  {
    id: "operations",
    name: "Operations Overseer",
    roleId: "NX-OPS-06",
    category: "operations",
    description:
      "Coordinates internal SOP workflows, verifies vendor regulatory compliance, tracks supply chain logistics, and enforces organizational operational checklists.",
    tags: ["ERP Integration", "Document OCR", "Exception Alerts", "Task Dispatch"],
    icon: "schema",
    color: "#565e74",
    bgImage: "/agents/operations-overseer.jpg",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Agents" },
  { id: "support", label: "Support" },
  { id: "revenue", label: "Revenue" },
  { id: "finance", label: "Finance" },
  { id: "operations", label: "Operations" },
];

const INDUSTRIES = [
  { icon: "account_balance", name: "Financial Services", desc: "Microlending, credit scoring, compliance reporting, arrears tracking.", bgImage: "/Financial Services.jpg" },
  { icon: "local_hospital", name: "Healthcare", desc: "Appointment booking, patient intake, insurance pre-auth, after-hours triage.", bgImage: "/Healthcare.jpg" },
  { icon: "storefront", name: "Retail & E-Commerce", desc: "Order tracking, returns automation, inventory queries, loyalty management.", bgImage: "/Retail & E-Commerce.jpg" },
  { icon: "gavel", name: "Legal & Compliance", desc: "Document review, contract drafting support, regulatory filings, matter tracking.", bgImage: "/Legal & Compliance.jpg" },
  { icon: "engineering", name: "Professional Services", desc: "Client onboarding, time-tracking, project coordination, invoice generation.", bgImage: "/Professional Services.jpg" },
  { icon: "school", name: "Education", desc: "Admissions enquiries, fee management, timetabling, parent communication.", bgImage: "/Education.jpg" },
];

/* ─── Scroll-reveal hook ─────────────────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px 50px 0px" }
    );
    elements.forEach((el) => obs.observe(el));

    // Instant safety fallback: make elements in initial viewport visible immediately
    const timer = setTimeout(() => {
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 100 && rect.bottom > -100) {
          el.classList.add("visible");
        }
      });
    }, 100);

    return () => {
      obs.disconnect();
      clearTimeout(timer);
    };
  }, []);
  return ref;
}

/* ─── Icon helper ─────────────────────────────────────────────────────────── */
function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden>{name}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */
function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "#catalogue", label: "AI Employees" },
    { href: "#transformation", label: "Solutions" },
    { href: "#industries", label: "Industries" },
    { href: "#architecture", label: "Security" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-md shadow-black/5 border-b border-gray-100"
          : "bg-transparent border-b border-white/10"
      }`}
    >
      <div className="h-20 w-full px-4 md:px-8 flex items-center justify-between gap-4">
        {/* Prominent Logo */}
        <Link to="/" className="flex items-center shrink-0 group">
          <img
            src="/brand/nexora-brand-mark.png"
            onError={(e) => { (e.target as HTMLImageElement).src = "/brand/nexora-mark.png"; }}
            alt="Nexora Systems"
            className="h-10 sm:h-12 w-auto object-contain max-h-12 shrink-0 transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`nav-link-animated px-3.5 py-2 text-[14px] font-medium rounded-lg transition-colors ${
                scrolled
                  ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  : "text-white/85 hover:text-white hover:bg-white/10"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA group */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#contact"
            className="hidden sm:inline-flex items-center gap-1.5 h-10 px-5 text-[13px] font-semibold text-on-primary bg-primary hover:bg-primary-container rounded-lg shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/25 transition-all hover:-translate-y-px"
          >
            Book a Demo
            <Icon name="arrow_forward" className="text-[14px]" />
          </a>
          {/* Hamburger Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`lg:hidden p-2.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              scrolled ? "text-gray-800 hover:bg-gray-100" : "text-white hover:bg-white/15"
            }`}
            aria-label="Toggle Navigation Menu"
          >
            <Icon name={mobileOpen ? "close" : "menu"} className="text-[26px]" />
          </button>
        </div>
      </div>

      {/* Mobile drawer navigation */}
      {mobileOpen && (
        <div className={`lg:hidden border-t px-4 py-5 space-y-2 shadow-2xl animate-fade-up ${
          scrolled ? "bg-white border-gray-100 text-gray-900" : "bg-slate-950/95 backdrop-blur-xl border-white/10 text-white"
        }`}>
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center px-4 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                  scrolled ? "text-gray-800 hover:bg-gray-100" : "text-white/90 hover:bg-white/10"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className={`pt-4 border-t space-y-2.5 ${scrolled ? "border-gray-100" : "border-white/10"}`}>
            <a
              href="#contact"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-on-primary text-[14px] font-semibold transition-colors hover:bg-primary-container"
            >
              Book a Demo →
            </a>
          </div>
        </div>
      )}
    </header>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section className="relative w-full overflow-hidden min-h-[85vh] flex flex-col justify-center pt-36 md:pt-48 pb-32 md:pb-48">
      {/* ── Hero background image ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero-background.jpg')" }}
        aria-hidden="true"
      />
      {/* Dark gradient overlay — keeps text readable over the photo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,20,45,0.85) 0%, rgba(5,20,45,0.65) 45%, rgba(5,20,45,0.78) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 flex flex-col items-center text-center my-auto">
        {/* Main headline */}
        <h1 className="animate-fade-up delay-100 max-w-4xl text-[40px] sm:text-[52px] md:text-[64px] leading-[1.05] font-bold tracking-tight text-white mb-6">
          Your AI Business Workforce.{" "}
          <span className="text-shimmer">Built for Real Work.</span>
        </h1>

        {/* Sub-headline */}
        <p className="animate-fade-up delay-200 max-w-2xl text-[16px] md:text-[18px] text-white/80 leading-relaxed mb-10">
          NEXORA equips enterprise organisations with autonomous AI agents that execute
          Tier-1 customer service, high-velocity sales, underwriting, and routine operational
          workflows — operating <strong className="text-white font-semibold">24 / 7</strong> alongside your human team.
        </p>

        {/* CTA buttons */}
        <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center gap-3">
          <a
            href="#catalogue"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[15px] font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
          >
            <Icon name="smart_toy" className="text-[18px]" />
            Hire an AI Employee
            <Icon name="arrow_forward" className="text-[16px]" />
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white/10 backdrop-blur-sm border border-white/30 text-white text-[15px] font-medium hover:bg-white/20 hover:border-white/50 transition-all hover:-translate-y-0.5 shadow-sm"
          >
            <Icon name="play_circle" className="text-[18px] text-white/80" />
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFORMATION / ARCHITECTURE FLOW
   ═══════════════════════════════════════════════════════════════════════════ */
function TransformationSection() {
  const ref = useReveal();
  return (
    <section id="transformation" className="w-full bg-surface-container-low py-20 border-y border-outline-variant/30">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div ref={ref} className="reveal text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-3 px-3 py-1 bg-surface-container rounded-full border border-outline-variant/40">
            System Architecture
          </span>
          <h2 className="text-[32px] md:text-[40px] font-bold text-on-surface leading-tight tracking-tight">
            From Fragmented Silos to Unified Autonomous Execution
          </h2>
          <p className="mt-3 text-[15px] text-on-surface-variant leading-relaxed">
            Nexora connects your existing business systems to a deterministic AI core — then delivers verified, audit-trailed output at machine speed.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
          {/* Input sources */}
          <FlowNode
            delay="delay-100"
            cols="lg:col-span-3"
            label="Input Sources"
            status={{ dot: "bg-tertiary", text: "CONNECTED", color: "text-tertiary" }}
            title="Your Business Ecosystem"
            subtitle="Ingests raw signals from your everyday enterprise stacks via secured API webhooks."
            items={[
              { icon: "hub", label: "CRM & ERPs" },
              { icon: "mail", label: "Email & Tickets" },
              { icon: "chat", label: "WhatsApp / SMS" },
              { icon: "account_balance", label: "Bank Feeds" },
            ]}
          />

          {/* Arrow */}
          <FlowArrow />

          {/* Core engine */}
          <div className="reveal delay-300 lg:col-span-3 flex flex-col gap-3 bg-primary p-6 rounded-2xl shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-primary-fixed/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary-fixed/50 to-transparent" />
            <div className="flex items-center justify-between mb-1 relative z-10">
              <span className="font-mono text-[11px] uppercase tracking-widest text-on-primary-container font-bold">Secure Middleware</span>
              <span className="bg-tertiary text-on-tertiary font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">AES-256</span>
            </div>
            <div className="relative z-10">
              <img src="/brand/nexora-mark.png" alt="" className="h-8 w-8 mb-2 opacity-90" />
              <h3 className="text-[18px] font-bold text-on-primary leading-tight">NEXORA Core Engine</h3>
              <p className="text-[12px] text-on-primary-container mt-1 leading-relaxed">
                Deterministic business rules, isolated tenant reasoning loops, and continuous compliance checks.
              </p>
            </div>
            <div className="space-y-2 relative z-10 mt-auto">
              {[
                ["Multi-Tenant Vault", "ISOLATED"],
                ["Deterministic Guardrails", "ENFORCED"],
                ["Human Escalation Gate", "STANDBY"],
              ].map(([label, badge]) => (
                <div key={label} className="bg-primary-container/40 px-3 py-2 rounded-lg flex items-center justify-between">
                  <span className="text-[12px] text-on-primary font-medium">{label}</span>
                  <span className="font-mono text-[10px] text-tertiary-fixed font-bold">{badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <FlowArrow />

          {/* Output */}
          <FlowNode
            delay="delay-500"
            cols="lg:col-span-3"
            label="Verified Output"
            status={{ dot: "bg-tertiary", text: "ACTIVE 24/7", color: "text-tertiary font-bold" }}
            title="AI Workforce Execution"
            subtitle="Instant customer resolution, booked revenue, bank reconciliation, and automated filing."
            items={[
              { icon: "task_alt", label: "SLA Resolution", value: "< 14 sec" },
              { icon: "verified", label: "Audit Trail", value: "100% Immutable" },
              { icon: "trending_up", label: "Cost Savings", value: "68% Avg" },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function FlowArrow() {
  return (
    <div className="lg:col-span-1 flex flex-col lg:flex-row items-center justify-center py-2 lg:py-0">
      <div className="hidden lg:flex items-center w-full justify-center">
        <div className="h-0.5 flex-1 bg-gradient-to-r from-outline-variant/40 to-primary/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary w-8 animate-[shimmer_1.5s_linear_infinite]" />
        </div>
        <Icon name="chevron_right" className="text-primary -ml-1 text-[24px]" />
      </div>
      <div className="lg:hidden">
        <Icon name="keyboard_arrow_down" className="text-primary text-[30px]" />
      </div>
    </div>
  );
}

function FlowNode({
  delay, cols, label, status, title, subtitle, items,
}: {
  delay: string; cols: string; label: string;
  status: { dot: string; text: string; color: string };
  title: string; subtitle: string;
  items: { icon: string; label: string; value?: string }[];
}) {
  return (
    <div className={`reveal ${delay} ${cols} flex flex-col gap-3 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-secondary font-bold">{label}</span>
        <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] ${status.color}`}>
          <span className={`w-2 h-2 rounded-full ${status.dot}`} />{status.text}
        </span>
      </div>
      <div>
        <h3 className="text-[16px] font-bold text-on-surface">{title}</h3>
        <p className="text-[12px] text-on-surface-variant mt-1 leading-relaxed">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-2 mt-auto">
        {items.map((item) => (
          <div key={item.label} className="bg-surface-container p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name={item.icon} className="text-primary text-[17px]" />
              <span className="text-[12px] font-semibold text-on-surface">{item.label}</span>
            </div>
            {item.value && <span className="font-mono text-[11px] text-primary font-bold">{item.value}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGENT CATALOGUE
   ═══════════════════════════════════════════════════════════════════════════ */
function AgentCatalogue() {
  const [filter, setFilter] = useState("all");
  const ref = useReveal();

  const filtered = filter === "all" ? AGENTS : AGENTS.filter((a) => a.category === filter);

  const handleHire = (roleId: string) => {
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
    console.log("Hiring:", roleId);
  };

  return (
    <section id="catalogue" className="w-full py-20 bg-surface">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div ref={ref} className="reveal flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <span className="inline-block font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-3 px-3 py-1 bg-surface-container rounded-full border border-outline-variant/40">
              AI Employee Catalogue
            </span>
            <h2 className="text-[32px] md:text-[40px] font-bold text-on-surface leading-tight tracking-tight">
              Six Autonomous Roles. One Platform.
            </h2>
            <p className="mt-3 text-[15px] text-on-surface-variant leading-relaxed">
              Deploy pre-trained AI staff in under 48 hours. Every agent operates with full audit trails,
              human escalation paths, and tenant isolation.
            </p>
          </div>
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${
                  filter === cat.id
                    ? "bg-primary text-on-primary border-primary shadow-sm shadow-primary/20"
                    : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/60 hover:border-outline-variant hover:bg-surface-container"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((agent, i) => (
            <div
              key={agent.id}
              className={`reveal delay-${(i % 3) * 100 + 100} group relative rounded-2xl overflow-hidden flex flex-col justify-between border border-outline-variant/30 shadow-xl min-h-[420px] p-5`}
            >
              {/* Vibrant Full-Color Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: `url('${agent.bgImage}')` }}
                aria-hidden="true"
              />

              {/* Light gradient for background image contrast */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"
                aria-hidden="true"
              />

              {/* Bottom Translucent Light Glassmorphic Content Card */}
              <div className="relative z-10 mt-auto bg-black/10 backdrop-blur-md p-4 rounded-xl border border-white/15 shadow-sm space-y-3">
                {/* Title & Description */}
                <div>
                  <h3 className="text-[19px] font-bold text-white mb-1 leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{agent.name}</h3>
                  <p className="text-[12px] text-white/95 leading-relaxed font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{agent.description}</p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {agent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-mono font-semibold text-white bg-white/25 backdrop-blur-sm border border-white/30 px-2 py-0.5 rounded-full drop-shadow-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* CTA Button */}
                <div className="pt-1">
                  <button
                    onClick={() => handleHire(agent.roleId)}
                    className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all bg-primary hover:bg-primary-container text-on-primary shadow-md shadow-primary/30 flex items-center justify-center gap-2 hover:-translate-y-0.5"
                  >
                    Hire {agent.name} →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



/* ═══════════════════════════════════════════════════════════════════════════
   INDUSTRIES
   ═══════════════════════════════════════════════════════════════════════════ */
function Industries() {
  const ref = useReveal();
  return (
    <section id="industries" className="w-full py-20 bg-surface">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div ref={ref} className="reveal text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-3 px-3 py-1 bg-surface-container rounded-full border border-outline-variant/40">
            Industry Coverage
          </span>
          <h2 className="text-[32px] md:text-[40px] font-bold text-on-surface leading-tight tracking-tight">
            Deployed Across Six Sectors
          </h2>
          <p className="mt-3 text-[15px] text-on-surface-variant leading-relaxed">
            Nexora agents are pre-trained on sector-specific compliance requirements, terminology, and escalation protocols.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {INDUSTRIES.map((ind, i) => (
            <div
              key={ind.name}
              className={`reveal delay-${(i % 3) * 100 + 100} group relative rounded-2xl overflow-hidden flex flex-col justify-end border border-outline-variant/30 shadow-xl min-h-[280px] p-5 transition-all cursor-default`}
            >
              {/* Vibrant Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: `url('${ind.bgImage}')` }}
                aria-hidden="true"
              />

              {/* Dark Gradient Overlay - Ultra Light */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"
                aria-hidden="true"
              />

              {/* Ultra-Light Sheer Glass Content Card */}
              <div className="relative z-10 mt-auto bg-black/5 backdrop-blur-md p-4.5 rounded-xl border border-white/15 shadow-sm">
                <h3 className="text-[18px] font-bold text-white mb-1.5 leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{ind.name}</h3>
                <p className="text-[13px] text-white/95 leading-relaxed font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{ind.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECURITY / ARCHITECTURE
   ═══════════════════════════════════════════════════════════════════════════ */
function SecuritySection() {
  const ref = useReveal();
  const pillars = [
    { icon: "lock", title: "Zero Data Leakage", desc: "Every tenant operates in a fully isolated execution context. Model weights, conversation history, and business data never cross tenant boundaries.", badge: "ISO 27001 Aligned" },
    { icon: "verified_user", title: "Immutable Audit Trails", desc: "Every AI action is logged to a tamper-evident ledger with SHA-256 hash chaining. Full auditability for regulatory review at any time.", badge: "SHA-256 Hash Chain" },
    { icon: "policy", title: "Deterministic Guardrails", desc: "Business rules are enforced at the engine level — not the model level — ensuring consistent, predictable behaviour regardless of input variation.", badge: "Rules Engine v2.4" },
    { icon: "supervised_user_circle", title: "Human-in-the-Loop", desc: "Every escalation path is designed before deployment. AI agents know their limits and route to human agents with full context preservation.", badge: "99.2% Escalation SLA" },
  ];

  return (
    <section id="architecture" className="w-full py-20 bg-surface-container-low">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div ref={ref} className="reveal text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-3 px-3 py-1 bg-surface-container-lowest rounded-full border border-outline-variant/40">
            Enterprise Security
          </span>
          <h2 className="text-[32px] md:text-[40px] font-bold text-on-surface leading-tight tracking-tight">
            Enterprise-Grade Security. No Compromises.
          </h2>
          <p className="mt-3 text-[15px] text-on-surface-variant leading-relaxed">
            Nexora was architected for regulated industries from the ground up — not retrofitted with security as an afterthought.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {pillars.map((p, i) => (
            <div key={i} className={`reveal delay-${i * 100 + 100} group p-7 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/20 hover:shadow-lg transition-all`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-fixed/40 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:shadow-md group-hover:shadow-primary/20 transition-all">
                  <Icon name={p.icon} className="text-primary group-hover:text-on-primary text-[22px] transition-colors" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[15px] font-bold text-on-surface">{p.title}</h3>
                  </div>
                  <p className="text-[13px] text-on-surface-variant leading-relaxed">{p.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Multi-Tenant Private Cloud Architecture Banner */}
        <div className="reveal p-8 rounded-2xl bg-surface-container-lowest border border-primary/20 shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
                Multi-Tenant Isolation Architecture
              </span>
            </div>
            <h3 className="text-[20px] font-bold text-on-surface">Your Business Data Remains 100% Private &amp; Isolated</h3>
            <p className="text-[14px] text-on-surface-variant leading-relaxed">
              Nexora operates as a dedicated multi-tenant platform. Every client receives an isolated private environment — your business information, customer records, proprietary workflows, and AI agent memory are strictly accessible only to your authorized team and verified administrators.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}



/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT / DEMO REQUEST
   ═══════════════════════════════════════════════════════════════════════════ */
function ContactSection() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [role, setRole] = useState("customer-support");
  const ref = useReveal();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ref = "NX-REQ-" + Math.floor(100000 + Math.random() * 900000);
    setSubmitted(ref);
  };

  return (
    <section id="contact" className="w-full py-20 bg-surface relative overflow-hidden">
      <div className="absolute -top-40 right-0 w-72 h-72 bg-primary-fixed/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-0 w-48 h-48 bg-tertiary-fixed/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8">
        <div ref={ref} className="reveal text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-3 px-3 py-1 bg-surface-container rounded-full border border-outline-variant/40">
            Get Started
          </span>
          <h2 className="text-[32px] md:text-[40px] font-bold text-on-surface leading-tight tracking-tight">
            Book Your Architecture Session
          </h2>
          <p className="mt-3 text-[15px] text-on-surface-variant leading-relaxed">
            Tell us which agent role you want to deploy first. Our team will map a 48-hour deployment plan to your specific workflow.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {submitted ? (
            <div className="reveal text-center py-16 px-8 rounded-2xl bg-surface-container-lowest border border-tertiary/20 shadow-lg">
              <div className="w-16 h-16 rounded-full bg-tertiary-fixed/30 flex items-center justify-center mx-auto mb-5">
                <Icon name="check_circle" className="text-tertiary text-[32px]" />
              </div>
              <h3 className="text-[22px] font-bold text-on-surface mb-2">Request Received</h3>
              <p className="text-[14px] text-on-surface-variant mb-4">Our architects will respond within 4 business hours.</p>
              <span className="font-mono text-[13px] text-primary font-bold bg-primary-fixed/30 px-4 py-2 rounded-full border border-primary/20">
                Reference: {submitted}
              </span>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="reveal bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 md:p-8 shadow-sm space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField label="Full Name" name="name" placeholder="Jane Smith" required />
                <FormField label="Email Address" name="email" type="email" placeholder="jane@company.com" required />
                <FormField label="Company / Organisation" name="company" placeholder="Acme Corp Ltd" required />
                <FormField label="Phone Number" name="phone" type="tel" placeholder="+264 81 000 0000" />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-on-surface mb-1.5">
                  Agent Role of Interest <span className="text-error">*</span>
                </label>
                <select
                  name="agent_role"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-outline-variant/60 bg-surface text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                >
                  <option value="receptionist">AI Receptionist (NX-REC-01)</option>
                  <option value="customer-support">Customer Support Agent (NX-SUP-02)</option>
                  <option value="sales-outreach">Autonomous Sales Agent (NX-SLS-03)</option>
                  <option value="booking">Booking Coordinator (NX-BKG-04)</option>
                  <option value="finance-arrears">Finance &amp; Arrears Agent (NX-FIN-05)</option>
                  <option value="operations-ocr">Operations Overseer (NX-OPS-06)</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-on-surface mb-1.5">Message (Optional)</label>
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Briefly describe your current workflow or challenge..."
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/60 bg-surface text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[15px] font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Icon name="send" className="text-[18px]" />
                Submit Request — Response in 4 Hours
              </button>

              <p className="text-[11px] text-on-surface-variant text-center">
                No commitment required. We will scope your deployment and provide a fixed-price proposal.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function FormField({
  label, name, type = "text", placeholder, required,
}: {
  label: string; name: string; type?: string; placeholder: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-on-surface mb-1.5">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-xl border border-outline-variant/60 bg-surface text-[13px] text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="bg-surface-container-lowest border-t border-outline-variant/30">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 items-start mb-12">
          {/* Brand */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center gap-3 h-8">
              <img src="/brand/nexora-mark.png" alt="Nexora" className="h-8 w-auto" />
            </div>
            <p className="text-[13px] text-on-surface-variant leading-relaxed max-w-xs">
              Autonomous AI workforce infrastructure for enterprise organisations.
            </p>
          </div>

          {/* Product */}
          <div className="flex flex-col space-y-3">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-on-surface-variant h-8 flex items-center">
              Product
            </h4>
            <a href="#catalogue" className="text-[13px] text-on-surface-variant hover:text-primary transition-colors">AI Employee Catalogue</a>
            <a href="#transformation" className="text-[13px] text-on-surface-variant hover:text-primary transition-colors">Architecture Overview</a>
            <a href="#architecture" className="text-[13px] text-on-surface-variant hover:text-primary transition-colors">Security &amp; Compliance</a>
          </div>

          {/* Tenants */}
          <div className="flex flex-col space-y-3">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-on-surface-variant h-8 flex items-center">
              Live Tenants
            </h4>
            <Link to="/tmu" className="inline-flex items-center gap-2 text-[13px] text-on-surface-variant hover:text-primary transition-colors group">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary shrink-0 group-hover:scale-125 transition-transform" />
              TMU Investments — Cash Loans
            </Link>
            <p className="text-[12px] text-on-surface-variant/60 italic pt-1">More tenants launching Q3 2026</p>
          </div>

          {/* Links */}
          <div className="flex flex-col space-y-3">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-on-surface-variant h-8 flex items-center">
              Platform
            </h4>
            <Link to="/portal/login" className="text-[13px] text-on-surface-variant hover:text-primary transition-colors">Borrower Portal</Link>
            <a href="#contact" className="text-[13px] text-on-surface-variant hover:text-primary transition-colors">Book a Demo</a>
            <a href="mailto:info@nexorasystems.solutions" className="text-[13px] text-primary hover:underline transition-colors pt-1 flex items-center gap-1.5">
              <Icon name="mail" className="text-[15px]" />
              info@nexorasystems.solutions
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-outline-variant/30 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-on-surface-variant">
          <span>© 2026 Nexora Systems (Pty) Ltd. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-on-surface transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-on-surface transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-on-surface transition-colors">Security Overview</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE ROOT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function NexoraHomePage() {
  usePageTitle("Nexora Systems — Enterprise Autonomous AI Workforce", true);
  return (
    <div data-surface="admin" className="min-h-screen bg-surface text-on-surface antialiased">
      <NavBar />
      <main>
        <Hero />
        <TransformationSection />
        <AgentCatalogue />
        <Industries />
        <SecuritySection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
