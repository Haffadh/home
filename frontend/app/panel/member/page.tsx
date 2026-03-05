"use client";

import RequireRole from "../../components/auth/RequireRole";
import MainDashboard from "../../components/dashboard/MainDashboard";

export default function MemberPanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "member"]}>
      <MainDashboard showAdminControls={false} />
    </RequireRole>
  );
}
