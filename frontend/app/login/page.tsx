"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { ROLE_LABELS, ROLE_DEFAULT_ROUTE, STORAGE_KEY, VISIBLE_ROLES } from "@/lib/roles";
import { getBaseUrl } from "@/lib/api";

const ADMIN_PASSCODE = "3866";

export default function LoginPage() {
  const router = useRouter();
  const [tapCount, setTapCount] = useState(0);
  const [adminPrompt, setAdminPrompt] = useState(false);
  const [code, setCode] = useState("");

  async function selectRole(role: Role) {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, role);
    }
    try {
      const res = await fetch(`${getBaseUrl()}/auth/role-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem("token", data.accessToken);
      }
    } catch {
      // Proceed without token — API calls will fail gracefully
    }
    router.push(ROLE_DEFAULT_ROUTE[role as keyof typeof ROLE_DEFAULT_ROUTE]);
  }

  function handleHeaderClick() {
    setTapCount((c) => {
      const next = c + 1;
      if (next >= 3) {
        setAdminPrompt(true);
        return 0;
      }
      return next;
    });
  }

  async function handleUnlock() {
    if (code === ADMIN_PASSCODE) {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, "admin");
      }
      try {
        const res = await fetch(`${getBaseUrl()}/auth/role-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "admin" }),
        });
        const data = await res.json();
        if (data.accessToken) {
          localStorage.setItem("token", data.accessToken);
        }
      } catch {
        // proceed
      }
      setAdminPrompt(false);
      setCode("");
      router.push(ROLE_DEFAULT_ROUTE.admin);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1
        className="text-xl font-semibold text-white/90 tracking-tight mb-2 cursor-default select-none"
        onClick={handleHeaderClick}
      >
        Choose your panel
      </h1>
      <p className="text-[0.8125rem] text-white/50 mb-6">Select a role to continue</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {VISIBLE_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => selectRole(role)}
            className="w-full rounded-3xl border border-white/10 bg-[#0f172a]/70 px-5 py-3.5 text-[0.9375rem] font-medium text-white/90 transition-all duration-300 ease-out hover:bg-[#0f172a]/80 hover:scale-[1.02] active:scale-[0.97]"
          >
            {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
          </button>
        ))}
      </div>

      {adminPrompt && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-slate-900 p-6 rounded-2xl w-80 border border-white/10">
            <h2 className="text-lg text-white font-semibold mb-4">Enter Passcode</h2>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full text-center text-xl mb-4 rounded-xl bg-[#0f172a]/70 border border-white/10 px-3 py-2 text-white"
              placeholder="••••"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdminPrompt(false);
                  setCode("");
                }}
                className="flex-1 rounded-xl border border-white/10 py-2 text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlock}
                className="flex-1 bg-blue-500 rounded-xl py-2 text-white font-medium"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
