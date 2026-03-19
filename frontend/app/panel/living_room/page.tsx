"use client";

import RequireRole from "../../components/auth/RequireRole";
import RoomPanel from "../../components/dashboard/RoomPanel";

export default function LivingRoomPanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "living_room"]}>
      <RoomPanel roomId="living_room" roomLabel="Living Room" />
    </RequireRole>
  );
}
