/**
 * AI meal suggestions from inventory. Ported from backend/services/mealAIService.js.
 */

const DEFAULT_MODEL = "gpt-4o-mini";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function getAIMealSuggestions(input: {
  inventory: string[];
  expiringSoon: string[];
  householdSize?: number;
}): Promise<{ meal: string; reason: string; missingIngredients: string[] }[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];

  const inventory = Array.isArray(input.inventory) ? input.inventory : [];
  const expiringSoon = Array.isArray(input.expiringSoon) ? input.expiringSoon : [];
  const householdSize = typeof input.householdSize === "number" ? input.householdSize : 2;

  const allowedMeals = [
    "Eggs","Foul","Avocado Toast","Burrata","Oatmeal","Biscuits","Yogurt",
    "Lasagna","Pasta with Mushroom Sauce","Saffron Chicken","Spaghetti","Mushroom Soup","Vegetable Soup","Pumpkin Soup",
    "Machboos Rubyan","Rubyan Qaloona with Rice","Kofta with Rice","Kofta with Hummus","Cajun Shrimp","Salmon",
    "Pizza (Vegetable / Margherita)","Chicken Tikka with Green Sauce and Mashed Potatoes","Chicken Mandi",
    "Beef Biryani","Chicken Biryani","Beef Bamiya","Mushroom Chicken with Mashed Potatoes","Chinese Chicken",
    "Chicken Makhani","Shrimp Dopiyaza","Chicken Dopiyaza","Chinese Cream Shrimp","Minced Meat with Vegetables",
    "Supreme Fish","Chicken Burger (Nawaf Recipe)","Khoresh Sabzi","Qaliya Rubyan","Halloumi in Tomato Sauce",
    "Dahl","Charcoal Chicken","Musakaa with Eggplant","Kufta Kebab","Mujadara","Chicken Breast Pizza","Noodles",
    "Qaliya Maslawiya","Creamy Beef Pink Pasta","Chickpeas","Balaleet","Halloumi Mousaka"
  ];

  const system = `You are a meal recommender for the Al Abood household. You may ONLY suggest meals from this list:
${allowedMeals.join(", ")}
Do NOT suggest any meal not on this list. Given pantry inventory and expiring items, pick the best 3-5 meals.
Prioritize meals that use expiring items first. Return ONLY a valid JSON array. Each item: { "meal": "Exact Meal Name From List", "reason": "Short reason", "missingIngredients": ["item1"] }.`;

  const user = [
    `Inventory: ${inventory.slice(0, 80).join(", ") || "none"}`,
    `Expiring soon (use these first): ${expiringSoon.slice(0, 30).join(", ") || "none"}`,
    `Household size: ${householdSize}`,
    "Return a JSON array of 3-5 meal suggestions from the allowed list only.",
  ].join("\n");

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          response_format: { type: "json_object" },
          max_tokens: 600,
        }),
      },
      15000
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
          reason: typeof item.reason === "string" ? item.reason.trim() : "Suggested from inventory",
          missingIngredients: Array.isArray(item.missingIngredients) ? item.missingIngredients.map(String) : [],
        };
      });
  } catch {
    return [];
  }
}
