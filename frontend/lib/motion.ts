/**
 * Shared motion tokens for consistent animation across the app.
 * Uses framer-motion. Import as `import { motion } from "framer-motion"`.
 */

import type { Transition, Variants } from "framer-motion";

/** Standard easing — soft, decelerating "iOS-style" curve */
export const EASE_OUT_SOFT: Transition["ease"] = [0.16, 1, 0.3, 1];

/** Fast spring for interactive elements (hover/tap) */
export const SPRING_TAP: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 28,
};

/** Page entry — fade + slight rise */
export const pageEntry: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT_SOFT },
  },
};

/** Stagger container */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

/** List item — fade + rise, used inside staggerContainer */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT_SOFT },
  },
};

/** Card reveal — fade + slight scale */
export const cardReveal: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT_SOFT },
  },
};

/** Modal fade in */
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: EASE_OUT_SOFT },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.15 },
  },
};
