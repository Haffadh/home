"use client";

import RequireRole from "../../components/auth/RequireRole";
import HouseControlPanel from "../../components/dashboard/HouseControlPanel";

export default function HousePanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "house"]}>
      <div className="min-h-full w-full overflow-x-hidden pb-safe">
        <HouseControlPanel />
      </div>
    </RequireRole>
  );
}
