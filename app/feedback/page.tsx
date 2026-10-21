"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import LotteryWheel from "@/components/LotteryWheel";
import {
  Star,
  Heart,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Send,
  Loader2,
} from "lucide-react";

// Star rating interactive selector component
function StarRating({
  value,
  onChange,
  label,
  required = false,
}: {
  value: number;
  onChange: (val: number) => void;
  label: string;
  required?: boolean;
}) {
  const [hoverVal, setHoverVal] = useState<number>(0);
  const ratingTexts = ["", "较差", "需改进", "良好", "很棒", "无可挑剔"];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {label} {required && <span className="text-red-500 font-bold">*</span>}
        </label>
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 min-w-16 text-right">
          {hoverVal > 0 ? ratingTexts[hoverVal] : value > 0 ? ratingTexts[value] : "点击评星"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = (hoverVal || value) >= star;
          return (
            <button
              type="button"
              key={star}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoverVal(star)}
              onMouseLeave={() => setHoverVal(0)}
              className="p-1 rounded transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400"
              aria-label={`${star} 星`}
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  active
                    ? "text-amber-400 fill-amber-400 drop-shadow-sm"
                    : "text-gray-300 dark:text-gray-600 hover:text-amber-300"
                }`}
              />
            </button>
          );
        })}
        <span className="ml-2 text-xs text-gray-400">
          {value > 0 ? `${value} / 5 分` : "未打分"}
        </span>
      </div>
    </div>
  );
}

// Single-choice pill group component
function RadioGroup({
  label,
  required = false,
  options,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  options: { label: string; value: string; desc?: string }[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-800 dark:text-gray-200 block">
        {label} {required && <span className="text-red-500 font-bold">*</span>}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`text-left p-3 rounded-lg border text-sm transition-all ${
                isSelected
                  ? "border-blue-600 bg-blue-50/70 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-200 ring-2 ring-blue-500/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="font-medium flex items-center justify-between">
                <span>{opt.label}</span>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </div>
              {opt.desc && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {opt.desc}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Multi-select tags component
function MultiTagGroup({
  label,
  required = false,
  options,
  values,
  onChange,
}: {
  label: string;
  required?: boolean;
  options: string[];
  values: string[];
  onChange: (newVals: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter((v) => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-800 dark:text-gray-200 block">
        {label} {required && <span className="text-red-500 font-bold">*</span>}{" "}
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
          {required ? "(必选，至少 1 个，可多选)" : "(可选多个标签)"}
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = values.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {opt} {isSelected ? "✓" : "+"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DatingFeedbackPage() {
  const [hasSubmittedBefore, setHasSubmittedBefore] = useState<boolean>(false);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [showLottery, setShowLottery] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Form State — Section 1: Appearance & Style
  const [appearanceRating, setAppearanceRating] = useState<number>(0);
  const [clothingStyle, setClothingStyle] = useState<string>("");
  const [photoMatch, setPhotoMatch] = useState<string>("");
  const [appearanceTags, setAppearanceTags] = useState<string[]>([]);
  const [appearanceNote, setAppearanceNote] = useState<string>("");

  // Form State — Section 2: Conversation & Connection
  const [conversationRating, setConversationRating] = useState<number>(0);
  const [conversationDynamic, setConversationDynamic] = useState<string>("");
  const [conversationTags, setConversationTags] = useState<string[]>([]);
  const [conversationNote, setConversationNote] = useState<string>("");

  // Form State — Section 3: Politeness & Manners
  const [politenessRating, setPolitenessRating] = useState<number>(0);
  const [vibeManner, setVibeManner] = useState<string>("");
  const [etiquetteDetails, setEtiquetteDetails] = useState<string[]>([]);
  const [politenessNote, setPolitenessNote] = useState<string>("");

  // Form State — Section 4: Overall Experience & Next Steps
  const [overallRating, setOverallRating] = useState<number>(0);
  const [dateArrangement, setDateArrangement] = useState<string>("");
  const [futureIntention, setFutureIntention] = useState<string>("");
  const [dateImpressionTags, setDateImpressionTags] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState<string>("");

  // Form State — Section 6: Optional Info
  const [nickname, setNickname] = useState<string>("");

  // Check if visitor has already submitted
  useEffect(() => {
    async function checkStatus() {
      try {
        const localToken = localStorage.getItem("dating_feedback_token");
        const query = localToken ? `?token=${encodeURIComponent(localToken)}` : "";
        const res = await fetch(`/api/feedback${query}`);
        const data = await res.json();
        if (data.hasSubmitted) {
          setHasSubmittedBefore(true);
        }
      } catch (err) {
        console.error("Failed to check submission status:", err);
      } finally {
        setCheckingStatus(false);
      }
    }
    checkStatus();
  }, []);

  const showError = (message: string) => {
    setErrorMessage(message);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Selections marked with * are mandatory; tag rows (1.4 / 2.3 / 3.3 / 4.4), 4.3 and all free-text boxes are optional.
  const findMissingSelection = (): string => {
    if (appearanceRating === 0) return "请先为【1.1 外形与第一印象】打分（必填）";
    if (!clothingStyle) return "请选择【1.2 穿搭风格与整洁度】（必填）";
    if (!photoMatch) return "请选择【1.3 与社交软件/照片的符合度】（必填）";

    if (conversationRating === 0) return "请先为【2.1 整体聊天氛围与互动舒适度】打分（必填）";
    if (!conversationDynamic) return "请选择【2.2 聊天时的互动感受】（必填）";

    if (politenessRating === 0) return "请先为【3.1 整体礼貌与举止分寸】打分（必填）";
    if (!vibeManner) return "请选择【3.2 相处时的气场与分寸感】（必填）";

    if (overallRating === 0) return "请先为【4.1 本次约会的综合体验】打分（必填）";
    if (!dateArrangement) return "请选择【4.2 约会地点与环境满意度】（必填）";

    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const missing = findMissingSelection();
    if (missing) {
      showError(missing);
      return;
    }

    setSubmitting(true);

    try {
      let clientToken = localStorage.getItem("dating_feedback_token");
      if (!clientToken) {
        clientToken = `dt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      const payload = {
        clientToken,

        appearanceRating,
        clothingStyle,
        photoMatch,
        appearanceTags,
        appearanceNote,

        conversationRating,
        conversationDynamic,
        conversationTags,
        conversationNote,

        politenessRating,
        vibeManner,
        etiquetteDetails,
        politenessNote,

        overallRating,
        dateArrangement,
        futureIntention,
        dateImpressionTags,
        suggestion,

        nickname,
      };

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMessage(result.error || "提交失败，请稍后重试");
        return;
      }

      // Store local token to prevent re-submission from this browser
      localStorage.setItem("dating_feedback_token", clientToken);
      setSubmitSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Submission failed:", err);
      setErrorMessage("网络连接异常，请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  };

  // State 1: Loading verification
  if (checkingStatus) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm">正在加载问卷...</p>
        </div>
      </main>
    );
  }

  // State 2: Reward lottery — shown right after a successful submission, or reopened from the
  // "already submitted" screen. One draw per IP / browser, enforced by /api/lottery.
  if (submitSuccess || showLottery) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-start px-4 sm:px-6 py-8 md:py-12">
        <div className="w-full max-w-3xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              反馈提交成功！
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              非常感谢您的每一句坦诚分享！无论是鼓励还是中肯的建议，都对我十分宝贵。
              祝愿你每天心情明朗，一切顺心如意！🌸
            </p>
          </div>

          <LotteryWheel />

          <div className="text-center pb-10">
            <Link
              href="/error"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> 返回主页
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // State 3: Already submitted view
  if (hasSubmittedBefore) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-8 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            您已提交过反馈
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            感谢您之前的真诚分享！为了保证问卷样本的客观性与独立性，每个 IP
            与设备仅限提交一次。您的评价已被安全记录。
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowLottery(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              🎁 去抽奖
            </button>
            <Link
              href="/error"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> 返回个人主页
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // State 4: Form input view
  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 sm:px-6 py-8 md:py-12">
      <div className="w-full max-w-3xl">
        {/* Page title */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white leading-snug">
            你觉得跟samo上一次的约会怎么样？
          </h1>
          <p className="mt-2 text-sm font-medium text-rose-500 dark:text-rose-400">
            感谢反馈 🌸
          </p>
        </div>

        {/* Header card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-2.5 text-rose-500 mb-2">
            <Heart className="w-6 h-6 fill-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/60">
              Anonymous Feedback
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">
            约会体验匿名反馈问卷
          </h2>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            感谢与你度过的美好时光！为了真诚复盘自己在约会中的细节与表现，并持续成长为更成熟体贴的人，特设此匿名反馈表。
          </p>

          {/* Notice box */}
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <span>📌 填写说明：</span>
              <span className="text-red-600 font-bold">* 标有红色星号的项目为必填项</span>
              <span>，其余未标 * 均为可选填。</span>
            </p>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              🔒 <strong>匿名填写：</strong>无需登录，内容不会公开展示。为防止重复提交，系统会记录提交时的 IP 与浏览器标识，请放心表达最真实的感受。
            </p>
          </div>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300 flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: Appearance & Style */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                1
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                外形衣品与仪态气质
              </h2>
            </div>

            <StarRating
              label="1.1 外形与第一印象评分"
              required={true}
              value={appearanceRating}
              onChange={setAppearanceRating}
            />

            <RadioGroup
              label="1.2 穿搭风格与整洁度"
              required={true}
              value={clothingStyle}
              onChange={setClothingStyle}
              options={[
                { label: "很有品味且得体", value: "很有品味且得体", desc: "搭配协调，质感很好，赏心悦目" },
                { label: "干净清爽大方", value: "干净清爽大方", desc: "整洁舒适，给人自然舒服的阳光感" },
                { label: "偏日常随意", value: "偏日常随意", desc: "比较休闲，无功无过" },
                { label: "有明显提升空间", value: "有明显提升空间", desc: "建议在穿搭或发型上多加打磨" },
              ]}
            />

            <RadioGroup
              label="1.3 与社交软件/照片的符合度"
              required={true}
              value={photoMatch}
              onChange={setPhotoMatch}
              options={[
                { label: "比照片更有气质/更帅", value: "比照片更有气质/更帅", desc: "真人动态气质更佳" },
                { label: "与照片高度一致", value: "与照片高度一致", desc: "真实坦荡，见光不死" },
                { label: "略有差异但很合理", value: "略有差异但很合理", desc: "符合正常预期" },
                { label: "与照片差异较大", value: "与照片差异较大", desc: "反差略明显" },
              ]}
            />

            <MultiTagGroup
              label="1.4 形象与仪态印象（优点 / 待改进）"
              options={[
                "笑容温暖有感染力",
                "体态挺拔自然",
                "气味清爽好闻",
                "整体干净利落",
                "表情偏严肃、笑容较少",
                "发型或胡须略显随意",
                "体态略含胸、可再挺拔些",
                "穿搭色系偏单调或偏随意",
              ]}
              values={appearanceTags}
              onChange={setAppearanceTags}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200 block">
                1.5 形象方面的真实建议 (选填)
              </label>
              <textarea
                rows={2}
                value={appearanceNote}
                onChange={(e) => setAppearanceNote(e.target.value)}
                placeholder="例如：适合什么样的色系/风格，或者发型有哪些改进小建议..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 2: Conversation & Connection */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                2
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                谈吐交流与话题趣味度
              </h2>
            </div>

            <StarRating
              label="2.1 整体聊天氛围与互动舒适度"
              required={true}
              value={conversationRating}
              onChange={setConversationRating}
            />

            <RadioGroup
              label="2.2 聊天时的互动感受"
              required={true}
              value={conversationDynamic}
              onChange={setConversationDynamic}
              options={[
                {
                  label: "双向畅聊，毫无冷场",
                  value: "双向畅聊，毫无冷场",
                  desc: "双方都能接住梗，话匣子自然打开，时间过得很快",
                },
                {
                  label: "倾听充分，真诚互动",
                  value: "倾听充分，真诚互动",
                  desc: "很懂倾听，能够尊重我的表达，并给予正面回应",
                },
                {
                  label: "交流舒适，偶有安静",
                  value: "交流舒适，偶有安静",
                  desc: "偶有短暂沉默，但整体不尴尬、不压抑",
                },
                {
                  label: "略显拘谨慢热",
                  value: "略显拘谨慢热",
                  desc: "需要多主动找话题，稍有些许冷场或紧张感",
                },
                {
                  label: "单向倾诉或说教感偏重",
                  value: "单向倾诉或说教感偏重",
                  desc: "偏向输出自己的观点，较少引导对方参与",
                },
              ]}
            />

            <MultiTagGroup
              label="2.3 话题特色与闪光点（优点 / 待改进）"
              options={[
                "幽默风趣有梗",
                "善于共情体恤人",
                "见闻广博视野开阔",
                "总把话题绕回自己",
                "说教感 / 爱讲道理",
                "否定或轻视我的观点与经历",
                "话题偏学术或工作、略显干",
              ]}
              values={conversationTags}
              onChange={setConversationTags}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200 block">
                2.4 交流中最触动或略显出戏的话题 (选填)
              </label>
              <textarea
                rows={2}
                value={conversationNote}
                onChange={(e) => setConversationNote(e.target.value)}
                placeholder="例如：聊到什么话题时很有共鸣，或者聊哪些话题时略感距离感..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 3: Politeness & Manners */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-sm">
                3
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                整体礼貌度与举止风度
              </h2>
            </div>

            <StarRating
              label="3.1 整体礼貌与举止分寸评分"
              required={true}
              value={politenessRating}
              onChange={setPolitenessRating}
            />

            <RadioGroup
              label="3.2 相处时的气场与分寸感"
              required={true}
              value={vibeManner}
              onChange={setVibeManner}
              options={[
                {
                  label: "平等尊重，氛围轻松",
                  value: "平等尊重，氛围轻松",
                  desc: "双方都能自然表达，没有居高临下的感觉",
                },
                {
                  label: "偶有说教感，但不至于压迫",
                  value: "偶有说教感，但不至于压迫",
                  desc: "有时会讲道理、给建议，语气还算温和",
                },
                {
                  label: "大男子主义倾向明显",
                  value: "大男子主义倾向明显",
                  desc: "会替我做决定，或默认我应该听你的安排",
                },
                {
                  label: "否定或贬低我的表现",
                  value: "否定或贬低我的表现",
                  desc: "对我的工作、能力或分享的东西，评价偏否定",
                },
              ]}
            />

            <MultiTagGroup
              label="3.3 举止与细节礼仪观察（优点 / 待改进）"
              options={[
                "主动推门 / 拉椅",
                "对服务员友善客气",
                "照顾就餐口味偏好",
                "买单主动且得体",
                "聊天时看手机较多",
                "对服务员态度略显敷衍",
                "偶尔打断我说话 / 抢话",
                "买单时略显计较或不太自然",
              ]}
              values={etiquetteDetails}
              onChange={setEtiquetteDetails}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200 block">
                3.4 礼貌或举止方面的补充建议 (选填)
              </label>
              <textarea
                rows={2}
                value={politenessNote}
                onChange={(e) => setPolitenessNote(e.target.value)}
                placeholder="例如：某些细节感觉很暖心，或者哪些小习惯若能调整会更好..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 4: Overall Vibe & Next Steps */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-sm">
                4
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                约会综合体验与心动指数
              </h2>
            </div>

            <StarRating
              label="4.1 本次约会的综合体验打分"
              required={true}
              value={overallRating}
              onChange={setOverallRating}
            />

            <RadioGroup
              label="4.2 约会地点与环境满意度"
              required={true}
              value={dateArrangement}
              onChange={setDateArrangement}
              options={[
                { label: "非常用心且有氛围", value: "非常用心且有氛围", desc: "选址很有品味，体验非常愉快" },
                { label: "环境舒适惬意", value: "环境舒适惬意", desc: "安静自然，适合深入聊天" },
                { label: "中规中矩", value: "中规中矩", desc: "符合常规标准" },
                { label: "环境或行程欠佳", value: "环境或行程欠佳", desc: "略嘈杂或路线稍显局促" },
              ]}
            />

            <RadioGroup
              label="4.3 后续发展意愿"
              value={futureIntention}
              onChange={setFutureIntention}
              options={[
                {
                  label: "💖 很有心动感，期待下一次约会",
                  value: "很有心动感，期待下一次约会",
                  desc: "感觉合拍，希望能有更多深入互动的机会",
                },
                {
                  label: "☕ 相处轻松，愿意作为好友继续联络",
                  value: "相处轻松，愿意作为好友继续联络",
                  desc: "很认可为人品格，适合作为聊得来的朋友",
                },
                {
                  label: "🌱 节奏或感觉略有偏差，暂时观望",
                  value: "节奏或感觉略有偏差，暂时观望",
                  desc: "需要更多时间或特定场景来感受",
                },
                {
                  label: "🕊️ 磁场不太合适，感谢相遇，祝福彼此",
                  value: "磁场不太合适，感谢相遇，祝福彼此",
                  desc: "感觉不适合发展亲密关系，诚挚祝愿彼此找到良人",
                },
              ]}
            />

            <MultiTagGroup
              label="4.4 约会安排与相处细节（优点 / 待改进）"
              options={[
                "选址用心、环境有氛围",
                "行程安排周到、节奏舒服",
                "做决定前会先问我的想法",
                "行程略显仓促 / 赶时间",
                "地点偏嘈杂、不太适合聊天",
                "很多事直接替我决定",
                "整体更多按自己的节奏走",
              ]}
              values={dateImpressionTags}
              onChange={setDateImpressionTags}
            />
          </div>

          {/* SECTION 5: Teach me how to be a better me */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold text-sm">
                  5
                </span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  教我如何成为更好的自己
                </h2>
              </div>
              <span className="text-xs text-gray-400">选填</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-800 dark:text-gray-200 block">
                5.1 教我如何成为更好的自己（选填）
              </label>
              <textarea
                rows={4}
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="例如：多留些倾听的时间、提前确认安排，或选个更方便聊天的地点。也可以留空。谢谢你愿意坦诚分享。"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 6: Optional Info */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">
                  6
                </span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  你的称呼 (选填 / Optional)
                </h2>
              </div>
              <span className="text-xs text-gray-400">全部选填</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200 block">
                6.1 你的称呼 / 微信备注 (选填，留空则完全匿名)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="例如：小鹿、Momo，或留空保持 100% 匿名"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-400">
                若不希望留下称呼，请直接留空。
              </p>
            </div>
          </div>

          {/* Submit button bar */}
          <div className="pt-2 pb-12 flex flex-col items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto min-w-64 inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>正在安全提交...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>匿名提交反馈</span>
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 text-center">
              每个 IP 与设备仅可提交一次 • 内容仅保存在本地数据库中
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
