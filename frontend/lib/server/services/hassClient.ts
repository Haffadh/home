/**
 * Home Assistant REST API client.
 * Ported from backend/services/hassClient.js.
 */

const TIMEOUT_MS = 8000;

export function isConfigured(): boolean {
  return Boolean(process.env.HASS_URL && process.env.HASS_TOKEN);
}

async function hassRequest(method: string, path: string, body?: unknown) {
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
    if (!res.ok) throw new Error(`HA ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchAllStates() {
  return hassRequest("GET", "/api/states");
}

export async function fetchEntityState(entityId: string) {
  return hassRequest("GET", `/api/states/${encodeURIComponent(entityId)}`);
}

export async function callService(domain: string, service: string, data: Record<string, unknown> = {}) {
  return hassRequest("POST", `/api/services/${domain}/${service}`, data);
}
