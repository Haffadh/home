"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { USER_ROLES, ROOM_ROLES, LOGIN_LABELS, ROLE_PASSWORDS, ROLE_DEFAULT_ROUTE, STORAGE_KEY, ACTOR_NAME } from "@/lib/roles";
import { getBaseUrl } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "users" | "rooms" | "password">("choose");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function handleSelect(role: Role) {
    setSelectedRole(role);
    setPassword("");
    setError(false);
    setStep("password");
  }

  async function handlePasswordSubmit() {
    if (!selectedRole) return;
    const correct = ROLE_PASSWORDS[selectedRole];
    if (password !== correct) {
      setError(true);
      return;
    }
    // Login
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, selectedRole);
      localStorage.setItem("shh_actor_name", ACTOR_NAME[selectedRole] || selectedRole);
    }
    try {
      const res = await fetch(`${getBaseUrl()}/auth/role-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem("token", data.accessToken);
        localStorage.setItem("smarthub_token", data.accessToken);
      }
    } catch { /* proceed */ }
    router.push(ROLE_DEFAULT_ROUTE[selectedRole]);
  }

  function goBack() {
    if (step === "password") {
      // Go back to the list they came from
      const isUser = selectedRole && USER_ROLES.includes(selectedRole);
      setStep(isUser ? "users" : "rooms");
      setSelectedRole(null);
      setPassword("");
      setError(false);
    } else {
      setStep("choose");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-2xl font-bold text-white/90 tracking-tight mb-2 cursor-default select-none">
        Haffadh Home
      </h1>

      {step === "choose" && (
        <>
          <p className="text-[0.9375rem] text-white/50 mb-8">Who&apos;s logging in?</p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button type="button" onClick={() => setStep("users")}
              className="w-full rounded-3xl border border-white/10 bg-[#0f172a]/70 px-5 py-4 text-[1rem] font-medium text-white/90 transition-all duration-300 ease-out hover:bg-[#0f172a]/80 hover:scale-[1.02] active:scale-[0.97] flex items-center justify-between">
              <span>Family Members</span>
              <span className="text-white/30">→</span>
            </button>
            <button type="button" onClick={() => setStep("rooms")}
              className="w-full rounded-3xl border border-white/10 bg-[#0f172a]/70 px-5 py-4 text-[1rem] font-medium text-white/90 transition-all duration-300 ease-out hover:bg-[#0f172a]/80 hover:scale-[1.02] active:scale-[0.97] flex items-center justify-between">
              <span>Room Panels</span>
              <span className="text-white/30">→</span>
            </button>
          </div>
        </>
      )}

      {(step === "users" || step === "rooms") && (
        <>
          <button type="button" onClick={goBack}
            className="text-[0.8125rem] text-white/40 hover:text-white/70 transition mb-6">← Back</button>
          <p className="text-[0.9375rem] text-white/50 mb-6">
            {step === "users" ? "Select your name" : "Select a room"}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {(step === "users" ? USER_ROLES : ROOM_ROLES).map((role) => (
              <button key={role} type="button" onClick={() => handleSelect(role)}
                className="w-full rounded-3xl border border-white/10 bg-[#0f172a]/70 px-5 py-3.5 text-[1rem] font-medium text-white/90 transition-all duration-300 ease-out hover:bg-[#0f172a]/80 hover:scale-[1.02] active:scale-[0.97]">
                {LOGIN_LABELS[role]}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "password" && selectedRole && (
        <>
          <button type="button" onClick={goBack}
            className="text-[0.8125rem] text-white/40 hover:text-white/70 transition mb-6">← Back</button>
          <p className="text-[1.125rem] font-medium text-white/80 mb-1">{LOGIN_LABELS[selectedRole]}</p>
          <p className="text-[0.8125rem] text-white/40 mb-6">Enter password</p>
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }} className="w-full max-w-xs space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="••••••"
              autoFocus
              className={`w-full text-center text-xl rounded-2xl border px-4 py-3 text-white/90 bg-[#0f172a]/70 outline-none transition ${
                error ? "border-rose-400/50 bg-rose-500/5" : "border-white/10 focus:border-white/20"
              }`}
            />
            {error && (
              <p className="text-[0.8125rem] text-rose-400/80 text-center">Incorrect password</p>
            )}
            <button type="submit"
              className="w-full rounded-2xl bg-blue-500/80 hover:bg-blue-500 py-3 text-[1rem] font-medium text-white transition">
              Login
            </button>
          </form>
        </>
      )}
    </div>
  );
}
