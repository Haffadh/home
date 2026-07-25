import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "done" | "muted";

export type BadgeProps = {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

/* No decorative status dots. The badge's own colour and label carry the state,
   which keeps one signal per element instead of two. */
const TONE: Record<Tone, string> = {
  neutral: "bg-hearth-sunk text-hearth-ink-2",
  accent: "bg-hearth-accent-soft text-hearth-accent",
  done: "bg-hearth-done-soft text-hearth-done",
  muted: "bg-transparent text-hearth-ink-3 border border-hearth-line",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-h1 rounded-h-pill px-h3 py-h1",
        "text-h9 font-medium whitespace-nowrap",
        TONE[tone],
        className,
      ].join(" ")}
    >
      {icon}
      {children}
    </span>
  );
}
