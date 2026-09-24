"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function WelcomeMessage() {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const isWelcome = searchParams.get("message") === "welcome";

  useEffect(() => {
    if (!isWelcome) return;
    // Clear the message after 10 seconds
    const timer = setTimeout(() => setDismissed(true), 10000);
    return () => clearTimeout(timer);
  }, [isWelcome]);

  if (!isWelcome || dismissed) return null;

  return (
    <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-600 text-sm">✓</span>
          </div>
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-green-800">
            Welcome to TMU CashLoan CC! Your account has been successfully verified.
          </p>
          <p className="text-xs text-green-600 mt-1">You can now apply for loans and track your applications.</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-auto text-green-400 hover:text-green-600 text-lg"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}