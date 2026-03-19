"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import GlassCard from "./GlassCard";
import { getCategoryIcon } from "../../../lib/taskCategories";
import { TASK_CATEGORIES } from "../../../lib/taskCategories";
import { useRealtimeEvent } from "../../context/RealtimeContext";
import { getApiBase, withActorBody } from "../../../lib/api";
import { formatTaskTimeRange } from "../../../lib/scheduling/formatTaskTimeRange";

const LONG_PRESS_MS = 600;

const glassModalStyle = {
  background: "rgba(18, 24, 38, 0.9)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)" as const,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "28px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)",
};

type Task = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  status: string;
  category: string;
  urgent: boolean;
  room?: string;
  assignedBy?: string;
  order: number;
};

type HouseBrainTasksCardProps = {
  readOnly?: boolean;
  roomFilter?: string;
  urgentOnly?: boolean;
  title?: string;
};

/* ─── Sortable row ─── */
function SortableTaskRow({
  task, isHolding, onPressStart, onPressEnd, onClick, onContextMenu, readOnly,
}: {
  task: Task; isHolding: boolean;
  onPressStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onPressEnd: () => void; onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void; readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style: React.CSSProperties = {
    opacity: isDragging ? 0.6 : 1,
    transform: isDragging ? undefined : isHolding ? "scale(0.97)" : undefined,
    boxShadow: isHolding ? "0 0 20px rgba(120,180,255,0.25)" : undefined,
    ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
    transition,
  };
  return (
    <li ref={setNodeRef} style={style}>
      <button
        type="button"
        onClick={onClick}
        onMouseDown={(e) => !readOnly && onPressStart(e)}
        onMouseUp={onPressEnd}
        onMouseLeave={onPressEnd}
        onTouchStart={(e) => !readOnly && onPressStart(e)}
        onTouchEnd={onPressEnd}
        onContextMenu={onContextMenu}
        className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.06] px-3.5 py-2.5 backdrop-blur-xl transition-all duration-300 ease-out text-left"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)" }}
      >
        <span className="text-base shrink-0" aria-hidden>{getCategoryIcon(task.category ?? "misc")}</span>
        <div className="min-w-0 flex-1">
          {task.startTime && (
            <p className="text-[0.6875rem] text-white/50 tabular-nums">
              {formatTaskTimeRange(
                task.startTime,
                task.endTime ?? new Date(new Date(task.startTime).getTime() + task.durationMinutes * 60000).toISOString(),
                task.durationMinutes
              )}
            </p>
          )}
          <p className="text-[0.875rem] font-medium text-white/90 truncate">{task.title}</p>
        </div>
        {!readOnly && (
          <span
            className="drag-handle shrink-0 text-white/30 cursor-grab active:cursor-grabbing select-none text-sm"
            style={{ touchAction: "none" }}
            aria-hidden
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </span>
        )}
      </button>
    </li>
  );
}

