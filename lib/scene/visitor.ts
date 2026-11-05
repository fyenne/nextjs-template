import type { LapDirection } from "./lap-tracker";

const ID_KEY = "tree_visitor_id";
// Written by an earlier version that restored autumn on load; now removed on sight.
const LEGACY_UNLOCK_KEY = "tree_autumn_unlocked";

export type VisitorStatus = {
  id: string;
  /** True if this visitor has ever earned autumn. It never changes how the scene loads. */
  autumn: boolean;
  /** How many times this visitor has earned autumn. */
  unlocks: number;
  /** The same for winter. */
  winterUnlocks: number;
  laps: number;
};

type ServerStatus = {
  id: string | null;
  autumn: boolean;
  unlocks?: number;
  winterUnlocks?: number;
  laps: number;
};

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode: the server cookie still identifies the visitor.
  }
}

/** crypto.randomUUID only exists in secure contexts, so fall back for http LAN access. */
function mintId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type ProgressReport = {
  laps: number;
  direction: LapDirection | null;
  completed?: boolean;
  /** The stage the completed laps unlocked. */
  stage?: "autumn" | "winter";
};

export class VisitorSession {
  private id: string | null = null;

  /**
   * Registers this visit. With no stored id the server may recognise the
   * visitor from its cookie; otherwise a new uuid is minted and registered.
   */
  async load(signal?: AbortSignal): Promise<VisitorStatus | null> {
    try {
      try {
        window.localStorage.removeItem(LEGACY_UNLOCK_KEY);
      } catch {
        // Storage can be unavailable; nothing to clean up then.
      }
      const stored = readStorage(ID_KEY);
      const query = stored ? `?id=${encodeURIComponent(stored)}` : "";
      let response = await fetch(`/api/autumn${query}`, { cache: "no-store", signal });
      if (!response.ok) return null;
      let status = (await response.json()) as ServerStatus;

      if (!status.id) {
        const minted = mintId();
        response = await fetch(`/api/autumn?id=${minted}`, { cache: "no-store", signal });
        if (!response.ok) return null;
        status = (await response.json()) as ServerStatus;
      }
      if (!status.id) return null;

      this.id = status.id;
      writeStorage(ID_KEY, status.id);
      return {
        id: status.id,
        autumn: status.autumn,
        unlocks: status.unlocks ?? (status.autumn ? 1 : 0),
        winterUnlocks: status.winterUnlocks ?? 0,
        laps: status.laps,
      };
    } catch {
      return null;
    }
  }

  report(progress: ProgressReport) {
    const id = this.id ?? readStorage(ID_KEY);
    if (!id) return;
    void fetch("/api/autumn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...progress }),
      keepalive: true,
    }).catch(() => undefined);
  }
}
