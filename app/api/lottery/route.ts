import { NextRequest, NextResponse } from "next/server";
import {
  createGuaranteedAward,
  hasAlreadySpun,
  hasAlreadySubmitted,
  recordSpin,
} from "@/lib/feedback-db";
import type { LotteryRecord } from "@/lib/lottery";
import { getClientIp } from "@/lib/client-ip";

const TOKEN_COOKIE = "dating_feedback_token";

function resolveToken(req: NextRequest, bodyToken?: unknown): string | undefined {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  const cookieToken = req.cookies.get(TOKEN_COOKIE)?.value;
  if (typeof bodyToken === "string" && bodyToken) return bodyToken;
  return queryToken || cookieToken || undefined;
}

// Tells the client whether this visitor has already played (and what they won).
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const clientToken = resolveToken(req);
    const status = hasAlreadySpun(ip, clientToken);

    return NextResponse.json({
      hasSpun: status.hasSpun,
      award: status.award ?? null,
      canSpin: hasAlreadySubmitted(ip, clientToken).hasSubmitted && !status.hasSpun,
    });
  } catch (error) {
    console.error("GET /api/lottery error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

// One draw per visitor. The wheel always lands on the last option, so the
// created award is fixed to that prize (see createGuaranteedAward).
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const cookieToken = req.cookies.get(TOKEN_COOKIE)?.value;

    let bodyToken: unknown = undefined;
    try {
      const parsed = await req.json();
      bodyToken = parsed?.token ?? parsed?.clientToken;
    } catch {
      // Empty body is fine: the cookie or query token still identifies the visitor.
    }

    const clientToken = resolveToken(req, bodyToken);

    // 1. Feedback must have been submitted before the reward game is unlocked.
    if (!hasAlreadySubmitted(ip, clientToken).hasSubmitted) {
      return NextResponse.json(
        { error: "请先提交反馈问卷，再来抽奖。" },
        { status: 403 }
      );
    }

    // 2. One draw per IP / browser token.
    const existing = hasAlreadySpun(ip, clientToken);
    if (existing.hasSpun) {
      return NextResponse.json(
        {
          error: "你已经抽过奖了，每人仅限一次。",
          hasSpun: true,
          award: existing.award ?? null,
        },
        { status: 409 }
      );
    }

    // 3. Record the guaranteed award.
    const award = createGuaranteedAward();
    const entry: LotteryRecord = {
      id: `lt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      spunAt: new Date().toISOString(),
      ip,
      clientToken,
      userAgent: req.headers.get("user-agent") || undefined,
      ...award,
    };

    const result = recordSpin(entry);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "抽奖失败，请稍后重试", hasSpun: true },
        { status: 409 }
      );
    }

    const response = NextResponse.json({
      success: true,
      hasSpun: true,
      award,
    });

    if (!cookieToken && clientToken) {
      response.cookies.set(TOKEN_COOKIE, clientToken, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("POST /api/lottery error:", error);
    return NextResponse.json({ error: "服务器发生错误，请稍后重试" }, { status: 500 });
  }
}
