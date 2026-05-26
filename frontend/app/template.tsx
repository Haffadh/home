"use client";

import { motion } from "framer-motion";
import { EASE_OUT_SOFT } from "@/lib/motion";

/**
 * Next.js App Router `template.tsx` — re-renders on navigation.
 * Applies a subtle cross-fade + rise to every routed page.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT_SOFT }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
