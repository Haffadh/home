"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBase, withActorBody } from "../../lib/api";
import { useRealtimeEvent } from "../context/RealtimeContext";

type Category = "Food" | "Cleaning" | "Household" | "Other";
const CATEGORIES: Category[] = ["Food", "Cleaning", "Household", "Other"];
const CAT_ICONS: Record<Category, string> = { Food: "🍎", Cleaning: "🧹", Household: "🏠", Other: "📦" };

type StorageLocation = "Indoor Fridge" | "Outdoor Fridge" | "Outside Kitchen" | "Outdoor Store" | "Abdullah's Room" | "Inside Store";
const STORAGE_LOCATIONS: StorageLocation[] = ["Indoor Fridge", "Outdoor Fridge", "Outside Kitchen", "Outdoor Store", "Abdullah's Room", "Inside Store"];
const LOC_ICONS: Record<string, string> = {
  "Indoor Fridge": "🧊", "Outdoor Fridge": "❄️", "Outside Kitchen": "🍳",
  "Outdoor Store": "🏪", "Abdullah's Room": "🚪", "Inside Store": "📦",
};

type Item = {
  id: number;
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  expiration_date: string | null;
  threshold: number;
  updated_at: string | null;
  location: string | null;
  default_location: string | null;
};

type AuditItem = { name: string; estimatedQuantity: number; unit: string; category: string };

function expiryStatus(d: string | null): "ok" | "soon" | "expired" | "none" {
  if (!d) return "none";
  const today = new Date().toISOString().slice(0, 10);
  const date = d.slice(0, 10);
  if (date < today) return "expired";
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 3);
  if (date <= cutoff.toISOString().slice(0, 10)) return "soon";
  return "ok";
}

function expiryBadge(status: ReturnType<typeof expiryStatus>, date: string | null, compact = false) {
  if (status === "none") return null;
  const d = date?.slice(5, 10)?.replace("-", "/") ?? "";
  if (compact) {
    const dot = status === "expired" ? "bg-rose-400" : status === "soon" ? "bg-amber-400" : "bg-emerald-400";
    return (
      <span className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className={`text-[0.5625rem] ${status === "expired" ? "text-rose-300/80" : status === "soon" ? "text-amber-300/80" : "text-emerald-300/70"}`}>{d}</span>
      </span>
    );
  }
  const cls =
    status === "expired" ? "bg-rose-500/20 text-rose-300 border-rose-400/20" :
    status === "soon" ? "bg-amber-500/20 text-amber-300 border-amber-400/20" :
    "bg-emerald-500/15 text-emerald-300 border-emerald-400/15";
  return (
    <span className={`text-[0.625rem] px-2 py-0.5 rounded-lg border ${cls}`}>
      {status === "expired" ? "Expired" : status === "soon" ? "Exp." : ""} {d}
    </span>
  );
}

