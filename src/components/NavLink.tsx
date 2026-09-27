import { Link, useLocation } from "react-router-dom";

export default function NavLink({
  href, icon, label, badge,
}: { href: string; icon: string; label: string; badge?: string | number | null }) {
  const location = useLocation();
  const active = location.pathname === href || location.pathname.startsWith(href + "/");

  return (
    <Link
      to={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-between gap-space-sm px-space-md py-space-sm rounded transition-colors duration-150 ${
        active
          ? "bg-primary-container text-on-primary font-semibold shadow-sm"
          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
      }`}
    >
      <span className="flex items-center gap-space-sm">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        <span className="text-[13px] font-semibold">{label}</span>
      </span>
      {badge != null && (
        <span className="font-mono text-[11px] bg-surface-container-lowest/70 px-space-xs rounded">{badge}</span>
      )}
    </Link>
  );
}
