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
  const sys = "You are a household assistant helping Abdullah (the butler). Be extremely brief and direct. No filler words, no intros, no sign-offs. Just numbered steps. Use plain text only — no markdown, no asterisks, no bold markers.";
  const user = [
    `Task: ${t}`,
    context ? `Context: ${String(context).slice(0, 800)}` : "",
    "Give 3-6 short numbered steps. One line each. No extra text.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          max_tokens: 800,
        }),
      },
      12000
    );

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      let j = null;
      try { j = JSON.parse(text); } catch { j = null; }
      const err = j?.error || {};
      const code = err?.code || null;
      const type = err?.type || null;
      const message = err?.message || text || "OpenAI error";

      console.error("OpenAI chat error", { status: res.status, code, type, message: String(message).slice(0, 400) });

      const detail = String(message).slice(0, 220);
      if (res.status === 401) return { ok: false, error: "OPENAI_INVALID_KEY", detail, status: res.status, code, type };
      if (res.status === 429 || code === "insufficient_quota")
        return { ok: false, error: "OPENAI_NO_CREDITS", detail, status: res.status, code, type };
      return { ok: false, error: "OPENAI_ERROR", detail, status: res.status, code, type };
    }

    let data = null;
    try { data = JSON.parse(text); } catch { data = null; }

    const answer = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!answer) return { ok: false, error: "OPENAI_ERROR", detail: "Empty response", status: 200, code: null, type: null };
    return { ok: true, answer };
  } catch (e) {
    console.error("OpenAI chat exception", e);
    const msg = e instanceof Error ? e.message : "OpenAI error";
    return { ok: false, error: "OPENAI_ERROR", detail: String(msg).slice(0, 220), status: null, code: null, type: null };
  }
}

/**
 * Analyze a photo of pantry/fridge using GPT-4o vision.
 * @param {string} base64Image - base64-encoded image (jpeg/png)
 * @returns {{ ok: boolean, items?: { name: string, estimatedQuantity: number, unit: string, category: string }[], error?: string, detail?: string }}
 */
export async function analyzeInventoryPhoto(base64Image, expectedItems = []) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: "ENV_MISSING", detail: "OPENAI_API_KEY not set" };

  const dataUrl = base64Image.startsWith("data:") ? base64Image : `data:image/jpeg;base64,${base64Image}`;

  const hasExpected = Array.isArray(expectedItems) && expectedItems.length > 0;

  const sys = hasExpected
    ? `You are auditing a household inventory. The user is checking these specific items: ${expectedItems.join(", ")}.

STRICT RULES:
1. ONLY report items you can ACTUALLY SEE in the photo. Do NOT assume an item is present just because it's on the list.
2. For each item you see, estimate how much is LEFT (e.g. "bottle looks 1/3 full = 0.3 L", "2 chicken breasts visible = 2 pcs").
3. If an expected item is NOT visible in the photo, do NOT include it in the results. Absence = not found.
4. If you see items that are NOT on the expected list but ARE visible in the photo, include them with "unexpected": true.
5. Use the EXACT name from the expected list when matching. For unexpected items, use a descriptive name.

Return ONLY valid JSON: { "found": [{ "name": "Exact Name", "estimatedQuantity": 2.5, "unit": "kg" }], "unexpected": [{ "name": "Item Name", "estimatedQuantity": 1, "unit": "pcs", "category": "Food" }] }`
    : `You analyze photos of pantries, fridges, and kitchen storage. Identify every visible food/household item.
Return ONLY valid JSON: { "found": [{ "name": "Item Name", "estimatedQuantity": 3, "unit": "pcs", "category": "Food" }], "unexpected": [] }
Categories: Food, Cleaning, Household, Other.
Units: pcs, kg, g, L, ml, bottles, cans, bags, boxes, packs.
Be specific with names. Estimate quantity remaining. If unsure, guess conservatively.`;

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
      let j = null; try { j = JSON.parse(text); } catch {}
      const detail = j?.error?.message || text.slice(0, 200);
      return { ok: false, error: "OPENAI_ERROR", detail };
    }

    let data = null; try { data = JSON.parse(text); } catch {}
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "OPENAI_ERROR", detail: "Empty vision response" };

    let parsed = null; try { parsed = JSON.parse(content); } catch {}
    const mapItem = (x) => ({
      name: String(x.name).trim(),
      estimatedQuantity: typeof x.estimatedQuantity === "number" ? x.estimatedQuantity : 1,
      unit: typeof x.unit === "string" ? x.unit : "pcs",
      category: ["Food", "Cleaning", "Household", "Other"].includes(x.category) ? x.category : "Food",
    });
    // Support both old { items } and new { found, unexpected } formats
    const found = Array.isArray(parsed?.found) ? parsed.found.filter(x => x?.name).map(mapItem) : [];
    const unexpected = Array.isArray(parsed?.unexpected) ? parsed.unexpected.filter(x => x?.name).map(mapItem) : [];
    // Fallback: old format
    if (found.length === 0 && Array.isArray(parsed?.items)) {
      return { ok: true, found: parsed.items.filter(x => x?.name).map(mapItem), unexpected: [] };
    }
    return { ok: true, found, unexpected };
  } catch (e) {
    console.error("Vision analysis error:", e?.message);
    return { ok: false, error: "OPENAI_ERROR", detail: e instanceof Error ? e.message.slice(0, 200) : "Vision failed" };
  }
}

