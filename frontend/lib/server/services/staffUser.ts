import { getDb } from "@/lib/server/db";

/**
 * Who the daily tasks belong to.
 *
 * There is exactly one member of household staff, and every surface needs to
 * agree on which user that is. Resolving it on the server — by ROLE, never by
 * "whoever is signed in" — is what keeps the three surfaces in sync:
 *
 *  - the wall dashboard has no user at all, only a device token
 *  - the admin panel is used by whoever is administering, not by the staff
 *  - the staff panel runs on a shared tablet, and used to key off the signed-in
 *    user's id. Open it as anyone else and it queried THEIR id and rendered
 *    "No tasks today" while the tasks sat there under Abdullah's id.
 *
 * Kitchen is accepted as a fallback so a kitchen-role account keeps working.
 */
export async function getStaffUserId(): Promise<number | null> {
  const db = getDb();
  const { data } = await db
    .from("users")
    .select("id, role")
    .in("role", ["abdullah", "kitchen"])
    .order("id", { ascending: true });

  if (!data || data.length === 0) return null;
  // Prefer the dedicated staff role if both exist.
  const staff = data.find((u) => u.role === "abdullah") ?? data[0];
  return staff.id as number;
}
