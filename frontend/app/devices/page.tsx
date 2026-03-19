"use client";

import DevicesCard from "../components/dashboard/DevicesCard";

export default function DevicesPage() {
  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6 md:py-10">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-xl font-semibold text-white/95 tracking-tight">Devices</h1>
        <p className="text-[0.8125rem] text-white/55 mt-1">Control your smart devices</p>
      </div>
      <DevicesCard />
    </div>
  );
}
