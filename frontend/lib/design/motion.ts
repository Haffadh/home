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

import { useEffect, useLayoutEffect, useState } from "react";

/** These hooks must settle BEFORE the browser paints, or the mount animation
    they are meant to suppress has already started. useLayoutEffect runs
    synchronously after render and before paint; on the server it does not run
    at all and React warns, so fall back to useEffect there. */
const useBeforePaint =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Own media-query read, not Framer's useReducedMotion: Framer snapshots a
    lazily-initialized global whose timing can miss a preference that was set
    before the app booted. This reads the live value at mount and subscribes.

    Seeded false and corrected before paint rather than read during render:
    a render-time read would disagree with the server-rendered markup and
    trip hydration. Child effects run before parent effects, so Framer has
    already queued the mount animation by the time this fires — but the state
    update forces a synchronous re-render before paint, so the animation is
    retargeted to duration 0 and no intermediate frame is ever shown. */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useBeforePaint(() => {
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
  useBeforePaint(() => {
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

/* The page-enter used to live here as a Framer prop bundle. It is now the
   `.hearth-page-enter` CSS animation applied by app/template.tsx — a mount-time
   animation cannot be gated by a hook that only resolves after first paint.
   Everything else on the surfaces animates in response to a user action or a
   data change, i.e. well after useInstantMotion() has settled, so those stay
   on Framer and keep using DUR/EASE below. */
