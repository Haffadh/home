import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/middleware";
import { getTasksWithInstances } from "@/lib/server/services/dailyTasksDb";

/**
 * GET /api/dashboard/summary
 * Everything the wall dashboard needs, in one response, once per refresh cycle.
 *
 * Auth is the DASHBOARD_TOKEN env var via the X-Dashboard-Token header — and
 * only that. User JWTs are deliberately not accepted: the tablet token is a
 * read-only credential that can never touch a mutating route, and keeping the
 * two schemes disjoint means neither can be swapped in for the other.
 */

function isDashboardToken(request: Request): boolean {
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) return false;
  const presented = request.headers.get("x-dashboard-token") || "";
  if (presented.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

type NextTask = { title: string; window_start: string; window_end: string };

export async function GET(request: Request) {
  if (!isDashboardToken(request)) {
    return errorResponse(401, "Invalid dashboard token");
  }

  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    // Menu — nulls where unset.
    const menu: Record<"breakfast" | "lunch" | "dinner", string | null> = {
      breakfast: null,
      lunch: null,
      dinner: null,
    };
    const { data: meals } = await db
      .from("meals")
      .select("meal_type, name")
      .eq("date", today);
    for (const m of meals || []) {
      if (m.meal_type in menu) menu[m.meal_type as keyof typeof menu] = m.name;
    }

    // Abdullah's day — same materialization the panels use.
    let done = 0;
    let total = 0;
    let next: NextTask[] = [];

    const { data: abdullah } = await db
      .from("users")
      .select("id")
      .eq("role", "abdullah")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (abdullah) {
      const { tasks } = await getTasksWithInstances(abdullah.id, today);
      type Row = {
        title: string;
        window_start: string;
        window_end: string;
        instance: { status?: string } | null;
      };
      const rows = tasks as unknown as Row[];
      const statusOf = (t: Row) => t.instance?.status || "pending";

      total = rows.length;
      done = rows.filter((t) => statusOf(t) === "done").length;
      // Already ordered by window_start in the service.
      next = rows
        .filter((t) => statusOf(t) === "pending")
        .slice(0, 3)
        .map((t) => ({
          title: t.title,
          window_start: t.window_start,
          window_end: t.window_end,
        }));
    }

    // Pending family requests — count only; the dashboard never shows contents.
    const { count } = await db
      .from("urgent_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return NextResponse.json({
      ok: true,
      data: {
        menu,
        tasks: { done, total, next },
        pendingRequests: count ?? 0,
      },
    });
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
