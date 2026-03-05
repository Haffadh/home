"use client";

import RequireRole from "../../components/auth/RequireRole";
import MainDashboard from "../../components/dashboard/MainDashboard";

export default function CleanerPanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "cleaner"]}>
      <MainDashboard
        showAdminControls={false}
        simplified={true}
        className="max-w-md mx-auto py-8 space-y-8"
      />
    </RequireRole>
  );
}
