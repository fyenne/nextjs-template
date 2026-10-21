"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PartyPopper, Sparkles } from "lucide-react";
import { LOTTERY_PRIZES, type LotteryAward } from "@/lib/lottery";

const VIEWBOX = 320;
const CENTER = VIEWBOX / 2;
const RADIUS = 148;
const SPIN_MS = 4600;
const TURNS = 5;

const SLICE_STYLES: Record<string, { fill: string; text: string; emoji: string }> = {
  thanks: { fill: "#cbd5e1", text: "#334155", emoji: "🙏" },
  porsche: { fill: "#38bdf8", text: "#0c4a6e", emoji: "🚗" },
  dinner: { fill: "#34d399", text: "#064e3b", emoji: "🍽️" },
  redpacket: { fill: "#fb7185", text: "#7f1d1d", emoji: "🧧" },
};

const TOTAL_WEIGHT = LOTTERY_PRIZES.reduce((sum, prize) => sum + prize.weight, 0);

/** Degrees clockwise, 0° pointing straight up (where the pointer sits). */
function polar(radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function wedgePath(startAngle: number, endAngle: number) {
  const start = polar(RADIUS, startAngle);
  const end = polar(RADIUS, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

type Phase = "loading" | "ready" | "spinning" | "done";

function readFeedbackToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("dating_feedback_token");
  } catch {
    return null;
  }
}

export default function LotteryWheel() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [award, setAward] = useState<LotteryAward | null>(null);
  const [error, setError] = useState<string>("");
  const [rotation, setRotation] = useState<number>(0);
  const [blocked, setBlocked] = useState<string>("");

  const slices = useMemo(() => {
    let acc = 0;
    return LOTTERY_PRIZES.map((prize) => {
      const start = (acc / TOTAL_WEIGHT) * 360;
      acc += prize.weight;
      const end = (acc / TOTAL_WEIGHT) * 360;
      return { ...prize, start, end, mid: (start + end) / 2 };
    });
  }, []);

  // Has this visitor already played? Show the recorded result instead of the button.
  useEffect(() => {
    let cancelled = false;

    async function check() {
      const token = readFeedbackToken();
      const query = token ? `?token=${encodeURIComponent(token)}` : "";

      try {
        const res = await fetch(`/api/lottery${query}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.hasSpun && data.award) {
          const winner =
            slices.find((slice) => slice.id === data.award.prizeId) ?? slices[slices.length - 1];
          setRotation(360 - winner.mid);
          setAward(data.award);
          setPhase("done");
          return;
        }
        if (data.canSpin === false) {
          setBlocked("请先提交反馈问卷，再来抽奖。");
        }
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("ready");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [slices]);

  const spin = useCallback(async () => {
    if (phase === "spinning") return;
    setError("");
    setPhase("spinning");

    try {
      const res = await fetch("/api/lottery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: readFeedbackToken() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "抽奖失败，请稍后重试");
        if (data.award) {
          const winner =
            slices.find((slice) => slice.id === data.award.prizeId) ?? slices[slices.length - 1];
          setRotation(360 - winner.mid);
          setAward(data.award);
          setPhase("done");
        } else {
          setPhase("ready");
        }
        return;
      }

      // The draw always awards the last prize, so park the pointer on the last slice.
      const target = slices[slices.length - 1];
      const jitter = (Math.random() * 2 - 1) * (target.end - target.start) * 0.3;
      setRotation(TURNS * 360 + (360 - target.mid) + jitter);
      setAward(data.award);
      window.setTimeout(() => setPhase("done"), SPIN_MS + 150);
    } catch {
      setError("网络异常，请稍后再试");
      setPhase("ready");
    }
  }, [phase, slices]);

  const spinning = phase === "spinning";
  const played = phase === "done";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 sm:p-8 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-rose-500" />
          反馈成功，抽个奖再走
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          每个 IP / 设备仅限抽奖一次，转盘停在哪里就送哪个 🎁
        </p>
      </div>

      {/* Wheel */}
      <div className="relative w-[300px] h-[300px] sm:w-[340px] sm:h-[340px] mx-auto">
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.12, 1)`
              : "none",
          }}
        >
          <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="w-full h-full drop-shadow-lg">
            {slices.map((slice) => {
              const style = SLICE_STYLES[slice.id] ?? SLICE_STYLES.thanks;
              const label = polar(RADIUS * 0.68, slice.mid);
              return (
                <g key={slice.id}>
                  <path
                    d={wedgePath(slice.start, slice.end)}
                    fill={style.fill}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={slice.weight >= 15 ? 22 : 16}
                  >
                    {style.emoji}
                  </text>
                  {slice.weight >= 15 && (
                    <text
                      x={polar(RADIUS * 0.86, slice.mid).x}
                      y={polar(RADIUS * 0.86, slice.mid).y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={12}
                      fontWeight={700}
                      fill={style.text}
                    >
                      {slice.weight}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Pointer */}
        <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-20">
          <svg width="30" height="26" viewBox="0 0 30 26" aria-hidden="true">
            <polygon points="15,26 0,2 30,2" fill="#e11d48" stroke="#ffffff" strokeWidth="2.5" />
          </svg>
        </div>

        {/* Hub */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-white dark:bg-gray-900 border-4 border-rose-400 shadow-lg flex items-center justify-center">
            {spinning ? (
              <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
            ) : (
              <span className="text-sm font-extrabold text-rose-500">
                {played ? "已开奖" : "抽奖"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
        {slices.map((slice) => {
          const style = SLICE_STYLES[slice.id] ?? SLICE_STYLES.thanks;
          const isWinner = played && award?.prizeId === slice.id;
          return (
            <li
              key={slice.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                isWinner
                  ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 font-semibold"
                  : "border-gray-100 dark:border-gray-700"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: style.fill }}
              />
              <span className="flex-1 text-gray-700 dark:text-gray-200">{slice.label}</span>
              <span className="text-gray-400 tabular-nums">{slice.weight}%</span>
            </li>
          );
        })}
      </ul>

      {/* Error / blocked notice */}
      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {blocked && !award && (
        <p className="text-center text-sm text-amber-600 dark:text-amber-400">{blocked}</p>
      )}

      {/* Result */}
      {award && phase === "done" && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/40 dark:to-amber-950/30 p-4 sm:p-5 text-center space-y-2">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-300">
            <PartyPopper className="w-4 h-4" /> 恭喜你抽中
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
            {award.prize}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-200">
            <span>
              口令：<span className="font-mono font-bold tracking-wider">{award.code}</span>
            </span>
            {award.amount != null && (
              <span>
                金额：<span className="font-bold text-rose-600 dark:text-rose-400">¥{award.amount.toFixed(2)}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">请截图保存口令，感谢参与 🎉</p>
        </div>
      )}

      {/* Action */}
      <div className="text-center space-y-2">
        <button
          type="button"
          onClick={spin}
          disabled={spinning || played || phase === "loading" || Boolean(blocked)}
          className="w-full sm:w-auto min-w-56 inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-semibold text-base rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {spinning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              转盘转动中...
            </>
          ) : played ? (
            <>本轮抽奖已结束</>
          ) : (
            <>开始抽奖 🎁</>
          )}
        </button>
      </div>
    </div>
  );
}
