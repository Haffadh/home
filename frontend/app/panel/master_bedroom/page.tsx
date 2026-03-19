"use client";

import RequireRole from "../../components/auth/RequireRole";
import RoomPanel from "../../components/dashboard/RoomPanel";

export default function MasterBedroomPanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "master_bedroom"]}>
      <RoomPanel roomId="master_bedroom" roomLabel="Master Bedroom" />
    </RequireRole>
  );
}
