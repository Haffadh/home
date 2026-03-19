import { getApiBase } from "../api";
import { getSupabase } from "../supabaseClient";

export type MealSlot = "breakfast" | "lunch" | "dinner";

/** Maps to Supabase columns: id, type, dish, drink, portions. Extra fields for caller compatibility only (not in DB). */
export type MealRow = {
  id: string;
  slot: MealSlot;
  dish: string | null;
  drink: string | null;
  people_count: number;
  meal_date?: string | null;
  requested_by?: string | null;
  options?: Record<string, string> | null;
};

export type MealInsert = {
  slot: MealSlot;
  dish?: string | null;
  drink?: string | null;
  people_count?: number;
  meal_date?: string | null;
  requested_by?: string | null;
  options?: Record<string, string> | null;
};

function dbToRow(row: { id: string; type: string; dish: string | null; drink: string | null; portions: number | null }): MealRow {
  return {
    id: row.id,
    slot: (row.type || "lunch") as MealSlot,
    dish: row.dish ?? null,
    drink: row.drink ?? null,
    people_count: row.portions ?? 1,
  };
}

/** Fetches meals from the backend API (GET /api/meals). */
export async function fetchMealsFromApi(): Promise<MealRow[]> {
  try {
    const data = (await getApiBase("/api/meals", { cache: "no-store" }) as { ok?: boolean; meals?: Array<{ id: string; type: string; dish: string | null; drink: string | null; portions: number | null }> });
    const meals = data?.meals ?? [];
    return meals.map((row) => dbToRow(row));
  } catch (e) {
    console.error("[meals] fetchMealsFromApi", e);
    throw e;
  }
}

export async function fetchMeals(_date?: string): Promise<MealRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meals")
    .select("id,type,dish,drink,portions")
    .order("type", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; type: string; dish: string | null; drink: string | null; portions: number | null }[]).map(dbToRow);
}

export async function createMeal(row: MealInsert): Promise<MealRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meals")
    .insert({
      type: row.slot,
      dish: row.dish ?? null,
      drink: row.drink ?? null,
      portions: row.people_count ?? 1,
    })
    .select("id,type,dish,drink,portions")
    .single();
  if (error) throw new Error(error.message);
  return dbToRow(data as { id: string; type: string; dish: string | null; drink: string | null; portions: number | null });
}

export async function updateMeal(id: string, updates: Partial<MealInsert>): Promise<MealRow> {
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {};
  if (updates.slot !== undefined) payload.type = updates.slot;
  if (updates.dish !== undefined) payload.dish = updates.dish;
  if (updates.drink !== undefined) payload.drink = updates.drink;
  if (updates.people_count !== undefined) payload.portions = updates.people_count;
  const { data, error } = await supabase.from("meals").update(payload).eq("id", id).select("id,type,dish,drink,portions").single();
  if (error) throw new Error(error.message);
  return dbToRow(data as { id: string; type: string; dish: string | null; drink: string | null; portions: number | null });
}

export async function deleteMeal(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
