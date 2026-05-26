"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to browser console for debugging
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-white/10 bg-[#0f172a]/70 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-white/95">Something broke</h1>
        <p className="text-[0.8125rem] text-white/60">
          A client-side error occurred. The details below help diagnose it — screenshot this
          and share to get it fixed.
        </p>
        <pre className="text-[0.75rem] text-rose-300/90 bg-rose-500/[0.08] border border-rose-500/20 rounded-xl p-3 overflow-auto whitespace-pre-wrap break-words max-h-64">
          {error.name}: {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90 hover:bg-white/15 transition"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.clear();
              } catch {
                // ignore
              }
              window.location.href = "/login";
            }}
            className="flex-1 rounded-xl border border-white/10 bg-[#0f172a] px-4 py-2.5 text-[0.8125rem] font-medium text-white/80 hover:text-white transition"
          >
            Reset &amp; sign out
          </button>
        </div>
      </div>
    </div>
  );
}
