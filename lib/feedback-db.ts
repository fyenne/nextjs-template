import fs from "fs";
import path from "path";

export interface FeedbackSubmission {
  id: string;
  submittedAt: string;
  ip: string;
  clientToken?: string;
  userAgent?: string;

  // 1. Appearance (外形衣品与仪态气质)
  appearanceRating: number; // 1-5 *
  clothingStyle?: string; // 衣品整洁度 *
  photoMatch?: string; // 与照片符合度 *
  appearanceTags?: string[]; // 仪态气质标签（含待改进，选填）
  appearanceNote?: string; // 形象建议

  // 2. Conversation Interest (谈吐交流与话题趣味度)
  conversationRating: number; // 1-5 *
  conversationDynamic: string; // 互动交流氛围 *
  conversationTags?: string[]; // 话题趣味标签（含待改进，选填）
  conversationNote?: string; // 交流体验

  // 3. Overall Politeness (礼貌度与举止)
  politenessRating: number; // 1-5 *
  vibeManner?: string; // 相处气场与分寸（说教感 / 大男子主义 / 否定对方）*
  etiquetteDetails?: string[]; // 细节举止标签（含待改进，选填）
  politenessNote?: string; // 补充建议

  // 4. Overall Dating Vibe (约会整体体验与后续意愿)
  overallRating: number; // 1-5 *
  dateArrangement?: string; // 行程与环境安排满意度 *
  futureIntention?: string; // 后续发展意愿（选填）
  dateImpressionTags?: string[]; // 约会安排与相处细节标签（含待改进，选填）

  // 5. Improvement Suggestion (教我如何成为更好的自己)
  suggestion?: string; // 改进建议

  // 6. Basic Info (Optional)
  nickname?: string; // 对方昵称/备注 (选填)
}

// ---------------------------------------------------------------------------
// Lottery (反馈提交后的一次性抽奖)
// Prize list + award factory live in lib/lottery.ts (shared with the client wheel).
// ---------------------------------------------------------------------------
import { LotteryAward, LotteryRecord } from "@/lib/lottery";

export type { LotteryAward, LotteryRecord } from "@/lib/lottery";

interface DatabaseSchema {
  feedbacks: FeedbackSubmission[];
  submittedIps: Record<string, string>; // ip -> submittedAt
  submittedTokens: Record<string, string>; // clientToken -> submittedAt
  lotteries: LotteryRecord[];
  spunIps: Record<string, string>; // ip -> lottery record id
  spunTokens: Record<string, string>; // clientToken -> lottery record id
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "feedback-store.json");

// The store file predates the lottery tables, so older files are upgraded in memory.
function normalizeDatabase(raw: Partial<DatabaseSchema>): DatabaseSchema {
  return {
    feedbacks: Array.isArray(raw.feedbacks) ? raw.feedbacks : [],
    submittedIps: raw.submittedIps ?? {},
    submittedTokens: raw.submittedTokens ?? {},
    lotteries: Array.isArray(raw.lotteries) ? raw.lotteries : [],
    spunIps: raw.spunIps ?? {},
    spunTokens: raw.spunTokens ?? {},
  };
}

function ensureDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialData = normalizeDatabase({});
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), "utf-8");
    return initialData;
  }

  // Read errors propagate on purpose: resetting the store here would erase every submission.
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    return normalizeDatabase(JSON.parse(raw) as Partial<DatabaseSchema>);
  } catch {
    const backupPath = `${DB_PATH}.corrupt-${Date.now()}`;
    fs.copyFileSync(DB_PATH, backupPath);
    throw new Error(`feedback-store.json 无法解析，原文件已备份至 ${backupPath}`);
  }
}

function saveDatabase(data: DatabaseSchema): void {
  const tempPath = `${DB_PATH}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempPath, DB_PATH);
}

export function hasAlreadySubmitted(ip: string, clientToken?: string): {
  hasSubmitted: boolean;
  reason?: "ip" | "token";
} {
  const db = ensureDatabase();

  if (ip && db.submittedIps[ip]) {
    return { hasSubmitted: true, reason: "ip" };
  }

  if (clientToken && db.submittedTokens[clientToken]) {
    return { hasSubmitted: true, reason: "token" };
  }

  return { hasSubmitted: false };
}

export function recordFeedback(entry: FeedbackSubmission): {
  success: boolean;
  error?: string;
} {
  const db = ensureDatabase();

  // Deduplication check
  if (entry.ip && db.submittedIps[entry.ip]) {
    return {
      success: false,
      error: "该 IP 地址已提交过反馈，每位访客仅限提交一次。",
    };
  }

  if (entry.clientToken && db.submittedTokens[entry.clientToken]) {
    return {
      success: false,
      error: "该设备已提交过反馈，每位访客仅限提交一次。",
    };
  }

  // Record submission
  db.feedbacks.push(entry);
  if (entry.ip) {
    db.submittedIps[entry.ip] = entry.submittedAt;
  }
  if (entry.clientToken) {
    db.submittedTokens[entry.clientToken] = entry.submittedAt;
  }

  saveDatabase(db);
  return { success: true };
}

export function getAllFeedbacks(): FeedbackSubmission[] {
  const db = ensureDatabase();
  return db.feedbacks;
}

// ---------------------------------------------------------------------------
// Lottery helpers
// ---------------------------------------------------------------------------

function findSpinRecord(
  db: DatabaseSchema,
  ip: string,
  clientToken?: string
): LotteryRecord | undefined {
  const id = (ip && db.spunIps[ip]) || (clientToken && db.spunTokens[clientToken]) || "";
  if (!id) return undefined;
  return db.lotteries.find((record) => record.id === id);
}

function toAward(record: LotteryRecord): LotteryAward {
  return {
    prizeId: record.prizeId,
    prize: record.prize,
    code: record.code,
    amount: record.amount,
  };
}

/**
 * Builds the guaranteed award: the last prize in LOTTERY_PRIZES always wins.
 * The red-packet amount and redeem code are randomised so every visitor sees a
 * unique-looking result, while the prize itself never varies.
 */
export { createGuaranteedAward } from "@/lib/lottery";

export function hasAlreadySpun(
  ip: string,
  clientToken?: string
): { hasSpun: boolean; award?: LotteryAward } {
  const db = ensureDatabase();
  const record = findSpinRecord(db, ip, clientToken);
  if (!record) return { hasSpun: false };
  return { hasSpun: true, award: toAward(record) };
}

export function recordSpin(entry: LotteryRecord): {
  success: boolean;
  error?: string;
} {
  const db = ensureDatabase();

  if (entry.ip && db.spunIps[entry.ip]) {
    return { success: false, error: "该 IP 地址已抽过奖，每人仅限抽一次。" };
  }

  if (entry.clientToken && db.spunTokens[entry.clientToken]) {
    return { success: false, error: "该设备已抽过奖，每人仅限抽一次。" };
  }

  db.lotteries.push(entry);
  if (entry.ip) {
    db.spunIps[entry.ip] = entry.id;
  }
  if (entry.clientToken) {
    db.spunTokens[entry.clientToken] = entry.id;
  }

  saveDatabase(db);
  return { success: true };
}
