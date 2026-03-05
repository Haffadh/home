"use client";

import DevicesCard from "../components/dashboard/DevicesCard";

export default function DevicesPage() {
  return (
    <div className="p-6 md:p-10 max-w-2xl">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-xl font-semibold text-white/95 tracking-tight">Devices</h1>
        <p className="text-[0.8125rem] text-white/55 mt-1">Control your smart devices</p>
      </div>
      <DevicesCard />
    </div>
  );
}
