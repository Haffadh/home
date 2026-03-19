import { getApiBase } from "../api";
import { getSupabase } from "../supabaseClient";

/**
 * Supabase schema: id, item, category, quantity, expiration_date, updated_at.
 * Service types keep name/expiry_date for compatibility; we map to/from item/expiration_date at the DB boundary.
 */
export type InventoryCategory = "Food" | "Cleaning" | "Household" | "Other";

export type InventoryRow = {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  /** Same as expiration_date; kept for backward compatibility. */
  expiry_date: string | null;
  expiration_date: string | null;
  updated_at: string | null;
};

export type InventoryInsert = {
  name: string;
  category: InventoryCategory;
  quantity?: number;
  expiration_date?: string | null;
  /** Alias for expiration_date; only expiration_date is sent to DB. */
  expiry_date?: string | null;
};

const SELECT_COLS = "id,item,category,quantity,expiration_date,updated_at";

function dbToRow(row: { id: string; item: string; category: string; quantity: number; expiration_date: string | null; updated_at: string | null }): InventoryRow {
  const exp = row.expiration_date ?? null;
  return {
    id: row.id,
    name: row.item,
    category: row.category as InventoryCategory,
    quantity: row.quantity ?? 0,
    expiry_date: exp,
    expiration_date: exp,
    updated_at: row.updated_at ?? null,
  };
}

/** Fetches inventory from the backend API (GET /api/inventory). */
export async function fetchInventoryFromApi(): Promise<InventoryRow[]> {
  console.log("[inventory] Fetching inventory...");
  try {
    const data = (await getApiBase("/api/inventory", { cache: "no-store" }) as { ok?: boolean; items?: Array<{ id: string; item?: string; name?: string; category: string; quantity: number; expiration_date?: string | null; expiry_date?: string | null; updated_at?: string | null }> });
    const items = data?.items ?? [];
    return items.map((row) => {
      const name = row.item ?? row.name ?? "";
      const exp = row.expiration_date ?? row.expiry_date ?? null;
      return {
        id: row.id,
        name,
        category: row.category as InventoryCategory,
        quantity: row.quantity ?? 0,
        expiry_date: exp,
        expiration_date: exp,
        updated_at: row.updated_at ?? null,
      };
    });
  } catch (e) {
    console.error("[inventory] fetchInventoryFromApi", e);
    throw e;
  }
}

export async function fetchInventory(category?: InventoryCategory): Promise<InventoryRow[]> {
  const supabase = getSupabase();
  let q = supabase.from("inventory").select(SELECT_COLS).order("item", { ascending: true });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) {
    console.error("[inventory] fetchInventory", error.message, error);
    throw new Error(error.message);
  }
  return ((data ?? []) as { id: string; item: string; category: string; quantity: number; expiration_date: string | null; updated_at: string | null }[]).map(dbToRow);
}

/** Food category only (for expiration and audit). */
export async function fetchFoodInventory(): Promise<InventoryRow[]> {
  return fetchInventory("Food");
}

/** Items with expiration_date set, optionally within the next N days (default all with a date). */
export async function fetchExpiringInventory(withinDays?: number): Promise<InventoryRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("inventory")
    .select(SELECT_COLS)
    .not("expiration_date", "is", null)
    .order("expiration_date", { ascending: true });
  if (error) {
    console.error("[inventory] fetchExpiringInventory", error.message, error);
    throw new Error(error.message);
  }
  const rows = ((data ?? []) as { id: string; item: string; category: string; quantity: number; expiration_date: string | null; updated_at: string | null }[]).map(dbToRow);
  if (withinDays == null) return rows;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => r.expiration_date && r.expiration_date.slice(0, 10) <= cutoffStr);
}

export async function updateInventoryItem(
  id: string,
  updates: {
    quantity?: number;
    expiration_date?: string | null;
    expiry_date?: string | null;
  }
): Promise<InventoryRow> {
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {};
  if (updates.quantity !== undefined) payload.quantity = updates.quantity;
  const exp = updates.expiration_date ?? updates.expiry_date;
  if (exp !== undefined) payload.expiration_date = exp;
  const { data, error } = await supabase.from("inventory").update(payload).eq("id", id).select(SELECT_COLS).single();
  if (error) {
    console.error("[inventory] updateInventoryItem", error.message, error);
    throw new Error(error.message);
  }
  return dbToRow(data as { id: string; item: string; category: string; quantity: number; expiration_date: string | null; updated_at: string | null });
}

export async function createInventoryItem(row: InventoryInsert): Promise<InventoryRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("inventory")
    .insert({
      item: row.name,
      category: row.category,
      quantity: row.quantity ?? 0,
      expiration_date: row.expiration_date ?? row.expiry_date ?? null,
    })
    .select(SELECT_COLS)
    .single();
  if (error) {
    console.error("[inventory] createInventoryItem", error.message, error);
    throw new Error(error.message);
  }
  return dbToRow(data as { id: string; item: string; category: string; quantity: number; expiration_date: string | null; updated_at: string | null });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("inventory").delete().eq("id", id);
  if (error) {
    console.error("[inventory] deleteInventoryItem", error.message, error);
    throw new Error(error.message);
  }
}
