/**
 * Grocery list PDF generator — single canonical implementation.
 * Clean, branded layout. Accepts grocery rows (e.g. from groceriesService.fetchGroceries()).
 */

import { jsPDF } from "jspdf";

/** Shape accepted by PDF (matches GroceryRow from services/groceries). */
export type GroceryItemForPdf = {
  title: string;
  category: string | null;
  suggested_quantity: number | null;
  reason: string | null;
  linked_meal: string | null;
  is_done?: boolean;
};

const CATEGORY_ORDER = ["Food", "Cleaning", "Household", "Other"] as const;
const FONT = "helvetica";
const MARGIN = 24;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function categorySortKey(category: string | null): number {
  const i = CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number]);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/**
 * Prepares groceries for PDF: remove completed, sort by category then item name.
 */
export function prepareGroceriesForPdf(
  groceries: GroceryItemForPdf[]
): GroceryItemForPdf[] {
  const pending = groceries.filter((g) => !g.is_done);
  return [...pending].sort((a, b) => {
    const catA = categorySortKey(a.category);
    const catB = categorySortKey(b.category);
    if (catA !== catB) return catA - catB;
    return (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" });
  });
}

/**
 * Groups items by category for display. Category order: Food, Cleaning, Household, Other, then null/other.
 */
function groupByCategory(
  items: GroceryItemForPdf[]
): { category: string; items: GroceryItemForPdf[] }[] {
  const map = new Map<string, GroceryItemForPdf[]>();
  for (const item of items) {
    const cat = item.category?.trim() || "Other";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  const result: { category: string; items: GroceryItemForPdf[] }[] = [];
  for (const cat of CATEGORY_ORDER) {
    const list = map.get(cat);
    if (list?.length) result.push({ category: cat, items: list });
  }
  for (const [cat, list] of map) {
    if (!CATEGORY_ORDER.includes(cat as (typeof CATEGORY_ORDER)[number]))
      result.push({ category: cat, items: list });
  }
  return result;
}

/**
 * Generates a branded grocery PDF and triggers download.
 * Filename: grocery-list-YYYY-MM-DD.pdf
 */
export function generateGroceryPDF(groceries: GroceryItemForPdf[]): void {
  const prepared = prepareGroceriesForPdf(groceries);
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  let y = MARGIN;

  // —— Header (extensible: logo slot above title later)
  doc.setFontSize(28);
  doc.setFont(FONT, "normal");
  doc.setTextColor(30, 41, 59);
  doc.text("Haffadh Home", MARGIN, y);
  y += 14;

  doc.setFontSize(16);
  doc.setTextColor(71, 85, 105);
  doc.text("Grocery List", MARGIN, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}`,
    MARGIN,
    y
  );
  y += 16;

  // Subtle separator
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 14;

  if (prepared.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("No items on the list.", MARGIN, y);
    triggerDownload(doc);
    return;
  }

  const groups = groupByCategory(prepared);
  const rowHeight = 8;
  const sectionGap = 10;
  const colItem = MARGIN;
  const colQty = 72;
  const colReason = 84;
  const colMeal = 138;

  for (const { category, items } of groups) {
    if (y > 260) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFontSize(11);
    doc.setFont(FONT, "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(category, colItem, y);
    y += rowHeight + 2;

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    for (const row of items) {
      if (y > 268) {
        doc.addPage();
        y = MARGIN;
      }
      const qty = row.suggested_quantity != null ? String(row.suggested_quantity) : "—";
      const reason = row.reason?.trim() || "—";
      const meal = row.linked_meal?.trim() ? `Meal: ${row.linked_meal}` : "";
      doc.text(row.title.slice(0, 36), colItem, y);
      doc.text(qty, colQty, y);
      doc.text(reason.slice(0, 32), colReason, y);
      if (meal) doc.text(meal.slice(0, 28), colMeal, y);
      y += rowHeight;
    }
    y += sectionGap;
  }

  triggerDownload(doc);
}

function triggerDownload(doc: jsPDF): void {
  const date = new Date();
  const filename = `grocery-list-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}.pdf`;
  doc.save(filename);
}
