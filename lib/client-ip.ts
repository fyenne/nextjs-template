import type { NextRequest } from "next/server";

/**
 * Best-effort client IP for rate limiting / one-shot rules.
 *
 * Direct connections expose no client IP to Route Handlers. A shared fallback
 * such as "127.0.0.1" would block every direct visitor after the first request,
 * so this returns "" and callers must skip the IP check in that case.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();
  return "";
}
