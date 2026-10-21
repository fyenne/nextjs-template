import { NextRequest, NextResponse } from "next/server";
import {
  hasAlreadySubmitted,
  recordFeedback,
  FeedbackSubmission,
} from "@/lib/feedback-db";

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();
  // Direct connections expose no client IP to Route Handlers. A shared fallback such as
  // "127.0.0.1" would block every direct visitor after the first submission, so skip the IP check.
  return "";
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const tokenCookie = req.cookies.get("dating_feedback_token")?.value;
    const url = new URL(req.url);
    const clientToken = url.searchParams.get("token") || tokenCookie;

    const status = hasAlreadySubmitted(ip, clientToken);
    return NextResponse.json({
      hasSubmitted: status.hasSubmitted,
      reason: status.reason,
    });
  } catch (error) {
    console.error("GET /api/feedback error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const cookieToken = req.cookies.get("dating_feedback_token")?.value;

    const body = await req.json();
    const clientToken = body.clientToken || cookieToken || `tok_${Math.random().toString(36).substring(2, 10)}`;

    // 1. Deduplication check
    const duplicateCheck = hasAlreadySubmitted(ip, clientToken);
    if (duplicateCheck.hasSubmitted) {
      return NextResponse.json(
        {
          error: "该 IP 地址或设备已提交过反馈，每位访客仅限提交一次。感谢您的真诚分享！",
        },
        { status: 403 }
      );
    }

    // 2. Validate mandatory (*) fields
    const {
      politenessRating,
      conversationRating,
      conversationDynamic,
      appearanceRating,
      overallRating,
      futureIntention,
    } = body;

    if (
      typeof politenessRating !== "number" ||
      politenessRating < 1 ||
      politenessRating > 5
    ) {
      return NextResponse.json(
        { error: "请为【整体礼貌度与举止】打分（必填）" },
        { status: 400 }
      );
    }

    if (
      typeof conversationRating !== "number" ||
      conversationRating < 1 ||
      conversationRating > 5
    ) {
      return NextResponse.json(
        { error: "请为【谈吐与交流氛围】打分（必填）" },
        { status: 400 }
      );
    }

    if (!conversationDynamic || typeof conversationDynamic !== "string") {
      return NextResponse.json(
        { error: "请选择【聊天时的互动感受】（必填）" },
        { status: 400 }
      );
    }

    if (
      typeof appearanceRating !== "number" ||
      appearanceRating < 1 ||
      appearanceRating > 5
    ) {
      return NextResponse.json(
        { error: "请为【外形与第一印象】打分（必填）" },
        { status: 400 }
      );
    }

    if (
      typeof overallRating !== "number" ||
      overallRating < 1 ||
      overallRating > 5
    ) {
      return NextResponse.json(
        { error: "请为【本次约会整体体验】打分（必填）" },
        { status: 400 }
      );
    }

    if (!futureIntention || typeof futureIntention !== "string") {
      return NextResponse.json(
        { error: "请选择【后续发展意愿】（必填）" },
        { status: 400 }
      );
    }

    // 3. Assemble submission
    const newEntry: FeedbackSubmission = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      submittedAt: new Date().toISOString(),
      ip,
      clientToken,
      userAgent: req.headers.get("user-agent") || undefined,

      politenessRating,
      punctuality: body.punctuality || undefined,
      etiquetteDetails: Array.isArray(body.etiquetteDetails)
        ? body.etiquetteDetails
        : undefined,
      politenessNote: body.politenessNote?.trim() || undefined,

      conversationRating,
      conversationDynamic,
      conversationTags: Array.isArray(body.conversationTags)
        ? body.conversationTags
        : undefined,
      conversationNote: body.conversationNote?.trim() || undefined,

      appearanceRating,
      clothingStyle: body.clothingStyle || undefined,
      photoMatch: body.photoMatch || undefined,
      appearanceTags: Array.isArray(body.appearanceTags)
        ? body.appearanceTags
        : undefined,
      appearanceNote: body.appearanceNote?.trim() || undefined,

      overallRating,
      dateArrangement: body.dateArrangement || undefined,
      futureIntention,
      suggestion: body.suggestion?.trim() || undefined,

      platform: body.platform?.trim() || undefined,
      nickname: body.nickname?.trim() || undefined,
    };

    const recordResult = recordFeedback(newEntry);
    if (!recordResult.success) {
      return NextResponse.json(
        { error: recordResult.error || "提交失败" },
        { status: 409 }
      );
    }

    // 4. Return success and set cookie
    const response = NextResponse.json({
      success: true,
      message: "反馈已成功匿名提交，非常感谢您的真诚反馈！",
    });

    response.cookies.set("dating_feedback_token", clientToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("POST /api/feedback error:", error);
    return NextResponse.json(
      { error: "服务器发生错误，请稍后重试" },
      { status: 500 }
    );
  }
}
