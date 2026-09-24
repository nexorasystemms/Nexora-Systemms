"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function WelcomeMessage() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg === "welcome") {
      setMessage("Welcome to TMU CashLoan CC! Your account has been successfully verified.");
      // Clear the message after 10 seconds
      const timer = setTimeout(() => setMessage(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!message) return null;

  return (
    <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-600 text-sm">✓</span>
          </div>
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-green-800">{message}</p>
          <p className="text-xs text-green-600 mt-1">You can now apply for loans and track your applications.</p>
        </div>
        <button
          onClick={() => setMessage(null)}
          className="ml-auto text-green-400 hover:text-green-600 text-lg"
        >
          ×
        </button>
      </div>
    </div>
  );
}