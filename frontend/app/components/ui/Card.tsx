import type { ElementType, ReactNode } from "react";

type Tone = "surface" | "sunk" | "accent" | "done";
type Elevation = "flat" | "e1" | "e2";

export type CardProps = {
  tone?: Tone;
  elevation?: Elevation;
  /** Renders as <li>, <article>, etc. Defaults to <div>. */
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

const TONE: Record<Tone, string> = {
  surface: "bg-hearth-surface border-hearth-line",
  sunk: "bg-hearth-sunk border-transparent",
  accent: "bg-hearth-accent-soft border-hearth-accent/25",
  done: "bg-hearth-done-soft border-hearth-done/20",
};

const ELEVATION: Record<Elevation, string> = {
  flat: "",
  e1: "shadow-h-e1",
  e2: "shadow-h-e2",
};

/**
 * A card is only correct when elevation communicates real hierarchy. For plain
 * grouping prefer whitespace or a single hairline — that is why `flat` and the
 * `sunk` tone exist.
 */
export function Card({
  tone = "surface",
  elevation = "e1",
  as: Tag = "div",
  className = "",
  children,
}: CardProps) {
  return (
    <Tag
      className={[
        "rounded-h-lg border p-h6",
        TONE[tone],
        ELEVATION[elevation],
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}

/** Small caps-free section label. Used sparingly — see the style guide notes. */
export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-h9 font-medium tracking-[0.02em] text-hearth-ink-3">
      {children}
    </p>
  );
}
