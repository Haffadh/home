import crypto from "crypto";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function requireTuyaEnv() {
  try {
    const accessId = mustEnv("TUYA_ACCESS_ID");
    const accessSecret = mustEnv("TUYA_ACCESS_SECRET");
    const endpoint = mustEnv("TUYA_ENDPOINT").replace(/\/+$/, "");
    const projectCode = process.env.TUYA_PROJECT_CODE || "";
    return { accessId, accessSecret, endpoint, projectCode };
  } catch {
    throw new Error("Tuya not configured. Add TUYA_ACCESS_ID, TUYA_ACCESS_SECRET, TUYA_ENDPOINT to backend .env");
  }
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmacSha256Hex(secret, input) {
  return crypto.createHmac("sha256", secret).update(input).digest("hex").toUpperCase();
}

function toJsonBody(body) {
  if (body == null) return "";
  return typeof body === "string" ? body : JSON.stringify(body);
}

let tokenCache = {
  access_token: null,
  expire_at_ms: 0,
};

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function buildStringToSign({ method, pathWithQuery, bodyString }) {
  // Canonical headers omitted (Tuya examples show empty header section when none are signed)
  const contentHash = sha256Hex(bodyString || "");
  return [method.toUpperCase(), contentHash, "", pathWithQuery].join("\n");
}

function signRequest({ accessId, accessSecret, token, t, method, pathWithQuery, bodyString }) {
  const stringToSign = buildStringToSign({ method, pathWithQuery, bodyString });
  const nonce = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const signStr = `${accessId}${token || ""}${t}${nonce}${stringToSign}`;
  return hmacSha256Hex(accessSecret, signStr);
}

async function getAccessToken() {
  const { accessId, accessSecret, endpoint } = requireTuyaEnv();

  const now = Date.now();
  if (tokenCache.access_token && now < tokenCache.expire_at_ms - 60_000) {
    return tokenCache.access_token;
  }

  const path = "/v1.0/token?grant_type=1";
  const t = String(Date.now());
  const nonce = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const stringToSign = buildStringToSign({ method: "GET", pathWithQuery: path, bodyString: "" });
  const sign = hmacSha256Hex(accessSecret, `${accessId}${t}${nonce}${stringToSign}`);

  const res = await fetchWithTimeout(
    `${endpoint}${path}`,
    {
      method: "GET",
      headers: {
        "client_id": accessId,
        "sign_method": "HMAC-SHA256",
        "t": t,
        "sign": sign,
        "nonce": nonce,
      },
    },
    8000
  );

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const msg = json?.msg || json?.message || `Tuya token failed (${res.status})`;
    throw new Error(msg);
  }

  const access_token = json.result?.access_token;
  const expire_time = json.result?.expire_time; // seconds
  if (!access_token) throw new Error("Tuya token missing");

  tokenCache.access_token = access_token;
  tokenCache.expire_at_ms = Date.now() + (Number(expire_time) || 3600) * 1000;
  return access_token;
}

