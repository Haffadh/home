"use client";

import RequireRole from "../../components/auth/RequireRole";
import RoomPanel from "../../components/dashboard/RoomPanel";

export default function MariamRoomPanelPage() {
  return (
    <RequireRole allowedRoles={["admin", "mariam_room"]}>
      <RoomPanel roomId="mariam_room" roomLabel="Mariam Room" />
    </RequireRole>
  );
}
