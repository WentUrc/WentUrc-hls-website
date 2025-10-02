export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''
export const WS_BASE = (process.env.NEXT_PUBLIC_WS_BASE || (API_BASE ? API_BASE.replace(/^http/, 'ws') : 'ws://127.0.0.1:8000'))

export async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText} ${text}`)
  }
  return res.json() as Promise<T>
}

export async function postJSON<T>(url: string, body?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText} ${text}`)
  }
  return res.json() as Promise<T>
}

export function openScanWS(path: '/ws/scan/video' | '/ws/scan/music', handlers: {
  onLog?: (line: string) => void
  onDone?: (result: unknown) => void
  onError?: (message: string) => void
  onClose?: () => void
}) {
  // Prefer relative path so Next.js dev rewrites can proxy WS correctly
  const ws = new WebSocket((WS_BASE || '') + path)
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data as string) as { type: string; line?: string; result?: unknown; message?: string }
      if (data.type === 'log' && data.line) handlers.onLog?.(data.line)
      else if (data.type === 'done') handlers.onDone?.(data.result)
      else if (data.type === 'error') handlers.onError?.(data.message || 'unknown error')
    } catch {
      // ignore
    }
  }
  ws.onerror = () => handlers.onError?.('ws error')
  ws.onclose = () => handlers.onClose?.()
  return ws
}
