/**
 * API base URL and actor metadata from localStorage (current UI role/name).
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:4000";

const STORAGE_KEY_ROLE = "shh_role";
const STORAGE_KEY_ACTOR_NAME = "shh_actor_name";

export async function getApiBase(path: string) {
  const token = localStorage.getItem("token"); // or however you're storing it

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return res.json();
}

export function getActorMeta(): { actorRole: string; actorName: string } {
  if (typeof window === "undefined") return { actorRole: "", actorName: "" };
  const role = localStorage.getItem(STORAGE_KEY_ROLE) || "";
  const name = localStorage.getItem(STORAGE_KEY_ACTOR_NAME) || role || "—";
  return { actorRole: role, actorName: name };
}

/** Headers to send with mutation requests for activity log */
export function getActorHeaders(): Record<string, string> {
  const { actorRole, actorName } = getActorMeta();
  const h: Record<string, string> = {};
  if (actorRole) h["X-Actor-Role"] = actorRole;
  if (actorName) h["X-Actor-Name"] = actorName;
  return h;
}

/** Merge actor into JSON body for POST/PATCH */
export function withActorBody<T extends Record<string, unknown>>(body: T): T {
  const { actorRole, actorName } = getActorMeta();
  return { ...body, ...(actorRole && { actorRole }), ...(actorName && { actorName }) };
}

