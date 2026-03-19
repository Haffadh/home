"use client";

import { useEffect, useState } from "react";
import GroceriesCard from "../components/dashboard/GroceriesCard";
import { getStoredRole } from "../../lib/roles";
import { getSupabaseClient } from "../../lib/supabaseClient";
import * as groceriesService from "../../lib/services/groceries";
import { generateGroceryPDF } from "../../lib/pdf/groceryPdf";

export default function GroceriesPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(getStoredRole());
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
    <div className="max-w-screen-2xl mx-auto px-6 py-6 md:py-10">
      <div className="mb-6 animate-fade-in-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white/95 tracking-tight">Groceries</h1>
          <p className="text-[0.8125rem] text-white/55 mt-1">Manage your grocery list</p>
        </div>
        {showPdfButton && getSupabaseClient() && (
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="rounded-xl border border-white/10 bg-[#0f172a]/70 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90 hover:bg-[#0f172a]/80 transition"
          >
            Download Grocery List
          </button>
        )}
      </div>
      <GroceriesCard maxItems={999} />
    </div>
  );
}
