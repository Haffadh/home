"use client";

import RequireRole from "../../components/auth/RequireRole";
import RoomPanel from "../../components/dashboard/RoomPanel";

export default function WinkleviRoomPanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "winklevi_room"]}>
      <RoomPanel roomId="winklevi_room" roomLabel="Winklevi Room" />
    </RequireRole>
  );
}
