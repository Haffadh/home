"use client";

const cardStyle = "rounded-2xl bg-slate-800/50 backdrop-blur-md border border-white/[0.06]";

export type SkipOption = "leave_empty" | "replace" | "bring_forward";

export type SkipTaskModalProps = {
  taskTitle: string;
  onChoose: (option: SkipOption) => void;
  onClose: () => void;
  onEdit?: () => void;
};

export default function SkipTaskModal({ taskTitle, onChoose, onClose, onEdit }: SkipTaskModalProps) {
  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-sm rounded-2xl p-6 ${cardStyle} shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white/95 mb-1">Task: {taskTitle}</h3>
        <p className="text-[0.6875rem] text-white/50 uppercase tracking-wider mb-4">Skip options</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onChoose("leave_empty")}
            className="w-full rounded-xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.875rem] font-medium text-white/90 hover:bg-[#0f172a]/80 transition text-left px-4"
          >
            Leave time slot empty
          </button>
          <button
            type="button"
            onClick={() => onChoose("replace")}
            className="w-full rounded-xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.875rem] font-medium text-white/90 hover:bg-[#0f172a]/80 transition text-left px-4"
          >
            Replace another task
          </button>
          <button
            type="button"
            onClick={() => onChoose("bring_forward")}
            className="w-full rounded-xl border border-white/10 bg-[#0f172a]/70 py-2.5 text-[0.875rem] font-medium text-white/90 hover:bg-[#0f172a]/80 transition text-left px-4"
          >
            Bring all later tasks forward
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="w-full rounded-xl border border-[rgba(99,179,237,0.3)] bg-[rgba(99,179,237,0.15)] py-2.5 text-[0.875rem] font-medium text-white/90 hover:bg-[rgba(99,179,237,0.2)] transition text-left px-4 mt-2"
            >
              Edit task instead
            </button>
          )}
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-white/10 py-2.5 text-[0.8125rem] text-white/60 hover:bg-white/5 transition mt-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
