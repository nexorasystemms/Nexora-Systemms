import { useEffect } from "react";

const BASE_TITLE = "Nexora Systems";

/**
 * Sets document.title for the current page.
 * Append-mode (default): "My Page — Nexora Systems"
 * Override mode: pass override=true to set title exactly as given.
 */
export function usePageTitle(title: string, override = false) {
  useEffect(() => {
    document.title = override ? title : `${title} — ${BASE_TITLE}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title, override]);
}
