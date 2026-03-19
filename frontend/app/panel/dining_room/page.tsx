"use client";

import RequireRole from "../../components/auth/RequireRole";
import RoomPanel from "../../components/dashboard/RoomPanel";

export default function DiningRoomPanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "dining_room"]}>
      <RoomPanel roomId="dining_room" roomLabel="Dining Room" />
    </RequireRole>
  );
}
