"use client";

import RequireRole from "../../components/auth/RequireRole";
import MainDashboard from "../../components/dashboard/MainDashboard";

export default function AdminPanelPage() {
  return (
    <RequireRole allowedRoles={["admin"]}>
      <MainDashboard showAdminControls={true} />
    </RequireRole>
  );
}
