/**
 * HEARTH tokens — TypeScript mirror of app/hearth.css.
 *
 * CSS is the source of truth for anything a stylesheet can express. This file
 * exists for the values JS genuinely needs: motion durations and easings for
 * Framer Motion, and the palette for the /design style guide to render itself.
 * Keep the two in sync by hand; there are few enough values that a build step
 * would cost more than it saves.
 */

export const COLOR = {
  canvas: "#F6F4F1",
  surface: "#FFFFFF",
  sunk: "#EFEBE6",
  line: "#E2DCD4",
  lineStrong: "#CFC7BC",
  ink: "#1F1B17",
  ink2: "#57504A",
  ink3: "#6E655E",
  accent: "#B4471B",
  accentSoft: "#FBEDE5",
  done: "#4A6B2A",
  doneSoft: "#EDF1E4",
} as const;

/** Contrast ratios verified against the surfaces each token is allowed on. */
export const CONTRAST = {
  ink: { canvas: 15.58, surface: 17.11 },
  ink2: { canvas: 7.21, surface: 7.92 },
  ink3: { canvas: 5.19, surface: 5.7, sunk: 4.8 },
  accent: { canvas: 4.96, surface: 5.44, accentSoft: 4.76 },
  done: { surface: 6.13, doneSoft: 5.34 },
} as const;

export const TYPE = [
  { name: "h1", px: 128, use: "Dashboard clock", weight: 600, tracking: "-0.03em" },
  { name: "h2", px: 72, use: "Dashboard numerals", weight: 600, tracking: "-0.02em" },
  { name: "h3", px: 40, use: "Page title", weight: 600, tracking: "-0.02em" },
  { name: "h4", px: 28, use: "Section heading", weight: 600, tracking: "-0.01em" },
  { name: "h5", px: 22, use: "Card heading, task title", weight: 600, tracking: "-0.01em" },
  { name: "h6", px: 19, use: "Lead body", weight: 400, tracking: "0" },
  { name: "h7", px: 17, use: "Body", weight: 400, tracking: "0" },
  { name: "h8", px: 15, use: "Label", weight: 500, tracking: "0" },
  { name: "h9", px: 13, use: "Meta, timestamps", weight: 500, tracking: "0.02em" },
] as const;

export const SPACE = [
  { name: "h1", px: 4 },
  { name: "h2", px: 8 },
  { name: "h3", px: 12 },
  { name: "h4", px: 16 },
  { name: "h5", px: 20 },
  { name: "h6", px: 24 },
  { name: "h8", px: 32 },
  { name: "h10", px: 40 },
  { name: "h12", px: 48 },
  { name: "h16", px: 64 },
  { name: "h20", px: 80 },
  { name: "h24", px: 96 },
] as const;

export const RADIUS = [
  { name: "h-sm", px: 8, use: "Inputs, small chips" },
  { name: "h-md", px: 12, use: "Buttons, inner wells" },
  { name: "h-lg", px: 16, use: "Cards" },
  { name: "h-xl", px: 22, use: "Page-level panels" },
  { name: "h-pill", px: 999, use: "Badges only" },
] as const;

export const SHADOW = [
  { name: "h-e1", use: "Resting card on canvas" },
  { name: "h-e2", use: "Raised card, menu" },
  { name: "h-e3", use: "Modal, sheet" },
] as const;

/** Motion durations in seconds, the unit Framer Motion expects.
    Three, not four (Phase 4): every animation is feedback, a transition, or
    ambient. Anything that can't say which it is doesn't get animated. */
export const DUR = {
  fast: 0.18, // feedback: taps, hover colour, "Saved" confirmations
  base: 0.3, // transitions: enter/exit, page-enter, list reflow
  ambient: 0.5, // ambient: dashboard crossfades, the offline dot
} as const;

/** Cubic-bezier control points, matching --ease-h-* in hearth.css.
    One family: `out` for things arriving or settling, `inOut` for things
    moving between two resting states. */
export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const MOTION_DOC = [
  { name: "fast", ms: 180, use: "Feedback — taps, hover colour, saved ticks" },
  { name: "base", ms: 300, use: "Transitions — enter, exit, page-enter, reflow" },
  { name: "ambient", ms: 500, use: "Ambient — dashboard crossfades, offline dot" },
] as const;
