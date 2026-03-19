import { getApiBase } from "../api";
import { getSupabase } from "../supabaseClient";

export type GroceryRow = {
  id: string;
  title: string;
  requested_by: string | null;
  is_done: boolean;
  category: string | null;
  suggested_quantity: number | null;
  reason: string | null;
  linked_meal: string | null;
  created_at: string;
};

export type GroceryInsert = {
  title: string;
  requested_by?: string | null;
  category?: string | null;
  suggested_quantity?: number | null;
  reason?: string | null;
  linked_meal?: string | null;
};

/** Fetches groceries from the backend API (GET /api/groceries). */
export async function fetchGroceriesFromApi(): Promise<GroceryRow[]> {
  console.log("[groceries] Fetching groceries...");
  try {
    const data = (await getApiBase("/api/groceries", { cache: "no-store" })) as GroceryRow[] | { ok?: boolean; error?: string };
    if (Array.isArray(data)) return data;
    return [];
  } catch (e) {
    console.error("[groceries] fetchGroceriesFromApi", e);
    throw e;
  }
}

export async function fetchGroceries(): Promise<GroceryRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("groceries").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("[groceries] fetchGroceries", error.message, error);
    throw new Error(error.message);
  }
  return (data ?? []) as GroceryRow[];
}

export async function addGrocery(row: GroceryInsert): Promise<GroceryRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("groceries")
    .insert({
      title: row.title,
      requested_by: row.requested_by ?? "family",
      is_done: false,
      category: row.category ?? null,
      suggested_quantity: row.suggested_quantity ?? null,
      reason: row.reason ?? null,
      linked_meal: row.linked_meal ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error("[groceries] addGrocery", error.message, error);
    throw new Error(error.message);
  }
  return data as GroceryRow;
}

export async function updateGrocery(
  id: string,
  updates: { title?: string; is_done?: boolean; category?: string | null }
): Promise<GroceryRow> {
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.is_done !== undefined) payload.is_done = updates.is_done;
  if (updates.category !== undefined) payload.category = updates.category;
  const { data, error } = await supabase.from("groceries").update(payload).eq("id", id).select().single();
  if (error) {
    console.error("[groceries] updateGrocery", error.message, error);
    throw new Error(error.message);
  }
  return data as GroceryRow;
}

export async function deleteGrocery(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("groceries").delete().eq("id", id);
  if (error) {
    console.error("[groceries] deleteGrocery", error.message, error);
    throw new Error(error.message);
  }
}
