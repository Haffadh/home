/**
 * Ultra-intelligent meal suggestion engine.
 * Uses OpenAI with deep context: inventory, expiration, meal history,
 * day-of-week awareness, variety scoring, and cultural preferences.
 */

import { getDb } from "../db";

const DEFAULT_MODEL = "gpt-4o-mini";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/* ── Context Gathering ────────────────────────────────────────────────────── */

async function getMealHistory(days: number = 14): Promise<{ dish: string; date: string; type: string }[]> {
  try {
    const db = getDb();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data } = await db
      .from("meals")
      .select("dish, type, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });
    return (data ?? [])
      .filter((r: Record<string, unknown>) => r.dish)
      .map((r: Record<string, unknown>) => ({
        dish: String(r.dish),
        type: String(r.type),
        date: String(r.created_at).slice(0, 10),
      }));
  } catch {
    return [];
  }
}

async function getInventoryContext(): Promise<{ available: string[]; expiringSoon: string[] }> {
  try {
    const db = getDb();
    const { data } = await db.from("inventory").select("name, quantity, expiration_date");
    const items = data ?? [];
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const available = items
      .filter((i: Record<string, unknown>) => Number(i.quantity) > 0)
      .map((i: Record<string, unknown>) => String(i.name));

    const expiringSoon = items
      .filter((i: Record<string, unknown>) => {
        if (!i.expiration_date) return false;
        const exp = new Date(String(i.expiration_date));
        return exp <= threeDays && exp >= now && Number(i.quantity) > 0;
      })
      .map((i: Record<string, unknown>) => String(i.name));

    return { available, expiringSoon };
  } catch {
    return { available: [], expiringSoon: [] };
  }
}

/* ── Main Intelligence ────────────────────────────────────────────────────── */

