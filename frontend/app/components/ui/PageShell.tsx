import type { ReactNode } from "react";

type Width = "reader" | "panel" | "wide" | "full";

export type PageShellProps = {
  title?: string;
  /** Sits under the title. Keep it to one short line. */
  subtitle?: string;
  /** Top-right slot: sign out, a single action. Never a nav bar. */
  action?: ReactNode;
  width?: Width;
  /** Dashboard mode: no page padding, no header chrome, fills the display. */
  bare?: boolean;
  children: ReactNode;
};

const WIDTH: Record<Width, string> = {
  reader: "max-w-[42rem]", // family panel, one column of prose-width content
  panel: "max-w-[52rem]", // staff task list
  wide: "max-w-[80rem]", // admin
  full: "max-w-none", // wall dashboard
};

/**
 * Owns the warm canvas. Applying `theme-hearth` here rather than on <body> is
 * what keeps this design system additive: pages opt in one at a time, and the
 * untouched pages keep inheriting the old dark body exactly as before.
 */
export function PageShell({
  title,
  subtitle,
  action,
  width = "panel",
  bare = false,
  children,
}: PageShellProps) {
  if (bare) {
    return (
      <div className="theme-hearth theme-hearth-root">{children}</div>
    );
  }

  return (
    <div className="theme-hearth theme-hearth-root">
      <div
        className={`mx-auto w-full ${WIDTH[width]} px-h5 pb-h20 pt-h8 md:px-h8`}
      >
        {(title || action) && (
          <header className="mb-h8 flex items-start justify-between gap-h5">
            <div className="min-w-0">
              {title && (
                <h1 className="text-h3 font-semibold tracking-[-0.02em] text-hearth-ink">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-h1 text-h7 text-hearth-ink-3">{subtitle}</p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

/** Groups content under a quiet heading. Prefer this over nesting cards. */
export function Section({
  heading,
  children,
  className = "",
}: {
  heading?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-h10 ${className}`}>
      {heading && (
        <h2 className="mb-h4 text-h4 font-semibold tracking-[-0.01em] text-hearth-ink">
          {heading}
        </h2>
      )}
      {children}
    </section>
  );
}
