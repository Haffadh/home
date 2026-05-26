"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBaseUrl } from "@/lib/api";

type LoginResponse = {
  ok: boolean;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { id: number | string; name: string; email: string; role: string };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data: LoginResponse = await res.json();
      if (!res.ok || !data.accessToken || !data.user) {
        setError(data.error || "Login failed");
        return;
      }
      localStorage.setItem("smarthub_token", data.accessToken);
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("shh_user_id", String(data.user.id));
      localStorage.setItem("shh_user_name", data.user.name);
      localStorage.setItem("shh_role", data.user.role);
      router.push(data.user.role === "admin" ? "/panel/admin" : "/panel/abdullah");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 bg-slate-900/60 rounded-2xl p-6 border border-white/5">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-white/50">Use your email and password.</p>
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wide text-white/40">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-white outline-none focus:border-blue-400"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wide text-white/40">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-white outline-none focus:border-blue-400"
          />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white transition"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
