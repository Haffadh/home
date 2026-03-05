"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBase, getActorHeaders, withActorBody } from "../lib/api";

const API_BASE = getApiBase();

type UrgentTask = { id: number; title: string; acknowledged?: boolean; created_at?: string };

export default function FamilyPage() {
  const [title, setTitle] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<UrgentTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  const chips = useMemo(
    () => ["Clean living room", "Prepare tea", "Check bathroom supplies", "Set snacks & drinks", "Tidy kitchen"],
    []
  );

  async function refreshSent() {
    try {
      const res = await fetch(`${API_BASE}/urgent_tasks`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) return;
      setSent(data.slice(0, 10));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshSent();
  }, []);

  async function sendTask() {
    const t = title.trim();
    if (!t || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/urgent_tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getActorHeaders() },
        body: JSON.stringify(withActorBody({ title: t, assigned_to_name: "Abood" })),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Failed (${res.status})`);
      }
      setTitle("");
      await refreshSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10 bg-[#07090d]" />
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="text-2xl font-extrabold tracking-tight">Family</div>
        <div className="mt-1 text-sm text-white/55">Send a task to the iPad (Abood).</div>

        <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="text-sm font-semibold text-white/85">Send a task</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Prepare tea for guests"
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-white/20"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTitle(c)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/10"
              >
                {c}
              </button>
            ))}
          </div>

          {error ? <div className="mt-3 text-xs text-rose-200">{error}</div> : null}

          <button
            type="button"
            onClick={sendTask}
            disabled={sending || !title.trim()}
            className={[
              "mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/90 transition",
              sending ? "opacity-60" : "hover:bg-white/10",
            ].join(" ")}
          >
            {sending ? "Sending…" : "Send to iPad"}
          </button>
        </div>

        <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white/85">Last 10 sent</div>
            <button
              type="button"
              onClick={refreshSent}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {sent.length === 0 ? (
              <div className="text-sm text-white/55">No recent tasks.</div>
            ) : (
              sent.map((t) => (
                <div key={t.id} className="rounded-[16px] border border-white/10 bg-black/25 px-3 py-2">
                  <div className="text-sm font-semibold text-white/85">{t.title}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

