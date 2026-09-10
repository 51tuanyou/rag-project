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

function getCookie(name: string): string | null {
  const escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** fetch wrapper: attaches X-CSRFToken when a csrftoken cookie is present (Django admin session). */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {})
  const method = (init.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    const csrf = getCookie('csrftoken')
    if (csrf && !headers.has('X-CSRFToken')) {
      headers.set('X-CSRFToken', csrf)
    }
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'same-origin',
  })
}
