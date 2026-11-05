import fs from "fs";
import path from "path";

export interface SceneVisitor {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  visits: number;
  ip: string;
  userAgent: string;
  browser: string;
  /** Highest whole lap reached around the tree, 0 to 3. */
  laps: number;
  direction: "cw" | "ccw" | null;
  /** When autumn was first earned. */
  autumnUnlockedAt?: string;
  /** How many times autumn has been earned, once per page view that completed three laps. */
  autumnUnlocks: number;
  lastAutumnAt?: string;
}

interface SceneStore {
  visitors: Record<string, SceneVisitor>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "scene-visitors.json");
const MAX_VISITORS = 5000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVisitorId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Short human label such as "Chrome 155 on Windows" from a User-Agent header. */
export function describeBrowser(userAgent: string): string {
  const pick = (re: RegExp) => userAgent.match(re)?.[1]?.split(".")[0];
  let name = "Unknown browser";
  const edge = pick(/Edg(?:e|A|iOS)?\/([\d.]+)/);
  const opera = pick(/OPR\/([\d.]+)/);
  const firefox = pick(/(?:Firefox|FxiOS)\/([\d.]+)/);
  const chrome = pick(/(?:Chrome|CriOS)\/([\d.]+)/);
  const safari = pick(/Version\/([\d.]+).*Safari/);
  if (edge) name = `Edge ${edge}`;
  else if (opera) name = `Opera ${opera}`;
  else if (firefox) name = `Firefox ${firefox}`;
  else if (chrome) name = `Chrome ${chrome}`;
  else if (safari) name = `Safari ${safari}`;

  let os = "";
  if (/Windows/i.test(userAgent)) os = "Windows";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(userAgent)) os = "macOS";
  else if (/Linux/i.test(userAgent)) os = "Linux";
  return os ? `${name} on ${os}` : name;
}

function readStore(): SceneStore {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) return { visitors: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as Partial<SceneStore>;
    return { visitors: parsed.visitors ?? {} };
  } catch {
    fs.copyFileSync(DB_PATH, `${DB_PATH}.corrupt-${Date.now()}`);
    return { visitors: {} };
  }
}

function writeStore(store: SceneStore) {
  const ids = Object.keys(store.visitors);
  if (ids.length > MAX_VISITORS) {
    // Drop the stalest visitors who never unlocked autumn.
    ids
      .filter((id) => !store.visitors[id].autumnUnlockedAt)
      .sort((a, b) => store.visitors[a].lastSeenAt.localeCompare(store.visitors[b].lastSeenAt))
      .slice(0, ids.length - MAX_VISITORS)
      .forEach((id) => delete store.visitors[id]);
  }
  const tempPath = `${DB_PATH}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf-8");
  fs.renameSync(tempPath, DB_PATH);
}

export interface VisitorRequestMeta {
  ip: string;
  userAgent: string;
}

export interface ProgressUpdate {
  laps?: number;
  direction?: "cw" | "ccw" | null;
  completed?: boolean;
}

/**
 * Creates or refreshes a visitor record. The uuid is the identity; the IP
 * address and browser are stored alongside it for logging only.
 */
export function upsertVisitor(
  id: string,
  meta: VisitorRequestMeta,
  update: ProgressUpdate = {},
  countVisit = false,
): SceneVisitor {
  const store = readStore();
  const now = new Date().toISOString();
  const existing = store.visitors[id];
  const visitor: SceneVisitor = existing ?? {
    id,
    firstSeenAt: now,
    lastSeenAt: now,
    visits: 0,
    ip: meta.ip,
    userAgent: meta.userAgent,
    browser: describeBrowser(meta.userAgent),
    laps: 0,
    direction: null,
    autumnUnlocks: 0,
  };

  // Records written before unlocks were counted.
  if (typeof visitor.autumnUnlocks !== "number") visitor.autumnUnlocks = visitor.autumnUnlockedAt ? 1 : 0;

  visitor.lastSeenAt = now;
  visitor.ip = meta.ip || visitor.ip;
  visitor.userAgent = meta.userAgent || visitor.userAgent;
  visitor.browser = describeBrowser(visitor.userAgent);
  if (countVisit || !existing) visitor.visits += 1;

  const reportedLaps =
    typeof update.laps === "number" && Number.isFinite(update.laps)
      ? Math.min(3, Math.max(0, Math.floor(update.laps)))
      : 0;
  visitor.laps = Math.max(visitor.laps, reportedLaps);
  if (update.direction === "cw" || update.direction === "ccw") visitor.direction = update.direction;
  // The scene always loads green, so each page view that finishes three laps is a new unlock.
  if (update.completed && reportedLaps >= 3) {
    visitor.autumnUnlockedAt = visitor.autumnUnlockedAt ?? now;
    visitor.lastAutumnAt = now;
    visitor.autumnUnlocks += 1;
  }

  store.visitors[id] = visitor;
  writeStore(store);
  return visitor;
}
