/**
 * Home Assistant REST API client.
 * Env: HASS_URL (e.g. http://homeassistant.local:8123), HASS_TOKEN (long-lived access token).
 */

const TIMEOUT_MS = 8000;

export function isConfigured() {
  return Boolean(process.env.HASS_URL && process.env.HASS_TOKEN);
}

async function hassRequest(method, path, body) {
  const url = process.env.HASS_URL;
  const token = process.env.HASS_TOKEN;
  if (!url || !token) throw new Error("Home Assistant not configured (HASS_URL / HASS_TOKEN)");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const detail = text.slice(0, 200);
      throw new Error(`HA ${res.status}: ${detail}`);
    }
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(t);
  }
}

/** GET /api/states — all entity states */
export async function fetchAllStates() {
  return hassRequest("GET", "/api/states");
}

/** GET /api/states/{entity_id} — single entity */
export async function fetchEntityState(entityId) {
  return hassRequest("GET", `/api/states/${encodeURIComponent(entityId)}`);
}

/** POST /api/services/{domain}/{service} — call a service */
export async function callService(domain, service, data = {}) {
  return hassRequest("POST", `/api/services/${domain}/${service}`, data);
}
