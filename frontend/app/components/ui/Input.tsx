"use client";

import { forwardRef, useId } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  /** Visually hides the label but keeps it for screen readers. */
  hideLabel?: boolean;
};

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & FieldProps;
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldProps;

/* 17px minimum — mobile Safari zooms the viewport on focus for anything under
   16px, which on a tablet reads as the page "jumping". */
const CONTROL =
  "w-full min-h-[48px] rounded-h-sm border bg-hearth-surface px-h4 py-h3 text-h7 " +
  "text-hearth-ink placeholder:text-hearth-ink-3 " +
  "transition-colors duration-[var(--dur-h-fast)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

function Shell({
  id,
  label,
  hint,
  error,
  hideLabel,
  children,
}: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-h2">
      {/* Label above the control, always. Placeholder is never the label. */}
      <label
        htmlFor={id}
        className={
          hideLabel
            ? "sr-only"
            : "text-h8 font-medium text-hearth-ink-2"
        }
      >
        {label}
      </label>
      {children}
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
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel, className = "", id: idProp, ...rest },
  ref
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={[
          CONTROL,
          error ? "border-hearth-accent" : "border-hearth-line-strong",
          className,
        ].join(" ")}
        {...rest}
      />
    </Shell>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, hint, error, hideLabel, className = "", id: idProp, rows = 3, ...rest },
    ref
  ) {
    const auto = useId();
    const id = idProp ?? auto;
    return (
      <Shell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className={[
            CONTROL,
            "resize-y leading-relaxed",
            error ? "border-hearth-accent" : "border-hearth-line-strong",
            className,
          ].join(" ")}
          {...rest}
        />
      </Shell>
    );
  }
);
