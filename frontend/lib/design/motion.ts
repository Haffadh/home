/**
 * HEARTH motion helpers — the JS side of the motion system.
 *
 * Every animated surface derives ONE boolean from useInstantMotion() and keys
 * every duration off it. Two things force instant swaps:
 *
 *  1. prefers-reduced-motion — the user asked.
 *  2. document hidden — Chrome halts requestAnimationFrame for hidden and
 *     occluded pages, so a Framer exit started then freezes mid-flight and
 *     stacks ghost content until the next repaint (found the hard way in
 *     Phase 3). When nothing can be seen there is nothing to animate.
 */

import { useEffect, useState } from "react";
import { DUR, EASE } from "./tokens";

/** Own media-query read, not Framer's useReducedMotion: Framer snapshots a
    lazily-initialized global whose timing can miss a preference that was set
    before the app booted. This reads the live value at mount and subscribes. */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduce;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** True when every animation must be an instant swap. */
export function useInstantMotion(): boolean {
  const reduce = usePrefersReducedMotion();
  const visible = usePageVisible();
  return reduce || !visible;
}

/** The one page-enter treatment: subtle fade + small rise. No exit — exit
    animations on navigation fight the router. */
export function pageEnter(instant: boolean) {
  return {
    initial: instant ? false : ({ opacity: 0, y: 8 } as const),
    animate: { opacity: 1, y: 0 } as const,
    transition: instant
      ? ({ duration: 0 } as const)
      : ({ duration: DUR.base, ease: EASE.out } as const),
  };
}
