"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import GroceriesCard from "../components/dashboard/GroceriesCard";
import { getStoredRole } from "../../lib/roles";
import { getSupabaseClient } from "../../lib/supabaseClient";
import * as groceriesService from "../../lib/services/groceries";
import { generateGroceryPDF } from "../../lib/pdf/groceryPdf";
import { pageEntry, cardReveal, SPRING_TAP, EASE_OUT_SOFT } from "@/lib/motion";

export default function GroceriesPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => setRole(getStoredRole()));
  }, []);

  async function handleDownloadPdf() {
    if (!getSupabaseClient()) return;
    try {
      const rows = await groceriesService.fetchGroceries();
      generateGroceryPDF(rows);
    } catch {
      // ignore
    }
  }

  const showPdfButton = role === "abdullah" || role === "admin";

  return (
    <motion.div
      initial="hidden"
      animate="show"
      className="max-w-screen-2xl mx-auto px-6 py-6 md:py-10"
    >
      <motion.div
        variants={pageEntry}
        className="mb-6 flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <motion.h1
            className="text-xl font-semibold text-white/95 tracking-tight"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_SOFT }}
          >
            Groceries
          </motion.h1>
          <motion.p
            className="text-[0.8125rem] text-white/55 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.08, ease: EASE_OUT_SOFT }}
          >
            Manage your grocery list
          </motion.p>
        </div>
        {showPdfButton && getSupabaseClient() && (
          <motion.button
            type="button"
            onClick={handleDownloadPdf}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_TAP}
            className="rounded-xl border border-white/10 bg-[#0f172a]/70 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90 hover:bg-[#0f172a]/80 hover:border-white/20 transition-colors"
          >
            Download Grocery List
          </motion.button>
        )}
      </motion.div>
      <motion.div variants={cardReveal} initial="hidden" animate="show">
        <GroceriesCard maxItems={999} />
      </motion.div>
    </motion.div>
  );
}
