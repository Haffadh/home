"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { USER_ROLES, ROOM_ROLES, LOGIN_LABELS, ROLE_DEFAULT_ROUTE, STORAGE_KEY, ACTOR_NAME } from "@/lib/roles";
import { getBaseUrl } from "@/lib/api";

const ADMIN_PASSCODE = "3866";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "users" | "rooms">("choose");
  const [tapCount, setTapCount] = useState(0);
  const [adminPrompt, setAdminPrompt] = useState(false);
  const [code, setCode] = useState("");

  async function selectRole(role: Role) {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, role);
      localStorage.setItem("shh_actor_name", ACTOR_NAME[role] || role);
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
      // Proceed without token
    }
    router.push(ROLE_DEFAULT_ROUTE[role]);
  }

  function handleHeaderClick() {
    setTapCount((c) => {
      const next = c + 1;
      if (next >= 3) { setAdminPrompt(true); return 0; }
      return next;
    });
  }

  async function handleUnlock() {
    if (code === ADMIN_PASSCODE) {
      await selectRole("admin");
      setAdminPrompt(false);
      setCode("");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1
        className="text-2xl font-bold text-white/90 tracking-tight mb-2 cursor-default select-none"
        onClick={handleHeaderClick}
      >
        Haffadh Home
      </h1>

      {step === "choose" ? (
        <>
          <p className="text-[0.9375rem] text-white/50 mb-8">Who&apos;s logging in?</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={() => setStep("users")}
              className="w-full rounded-3xl border border-white/10 bg-[#0f172a]/70 px-5 py-4 text-[1rem] font-medium text-white/90 transition-all duration-300 ease-out hover:bg-[#0f172a]/80 hover:scale-[1.02] active:scale-[0.97] flex items-center justify-between"
            >
              <span>Family Members</span>
              <span className="text-white/30">→</span>
            </button>
            <button
              type="button"
              onClick={() => setStep("rooms")}
              className="w-full rounded-3xl border border-white/10 bg-[#0f172a]/70 px-5 py-4 text-[1rem] font-medium text-white/90 transition-all duration-300 ease-out hover:bg-[#0f172a]/80 hover:scale-[1.02] active:scale-[0.97] flex items-center justify-between"
            >
              <span>Room Panels</span>
              <span className="text-white/30">→</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setStep("choose")}
            className="text-[0.8125rem] text-white/40 hover:text-white/70 transition mb-6"
          >
            ← Back
          </button>
          <p className="text-[0.9375rem] text-white/50 mb-6">
            {step === "users" ? "Select your name" : "Select a room"}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {(step === "users" ? USER_ROLES : ROOM_ROLES).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => selectRole(role)}
                className="w-full rounded-3xl border border-white/10 bg-[#0f172a]/70 px-5 py-3.5 text-[1rem] font-medium text-white/90 transition-all duration-300 ease-out hover:bg-[#0f172a]/80 hover:scale-[1.02] active:scale-[0.97]"
              >
                {LOGIN_LABELS[role]}
              </button>
            ))}
          </div>
        </>
      )}

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
              <button type="button" onClick={() => { setAdminPrompt(false); setCode(""); }}
                className="flex-1 rounded-xl border border-white/10 py-2 text-white/80">Cancel</button>
              <button type="button" onClick={handleUnlock}
                className="flex-1 bg-blue-500 rounded-xl py-2 text-white font-medium">Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
