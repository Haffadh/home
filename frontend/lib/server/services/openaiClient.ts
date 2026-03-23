/**
 * OpenAI utilities: how-to answers and inventory photo analysis.
 * Ported from backend/openaiClient.js.
 */

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function generateHowToAnswer(opts: { title: string; context?: string; type?: string }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: "OPENAI_ENV_MISSING", detail: "OPENAI_API_KEY not loaded", status: null, code: null, type: null };

  const t = typeof opts.title === "string" ? opts.title.trim() : "";
  if (!t) return { ok: false, error: "Invalid title" };

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const sys = "You are a household assistant helping Abdullah (the butler). Be extremely brief and direct. No filler words, no intros, no sign-offs. Just numbered steps. Use plain text only — no markdown, no asterisks, no bold markers.";
  const user = [
    `Task: ${t}`,
    opts.context ? `Context: ${String(opts.context).slice(0, 800)}` : "",
    "Give 3-6 short numbered steps. One line each. No extra text.",
  ].filter(Boolean).join("\n");

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: sys }, { role: "user", content: user }],
          max_tokens: 800,
        }),
      },
      12000
    );

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      let j: Record<string, unknown> | null = null;
      try { j = JSON.parse(text); } catch { j = null; }
      const err = (j?.error || {}) as Record<string, unknown>;
      const code = err?.code || null;
      const type = err?.type || null;
      const message = err?.message || text || "OpenAI error";
      const detail = String(message).slice(0, 220);
      if (res.status === 401) return { ok: false, error: "OPENAI_INVALID_KEY", detail, status: res.status, code, type };
      if (res.status === 429 || code === "insufficient_quota") return { ok: false, error: "OPENAI_NO_CREDITS", detail, status: res.status, code, type };
      return { ok: false, error: "OPENAI_ERROR", detail, status: res.status, code, type };
    }

    let data: Record<string, unknown> | null = null;
    try { data = JSON.parse(text); } catch { data = null; }
    const answer = String((data?.choices as Record<string, unknown>[])?.[0]?.message && ((data?.choices as Record<string, unknown>[])?.[0]?.message as Record<string, unknown>)?.content || "").trim();
    if (!answer) return { ok: false, error: "OPENAI_ERROR", detail: "Empty response", status: 200, code: null, type: null };
    return { ok: true, answer };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OpenAI error";
    return { ok: false, error: "OPENAI_ERROR", detail: String(msg).slice(0, 220), status: null, code: null, type: null };
  }
}

export async function analyzeInventoryPhoto(base64Image: string, expectedItems: string[] = []) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: "ENV_MISSING", detail: "OPENAI_API_KEY not set" };

  const dataUrl = base64Image.startsWith("data:") ? base64Image : `data:image/jpeg;base64,${base64Image}`;
  const hasExpected = Array.isArray(expectedItems) && expectedItems.length > 0;

  const sys = hasExpected
    ? `You are auditing a household inventory. The user is checking these specific items: ${expectedItems.join(", ")}.

STRICT RULES:
1. ONLY report items you can ACTUALLY SEE in the photo. Do NOT assume an item is present just because it's on the list.
2. For each item you see, estimate how much is LEFT.
3. If an expected item is NOT visible in the photo, do NOT include it in the results.
4. If you see items that are NOT on the expected list but ARE visible in the photo, include them with "unexpected": true.
5. Use the EXACT name from the expected list when matching.

Return ONLY valid JSON: { "found": [{ "name": "Exact Name", "estimatedQuantity": 2.5, "unit": "kg" }], "unexpected": [{ "name": "Item Name", "estimatedQuantity": 1, "unit": "pcs", "category": "Food" }] }`
    : `You analyze photos of pantries, fridges, and kitchen storage. Identify every visible food/household item.
Return ONLY valid JSON: { "found": [{ "name": "Item Name", "estimatedQuantity": 3, "unit": "pcs", "category": "Food" }], "unexpected": [] }
Categories: Food, Cleaning, Household, Other.
Units: pcs, kg, g, L, ml, bottles, cans, bags, boxes, packs.`;

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: [
              { type: "text", text: "Analyze this photo and list all visible items with quantities." },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ]},
          ],
          max_tokens: 1500,
          response_format: { type: "json_object" },
        }),
      },
      25000
    );

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      let j: Record<string, unknown> | null = null;
      try { j = JSON.parse(text); } catch { /* */ }
      const detail = (j?.error as Record<string, unknown>)?.message || text.slice(0, 200);
      return { ok: false, error: "OPENAI_ERROR", detail };
    }

    let data: Record<string, unknown> | null = null;
    try { data = JSON.parse(text); } catch { /* */ }
    const content = (data?.choices as Record<string, unknown>[])?.[0]?.message &&
      ((data?.choices as Record<string, unknown>[])?.[0]?.message as Record<string, unknown>)?.content;
    if (!content) return { ok: false, error: "OPENAI_ERROR", detail: "Empty vision response" };

    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(content as string); } catch { /* */ }

    const mapItem = (x: Record<string, unknown>) => ({
      name: String(x.name).trim(),
      estimatedQuantity: typeof x.estimatedQuantity === "number" ? x.estimatedQuantity : 1,
      unit: typeof x.unit === "string" ? x.unit : "pcs",
      category: ["Food", "Cleaning", "Household", "Other"].includes(x.category as string) ? x.category : "Food",
    });

    const found = Array.isArray(parsed?.found) ? (parsed.found as Record<string, unknown>[]).filter(x => x?.name).map(mapItem) : [];
    const unexpected = Array.isArray(parsed?.unexpected) ? (parsed.unexpected as Record<string, unknown>[]).filter(x => x?.name).map(mapItem) : [];
    if (found.length === 0 && Array.isArray(parsed?.items)) {
      return { ok: true, found: (parsed.items as Record<string, unknown>[]).filter(x => x?.name).map(mapItem), unexpected: [] };
    }
    return { ok: true, found, unexpected };
  } catch (e) {
    return { ok: false, error: "OPENAI_ERROR", detail: e instanceof Error ? e.message.slice(0, 200) : "Vision failed" };
  }
}
