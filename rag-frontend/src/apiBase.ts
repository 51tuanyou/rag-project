/**
 * Browser-facing API base URL.
 *
 * - Unset: local dev default http://localhost:8000
 * - "" / "same-origin" / "/": same origin (nginx proxies /api) — use this on servers
 * - Explicit URL: e.g. http://10.10.10.125:8000
 */
export function getApiBase(): string {
  const raw = (import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env
    ?.VITE_API_BASE

  if (raw === "" || raw === "/" || raw === "same-origin") {
    return ""
  }
  if (raw == null || raw === undefined) {
    return "http://localhost:8000"
  }
  return raw.replace(/\/$/, "")
}

export const API_BASE = getApiBase()
