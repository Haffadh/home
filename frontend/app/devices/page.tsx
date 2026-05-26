"use client";

import { motion } from "framer-motion";
import DevicesCard from "../components/dashboard/DevicesCard";
import { pageEntry, cardReveal, EASE_OUT_SOFT } from "@/lib/motion";

export default function DevicesPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      className="max-w-screen-2xl mx-auto px-6 py-6 md:py-10"
    >
      <motion.div
        variants={pageEntry}
        className="mb-6"
      >
        <motion.h1
          className="text-xl font-semibold text-white/95 tracking-tight"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT_SOFT }}
        >
          Devices
        </motion.h1>
        <motion.p
          className="text-[0.8125rem] text-white/55 mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.08, ease: EASE_OUT_SOFT }}
        >
          Control your smart devices
        </motion.p>
      </motion.div>
      <motion.div variants={cardReveal} initial="hidden" animate="show">
        <DevicesCard />
      </motion.div>
    </motion.div>
  );
}
