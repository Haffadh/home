import { NextResponse } from "next/server";
import { authenticateRequest, isAuthError } from "@/lib/server/middleware";

export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;
  return NextResponse.json({ id: auth.id, role: auth.role });
}
