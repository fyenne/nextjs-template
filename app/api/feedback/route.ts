import { NextRequest, NextResponse } from "next/server";
import {
  hasAlreadySubmitted,
  recordFeedback,
  FeedbackSubmission,
} from "@/lib/feedback-db";
import { getClientIp } from "@/lib/client-ip";

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

    // 2. Validate mandatory (*) fields, following the questionnaire order.
    // Tag rows (1.4 / 2.3 / 3.3 / 4.4), 4.3 and the free-text boxes are optional.
    const ratingFields: { key: string; message: string }[] = [
      { key: "appearanceRating", message: "请为【1.1 外形与第一印象】打分（必填）" },
      { key: "conversationRating", message: "请为【2.1 整体聊天氛围与互动舒适度】打分（必填）" },
      { key: "politenessRating", message: "请为【3.1 整体礼貌与举止分寸】打分（必填）" },
      { key: "overallRating", message: "请为【4.1 本次约会的综合体验】打分（必填）" },
    ];

    for (const { key, message } of ratingFields) {
      const value = body[key];
      if (typeof value !== "number" || value < 1 || value > 5) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const singleChoiceFields: { key: string; message: string }[] = [
      { key: "clothingStyle", message: "请选择【1.2 穿搭风格与整洁度】（必填）" },
      { key: "photoMatch", message: "请选择【1.3 与社交软件/照片的符合度】（必填）" },
      { key: "conversationDynamic", message: "请选择【2.2 聊天时的互动感受】（必填）" },
      { key: "vibeManner", message: "请选择【3.2 相处时的气场与分寸感】（必填）" },
      { key: "dateArrangement", message: "请选择【4.2 约会地点与环境满意度】（必填）" },
    ];

    for (const { key, message } of singleChoiceFields) {
      const value = body[key];
      if (!value || typeof value !== "string") {
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // 3. Assemble submission
    const {
      appearanceRating,
      conversationRating,
      conversationDynamic,
      politenessRating,
      overallRating,
    } = body;

    const newEntry: FeedbackSubmission = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      submittedAt: new Date().toISOString(),
      ip,
      clientToken,
      userAgent: req.headers.get("user-agent") || undefined,

      appearanceRating,
      clothingStyle: body.clothingStyle || undefined,
      photoMatch: body.photoMatch || undefined,
      appearanceTags: Array.isArray(body.appearanceTags)
        ? body.appearanceTags
        : undefined,
      appearanceNote: body.appearanceNote?.trim() || undefined,

      conversationRating,
      conversationDynamic,
      conversationTags: Array.isArray(body.conversationTags)
        ? body.conversationTags
        : undefined,
      conversationNote: body.conversationNote?.trim() || undefined,

      politenessRating,
      vibeManner: body.vibeManner || undefined,
      etiquetteDetails: Array.isArray(body.etiquetteDetails)
        ? body.etiquetteDetails
        : undefined,
      politenessNote: body.politenessNote?.trim() || undefined,

      overallRating,
      dateArrangement: body.dateArrangement || undefined,
      futureIntention: body.futureIntention || undefined,
      dateImpressionTags: Array.isArray(body.dateImpressionTags)
        ? body.dateImpressionTags
        : undefined,
      suggestion: body.suggestion?.trim() || undefined,

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
