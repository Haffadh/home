import { NextResponse } from "next/server";
import { signToken } from "@/lib/server/auth";
import { parseBody, errorResponse } from "@/lib/server/middleware";

const VALID_ROLES = [
  "moeen",
  "samya",
  "nawaf",
  "ahmed",
  "mariam",
  "abdullah",
  "kitchen",
  "admin",
  "house",
];

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const role = body.role as string | undefined;

    if (!role || typeof role !== "string") {
      return errorResponse(400, "role is required");
    }

    if (!VALID_ROLES.includes(role)) {
      return errorResponse(400, `Invalid role: ${role}`);
    }

    const accessToken = signToken(
      { id: `role-${role}`, role },
      30 * 24 * 60 * 60 // 30 days
    );

    return NextResponse.json({ ok: true, accessToken, role });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse(500, message);
  }
}
