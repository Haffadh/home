"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "quiet" | "done";
type Size = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Renders the spinner and blocks input. Keeps its width so nothing reflows. */
  loading?: boolean;
  /** Phosphor icon element, placed before the label. */
  icon?: React.ReactNode;
  fullWidth?: boolean;
};

/* Every variant pairs a background with a foreground that clears 4.5:1 on it.
   White-on-accent is 5.44:1, white-on-done is 6.13:1. */
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-hearth-accent text-white shadow-h-e1 hover:brightness-110 active:brightness-95",
  secondary:
    "bg-hearth-surface text-hearth-ink border border-hearth-line-strong shadow-h-e1 hover:bg-hearth-sunk",
  quiet:
    "bg-transparent text-hearth-ink-2 hover:bg-hearth-sunk hover:text-hearth-ink",
  done: "bg-hearth-done text-white shadow-h-e1 hover:brightness-110 active:brightness-95",
};

/* sm still clears the 44px WCAG target; md/lg clear the 48px the staff panel
   requires. Nothing smaller than sm exists on purpose. */
const SIZE: Record<Size, string> = {
  sm: "min-h-[44px] px-h4 text-h8 gap-h2 rounded-h-md",
  md: "min-h-[48px] px-h5 text-h7 gap-h2 rounded-h-md",
  lg: "min-h-[60px] px-h6 text-h6 gap-h3 rounded-h-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      fullWidth,
      disabled,
      className = "",
      children,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={[
          "inline-flex items-center justify-center font-medium cursor-pointer select-none",
          "transition-[background-color,color,filter,transform] duration-[var(--dur-h-fast)] ease-[var(--ease-h-out)]",
          // Tactile push. Transform only, so it never triggers layout.
          "active:translate-y-[1px]",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0",
          VARIANT[variant],
          SIZE[size],
          fullWidth ? "w-full" : "",
          className,
        ].join(" ")}
        {...rest}
      >
        {loading ? (
          <span
            aria-hidden
            className="size-[18px] shrink-0 rounded-full border-2 border-current border-r-transparent animate-spin"
          />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  }
);
