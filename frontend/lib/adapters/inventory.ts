import type { InventoryRow, InventoryCategory } from "../services/inventory";

/**
 * Maps Supabase inventory rows to UI shape. Schema: service uses name, expiry_date, updated_at;
 * adapter exposes item (= name), expiration_date (= expiry_date), updated_at (= updated_at ?? created_at).
 */
export type UIInventoryItem = {
  id: string;
  item: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  expiration_date: string | null;
  updated_at: string;
  threshold: number;
  last_confirmed_at: string | null;
  created_at: string;
};

export function inventoryRowToUI(row: InventoryRow): UIInventoryItem {
  return {
    id: row.id,
    item: row.name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    expiration_date: row.expiry_date ?? null,
    updated_at: row.updated_at ?? row.created_at,
    threshold: row.threshold,
    last_confirmed_at: row.last_confirmed_at ?? null,
    created_at: row.created_at,
  };
}

export function inventoryRowsToUI(rows: InventoryRow[]): UIInventoryItem[] {
  return rows.map(inventoryRowToUI);
}
