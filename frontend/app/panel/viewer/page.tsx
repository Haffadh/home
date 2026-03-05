"use client";

import { useEffect, useState } from "react";
import RequireRole from "../../components/auth/RequireRole";
import MainDashboard from "../../components/dashboard/MainDashboard";

export default function ViewerPanelPage() {
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <RequireRole allowedRoles={["admin", "viewer"]}>
      <MainDashboard key={refreshTick} showAdminControls={false} />
    </RequireRole>
  );
}
