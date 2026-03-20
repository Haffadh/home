"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeEvent } from "../../context/RealtimeContext";
import { getApiBase } from "../../../lib/api";

type AlertData = { id: number; title: string; submittedBy?: string };

/** Generate a pleasant chime sound using Web Audio API */
function createChimeSound(): { start: () => void; stop: () => void } {
  let ctx: AudioContext | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  function playChime() {
    if (!ctx) ctx = new AudioContext();
    const now = ctx.currentTime;
    // C-E-G chord chime
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.8);
      osc.connect(gain);
      gain.connect(ctx!.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.8);
    });
  }

  return {
    start: () => {
      playChime();
      interval = setInterval(playChime, 3000);
    },
    stop: () => {
      if (interval) { clearInterval(interval); interval = null; }
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    },
  };
}

export default function UrgentAlertOverlay() {
  const [alert, setAlert] = useState<AlertData | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const chimeRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  // Listen for urgent_alert events
  useRealtimeEvent("urgent_alert", useCallback(() => {
    // The event data comes through the CustomEvent detail
  }, []));

  // More direct: listen on window for the realtime event with full payload
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.event === "urgent_alert" && detail?.id) {
        setAlert({ id: detail.id, title: detail.title || "Urgent Task", submittedBy: detail.submittedBy });
      }
      if (detail?.event === "urgent_alert_ack") {
        stopAlert();
      }
    };
    window.addEventListener("realtime", handler);
    return () => window.removeEventListener("realtime", handler);
  }, []);

  // Start/stop sound when alert changes
  useEffect(() => {
    if (alert) {
      if (!chimeRef.current) chimeRef.current = createChimeSound();
      chimeRef.current.start();
    }
    return () => {
      if (chimeRef.current) { chimeRef.current.stop(); chimeRef.current = null; }
    };
  }, [alert]);

  function stopAlert() {
    if (chimeRef.current) { chimeRef.current.stop(); chimeRef.current = null; }
    setAlert(null);
    setAcknowledging(false);
  }

  async function handleAcknowledge() {
    if (!alert || acknowledging) return;
    setAcknowledging(true);
    try {
      await getApiBase(`/api/urgent_tasks/${alert.id}/ack`, { method: "PATCH", body: {} });
    } catch { /* ignore */ }
    stopAlert();
  }

  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>
      <div className="w-full max-w-md text-center animate-modal-in">
        {/* Pulsing ring */}
        <div className="relative mx-auto mb-8 w-28 h-28">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute inset-2 rounded-full bg-amber-500/30 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
          <div className="relative flex items-center justify-center w-full h-full rounded-full bg-amber-500/20 border-2 border-amber-400/40">
            <span className="text-4xl">🔔</span>
          </div>
        </div>

        <p className="text-[0.75rem] text-amber-300/60 uppercase tracking-widest mb-2">Urgent Task</p>
        <h2 className="text-2xl font-bold text-white/95 mb-3">{alert.title}</h2>
        {alert.submittedBy && (
          <p className="text-[0.9375rem] text-white/50 mb-8">from {alert.submittedBy}</p>
        )}

        <button
          type="button"
          onClick={handleAcknowledge}
          disabled={acknowledging}
          className="w-full max-w-xs mx-auto rounded-2xl bg-amber-500/20 border-2 border-amber-400/40 py-4 px-8 text-[1.125rem] font-bold text-amber-200 hover:bg-amber-500/30 transition active:scale-[0.97] disabled:opacity-50"
        >
          {acknowledging ? "…" : "Acknowledge"}
        </button>
      </div>
    </div>
  );
}
