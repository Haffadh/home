"use client";

const cardStyle = "rounded-2xl bg-slate-800/50 backdrop-blur-md border border-white/[0.06]";

export type AbdullahBusyModalProps = {
  taskName: string;
  untilTime: string;
  onUrgent: () => void;
  onCanWait: () => void;
  onClose: () => void;
};

export default function AbdullahBusyModal({ taskName, untilTime, onUrgent, onCanWait, onClose }: AbdullahBusyModalProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-sm rounded-2xl p-6 ${cardStyle} shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white/95 mb-2">Abdullah is busy</h3>
        <p className="text-[0.8125rem] text-white/70 mb-5">
          Abdullah is currently busy with <strong>{taskName}</strong> until {untilTime}.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onUrgent}
            className="w-full rounded-xl bg-amber-500/20 border border-amber-400/30 py-2.5 text-[0.875rem] font-medium text-amber-200 hover:bg-amber-500/25 transition"
          >
            It&apos;s URGENT!
          </button>
          <button
            type="button"
            onClick={onCanWait}
            className="w-full rounded-xl bg-[rgba(99,179,237,0.2)] border border-[rgba(99,179,237,0.3)] py-2.5 text-[0.875rem] font-medium text-white/90 hover:bg-[rgba(99,179,237,0.25)] transition"
          >
            It can wait
          </button>
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-white/10 py-2.5 text-[0.8125rem] text-white/70 hover:bg-white/5 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
