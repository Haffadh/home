"use client";

import { forwardRef, useId } from "react";
import { CaretDown } from "@phosphor-icons/react";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
};

/**
 * A native <select> on purpose. iPad Safari renders it as the system wheel,
 * which is the fastest control on a tablet and the one Abdullah already knows
 * from the current admin page. A custom listbox would be slower and heavier.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, hideLabel, className = "", id: idProp, children, ...rest },
  ref
) {
  const auto = useId();
  const id = idProp ?? auto;

  return (
    <div className="flex flex-col gap-h2">
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : "text-h8 font-medium text-hearth-ink-2"}
      >
        {label}
      </label>

      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className={[
            "w-full min-h-[48px] appearance-none rounded-h-sm border bg-hearth-surface",
            "pl-h4 pr-h10 py-h3 text-h7 text-hearth-ink cursor-pointer",
            "transition-colors duration-[var(--dur-h-fast)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error ? "border-hearth-accent" : "border-hearth-line-strong",
            className,
          ].join(" ")}
          {...rest}
        >
          {children}
        </select>
        <CaretDown
          aria-hidden
          weight="bold"
          size={16}
          className="pointer-events-none absolute right-h4 top-1/2 -translate-y-1/2 text-hearth-ink-3"
        />
      </div>

      {hint && !error && (
        <p id={`${id}-hint`} className="text-h9 text-hearth-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-h9 font-medium text-hearth-accent">
          {error}
        </p>
      )}
    </div>
  );
});
