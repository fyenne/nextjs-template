import fs from "fs";
import path from "path";

export interface FeedbackSubmission {
  id: string;
  submittedAt: string;
  ip: string;
  clientToken?: string;
  userAgent?: string;

  // 1. Overall Politeness (礼貌度与举止)
  politenessRating: number; // 1-5 *
  punctuality?: string; // 守时情况
  etiquetteDetails?: string[]; // 细节举止标签
  politenessNote?: string; // 补充建议

  // 2. Conversation Interest (谈吐交流与话题趣味度)
  conversationRating: number; // 1-5 *
  conversationDynamic: string; // 互动交流氛围 *
  conversationTags?: string[]; // 话题趣味标签
  conversationNote?: string; // 交流体验

  // 3. Appearance (外形衣品与仪态气质)
  appearanceRating: number; // 1-5 *
  clothingStyle?: string; // 衣品整洁度
  photoMatch?: string; // 与照片符合度
  appearanceTags?: string[]; // 仪态气质标签
  appearanceNote?: string; // 形象建议

  // 4. Overall Dating Vibe (约会整体体验与后续意愿)
  overallRating: number; // 1-5 *
  dateArrangement?: string; // 行程与环境安排满意度
  futureIntention: string; // 后续发展意愿 *
  suggestion?: string; // 改进建议

  // 5. Basic Info (Optional)
  platform?: string; // 相识渠道
  nickname?: string; // 对方昵称/备注 (选填)
}

interface DatabaseSchema {
  feedbacks: FeedbackSubmission[];
  submittedIps: Record<string, string>; // ip -> submittedAt
  submittedTokens: Record<string, string>; // clientToken -> submittedAt
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "feedback-store.json");

function ensureDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialData: DatabaseSchema = {
      feedbacks: [],
      submittedIps: {},
      submittedTokens: {},
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), "utf-8");
    return initialData;
  }

  // Read errors propagate on purpose: resetting the store here would erase every submission.
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    return JSON.parse(raw) as DatabaseSchema;
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
