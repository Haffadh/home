"use client";

import RequireRole from "../../components/auth/RequireRole";
import MainDashboard from "../../components/dashboard/MainDashboard";

export default function KitchenPanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "kitchen"]}>
      <MainDashboard showAdminControls={false} />
    </RequireRole>
  );
}