/* ─── Action modal (long press) ─── */
function TaskActionModal({
  task, onClose, onEdit, onSkip, onDelete, onAskAI,
}: {
  task: Task; onClose: () => void; onEdit: () => void;
  onSkip: () => void; onDelete: () => void; onAskAI: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-[28px] p-6 animate-modal-in" style={glassModalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white/95 mb-1 pr-8">{task.title}</h3>
        <p className="text-[0.75rem] text-white/40 mb-4">
          {getCategoryIcon(task.category ?? "misc")} {task.category ?? "misc"}
          {task.assignedBy ? ` · Assigned by ${task.assignedBy}` : ""}
        </p>
        {task.startTime && (
          <dl className="space-y-2 text-[0.8125rem] mb-5 border-t border-white/[0.06] pt-3">
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">Time</dt>
              <dd className="text-white/90">
                {formatTaskTimeRange(
                  task.startTime,
                  task.endTime ?? new Date(new Date(task.startTime).getTime() + task.durationMinutes * 60000).toISOString(),
                  task.durationMinutes
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">Duration</dt>
              <dd className="text-white/90">{task.durationMinutes}m</dd>
            </div>
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { onEdit(); onClose(); }}
            className="rounded-2xl border border-white/10 bg-[#1e293b]/60 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90 hover:bg-[#1e293b]/80 transition active:scale-[0.97]">
            Edit
          </button>
          <button type="button" onClick={() => { onAskAI(); onClose(); }}
            className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-[0.8125rem] font-medium text-violet-300/90 hover:bg-violet-500/20 transition active:scale-[0.97]">
            Ask AI
          </button>
          <button type="button" onClick={() => { onSkip(); onClose(); }}
            className="rounded-2xl border border-amber-400/25 bg-amber-500/15 px-4 py-2.5 text-[0.8125rem] font-medium text-amber-300/90 hover:bg-amber-500/20 transition">
            Skip
          </button>
          <button type="button" onClick={() => { onDelete(); onClose(); }}
            className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-[0.8125rem] font-medium text-rose-300/90 hover:bg-rose-500/20 transition">
            Delete
          </button>
          <button type="button" onClick={onClose}
            className="rounded-2xl border border-white/10 bg-[#0f172a]/70 px-4 py-2.5 text-[0.8125rem] font-medium text-white/70 hover:bg-[#0f172a]/80 transition ml-auto">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit modal ─── */
function EditTaskModal({ task, onClose, onSave }: {
  task: Task; onClose: () => void;
  onSave: (p: { title: string; category: string; durationMinutes: number }) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState(task.category || "misc");
  const [dur, setDur] = useState(task.durationMinutes);
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-[28px] p-6 animate-modal-in" style={glassModalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white/95 mb-4">Edit task</h3>
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-[0.6875rem] text-white/50 mb-1 uppercase tracking-wider">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="block text-[0.6875rem] text-white/50 mb-1 uppercase tracking-wider">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/20">
              {TASK_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.6875rem] text-white/50 mb-1 uppercase tracking-wider">Duration (min)</label>
            <input type="number" min={5} value={dur} onChange={(e) => setDur(parseInt(e.target.value, 10) || 15)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[0.875rem] text-white/95 border border-white/10 bg-[#0f172a]/50 focus:outline-none focus:border-white/20" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] font-medium text-white/80 hover:bg-[#0f172a]/80 transition">Cancel</button>
          <button type="button" onClick={() => onSave({ title, category, durationMinutes: dur })}
            className="flex-1 rounded-2xl bg-[rgba(99,179,237,0.2)] border border-[rgba(99,179,237,0.3)] py-2.5 text-[0.8125rem] font-medium text-white/95 hover:bg-[rgba(99,179,237,0.25)]">Save</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Ask AI modal ─── */
function AskAIModal({ taskTitle, onClose }: { taskTitle: string; onClose: () => void }) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnswer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await getApiBase("/api/ai/howto", {
        method: "POST",
        body: { title: taskTitle, type: "task" },
      })) as { ok?: boolean; answer?: string; error?: string; detail?: string };
      if (data?.ok && data.answer) {
        setAnswer(data.answer);
      } else {
        setError(data?.detail || data?.error || "No response from AI");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reach AI");
    } finally {
      setLoading(false);
    }
  }, [taskTitle]);

  useEffect(() => { fetchAnswer(); }, [fetchAnswer]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm max-h-[80vh] flex flex-col rounded-[28px] p-6 animate-modal-in" style={glassModalStyle} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <p className="text-[0.625rem] font-medium text-violet-300/70 uppercase tracking-wider mb-1">AI Instructions</p>
            <h3 className="text-lg font-semibold text-white/95">{taskTitle}</h3>
          </div>
          <span className="ai-sparkle text-violet-300/80 text-sm">&#10024;</span>
        </div>
        <div className="overflow-y-auto min-h-0 flex-1 mb-4">
          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <span className="ai-sparkle text-violet-400">&#10024;</span>
              <p className="text-[0.8125rem] text-white/50">Thinking…</p>
            </div>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-[0.8125rem] text-rose-300/80">{error}</p>
              <button type="button" onClick={fetchAnswer}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[0.8125rem] text-white/70 hover:bg-white/10 transition">
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {(answer ?? "").split("\n").filter(Boolean).map((line, i) => (
                <p key={i} className="text-[0.8125rem] text-white/80 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong class='text-white/95'>$1</strong>") }}
                />
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose}
          className="shrink-0 w-full rounded-2xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.8125rem] font-medium text-white/80 hover:bg-[#0f172a]/80 transition">
          Close
        </button>
      </div>
    </div>
  );
}

/* ─── Main card ─── */
export default function HouseBrainTasksCard({
  readOnly = false, roomFilter, urgentOnly = false, title = "Today's Tasks",
}: HouseBrainTasksCardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("misc");
  const [newDuration, setNewDuration] = useState(30);
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(true);
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setFadeTop(el.scrollTop > 8);
    setFadeBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }

  // Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [askAITitle, setAskAITitle] = useState<string | null>(null);

  // Long press
  const [isLongPress, setIsLongPress] = useState(false);
  const [holdingTaskId, setHoldingTaskId] = useState<string | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadTasks = useCallback(async () => {
    try {
      const data = (await getApiBase("/api/tasks", { cache: "no-store" })) as
        | { ok?: boolean; tasks?: Array<Record<string, unknown>> }
        | Array<Record<string, unknown>>;
      const raw = Array.isArray(data) ? data : (data?.tasks ?? []);
      const today = new Date().toISOString().slice(0, 10);
      const mapped: Task[] = raw.map((r: Record<string, unknown>, i: number) => ({
        id: String(r.id ?? ""),
        title: String(r.title ?? ""),
        date: r.date ? String(r.date).slice(0, 10) : today,
        startTime: (r.startTime || r.start_time) ? String(r.startTime || r.start_time) : null,
        endTime: (r.endTime || r.end_time) ? String(r.endTime || r.end_time) : null,
        durationMinutes: typeof r.durationMinutes === "number" ? r.durationMinutes : typeof r.duration_minutes === "number" ? r.duration_minutes : 60,
        status: String(r.status ?? "pending"),
        category: r.category ? String(r.category) : "misc",
        urgent: false,
        room: r.room ? String(r.room) : undefined,
        assignedBy: (r.assignedBy || r.assigned_by) ? String(r.assignedBy || r.assigned_by) : undefined,
        order: i,
      }));

      let filtered = roomFilter
        ? mapped.filter((t) => t.room === roomFilter)
        : urgentOnly
          ? mapped.filter((t) => t.urgent)
          : mapped.filter((t) => t.date === today).length > 0
            ? mapped.filter((t) => t.date === today)
            : mapped.slice(0, 20);

      // Sort: pending first (by order), completed last
      filtered = filtered.sort((a, b) => {
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (a.status !== "completed" && b.status === "completed") return -1;
        return a.order - b.order;
      }).map((t, i) => ({ ...t, order: i }));

      setTasks(filtered);
    } catch {
      setTasks([]);
    }
  }, [roomFilter, urgentOnly]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useRealtimeEvent("tasks_updated", loadTasks);

  useEffect(() => {
    return () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); };
  }, []);

  /* ─── Long press handlers ─── */
  function handlePressStart(task: Task, e: React.MouseEvent | React.TouchEvent) {
    if (readOnly) return;
    if (e.target instanceof HTMLElement && e.target.closest(".drag-handle")) return;
    setIsLongPress(false);
    setHoldingTaskId(task.id);
    pendingRef.current = task;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      setIsLongPress(true);
      if (pendingRef.current) setSelectedTask(pendingRef.current);
      pressTimerRef.current = null;
    }, LONG_PRESS_MS);
  }

  function handlePressEnd() {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
    pendingRef.current = null;
    setHoldingTaskId(null);
  }

  /* ─── Tap = toggle done ─── */
  async function handleTaskClick(task: Task, e: React.MouseEvent) {
    if (readOnly || isLongPress) return;
    if (e.target instanceof HTMLElement && e.target.closest(".drag-handle")) return;
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    // Optimistic update
    setTasks((prev) => {
      const updated = prev.map((t) => t.id === task.id ? { ...t, status: nextStatus } : t);
      return updated.sort((a, b) => {
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (a.status !== "completed" && b.status === "completed") return -1;
        return a.order - b.order;
      }).map((t, i) => ({ ...t, order: i }));
    });
    try {
      if (nextStatus === "completed") {
        await getApiBase(`/api/tasks/${task.id}/complete`, { method: "PATCH" });
      } else {
        await getApiBase(`/api/tasks/${task.id}`, { method: "PATCH", body: { status: "pending" } });
      }
    } catch {
      await loadTasks();
    }
  }

  /* ─── Actions ─── */
  async function handleDelete(task: Task) {
    try {
      await getApiBase(`/api/tasks/${task.id}`, { method: "DELETE" });
      await loadTasks();
    } catch { /* ignore */ }
  }

  async function handleSkip(task: Task) {
    // Skip = delete for now (same as DailyTasksCard "leave_empty")
    await handleDelete(task);
  }

  async function handleEditSave(task: Task, payload: { title: string; category: string; durationMinutes: number }) {
    try {
      await getApiBase(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: { title: payload.title, category: payload.category, duration_minutes: payload.durationMinutes },
      });
    } catch { /* ignore */ }
    setEditTask(null);
    await loadTasks();
  }

  /* ─── Drag reorder ─── */
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || String(active.id) === String(over.id)) return;
    const pending = tasks.filter((t) => t.status !== "completed");
    const oldIdx = pending.findIndex((t) => t.id === String(active.id));
    const newIdx = pending.findIndex((t) => t.id === String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const a = pending[oldIdx];
    const b = pending[newIdx];
    // Optimistic: swap positions AND timestamps locally
    const reordered = [...pending];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);
    const completed = tasks.filter((t) => t.status === "completed");
    // Swap start times but keep own duration
    const swapped = reordered.map((t) => {
      if (t.id === a.id && b.startTime) {
        const start = new Date(b.startTime);
        const end = new Date(start.getTime() + t.durationMinutes * 60000);
        return { ...t, startTime: b.startTime, endTime: end.toISOString() };
      }
      if (t.id === b.id && a.startTime) {
        const start = new Date(a.startTime);
        const end = new Date(start.getTime() + t.durationMinutes * 60000);
        return { ...t, startTime: a.startTime, endTime: end.toISOString() };
      }
      return t;
    });
    setTasks([...swapped, ...completed].map((t, i) => ({ ...t, order: i })));
    // Persist swap via API
    try {
      if (a.startTime && b.startTime) {
        const aNewEnd = new Date(new Date(b.startTime).getTime() + a.durationMinutes * 60000).toISOString();
        const bNewEnd = new Date(new Date(a.startTime).getTime() + b.durationMinutes * 60000).toISOString();
        await getApiBase("/api/tasks/reorder", {
          method: "PATCH",
          body: { tasks: [
            { id: a.id, startTime: b.startTime, endTime: aNewEnd },
            { id: b.id, startTime: a.startTime, endTime: bNewEnd },
          ]},
        });
      }
    } catch {
      await loadTasks();
    }
  }

  /* ─── Add task ─── */
  async function handleAddTask() {
    const t = newTitle.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await getApiBase("/api/tasks", {
        method: "POST",
        body: withActorBody({ title: t, date: today, timeWindow: "auto", durationMinutes: newDuration, category: newCategory }),
      });
      setNewTitle("");
      setNewCategory("misc");
      setNewDuration(30);
      setShowAdd(false);
      await loadTasks();
    } catch { /* ignore */ }
    finally { setAdding(false); }
  }

  const pending = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");
  const ordered = [...pending, ...completed];

  return (
    <GlassCard className="animate-fade-in-up opacity-0 overflow-hidden" style={{ animationDelay: "0.15s" }}>
      <div className="flex flex-col min-h-0 flex-1 gap-4">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-xl font-semibold text-white/90">{title}</h2>
          {!readOnly && (
            <button type="button" onClick={() => setShowAdd((v) => !v)}
              className="text-[0.8125rem] font-medium text-white/60 transition-all duration-300 ease-out hover:scale-[1.02] hover:text-blue-300">
              {showAdd ? "Cancel" : "Add +"}
            </button>
          )}
        </div>
        {showAdd && (
          <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="space-y-2 shrink-0">
            <div className="flex gap-2">
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New task…" autoFocus
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[0.875rem] text-white/90 placeholder:text-white/30 outline-none focus:border-white/20" />
              <button type="submit" disabled={adding || !newTitle.trim()}
                className="shrink-0 rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-[0.8125rem] font-medium text-white/90 transition hover:bg-white/20 disabled:opacity-40">
                {adding ? "…" : "Add"}
              </button>
            </div>
            <div className="flex gap-2">
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[0.75rem] text-white/70 outline-none">
                {TASK_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
              <select value={newDuration} onChange={(e) => setNewDuration(Number(e.target.value))}
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[0.75rem] text-white/70 outline-none">
                <option value={15}>15m</option>
                <option value={30}>30m</option>
                <option value={45}>45m</option>
                <option value={60}>1h</option>
                <option value={90}>1.5h</option>
                <option value={120}>2h</option>
              </select>
            </div>
          </form>
        )}
        {ordered.length === 0 ? (
          <p className="text-[0.8125rem] text-white/45">No tasks.</p>
        ) : (
          <div className="relative min-h-0 flex-1 overflow-hidden" style={{ maxHeight: ordered.length > 4 ? "calc(4 * 3.5rem + 3.5 * 0.625rem + 1.5rem)" : undefined }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
              <ul ref={scrollRef as React.RefObject<HTMLUListElement>} onScroll={handleScroll} className="space-y-2.5 overflow-y-auto min-h-0 h-full no-scrollbar">
                <SortableContext items={pending.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {pending.map((t) => (
                    <SortableTaskRow
                      key={t.id} task={t} isHolding={holdingTaskId === t.id} readOnly={readOnly}
                      onPressStart={(e) => handlePressStart(t, e)} onPressEnd={handlePressEnd}
                      onClick={(e) => handleTaskClick(t, e)} onContextMenu={(e) => e.preventDefault()}
                    />
                  ))}
                </SortableContext>
                {completed.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={(e) => handleTaskClick(t, e)}
                      className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.04] px-3.5 py-2.5 backdrop-blur-xl transition-all text-left opacity-35 scale-[0.98]"
                      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)" }}>
                      <span className="text-base shrink-0 opacity-50" aria-hidden>{getCategoryIcon(t.category ?? "misc")}</span>
                      <p className="text-[0.875rem] font-medium text-white/60 truncate line-through flex-1">{t.title}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </DndContext>
            {ordered.length > 4 && fadeTop && (
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#0f172a] via-[#0f172a]/80 to-transparent z-10 transition-opacity duration-300" />
            )}
            {ordered.length > 4 && fadeBottom && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent z-10 transition-opacity duration-300" />
            )}
          </div>
        )}
      </div>

      {/* Long-press action modal */}
      {selectedTask && (
        <TaskActionModal task={selectedTask}
          onClose={() => { setSelectedTask(null); setIsLongPress(false); }}
          onEdit={() => setEditTask(selectedTask)}
          onAskAI={() => setAskAITitle(selectedTask.title)}
          onSkip={() => handleSkip(selectedTask)}
          onDelete={() => handleDelete(selectedTask)}
        />
      )}
      {/* Edit modal */}
      {editTask && (
        <EditTaskModal task={editTask}
          onClose={() => { setEditTask(null); setSelectedTask(null); }}
          onSave={(p) => handleEditSave(editTask, p)}
        />
      )}
      {/* Ask AI modal */}
      {askAITitle && (
        <AskAIModal taskTitle={askAITitle} onClose={() => setAskAITitle(null)} />
      )}
    </GlassCard>
  );
}
