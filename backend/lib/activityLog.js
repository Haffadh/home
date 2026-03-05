/**
 * Activity log: persist and broadcast. getActor from request (body/headers).
 * broadcast(server, event, payload) sends to all WS clients.
 */

export function getActor(request) {
  const body = request.body || {};
  const role = body.actorRole ?? request.headers["x-actor-role"] ?? null;
  const name = body.actorName ?? request.headers["x-actor-name"] ?? null;
  return {
    actor_role: typeof role === "string" ? role.slice(0, 64) : null,
    actor_name: typeof name === "string" ? name.slice(0, 128) : null,
  };
}

export async function logActivity(db, { actor_role, actor_name, action, entity_type, entity_id, payload_json }) {
  if (!db) return;
  try {
    await db.query(
      `INSERT INTO activity_log (actor_role, actor_name, action, entity_type, entity_id, payload_json)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actor_role ?? null,
        actor_name ?? null,
        String(action ?? "").slice(0, 64),
        String(entity_type ?? "").slice(0, 64),
        entity_id != null ? String(entity_id).slice(0, 128) : null,
        payload_json != null ? JSON.stringify(payload_json) : null,
      ]
    );
  } catch (e) {
    console.error("activity_log insert failed:", e.message);
  }
}

/** Broadcast JSON message to all connected WebSocket clients */
export function broadcast(server, event, payload) {
  if (!server?.websocketServer?.clients) return;
  const msg = JSON.stringify({ event, ...payload });
  try {
    server.websocketServer.clients.forEach((client) => {
      if (client.readyState === 1) client.send(msg);
    });
  } catch (e) {
    console.error("websocket broadcast failed:", e.message);
  }
}
