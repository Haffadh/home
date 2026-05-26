import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  parseBody,
  errorResponse,
} from "@/lib/server/middleware";
import { generateHowToAnswer } from "@/lib/server/services/anthropicClient";

function mapErrorResponse(result: Record<string, unknown>) {
  const errType = String(result.error || "");
  const detail = String(result.detail || "Unknown error");

  if (errType === "ANTHROPIC_RATE_LIMIT") {
    return errorResponse(500, `AI rate limited: ${detail}`);
  }
  if (errType === "ANTHROPIC_INVALID_KEY") {
    return errorResponse(500, `Invalid AI key: ${detail}`);
  }
  if (errType === "ANTHROPIC_ENV_MISSING" || errType === "ENV_MISSING") {
    return errorResponse(500, `AI not configured: ${detail}`);
  }
  return errorResponse(500, `AI error: ${detail}`);
}

async function handleHowTo(title: string, context?: string, type?: string) {
  const result = await generateHowToAnswer({ title, context, type });
  if (result.ok) {
    return NextResponse.json({ ok: true, answer: result.answer });
  }
  return mapErrorResponse(result as Record<string, unknown>);
}

/**
 * POST /api/ai/howto
 * Generate a how-to answer for a task.
 */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await parseBody(request);
    const title = body.title ? String(body.title) : "";
    const context = body.context ? String(body.context) : undefined;
    const type = body.type ? String(body.type) : undefined;

    if (!title) {
      return errorResponse(400, "title is required");
    }

    return await handleHowTo(title, context, type);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}

/**
 * GET /api/ai/howto?taskTitle=...&context=...
 * Same as POST but via query params.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("taskTitle") || "";
    const context = searchParams.get("context") || undefined;

    if (!title) {
      return errorResponse(400, "taskTitle query param is required");
    }

    return await handleHowTo(title, context);
  } catch (err) {
    return errorResponse(500, (err as Error).message);
  }
}
