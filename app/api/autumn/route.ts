import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { isVisitorId, upsertVisitor, type ProgressUpdate, type SceneVisitor } from "@/lib/scene-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "scene_visitor";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const WRITES_PER_MINUTE = 60;

const writeWindows = new Map<string, { count: number; resetAt: number }>();

function overWriteLimit(key: string): boolean {
  const now = Date.now();
  const entry = writeWindows.get(key);
  if (!entry || entry.resetAt < now) {
    writeWindows.set(key, { count: 1, resetAt: now + 60_000 });
    if (writeWindows.size > 2000) {
      writeWindows.forEach((value, mapKey) => {
        if (value.resetAt < now) writeWindows.delete(mapKey);
      });
    }
    return false;
  }
  entry.count += 1;
  return entry.count > WRITES_PER_MINUTE;
}

function requestMeta(req: NextRequest) {
  return { ip: getClientIp(req), userAgent: (req.headers.get("user-agent") || "").slice(0, 400) };
}

function payload(visitor: SceneVisitor) {
  return { id: visitor.id, autumn: Boolean(visitor.autumnUnlockedAt), laps: visitor.laps };
}

function withCookie(req: NextRequest, response: NextResponse, id: string) {
  if (req.cookies.get(VISITOR_COOKIE)?.value === id) return response;
  response.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}

/**
 * Registers a visit and reports whether this visitor already unlocked autumn.
 * The id comes from the query string, falling back to the cookie so a visitor
 * who cleared localStorage is still recognised.
 */
export async function GET(req: NextRequest) {
  try {
    const queryId = req.nextUrl.searchParams.get("id");
    const cookieId = req.cookies.get(VISITOR_COOKIE)?.value;
    const id = isVisitorId(queryId) ? queryId : isVisitorId(cookieId) ? cookieId : null;

    // Without an id the client must mint one; nothing is stored yet.
    if (!id) return NextResponse.json({ id: null, autumn: false, laps: 0 });

    const visitor = upsertVisitor(id, requestMeta(req), {}, true);
    return withCookie(req, NextResponse.json(payload(visitor)), id);
  } catch (error) {
    console.error("GET /api/autumn error:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/** Records lap progress and, once three laps are done, the autumn unlock. */
export async function POST(req: NextRequest) {
  try {
    const meta = requestMeta(req);
    if (overWriteLimit(meta.ip || "unknown")) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) ?? {};
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const cookieId = req.cookies.get(VISITOR_COOKIE)?.value;
    const id = isVisitorId(body.id) ? body.id : isVisitorId(cookieId) ? cookieId : null;
    if (!id) return NextResponse.json({ error: "invalid visitor id" }, { status: 400 });

    const update: ProgressUpdate = {
      laps: typeof body.laps === "number" ? body.laps : undefined,
      direction: body.direction === "cw" || body.direction === "ccw" ? body.direction : undefined,
      completed: body.completed === true,
    };
    const visitor = upsertVisitor(id, meta, update);
    return withCookie(req, NextResponse.json(payload(visitor)), id);
  } catch (error) {
    console.error("POST /api/autumn error:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
