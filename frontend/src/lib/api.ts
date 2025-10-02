function resolveApiBase() {
  // 1) 优先环境变量
  const env = process.env.NEXT_PUBLIC_API_BASE
  if (env && env.trim()) return env
  // 2) 浏览器端直接用相对路径（同源）
  if (typeof window !== 'undefined') return ''
  // 3) 其余场景保持空字符串（由调用方决定）
  return ''
}

export const API_BASE = resolveApiBase()

function resolveWsBase() {
  // 1) 优先使用显式环境变量
  const envWs = process.env.NEXT_PUBLIC_WS_BASE
  if (envWs && envWs.trim()) return envWs
  // 2) 浏览器环境下，基于当前页面自动推断同源 ws/wss
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${window.location.host}`
  }
  // 3) 服务器/构建环境下，若提供了 API_BASE，则替换协议
  if (API_BASE) return API_BASE.replace(/^http/, 'ws')
  // 4) 最后兜底（本地开发）
  return 'ws://127.0.0.1:8000'
}

export const WS_BASE = resolveWsBase()

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
