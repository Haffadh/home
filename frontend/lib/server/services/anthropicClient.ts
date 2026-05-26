/**
 * Anthropic Claude client for household AI features.
 * Model: Claude Haiku 4.5 — fast and cost-effective for these tasks.
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (_client) return _client;
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

type HowToResult =
  | { ok: true; answer: string }
  | { ok: false; error: string; detail: string; status?: number | null; code?: string | null; type?: string | null };

export async function generateHowToAnswer(opts: { title: string; context?: string; type?: string }): Promise<HowToResult> {
  const client = getClient();
  if (!client) return { ok: false, error: "ANTHROPIC_ENV_MISSING", detail: "ANTHROPIC_API_KEY not loaded", status: null, code: null, type: null };

  const t = typeof opts.title === "string" ? opts.title.trim() : "";
  if (!t) return { ok: false, error: "Invalid title", detail: "title is empty" };

  const system = "You are a household assistant helping Abdullah (the butler). Be extremely brief and direct. No filler words, no intros, no sign-offs. Just numbered steps. Use plain text only — no markdown, no asterisks, no bold markers.";
  const user = [
    `Task: ${t}`,
    opts.context ? `Context: ${String(opts.context).slice(0, 800)}` : "",
    "Give 3-6 short numbered steps. One line each. No extra text.",
  ].filter(Boolean).join("\n");

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: user }],
    });

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!answer) return { ok: false, error: "ANTHROPIC_ERROR", detail: "Empty response", status: 200, code: null, type: null };
    return { ok: true, answer };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "ANTHROPIC_INVALID_KEY", detail: e.message.slice(0, 220), status: e.status ?? null, code: null, type: null };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "ANTHROPIC_RATE_LIMIT", detail: e.message.slice(0, 220), status: e.status ?? null, code: null, type: null };
    }
    if (e instanceof Anthropic.APIError) {
      return { ok: false, error: "ANTHROPIC_ERROR", detail: e.message.slice(0, 220), status: e.status ?? null, code: null, type: null };
    }
    const msg = e instanceof Error ? e.message : "Anthropic error";
    return { ok: false, error: "ANTHROPIC_ERROR", detail: String(msg).slice(0, 220), status: null, code: null, type: null };
  }
}

type InventoryItemOut = {
  name: string;
  estimatedQuantity: number;
  unit: string;
  category: string;
};

type PhotoResult =
  | { ok: true; found: InventoryItemOut[]; unexpected: InventoryItemOut[] }
  | { ok: false; error: string; detail: string };

export async function analyzeInventoryPhoto(base64Image: string, expectedItems: string[] = []): Promise<PhotoResult> {
  const client = getClient();
  if (!client) return { ok: false, error: "ENV_MISSING", detail: "ANTHROPIC_API_KEY not set" };

  // Strip data: prefix if present, and detect media type
  let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg";
  let imageData = base64Image;
  const dataUrlMatch = base64Image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (dataUrlMatch) {
    mediaType = dataUrlMatch[1] as typeof mediaType;
    imageData = dataUrlMatch[2];
  }

  const hasExpected = Array.isArray(expectedItems) && expectedItems.length > 0;

  const system = hasExpected
    ? `You are auditing a household inventory. The user is checking these specific items: ${expectedItems.join(", ")}.

STRICT RULES:
1. ONLY report items you can ACTUALLY SEE in the photo. Do NOT assume an item is present just because it's on the list.
2. For each item you see, estimate how much is LEFT.
3. If an expected item is NOT visible in the photo, do NOT include it in the results.
4. If you see items that are NOT on the expected list but ARE visible in the photo, include them with "unexpected": true.
5. Use the EXACT name from the expected list when matching.

Return ONLY valid JSON (no preamble, no markdown code fence): { "found": [{ "name": "Exact Name", "estimatedQuantity": 2.5, "unit": "kg" }], "unexpected": [{ "name": "Item Name", "estimatedQuantity": 1, "unit": "pcs", "category": "Food" }] }`
    : `You analyze photos of pantries, fridges, and kitchen storage. Identify every visible food/household item.
Return ONLY valid JSON (no preamble, no markdown code fence): { "found": [{ "name": "Item Name", "estimatedQuantity": 3, "unit": "pcs", "category": "Food" }], "unexpected": [] }
Categories: Food, Cleaning, Household, Other.
Units: pcs, kg, g, L, ml, bottles, cans, bags, boxes, packs.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageData },
            },
            { type: "text", text: "Analyze this photo and list all visible items with quantities." },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) return { ok: false, error: "ANTHROPIC_ERROR", detail: "Empty vision response" };

    // Extract JSON (strip any markdown fencing Claude might add)
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(cleaned); } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch { /* */ } }
    }
    if (!parsed) return { ok: false, error: "ANTHROPIC_ERROR", detail: "Could not parse JSON" };

    const mapItem = (x: Record<string, unknown>): InventoryItemOut => ({
      name: String(x.name ?? "").trim(),
      estimatedQuantity: typeof x.estimatedQuantity === "number" ? x.estimatedQuantity : 1,
      unit: typeof x.unit === "string" ? x.unit : "pcs",
      category: ["Food", "Cleaning", "Household", "Other"].includes(x.category as string) ? (x.category as string) : "Food",
    });

    const found = Array.isArray(parsed.found) ? (parsed.found as Record<string, unknown>[]).filter((x) => x?.name).map(mapItem) : [];
    const unexpected = Array.isArray(parsed.unexpected) ? (parsed.unexpected as Record<string, unknown>[]).filter((x) => x?.name).map(mapItem) : [];
    if (found.length === 0 && Array.isArray(parsed.items)) {
      return { ok: true, found: (parsed.items as Record<string, unknown>[]).filter((x) => x?.name).map(mapItem), unexpected: [] };
    }
    return { ok: true, found, unexpected };
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      return { ok: false, error: "ANTHROPIC_ERROR", detail: e.message.slice(0, 200) };
    }
    return { ok: false, error: "ANTHROPIC_ERROR", detail: e instanceof Error ? e.message.slice(0, 200) : "Vision failed" };
  }
}
