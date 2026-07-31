"use client";

import { motion } from "framer-motion";
import { pageEnter, useInstantMotion } from "@/lib/design/motion";

/**
 * Next.js App Router `template.tsx` — re-renders on navigation, giving every
 * routed page the single Hearth page-enter: fade + small rise. No exits.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const instant = useInstantMotion();
  return (
    <motion.div {...pageEnter(instant)} className="h-full">
      {children}
    </motion.div>
  );
}