export async function getAIMealSuggestions(input?: {
  inventory?: string[];
  expiringSoon?: string[];
  householdSize?: number;
  slot?: "breakfast" | "lunch" | "dinner";
}): Promise<{ meal: string; reason: string; missingIngredients: string[]; slot?: string }[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];

  // Gather rich context automatically
  const [history, inventoryCtx] = await Promise.all([
    getMealHistory(14),
    input?.inventory ? Promise.resolve({ available: input.inventory, expiringSoon: input.expiringSoon ?? [] }) : getInventoryContext(),
  ]);

  const householdSize = input?.householdSize ?? 6;
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const isWeekend = ["Thursday", "Friday", "Saturday"].includes(dayName);
  const hour = now.getHours();
  const currentSlot = input?.slot ?? (hour < 11 ? "breakfast" : hour < 16 ? "lunch" : "dinner");

  // Analyze meal history for variety
  const recentDishes = history.map(h => h.dish.toLowerCase());
  const dishFrequency: Record<string, number> = {};
  for (const d of recentDishes) {
    dishFrequency[d] = (dishFrequency[d] ?? 0) + 1;
  }
  const overusedDishes = Object.entries(dishFrequency)
    .filter(([, count]) => count >= 3)
    .map(([dish]) => dish);
  const lastThreeDays = history
    .filter(h => {
      const d = new Date(h.date);
      return (now.getTime() - d.getTime()) < 3 * 24 * 60 * 60 * 1000;
    })
    .map(h => h.dish);

  const allowedMeals = [
    "Eggs", "Foul", "Avocado Toast", "Burrata", "Oatmeal", "Biscuits", "Yogurt",
    "Lasagna", "Pasta with Mushroom Sauce", "Saffron Chicken", "Spaghetti",
    "Mushroom Soup", "Vegetable Soup", "Pumpkin Soup",
    "Machboos Rubyan", "Rubyan Qaloona with Rice", "Kofta with Rice",
    "Kofta with Hummus", "Cajun Shrimp", "Salmon",
    "Pizza (Vegetable / Margherita)", "Chicken Tikka with Green Sauce and Mashed Potatoes",
    "Chicken Mandi", "Beef Biryani", "Chicken Biryani", "Beef Bamiya",
    "Mushroom Chicken with Mashed Potatoes", "Chinese Chicken",
    "Chicken Makhani", "Shrimp Dopiyaza", "Chicken Dopiyaza",
    "Chinese Cream Shrimp", "Minced Meat with Vegetables", "Supreme Fish",
    "Chicken Burger (Nawaf Recipe)", "Khoresh Sabzi", "Qaliya Rubyan",
    "Halloumi in Tomato Sauce", "Dahl", "Charcoal Chicken",
    "Musakaa with Eggplant", "Kufta Kebab", "Mujadara",
    "Chicken Breast Pizza", "Noodles", "Qaliya Maslawiya",
    "Creamy Beef Pink Pasta", "Chickpeas", "Balaleet", "Halloumi Mousaka"
  ];

  const system = `You are an elite private chef AI for the Al Abood household in Bahrain. You create deeply personalized meal suggestions.

ALLOWED MEALS (you may ONLY suggest from this list):
${allowedMeals.join(", ")}

CONTEXT:
- Today: ${dayName}, ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
- Current meal slot: ${currentSlot}
- Household size: ${householdSize} people
- Weekend status: ${isWeekend ? "YES — it's the weekend (Thu-Sat in Bahrain). Suggest something special, celebratory, or indulgent." : "Weekday — balanced, practical meals."}

PANTRY:
- Available: ${inventoryCtx.available.slice(0, 60).join(", ") || "unknown"}
- Expiring soon (PRIORITIZE these): ${inventoryCtx.expiringSoon.slice(0, 20).join(", ") || "none"}

MEAL HISTORY (last 14 days):
${history.length > 0 ? history.slice(0, 30).map(h => `  ${h.date} ${h.type}: ${h.dish}`).join("\n") : "  No recent history"}

VARIETY ANALYSIS:
- Dishes eaten in last 3 days (AVOID repeating): ${lastThreeDays.join(", ") || "none"}
- Overused this fortnight (suggest alternatives): ${overusedDishes.join(", ") || "none — good variety"}

YOUR INTELLIGENCE RULES:
1. NEVER repeat a dish from the last 3 days
2. Use expiring ingredients FIRST — reducing waste is critical
3. On weekends (Thu-Sat), suggest premium/special dishes (biryani, machboos, seafood, charcoal chicken)
4. On weekdays, balance between quick meals and proper home-cooked food
5. Consider the meal slot: breakfast should be light, lunch is the main meal, dinner is lighter
6. Vary proteins across days — don't do chicken 3 days in a row
7. If the household hasn't had a particular cuisine in a while, suggest it (e.g., if no seafood in 10 days, suggest seafood)
8. Factor in Bahraini food culture: Thursday dinner is often special, Friday lunch is family gathering
9. Give genuine, thoughtful reasons — not generic "matches inventory" but specific like "You haven't had seafood in 8 days and the shrimp expires tomorrow"

Return ONLY a valid JSON object with key "suggestions" containing an array of 3-5 items.
Each item: { "meal": "Exact Name From List", "reason": "Specific thoughtful reason", "missingIngredients": ["item1"], "slot": "${currentSlot}" }`;

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: `Suggest ${currentSlot} options for today (${dayName}). Be specific and thoughtful.` },
          ],
          response_format: { type: "json_object" },
          max_tokens: 800,
          temperature: 0.7,
        }),
      },
      20000
    );

    const text = await res.text().catch(() => "");
    if (!res.ok) return [];

    let data = null;
    try { data = JSON.parse(text); } catch { return []; }

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return [];

    let parsed: Record<string, unknown> | unknown[] | null = null;
    try { parsed = JSON.parse(content); } catch {
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) { try { parsed = JSON.parse(arrayMatch[0]); } catch { return []; } }
      else return [];
    }

    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Record<string, unknown>)?.suggestions)
        ? (parsed as Record<string, unknown>).suggestions as unknown[]
        : Array.isArray((parsed as Record<string, unknown>)?.meals)
          ? (parsed as Record<string, unknown>).meals as unknown[]
          : [];

    return list
      .slice(0, 5)
      .filter((x: unknown) => x && typeof (x as Record<string, unknown>).meal === "string")
      .map((x: unknown) => {
        const item = x as Record<string, unknown>;
        return {
          meal: String(item.meal).trim() || "Meal",
          reason: typeof item.reason === "string" ? item.reason.trim() : "Suggested for you",
          missingIngredients: Array.isArray(item.missingIngredients) ? item.missingIngredients.map(String) : [],
          slot: typeof item.slot === "string" ? item.slot : currentSlot,
        };
      });
  } catch {
    return [];
  }
}