export async function tuyaRequest(method, path, body) {
  const { accessId, accessSecret, endpoint } = requireTuyaEnv();

  const token = await getAccessToken();
  const bodyString = toJsonBody(body);
  const t = String(Date.now());
  const nonce = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const stringToSign = buildStringToSign({ method, pathWithQuery: path, bodyString });
  const sign = hmacSha256Hex(accessSecret, `${accessId}${token}${t}${nonce}${stringToSign}`);

  const headers = {
    "client_id": accessId,
    "access_token": token,
    "sign_method": "HMAC-SHA256",
    "t": t,
    "sign": sign,
    "nonce": nonce,
    ...(bodyString ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetchWithTimeout(
    `${endpoint}${path}`,
    { method, headers, body: bodyString || undefined },
    10000
  );

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const msg = json?.msg || json?.message || `Tuya request failed (${res.status})`;
    throw new Error(msg);
  }
  return json.result;
}

export async function getDevices() {
  // Common Tuya IoT endpoint for listing devices in a project.
  // If your project uses a different path, adjust here.
  const result = await tuyaRequest("GET", "/v1.0/devices");

  const devices = Array.isArray(result?.devices) ? result.devices : Array.isArray(result) ? result : [];
  return devices.map((d) => ({
    id: d.id || d.dev_id || d.device_id,
    name: d.name || d.local_name || d.product_name || "Unnamed",
    online: typeof d.online === "boolean" ? d.online : Boolean(d.is_online),
    category: d.category || d.category_code || null,
    product_id: d.product_id || d.productId || null,
    product_name: d.product_name || null,
    icon: d.icon || d.icon_url || d.iconUrl || null,
    // best-effort on/off from list response (some Tuya responses include `status` here)
    status: Array.isArray(d.status)
      ? (() => {
          const sw = d.status.find(
            (s) => typeof s?.code === "string" && /^switch/.test(s.code) && typeof s.value === "boolean"
          );
          return typeof sw?.value === "boolean" ? sw.value : null;
        })()
      : null,
  }));
}

// Back-compat (older server routes)
export const listDevices = getDevices;

export async function sendCommands(deviceId, commandsArray) {
  if (!deviceId) throw new Error("deviceId required");
  if (!Array.isArray(commandsArray) || commandsArray.length === 0) throw new Error("commands required");

  const commands = commandsArray.map((c) => {
    if (!c || typeof c.code !== "string") throw new Error("Invalid command: code required");
    return { code: c.code, value: c.value };
  });

  const result = await tuyaRequest("POST", `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/commands`, {
    commands,
  });
  return result;
}

function pickSwitchCode(statuses) {
  const s = Array.isArray(statuses) ? statuses : [];
  const candidates = s.filter(
    (x) => typeof x?.code === "string" && /^switch/.test(x.code) && typeof x.value === "boolean"
  );
  if (candidates.length === 0) return null;
  // Prefer common codes, otherwise first
  return (
    candidates.find((c) => c.code === "switch_1")?.code ||
    candidates.find((c) => c.code === "switch")?.code ||
    candidates.find((c) => c.code === "switch_led")?.code ||
    candidates[0].code
  );
}

export async function setDeviceSwitch(deviceId, on) {
  if (typeof on !== "boolean") throw new Error("on must be boolean");
  const st = await getDeviceStatus(deviceId);

  if (st.online === false) {
    return { ok: false, error: "Device offline", deviceId };
  }

  const code = pickSwitchCode(st.status);
  if (!code) throw new Error("No switch code found");

  const tuyaResponse = await sendCommands(deviceId, [{ code, value: on }]);
  return { ok: true, deviceId, on, code, tuyaResponse };
}

export async function getDeviceStatus(deviceId) {
  if (!deviceId) throw new Error("deviceId required");

  const [deviceRes, statusRes] = await Promise.allSettled([
    tuyaRequest("GET", `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}`),
    tuyaRequest("GET", `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/status`),
  ]);

  const device = deviceRes.status === "fulfilled" ? deviceRes.value : null;
  const status = statusRes.status === "fulfilled" ? statusRes.value : null;

  const online =
    typeof device?.online === "boolean"
      ? device.online
      : typeof device?.is_online === "boolean"
        ? device.is_online
        : null;

  const statusArray = Array.isArray(status) ? status : Array.isArray(status?.status) ? status.status : [];

  return {
    deviceId,
    online,
    name: device?.name || device?.local_name || null,
    status: statusArray.map((s) => ({ code: s.code, value: s.value })),
    raw: {
      device,
      status,
      device_error: deviceRes.status === "rejected" ? String(deviceRes.reason?.message || deviceRes.reason) : null,
      status_error: statusRes.status === "rejected" ? String(statusRes.reason?.message || statusRes.reason) : null,
    },
  };
}

export async function turnOffIfOn(deviceId) {
  const base = {
    deviceId,
    attempted: true,
    already_off: false,
    turned_off: false,
    offline: false,
    error: null,
  };

  try {
    const st = await getDeviceStatus(deviceId);

    if (st.online === false) {
      return { ...base, offline: true };
    }

    const statuses = Array.isArray(st.status) ? st.status : [];
    const switchStatuses = statuses.filter(
      (s) => typeof s?.code === "string" && /^switch(_\\d+)?$/.test(s.code) && typeof s.value === "boolean"
    );

    if (switchStatuses.length === 0) {
      return { ...base, error: "No switch status found" };
    }

    const anyOn = switchStatuses.find((s) => s.value === true);
    if (!anyOn) {
      return { ...base, already_off: true };
    }

    // Turn off using the exact code that is currently ON.
    await sendCommands(deviceId, [{ code: anyOn.code, value: false }]);
    return { ...base, turned_off: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tuya error";
    return { ...base, error: String(msg || "Tuya error") };
  }
}

