"use client"
import { useEffect, useMemo, useState } from 'react'
import { HlsAudio } from '@/components/HlsPlayer'
import { getJSON, postJSON, openScanWS } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Music, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type Track = { id: string; artist?: string; title?: string; originalFile?: string; hlsUrl?: string; hasHLS?: boolean; format?: string }

export default function MusicPage() {
  const [list, setList] = useState<Track[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  // pagination (pure client-side)
  const readQuery = () => {
    if (typeof window === 'undefined') return { p: 1, ps: 12 }
    const sp = new URLSearchParams(window.location.search)
    const p = Math.max(1, Number(sp.get('page') || 1) || 1)
    const ps = Math.max(1, Number(sp.get('pageSize') || 12) || 12)
    return { p, ps }
  }
  const [{ p: initPage, ps: initPageSize }] = useState(readQuery())
  const [page, setPage] = useState(initPage)
  const [pageSize, setPageSize] = useState(initPageSize)

  const load = async () => {
    try {
      const data = await getJSON<Track[]>('/api/music/playlist')
      setList(data)
    } catch (e) {
      setLogs([`加载失败: ${String((e as Error).message)}`])
    }
  }
  useEffect(() => { load() }, [])

  // keep page in range when list or pageSize changes
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize || 1))
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages, page])

  // sync to URL for share/back-forward
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    sp.set('page', String(page))
    sp.set('pageSize', String(pageSize))
    const newUrl = `${window.location.pathname}?${sp.toString()}`
    window.history.replaceState({}, '', newUrl)
  }, [page, pageSize])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return list.slice(start, start + pageSize)
  }, [list, page, pageSize])

  const scan = async () => {
    setLoading(true)
    setLogs([])
    let ws: WebSocket | null = null
    try {
      ws = openScanWS('/ws/scan/music', {
        onLog: (line) => setLogs(prev => [...prev, line].slice(-500)),
        onDone: async () => {
          await load()
          toast.success('音乐扫描完成')
          setLoading(false)
        },
        onError: (msg) => {
          setLogs(prev => [...prev, `ERROR: ${msg}`])
          // 常见提示映射
          if (/already running/i.test(msg)) {
            toast.error('有一个音乐扫描正在进行中，请稍后再试')
          } else if (/debounced/i.test(msg)) {
            const m = msg.match(/(~?(\d+)s)/i)
            const left = m?.[2] ? `约 ${m[2]} 秒后重试` : '稍后重试'
            toast.error(`操作过于频繁，${left}`)
          } else {
            toast.error(`音乐扫描失败：${msg}`)
          }
          setLoading(false)
        },
        onClose: () => { if (ws) ws = null }
      })
    } catch (e) {
      // fallback: use HTTP POST once
      try {
        const data = await postJSON<{ logs?: string[]; result?: unknown }>('/api/scan/music')
        setLogs(data.logs || [])
        await load()
        toast.success('音乐扫描完成')
      } catch (err) {
        const msg = String((err as Error)?.message || err)
        setLogs(prev => [...prev, `ERROR: ${msg}`])
        if (/\b409\b/.test(msg) || /already running/i.test(msg)) {
          toast.error('有一个音乐扫描正在进行中，请稍后再试')
        } else if (/\b429\b/.test(msg) || /debounced/i.test(msg)) {
          const m = msg.match(/(~?(\d+)s)/i)
          const left = m?.[2] ? `约 ${m[2]} 秒后重试` : '稍后重试'
          toast.error(`操作过于频繁，${left}`)
        } else {
          toast.error('音乐扫描启动失败')
        }
      } finally { setLoading(false) }
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Music size={20}/> 音乐列表</h1>
        <Button onClick={scan} disabled={loading} variant={loading ? 'outline' : 'default'}>
          <RefreshCw className="mr-1" size={16} /> {loading ? '扫描中…' : '扫描并生成 HLS'}
        </Button>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          共 {total} 条；第 {Math.min(page, totalPages)} / {totalPages} 页
        </div>
        <div className="flex items-center gap-2">
          <span>每页</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value) || 12); setPage(1) }}
          >
            <option value={6}>6</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
          <span>条</span>
          <Button variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>上一页</Button>
          <Button variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</Button>
        </div>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map(item => (
          <li key={item.id} className="rounded border border-slate-200 p-0 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-sm flex items-center justify-between">
              <div className="font-medium truncate">{item.title || item.id}</div>
              <div className="text-slate-500 ml-2 truncate">{item.artist}</div>
            </div>
            <div className="p-3">
              {item.hlsUrl ? (
                <HlsAudio src={item.hlsUrl} className="w-full" />
              ) : (
                <div className="text-sm text-slate-500">无 HLS，可点击右上角按钮生成</div>
              )}
              <div className="text-xs text-slate-500 mt-2 break-all">原文件：{item.originalFile}</div>
            </div>
          </li>
        ))}
      </ul>
      {total === 0 && (
        <div className="text-sm text-slate-500">暂无条目</div>
      )}
      {logs.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer">查看最近日志</summary>
          <pre className="p-3 bg-slate-100 rounded overflow-auto max-h-64 text-xs whitespace-pre-wrap">{logs.join('\n')}</pre>
        </details>
      )}
    </div>
  )
}
