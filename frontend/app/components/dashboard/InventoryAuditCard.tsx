"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import * as inventoryService from "../../../lib/services/inventory";
import { inventoryRowsToUI } from "../../../lib/adapters/inventory";
import type { UIInventoryItem } from "../../../lib/adapters/inventory";
import { INVENTORY_CATEGORIES } from "../../../lib/inventory/categories";
import type { InventoryCategory } from "../../../lib/services/inventory";

export default function InventoryAuditCard() {
  const [items, setItems] = useState<UIInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState<InventoryCategory>("Food");
  const [adding, setAdding] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      const rows = await inventoryService.fetchInventoryFromApi();
      setItems(inventoryRowsToUI(rows ?? []));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  async function updateQuantity(id: string, quantity: number) {
    if (!getSupabaseClient()) return;
    try {
      await inventoryService.updateInventoryItem(id, {
        quantity: Math.max(0, Math.round(quantity)),
      });
      await loadInventory();
    } catch {
      loadInventory();
    }
  }

  async function updateExpiration(id: string, expiration_date: string | null) {
    if (!getSupabaseClient()) return;
    try {
      await inventoryService.updateInventoryItem(id, {
        expiration_date: expiration_date || null,
      });
      await loadInventory();
    } catch {
      loadInventory();
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = addName.trim();
    if (!name || adding || !getSupabaseClient()) return;
    setAdding(true);
    try {
      await inventoryService.createInventoryItem({
        name,
        category: addCategory,
        quantity: 0,
      });
      setAddName("");
      await loadInventory();
    } catch {
      loadInventory();
    } finally {
      setAdding(false);
    }
  }

  const byCategory = INVENTORY_CATEGORIES.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <GlassCard className="animate-fade-in-up opacity-0" style={{ animationDelay: "0.2s" }}>
      <h2 className="text-[1rem] font-medium text-white/90 tracking-tight mb-4">
        Inventory Audit
      </h2>
      <form onSubmit={addItem} className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder="Item name"
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[0.8125rem] text-white/95 placeholder:text-white/40 border border-white/10 bg-[#0f172a]/50"
        />
        <select
          value={addCategory}
          onChange={(e) => setAddCategory(e.target.value as InventoryCategory)}
          className="rounded-xl px-3 py-2 text-[0.8125rem] text-white/95 border border-white/10 bg-[#0f172a]/50"
        >
          {INVENTORY_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={adding || !addName.trim() || !getSupabaseClient()}
          className="rounded-xl bg-[#1e293b]/60 hover:bg-[#1e293b]/80 border border-white/10 px-3 py-2 text-[0.8125rem] font-medium text-white/90 disabled:opacity-50"
        >
          {adding ? "…" : "Add"}
        </button>
      </form>
      {loading ? (
        <p className="text-[0.8125rem] text-white/45">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[0.8125rem] text-white/45">No inventory items. Add one above.</p>
      ) : (
        <div className="space-y-4">
          {byCategory.map(({ category, items: catItems }) => (
            <div key={category}>
              <h3 className="text-[0.6875rem] font-semibold text-white/50 uppercase tracking-wider mb-2">
                {category}
              </h3>
              <ul className="space-y-2">
                {catItems.map((item) => (
                  <InventoryAuditRow
                    key={item.id}
                    item={item}
                    onQuantityChange={(q) => updateQuantity(item.id, q)}
                    onExpirationChange={(d) => updateExpiration(item.id, d)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function InventoryAuditRow({
  item,
  onQuantityChange,
  onExpirationChange,
}: {
  item: UIInventoryItem;
  onQuantityChange: (quantity: number) => void;
  onExpirationChange: (date: string | null) => void;
}) {
  const [qty, setQty] = useState(String(item.quantity));
  const [exp, setExp] = useState(item.expiration_date?.slice(0, 10) ?? "");
  const isFood = item.category === "Food";

  useEffect(() => {
    setQty(String(item.quantity));
    setExp(item.expiration_date?.slice(0, 10) ?? "");
  }, [item.id, item.quantity, item.expiration_date]);

  function handleQtyBlur() {
    const n = parseInt(qty, 10);
    if (!Number.isNaN(n) && n >= 0) onQuantityChange(n);
    else setQty(String(item.quantity));
  }

  function handleExpBlur() {
    if (exp.trim()) onExpirationChange(exp.trim().slice(0, 10));
    else onExpirationChange(null);
  }

  return (
    <li
      className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span className="text-[0.8125rem] text-white/90 truncate min-w-0 flex-1">
        {item.item}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <label className="text-[0.6875rem] text-white/50">Qty</label>
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={handleQtyBlur}
          className="w-14 rounded-lg px-2 py-1 text-[0.8125rem] text-white/95 bg-[#0f172a]/60 border border-white/10"
        />
      </div>
      {isFood && (
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <label className="text-[0.6875rem] text-white/50">Exp</label>
          <input
            type="date"
            value={exp}
            onChange={(e) => setExp(e.target.value)}
            onBlur={handleExpBlur}
            className="rounded-lg px-2 py-1 text-[0.8125rem] text-white/95 bg-[#0f172a]/60 border border-white/10"
          />
        </div>
      )}
    </li>
  );
}
