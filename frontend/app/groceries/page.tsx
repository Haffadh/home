"use client";

import GroceriesCard from "../components/dashboard/GroceriesCard";

export default function GroceriesPage() {
  return (
    <div className="p-6 md:p-10 max-w-2xl">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-xl font-semibold text-white/95 tracking-tight">Groceries</h1>
        <p className="text-[0.8125rem] text-white/55 mt-1">Manage your grocery list</p>
      </div>
      <GroceriesCard maxItems={999} />
    </div>
  );
}
