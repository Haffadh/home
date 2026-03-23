"use client";

import RequireRole from "../../components/auth/RequireRole";
import FamilyDashboard from "../../components/dashboard/FamilyDashboard";

export default function HousePanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "moeen", "samya", "nawaf", "ahmed", "mariam"]}>
      <FamilyDashboard />
    </RequireRole>
  );
}
