import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAuthError, errorResponse } from "@/lib/server/middleware";
import { getDb } from "@/lib/server/db";

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const db = getDb();
    const { data: rows, error } = await db
      .from("activity_log")
      .select("*")
      .eq("entity_type", "inventory")
      .in("action", ["created", "updated"])
      .order("ts", { ascending: false })
      .limit(200);

    if (error) throw error;

    // Group by day
    const grouped: Record<string, typeof rows> = {};
    for (const row of rows || []) {
      const day = row.ts ? String(row.ts).slice(0, 10) : "unknown";
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(row);
    }

    const history = Object.entries(grouped).map(([date, entries]) => ({
      date,
      entries,
    }));

    return NextResponse.json({ ok: true, history });
  } catch (e) {
    return errorResponse(500, e instanceof Error ? e.message : "Failed to fetch audit history");
  }
}
