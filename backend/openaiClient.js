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

export async function generateHowToAnswer({ title, context, type = "task" }) {
  const key = process.env.OPENAI_API_KEY;
  const hasKey = Boolean(key);
  if (!hasKey)
    return {
      ok: false,
      error: "OPENAI_ENV_MISSING",
      detail: "OPENAI_API_KEY not loaded",
      status: null,
      code: null,
      type: null,
    };

  const t = typeof title === "string" ? title.trim() : "";
  if (!t) return { ok: false, error: "Invalid title" };

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const sys = "You are helping Abood. Write short, practical, step-by-step instructions in simple English.";
  const user = [
    `Type: ${type === "meal" ? "meal" : "task"}`,
    `Title: ${t}`,
    context ? `Context: ${String(context).slice(0, 800)}` : "",
    "Return 5-8 numbered steps. Keep it concise.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [
            { role: "system", content: [{ type: "text", text: sys }] },
            { role: "user", content: [{ type: "text", text: user }] },
          ],
        }),
      },
      12000
    );

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      let j = null;
      try {
        j = JSON.parse(text);
      } catch {
        j = null;
      }
      const err = j?.error || {};
      const code = err?.code || null;
      const type = err?.type || null;
      const message = err?.message || text || "OpenAI error";

      console.error("OpenAI responses error", {
        status: res.status,
        code,
        type,
        message: String(message).slice(0, 400),
      });

      const detail = String(message).slice(0, 220);
      if (res.status === 401) return { ok: false, error: "OPENAI_INVALID_KEY", detail, status: res.status, code, type };
      if (res.status === 429 || code === "insufficient_quota")
        return { ok: false, error: "OPENAI_NO_CREDITS", detail, status: res.status, code, type };
      return { ok: false, error: "OPENAI_ERROR", detail, status: res.status, code, type };
    }

    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    const outputText =
      (data && Array.isArray(data.output_text) ? data.output_text.join("") : data?.output_text) ||
      data?.output?.[0]?.content?.[0]?.text ||
      "";

    const answer = String(outputText || "").trim();
    if (!answer) return { ok: false, error: "OPENAI_ERROR", detail: "Empty response", status: 200, code: null, type: null };
    return { ok: true, answer };
  } catch (e) {
    console.error("OpenAI responses exception", e);
    const msg = e instanceof Error ? e.message : "OpenAI error";
    return { ok: false, error: "OPENAI_ERROR", detail: String(msg).slice(0, 220), status: null, code: null, type: null };
  }
}

