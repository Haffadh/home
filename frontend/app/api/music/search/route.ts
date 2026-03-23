import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isAuthError,
  errorResponse,
} from "@/lib/server/middleware";

interface VideoResult {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
}

/**
 * GET /api/music/search?q=...
 * Search YouTube for music videos and return parsed results.
 */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q.trim()) {
      return errorResponse(400, "q query param is required");
    }

    const encoded = encodeURIComponent(q);
    const ytUrl = `https://www.youtube.com/results?search_query=${encoded}&sp=EgIQAQ%3D%3D`;

    const res = await fetch(ytUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ ok: true, results: [] });
    }

    const html = await res.text();

    // Extract ytInitialData JSON from the HTML
    const match = html.match(/var\s+ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
    if (!match) {
      return NextResponse.json({ ok: true, results: [] });
    }

    let ytData: Record<string, unknown>;
    try {
      ytData = JSON.parse(match[1]);
    } catch {
      return NextResponse.json({ ok: true, results: [] });
    }

    const results: VideoResult[] = [];

    // Navigate ytInitialData structure to find video renderers
    const contents =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ytData as any)?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.sections;

    if (!Array.isArray(contents)) {
      return NextResponse.json({ ok: true, results: [] });
    }

    for (const section of contents) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (section as any)?.itemSectionRenderer?.contents;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        if (results.length >= 8) break;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vr = (item as any)?.videoRenderer;
        if (!vr || !vr.videoId) continue;

        const videoId = String(vr.videoId);
        const title =
          vr.title?.runs?.[0]?.text || vr.title?.simpleText || "";
        const channel =
          vr.ownerText?.runs?.[0]?.text ||
          vr.shortBylineText?.runs?.[0]?.text ||
          "";
        const duration =
          vr.lengthText?.simpleText || vr.lengthText?.runs?.[0]?.text || "";
        const thumbnail =
          vr.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || "";

        results.push({ videoId, title, channel, duration, thumbnail });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch {
    return NextResponse.json({ ok: true, results: [] });
  }
}