/* ─── Audit Modal — checklist + photo flow ─── */
function AuditModal({ inventoryItems, onClose, onDone }: {
  inventoryItems: Item[];
  onClose: () => void;
  onDone: (updates: { id: number; quantity: number }[]) => void;
}) {
  type AuditStatus = "pending" | "found" | "not_found" | "recommended";
  type AuditEntry = { item: Item; selected: boolean; status: AuditStatus; newQty: number | null };
  type Recommendation = { name: string; quantity: number; unit: string; category: string; matchedItemId?: number };
  const [entries, setEntries] = useState<AuditEntry[]>(() =>
    inventoryItems.map((item) => ({ item, selected: false, status: "pending" as AuditStatus, newQty: null }))
  );
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [step, setStep] = useState<"checklist" | "photo" | "review">("checklist");
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = entries.filter((e) => e.selected);
  const audited = entries.filter((e) => e.status !== "pending");
  const pendingAudit = selected.filter((e) => e.status === "pending");

  function toggleSelect(id: number) {
    setEntries((prev) => prev.map((e) => e.item.id === id ? { ...e, selected: !e.selected } : e));
  }

  function selectAll() {
    const allSelected = entries.every((e) => e.selected);
    setEntries((prev) => prev.map((e) => ({ ...e, selected: !allSelected })));
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result as string); setError(null); };
    reader.readAsDataURL(file);
  }

  async function analyzePhoto() {
    if (!image) return;
    setAnalyzing(true);
    setError(null);
    const pendingNames = pendingAudit.map((e) => e.item.name);
    // Also send ALL inventory names so AI can detect unexpected items
    const allNames = inventoryItems.map((i) => i.name);
    try {
      const data = (await getApiBase("/api/inventory/audit-photo", {
        method: "POST",
        body: { image, expectedItems: pendingNames, allInventoryNames: allNames },
      })) as { ok?: boolean; found?: { name: string; estimatedQuantity: number; unit: string }[]; unexpected?: { name: string; estimatedQuantity: number; unit: string; category: string }[] };
      if (data?.ok) {
        const foundItems = data.found ?? [];
        const unexpectedItems = data.unexpected ?? [];

        setEntries((prev) => {
          const copy = [...prev];
          // Match found items to selected pending entries
          const matchedFoundNames = new Set<string>();
          for (const detected of foundItems) {
            const norm = detected.name.toLowerCase();
            const match = copy.find((e) =>
              e.selected && e.status === "pending" &&
              (e.item.name.toLowerCase() === norm || e.item.name.toLowerCase().includes(norm) || norm.includes(e.item.name.toLowerCase()))
            );
            if (match) {
              match.status = "found";
              match.newQty = detected.estimatedQuantity;
              matchedFoundNames.add(norm);
            }
          }
          // Selected items NOT found by AI = genuinely not seen
          for (const e of copy) {
            if (e.selected && e.status === "pending") {
              e.status = "not_found";
              e.newQty = 0;
            }
          }
          return copy;
        });

        // Handle unexpected items — items AI saw that weren't selected
        const newRecs: Recommendation[] = [];
        for (const u of unexpectedItems) {
          const matchedInv = inventoryItems.find((i) => i.name.toLowerCase() === u.name.toLowerCase());
          newRecs.push({
            name: u.name,
            quantity: u.estimatedQuantity,
            unit: u.unit,
            category: u.category,
            matchedItemId: matchedInv?.id,
          });
        }
        // Also check: did AI find an item from the inventory that was NOT selected?
        for (const detected of foundItems) {
          const norm = detected.name.toLowerCase();
          const isSelected = selected.some((e) =>
            e.item.name.toLowerCase() === norm || e.item.name.toLowerCase().includes(norm) || norm.includes(e.item.name.toLowerCase())
          );
          if (!isSelected) {
            const matchedInv = inventoryItems.find((i) => i.name.toLowerCase().includes(norm) || norm.includes(i.name.toLowerCase()));
            if (matchedInv) {
              newRecs.push({ name: matchedInv.name, quantity: detected.estimatedQuantity, unit: detected.unit, category: matchedInv.category, matchedItemId: matchedInv.id });
            }
          }
        }
        setRecommendations((prev) => [...prev, ...newRecs]);

        setImage(null);
        // Auto-advance if all selected are done
        if (pendingAudit.length <= foundItems.length) setStep("review");
      } else {
        setError("Analysis failed — try again");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function acceptRecommendation(rec: Recommendation) {
    if (rec.matchedItemId) {
      setEntries((prev) => prev.map((e) =>
        e.item.id === rec.matchedItemId ? { ...e, selected: true, status: "found" as AuditStatus, newQty: rec.quantity } : e
      ));
    }
    setRecommendations((prev) => prev.filter((r) => r !== rec));
  }

  function finishRemaining() {
    setEntries((prev) => prev.map((e) => e.selected && e.status === "pending" ? { ...e, status: "not_found" as AuditStatus, newQty: 0 } : e));
    setStep("review");
  }

  const modalStyle = {
    background: "rgba(18, 24, 38, 0.95)", backdropFilter: "blur(24px)",
    border: "1px solid rgba(255,255,255,0.12)", borderRadius: "28px",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-[28px] p-6 animate-modal-in" style={modalStyle} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <p className="text-[0.625rem] font-medium text-violet-300/70 uppercase tracking-wider mb-1">
              {step === "checklist" ? "Step 1 — Select Items" : step === "photo" ? "Step 2 — Take Photos" : "Step 3 — Review"}
            </p>
            <h3 className="text-lg font-semibold text-white/95">Inventory Audit</h3>
          </div>
          <span className="ai-sparkle text-violet-300/80 text-lg">&#10024;</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {step === "checklist" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[0.75rem] text-white/50">{selected.length} of {entries.length} selected</p>
                <button type="button" onClick={selectAll} className="text-[0.75rem] text-violet-300/70 hover:text-violet-300">
                  {entries.every((e) => e.selected) ? "Deselect all" : "Select all"}
                </button>
              </div>
              {/* Group by location */}
              {(() => {
                const groups: Record<string, AuditEntry[]> = {};
                for (const e of entries) {
                  const loc = e.item.location || "Unsorted";
                  if (!groups[loc]) groups[loc] = [];
                  groups[loc].push(e);
                }
                return Object.entries(groups).map(([loc, group]) => (
                  <div key={loc} className="mb-3">
                    <p className="text-[0.625rem] text-white/35 uppercase tracking-wider mb-1.5">{LOC_ICONS[loc] ?? "📍"} {loc}</p>
                    {group.map((entry) => (
                      <button key={entry.item.id} type="button" onClick={() => toggleSelect(entry.item.id)}
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1 text-left transition ${
                          entry.selected ? "bg-violet-500/15 border border-violet-400/25" : "bg-white/[0.03] border border-white/[0.06]"
                        }`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                          entry.selected ? "border-violet-400 bg-violet-500/30" : "border-white/20"
                        }`}>
                          {entry.selected && <span className="text-violet-200 text-xs">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.8125rem] text-white/90 truncate">{entry.item.name}</p>
                          <p className="text-[0.6875rem] text-white/40">{entry.item.quantity} {entry.item.unit}</p>
                        </div>
                        {entry.status !== "pending" && <span className="text-emerald-400 text-sm">✓</span>}
                      </button>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}

          {step === "photo" && (
            <div className="space-y-3">
              {/* Progress */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-500/80 rounded-full transition-all" style={{ width: `${selected.length ? (audited.length / selected.length) * 100 : 0}%` }} />
                </div>
                <span className="text-[0.6875rem] text-white/40">{audited.length}/{selected.length}</span>
              </div>

              {/* Items pending */}
              <p className="text-[0.75rem] text-white/50 mb-2">
                Pending: {pendingAudit.map((e) => e.item.name).join(", ")}
              </p>

              {!image ? (
                <div className="space-y-3">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full rounded-2xl border-2 border-dashed border-white/15 bg-white/5 py-6 text-center hover:border-white/25 transition">
                    <p className="text-2xl mb-2">📸</p>
                    <p className="text-[0.8125rem] text-white/70">Take a photo</p>
                    <p className="text-[0.6875rem] text-white/40 mt-1">Multiple items in one photo is fine</p>
                  </button>
                  <button type="button" onClick={() => {
                    // Manual count: show input for each pending item
                    setEntries((prev) => prev.map((e) => e.selected && e.status === "pending" ? { ...e, status: "found" as AuditStatus, newQty: Number(e.item.quantity) } : e));
                    setStep("review");
                  }}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-center text-[0.8125rem] text-white/60 hover:bg-white/10 transition">
                    ✏️ Manual count instead
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl overflow-hidden border border-white/10">
                    <img src={image} alt="Audit" className="w-full max-h-40 object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setImage(null)}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-2.5 text-[0.8125rem] text-white/70 transition">Retake</button>
                    <button type="button" onClick={analyzePhoto} disabled={analyzing}
                      className="flex-1 rounded-2xl bg-violet-600/60 hover:bg-violet-500/60 py-2.5 text-[0.8125rem] font-medium text-white transition disabled:opacity-50">
                      {analyzing ? <span className="flex items-center justify-center gap-2"><span className="ai-sparkle">&#10024;</span> Analyzing…</span> : "Analyze"}
                    </button>
                  </div>
                  {error && <p className="text-[0.8125rem] text-rose-300/80">{error}</p>}
                </div>
              )}

              {/* Audited items — found + not found */}
              {audited.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[0.625rem] text-white/40 uppercase tracking-wider mb-1">Results</p>
                  {audited.filter((e) => e.status === "found").map((e) => (
                    <div key={e.item.id} className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-400/15 px-3 py-1.5">
                      <span className="text-emerald-400 text-xs">✓</span>
                      <span className="text-[0.8125rem] text-white/80 flex-1 truncate">{e.item.name}</span>
                      <span className="text-[0.75rem] text-emerald-300/80">{e.newQty} {e.item.unit}</span>
                    </div>
                  ))}
                  {audited.filter((e) => e.status === "not_found").map((e) => (
                    <div key={e.item.id} className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-400/15 px-3 py-1.5">
                      <span className="text-rose-400 text-xs">✗</span>
                      <span className="text-[0.8125rem] text-white/60 flex-1 truncate">{e.item.name}</span>
                      <span className="text-[0.75rem] text-rose-300/70">Not seen</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations — unselected items AI spotted */}
              {recommendations.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[0.625rem] text-amber-400/60 uppercase tracking-wider mb-1">Also spotted (not selected)</p>
                  {recommendations.map((rec, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-400/15 px-3 py-1.5">
                      <span className="text-amber-400 text-xs">!</span>
                      <span className="text-[0.8125rem] text-white/70 flex-1 truncate">{rec.name}</span>
                      <span className="text-[0.75rem] text-amber-300/70">{rec.quantity} {rec.unit}</span>
                      <button type="button" onClick={() => acceptRecommendation(rec)}
                        className="text-[0.625rem] text-amber-300/80 bg-amber-500/20 px-2 py-0.5 rounded-md hover:bg-amber-500/30 transition">
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-2">
              {/* Found items */}
              {entries.filter((e) => e.status === "found").length > 0 && (
                <p className="text-[0.625rem] text-emerald-400/60 uppercase tracking-wider">Confirmed</p>
              )}
              {entries.filter((e) => e.status === "found").map((e) => {
                const changed = e.newQty !== null && e.newQty !== Number(e.item.quantity);
                return (
                  <div key={e.item.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                    changed ? "bg-emerald-500/10 border-emerald-400/15" : "bg-emerald-500/5 border-emerald-400/10"
                  }`}>
                    <span className="text-emerald-400 text-sm shrink-0">✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] text-white/90 truncate">{e.item.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {changed ? (
                        <div>
                          <span className="text-[0.6875rem] text-white/30 line-through mr-1">{e.item.quantity}</span>
                          <span className="text-[0.8125rem] text-emerald-300 font-medium">{e.newQty}</span>
                          <span className="text-[0.6875rem] text-white/40 ml-0.5">{e.item.unit}</span>
                        </div>
                      ) : (
                        <span className="text-[0.8125rem] text-white/60">{e.newQty} {e.item.unit}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Not found items */}
              {entries.filter((e) => e.status === "not_found").length > 0 && (
                <p className="text-[0.625rem] text-rose-400/60 uppercase tracking-wider mt-3">Not found in photo</p>
              )}
              {entries.filter((e) => e.status === "not_found").map((e) => (
                <div key={e.item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border bg-rose-500/5 border-rose-400/10">
                  <span className="text-rose-400 text-sm shrink-0">✗</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] text-white/70 truncate">{e.item.name}</p>
                    <p className="text-[0.5625rem] text-white/30">Was {e.item.quantity} {e.item.unit} — will be set to 0</p>
                  </div>
                  <input type="number" min={0} step="any" value={e.newQty ?? 0}
                    onClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) => {
                      const val = Number(ev.target.value);
                      setEntries((prev) => prev.map((x) => x.item.id === e.item.id ? { ...x, newQty: val } : x));
                    }}
                    className="w-14 rounded-lg px-2 py-1 text-[0.75rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none text-center" />
                </div>
              ))}
              {/* Recommendations accepted */}
              {entries.filter((e) => e.status === ("recommended" as AuditStatus)).length > 0 && (
                <p className="text-[0.625rem] text-amber-400/60 uppercase tracking-wider mt-3">Added from recommendation</p>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-2 mt-4 shrink-0">
          {step === "checklist" && (
            <>
              <button type="button" onClick={onClose}
                className="flex-1 rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] text-white/70 transition">Close</button>
              <button type="button" disabled={selected.length === 0} onClick={() => setStep("photo")}
                className="flex-1 rounded-2xl bg-violet-600/60 hover:bg-violet-500/60 py-2.5 text-[0.8125rem] font-medium text-white transition disabled:opacity-40">
                Start Audit ({selected.length})
              </button>
            </>
          )}
          {step === "photo" && (
            <>
              <button type="button" onClick={() => setStep("checklist")}
                className="flex-1 rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] text-white/70 transition">Back</button>
              {pendingAudit.length > 0 ? (
                <button type="button" onClick={finishRemaining}
                  className="flex-1 rounded-2xl bg-white/10 py-2.5 text-[0.8125rem] text-white/70 transition">
                  Skip remaining
                </button>
              ) : (
                <button type="button" onClick={() => setStep("review")}
                  className="flex-1 rounded-2xl bg-emerald-600/60 hover:bg-emerald-500/60 py-2.5 text-[0.8125rem] font-medium text-white transition">
                  Review all
                </button>
              )}
            </>
          )}
          {step === "review" && (
            <>
              <button type="button" onClick={() => setStep("photo")}
                className="flex-1 rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] text-white/70 transition">Back</button>
              <button type="button"
                onClick={() => onDone(entries.filter((e) => e.status !== "pending" && e.newQty !== null).map((e) => ({ id: e.item.id, quantity: e.newQty! })))}
                className="flex-1 rounded-2xl bg-emerald-600/60 hover:bg-emerald-500/60 py-2.5 text-[0.8125rem] font-medium text-white transition">
                Save ({entries.filter((e) => e.status !== "pending").length} items)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Add Item Modal ─── */
function AddItemModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (item: { name: string; category: Category; quantity: number; unit: string; expiration_date: string | null; threshold: number; location: string | null; default_location: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Food");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("pcs");
  const [expiry, setExpiry] = useState("");
  const [threshold, setThreshold] = useState(2);
  const [location, setLocation] = useState<string>("");
  const [alwaysHere, setAlwaysHere] = useState(true);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm max-h-[85vh] flex flex-col rounded-[28px] p-6 animate-modal-in"
        style={{ background: "rgba(18,24,38,0.95)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "28px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)" }}
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white/95 mb-4 shrink-0">Add Item</h3>
        <div className="space-y-3 mb-5 overflow-y-auto flex-1 min-h-0">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name"
            className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 outline-none focus:border-white/20" autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}
              className="rounded-xl px-3 py-2.5 text-[0.8125rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none">
              {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
            </select>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              className="rounded-xl px-3 py-2.5 text-[0.8125rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none">
              {["pcs", "kg", "g", "L", "ml", "bottles", "cans", "bags", "boxes", "packs"].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[0.625rem] text-white/40 uppercase mb-1">Quantity</label>
              <input type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-xl px-3 py-2.5 text-[0.8125rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none" />
            </div>
            <div>
              <label className="block text-[0.625rem] text-white/40 uppercase mb-1">Low stock at</label>
              <input type="number" min={0} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full rounded-xl px-3 py-2.5 text-[0.8125rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[0.625rem] text-white/40 uppercase mb-1">Stored in</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-[0.8125rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none">
              <option value="">Select location…</option>
              {STORAGE_LOCATIONS.map((l) => <option key={l} value={l}>{LOC_ICONS[l]} {l}</option>)}
            </select>
          </div>
          {location && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={alwaysHere} onChange={(e) => setAlwaysHere(e.target.checked)}
                className="rounded border-white/20 bg-white/10 text-emerald-500 w-4 h-4" />
              <span className="text-[0.8125rem] text-white/60">Always stored here</span>
            </label>
          )}
          {category === "Food" && (
            <div>
              <label className="block text-[0.625rem] text-white/40 uppercase mb-1">Expiry date</label>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-[0.8125rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none" />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] text-white/70">Cancel</button>
          <button type="button" disabled={!name.trim()} onClick={() => onSave({
              name: name.trim(), category, quantity, unit, expiration_date: expiry || null, threshold,
              location: location || null, default_location: location && alwaysHere ? location : null,
            })}
            className="flex-1 rounded-2xl bg-emerald-600/60 hover:bg-emerald-500/60 py-2.5 text-[0.8125rem] font-medium text-white disabled:opacity-40 transition">Add</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [openCat, setOpenCat] = useState<Category | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [auditHistory, setAuditHistory] = useState<{ date: string; count: number; entries: { time: string; action: string; payload: Record<string, unknown> }[] }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [editQty, setEditQty] = useState<Record<number, number>>({});
  const [editExpiry, setEditExpiry] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    try {
      const data = (await getApiBase("/api/inventory", { cache: "no-store" })) as { ok?: boolean; items?: Item[] };
      setItems(data?.items ?? []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadHistory() {
    try {
      const data = (await getApiBase("/api/inventory/audit-history")) as { history?: typeof auditHistory };
      setAuditHistory(data?.history ?? []);
    } catch { setAuditHistory([]); }
  }
  useRealtimeEvent("inventory_updated", load);

  const lowStock = items.filter((i) => i.quantity <= (i.threshold ?? 2));
  const expiringSoon = items.filter((i) => expiryStatus(i.expiration_date) === "soon" || expiryStatus(i.expiration_date) === "expired");
  const lastAudit = items.reduce((latest, i) => {
    if (!i.updated_at) return latest;
    return !latest || i.updated_at > latest ? i.updated_at : latest;
  }, "" as string);

  async function addItem(item: { name: string; category: Category; quantity: number; unit: string; expiration_date: string | null; threshold: number; location: string | null; default_location: string | null }) {
    try {
      await getApiBase("/api/inventory", { method: "POST", body: withActorBody(item) });
      setShowAdd(false);
      await load();
    } catch { /* ignore */ }
  }

  async function updateItem(id: number, updates: Record<string, unknown>) {
    try {
      await getApiBase(`/api/inventory/${id}`, { method: "PATCH", body: updates });
      await load();
    } catch { /* ignore */ }
  }

  async function deleteItem(id: number) {
    try {
      await getApiBase(`/api/inventory/${id}`, { method: "DELETE" });
      setExpandedId(null);
      await load();
    } catch { /* ignore */ }
  }

  const [locationPrompts, setLocationPrompts] = useState<{ id: number; name: string }[]>([]);

  async function handleAuditDone(updates: { id: number; quantity: number }[]) {
    for (const u of updates) {
      await getApiBase(`/api/inventory/${u.id}`, { method: "PATCH", body: { quantity: u.quantity } });
    }
    setShowAudit(false);
    await load();
  }

  function renderExpandedEdit(item: Item) {
    return (
      <div className="mt-1 rounded-xl border border-white/[0.04] bg-white/[0.03] p-3 space-y-2.5">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[0.5rem] text-white/40 uppercase mb-0.5">Qty</label>
            <div className="flex gap-1">
              <input type="number" min={0}
                value={editQty[item.id] ?? item.quantity}
                onChange={(e) => setEditQty({ ...editQty, [item.id]: Number(e.target.value) })}
                className="w-full rounded-lg px-2 py-1.5 text-[0.8125rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none" />
              <button type="button"
                onClick={() => updateItem(item.id, { quantity: editQty[item.id] ?? item.quantity })}
                className="rounded-lg bg-white/10 px-2 py-1.5 text-[0.6875rem] text-white/70 hover:bg-white/15 transition shrink-0">Save</button>
            </div>
          </div>
          {item.category === "Food" && (
            <div className="flex-1">
              <label className="block text-[0.5rem] text-white/40 uppercase mb-0.5">Expiry</label>
              <div className="flex gap-1">
                <input type="date"
                  value={editExpiry[item.id] ?? item.expiration_date?.slice(0, 10) ?? ""}
                  onChange={(e) => setEditExpiry({ ...editExpiry, [item.id]: e.target.value })}
                  className="w-full rounded-lg px-2 py-1.5 text-[0.8125rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none" />
                <button type="button"
                  onClick={() => updateItem(item.id, { expiration_date: editExpiry[item.id] || null })}
                  className="rounded-lg bg-white/10 px-2 py-1.5 text-[0.6875rem] text-white/70 hover:bg-white/15 transition shrink-0">Save</button>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-[0.5rem] text-white/40 uppercase mb-0.5">Location</label>
          <select
            value={item.location ?? ""}
            onChange={(e) => {
              const loc = e.target.value || null;
              updateItem(item.id, { location: loc, ...(loc && !item.default_location ? { default_location: loc } : {}) });
            }}
            className="w-full rounded-lg px-2 py-1.5 text-[0.8125rem] text-white/90 border border-white/10 bg-[#0f172a]/50 outline-none">
            <option value="">Unsorted</option>
            {STORAGE_LOCATIONS.map((l) => <option key={l} value={l}>{LOC_ICONS[l]} {l}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.04]">
          <p className="text-[0.6rem] text-white/25">
            {item.updated_at ? `Updated ${new Date(item.updated_at).toLocaleDateString()}` : ""}
          </p>
          <button type="button" onClick={() => deleteItem(item.id)}
            className="text-[0.6875rem] text-rose-400/70 hover:text-rose-300 transition">Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white/95 tracking-tight">Inventory</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setShowHistory(true); loadHistory(); }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[0.8125rem] text-white/50 hover:text-white/80 transition">
            History
          </button>
          <button type="button" onClick={() => setShowAudit(true)}
            className="flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3.5 py-2 text-[0.8125rem] font-medium text-violet-300/90 hover:bg-violet-500/20 transition">
            <span className="ai-sparkle text-[0.75rem]">&#10024;</span> Audit
          </button>
          <button type="button" onClick={() => setShowAdd(true)}
            className="rounded-xl border border-white/10 bg-[#0f172a]/70 px-3.5 py-2 text-[0.8125rem] font-medium text-white/90 hover:bg-[#0f172a]/80 transition">
            + Add
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: items.length, color: "text-white/90" },
          { label: "Low Stock", value: lowStock.length, color: lowStock.length ? "text-rose-300" : "text-white/60" },
          { label: "Expiring", value: expiringSoon.length, color: expiringSoon.length ? "text-amber-300" : "text-white/60" },
          { label: "Last Audit", value: lastAudit ? new Date(lastAudit).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—", color: "text-white/60" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-[#0f172a]/70 backdrop-blur-xl p-3 text-center"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
            <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-[0.625rem] text-white/40 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Inventory */}
      {loading ? (
        <p className="text-[0.8125rem] text-white/45 text-center py-8">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">📦</p>
          <p className="text-[0.875rem] text-white/50">No items yet.</p>
          <p className="text-[0.75rem] text-white/30 mt-1">Add items manually or run an AI photo audit.</p>
        </div>
      ) : openCat === null ? (
        /* ─── Category grid view ─── */
        <div className="space-y-5">
          {/* Expiring soon banner — pinned at top */}
          {expiringSoon.length > 0 && (
            <button type="button" onClick={() => setOpenCat("Food")}
              className="w-full text-left rounded-2xl px-5 py-4 transition hover:scale-[1.005]"
              style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(244,63,94,0.1) 100%)",
                border: "1px solid rgba(245,158,11,0.25)",
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-[0.875rem] font-semibold text-amber-200/90">Expiring Soon</p>
                    <p className="text-[0.75rem] text-white/50 mt-0.5">
                      {expiringSoon.map((i) => i.name).slice(0, 3).join(", ")}
                      {expiringSoon.length > 3 ? ` +${expiringSoon.length - 3} more` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-xl font-semibold text-amber-300/90">{expiringSoon.length}</span>
              </div>
            </button>
          )}

          {/* Category cards grid */}
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat);
              const catLow = catItems.filter((i) => i.quantity <= (i.threshold ?? 2));
              const catExpiring = catItems.filter((i) => {
                const s = expiryStatus(i.expiration_date);
                return s === "soon" || s === "expired";
              });
              return (
                <button key={cat} type="button" onClick={() => { setOpenCat(cat); setExpandedId(null); }}
                  className="text-left rounded-2xl border border-white/[0.06] p-5 backdrop-blur-xl transition hover:bg-white/[0.03] hover:scale-[1.01] hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}>
                  <span className="text-3xl block mb-3">{CAT_ICONS[cat]}</span>
                  <p className="text-[0.9375rem] font-semibold text-white/90">{cat}</p>
                  <p className="text-[0.8125rem] text-white/45 mt-0.5">{catItems.length} item{catItems.length !== 1 ? "s" : ""}</p>
                  {(catLow.length > 0 || catExpiring.length > 0) && (
                    <div className="flex gap-2 mt-2.5">
                      {catLow.length > 0 && (
                        <span className="text-[0.5625rem] px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-300/80 border border-rose-400/15">
                          {catLow.length} low
                        </span>
                      )}
                      {catExpiring.length > 0 && (
                        <span className="text-[0.5625rem] px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300/80 border border-amber-400/15">
                          {catExpiring.length} expiring
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ─── Category detail view — grouped by storage location ─── */
        (() => {
          const catItems = items.filter((i) => i.category === openCat);
          // Group by location
          const locationGroups: Record<string, Item[]> = {};
          for (const item of catItems) {
            const loc = item.location || "Unsorted";
            if (!locationGroups[loc]) locationGroups[loc] = [];
            locationGroups[loc].push(item);
          }
          // Sort within each group: expired → soon → low → alpha
          const sortItems = (arr: Item[]) => [...arr].sort((a, b) => {
            const expOrder = { expired: 0, soon: 1, ok: 2, none: 3 };
            const aE = expOrder[expiryStatus(a.expiration_date)];
            const bE = expOrder[expiryStatus(b.expiration_date)];
            if (aE !== bE) return aE - bE;
            const aL = a.quantity <= (a.threshold ?? 2) ? 0 : 1;
            const bL = b.quantity <= (b.threshold ?? 2) ? 0 : 1;
            if (aL !== bL) return aL - bL;
            return a.name.localeCompare(b.name);
          });
          // Order locations: known first, Unsorted last
          const locOrder = [...STORAGE_LOCATIONS.filter((l) => locationGroups[l]), ...Object.keys(locationGroups).filter((l) => !STORAGE_LOCATIONS.includes(l as StorageLocation) && l !== "Unsorted"), ...(locationGroups["Unsorted"] ? ["Unsorted"] : [])];

          return (
            <div>
              <button type="button" onClick={() => { setOpenCat(null); setExpandedId(null); }}
                className="flex items-center gap-2 text-[0.8125rem] text-white/50 hover:text-white/80 transition mb-4">
                <span>←</span> Back to categories
              </button>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">{CAT_ICONS[openCat]}</span>
                <div>
                  <h2 className="text-lg font-semibold text-white/95">{openCat}</h2>
                  <p className="text-[0.75rem] text-white/40">{catItems.length} item{catItems.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              {catItems.length === 0 ? (
                <p className="text-[0.8125rem] text-white/40 text-center py-8">No items in {openCat}.</p>
              ) : (
                <div className="space-y-5">
                  {locOrder.map((loc) => {
                    const locItems = sortItems(locationGroups[loc]);
                    return (
                      <section key={loc}>
                        <h3 className="text-[0.6875rem] font-semibold text-white/40 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                          <span>{LOC_ICONS[loc] ?? "📍"}</span> {loc}
                          <span className="text-white/20 font-normal">({locItems.length})</span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {locItems.map((item) => {
                            const exp = expiryStatus(item.expiration_date);
                            const isLow = item.quantity <= (item.threshold ?? 2);
                            const isExpanded = expandedId === item.id;
                            return (
                              <div key={item.id}>
                                <button type="button" onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                  className="w-full text-left rounded-2xl border border-white/[0.06] px-3.5 py-2.5 backdrop-blur-xl transition hover:scale-[1.01] relative"
                                  style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)" }}>
                                  {/* Expiry badge — top right */}
                                  {exp !== "none" && (
                                    <div className="absolute top-2 right-2.5">
                                      {expiryBadge(exp, item.expiration_date, true)}
                                    </div>
                                  )}
                                  <p className="text-[0.8125rem] font-medium text-white/90 truncate pr-12 mb-0.5">{item.name}</p>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[0.75rem] text-white/55">{item.quantity} {item.unit}</span>
                                    {isLow && <span className="text-[0.5rem] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/20">LOW</span>}
                                  </div>
                                </button>
                                {isExpanded && renderExpandedEdit(item)}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Modals */}
      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSave={addItem} />}
      {showAudit && <AuditModal inventoryItems={items} onClose={() => setShowAudit(false)} onDone={handleAuditDone} />}

      {/* Audit History modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-[28px] p-6 animate-modal-in"
            style={{ background: "rgba(18,24,38,0.95)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "28px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white/95 mb-4 shrink-0">Audit History</h3>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {auditHistory.length === 0 ? (
                <p className="text-[0.8125rem] text-white/40 text-center py-6">No audit history yet.</p>
              ) : auditHistory.map((day) => (
                <div key={day.date} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[0.875rem] font-medium text-white/90">
                      {new Date(day.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <span className="text-[0.6875rem] text-white/40">{day.count} changes</span>
                  </div>
                  <div className="space-y-1">
                    {day.entries.slice(0, 5).map((e, i) => (
                      <p key={i} className="text-[0.75rem] text-white/50">
                        {e.action === "created" ? "+" : "~"} {String((e.payload as Record<string, unknown>)?.name || (e.payload as Record<string, unknown>)?.title || "item")}
                        {e.payload && (e.payload as Record<string, unknown>).addedQty ? ` (+${String((e.payload as Record<string, unknown>).addedQty)})` : ""}
                      </p>
                    ))}
                    {day.entries.length > 5 && (
                      <p className="text-[0.625rem] text-white/30">+{day.entries.length - 5} more</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowHistory(false)}
              className="shrink-0 w-full mt-4 rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] text-white/60 transition">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Location prompt for new items after audit */}
      {locationPrompts.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm max-h-[80vh] flex flex-col rounded-[28px] p-6 animate-modal-in"
            style={{ background: "rgba(18,24,38,0.95)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "28px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white/95 mb-1 shrink-0">Where is this stored?</h3>
            <p className="text-[0.75rem] text-white/40 mb-4 shrink-0">
              {locationPrompts[0].name} — choose a storage location
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4 overflow-y-auto flex-1 min-h-0">
              {STORAGE_LOCATIONS.map((loc) => (
                <button key={loc} type="button"
                  onClick={async () => {
                    const item = locationPrompts[0];
                    await updateItem(item.id, { location: loc, default_location: loc });
                    setLocationPrompts((prev) => prev.slice(1));
                  }}
                  className="text-left rounded-xl border border-white/[0.06] bg-white/5 px-3.5 py-3 hover:bg-white/10 transition">
                  <span className="text-xl block mb-1">{LOC_ICONS[loc]}</span>
                  <p className="text-[0.8125rem] text-white/90">{loc}</p>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setLocationPrompts((prev) => prev.slice(1))}
              className="shrink-0 w-full rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] text-white/60 hover:bg-[#0f172a]/80 transition">
              Skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
