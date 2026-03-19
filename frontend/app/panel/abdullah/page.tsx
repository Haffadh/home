"use client";

import RequireRole from "../../components/auth/RequireRole";
import MainDashboard from "../../components/dashboard/MainDashboard";

export default function AbdullahPanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "abdullah"]}>
      <div className="min-h-full w-full overflow-x-hidden pb-safe px-3 sm:px-6">
        <MainDashboard showAdminControls={false} layout="abdullah" />
      </div>
    </RequireRole>
  );
}
