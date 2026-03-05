"use client";

import { useEffect, useState } from "react";
import { getStoredRole } from "../../../lib/roles";
import type { Role } from "../../../lib/roles";
import { can } from "../../../lib/permissions";
import ScenesCard from "./ScenesCard";
import UrgentTasksCard from "./UrgentTasksCard";
import DailyTasksCard from "./DailyTasksCard";
import MealsCard from "./MealsCard";
import ActivityBubble from "./ActivityBubble";

export type MainDashboardProps = {
  showAdminControls?: boolean;
  /** Simplified layout: only Today's Tasks + Urgent Tasks (e.g. cleaner) */
  simplified?: boolean;
  /** Extra CSS class for the container (e.g. cleaner mobile layout) */
  className?: string;
};

export default function MainDashboard({
  showAdminControls = false,
  simplified = false,
  className = "",
}: MainDashboardProps) {
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    setRole(getStoredRole());
  }, []);
  const canEditTasks = can(role, "edit");
  const canControlDevices = can(role, "controlDevices");
  const canReorder = can(role, "reorder");
  const readOnly = !can(role, "edit");

  return (
    <div className={`h-full min-h-0 flex flex-col overflow-hidden px-4 py-4 md:px-6 md:py-5 ${className}`}>
      {showAdminControls && (
        <>
          <section className="mb-4 shrink-0">
            <h2 className="text-[1rem] font-medium text-white/90 tracking-tight mb-3">Admin Controls</h2>
            <div className="flex flex-wrap gap-3">
              <span className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90">
                Manage Users
              </span>
              <span className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90">
                System Logs
              </span>
              <span className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90">
                Device Pairing
              </span>
              <span className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[0.8125rem] font-medium text-white/90">
                Global Settings
              </span>
            </div>
          </section>
          <div className="mb-4 shrink-0 max-w-md">
            <ActivityBubble />
          </div>
        </>
      )}

      {simplified ? (
        <div className="flex flex-col flex-1 min-h-0 gap-8">
          <UrgentTasksCard canEditTasks={canEditTasks} readOnly={readOnly} simplified />
          <div className="min-h-0 flex flex-col flex-1">
            <DailyTasksCard readOnly={readOnly} canEditTasks={canEditTasks} canReorder={canReorder} simplified />
          </div>
        </div>
      ) : (
        <div className="home-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 flex-1 min-h-0" style={{ gridTemplateRows: "min-content min-content 1fr" }}>
          <ScenesCard readOnly={readOnly || !canControlDevices} />
          <UrgentTasksCard canEditTasks={canEditTasks} readOnly={readOnly} />
          <div className="min-h-0 flex flex-col">
            <DailyTasksCard readOnly={readOnly} canEditTasks={canEditTasks} canReorder={canReorder} />
          </div>
          <div className="col-span-1 sm:col-span-2 xl:col-span-3 min-h-0 overflow-hidden">
            <MealsCard readOnly={readOnly} canEditTasks={canEditTasks} />
          </div>
        </div>
      )}
    </div>
  );
}
