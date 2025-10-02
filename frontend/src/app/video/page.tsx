"use client"
import { useEffect, useMemo, useState } from 'react'
import { HlsVideo } from '@/components/HlsPlayer'
import { getJSON, postJSON, openScanWS } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Window } from '@/components/ui/window'
import { Play, RefreshCw, History, X } from 'lucide-react'
import { toast } from 'sonner'

type Track = { id: string; artist?: string; title?: string; originalFile?: string; hlsUrl?: string; hasHLS?: boolean; format?: string }

export default function VideoPage() {
  const [list, setList] = useState<Track[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const hasLogs = logs.length > 0
  // selection for detail pane
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = async () => {
    try {
      const data = await getJSON<Track[]>('/api/video/playlist')
      setList(data)
    } catch (e) {
      setLogs([`加载失败: ${String((e as Error).message)}`])
    }
  }
  useEffect(() => { load() }, [])

  // initialize selected item when list loads or changes
  useEffect(() => {
    if (!list.length) { setSelectedId(null); return }
    // keep previous selection if still exists, otherwise select first
    if (!selectedId || !list.some(i => i.id === selectedId)) {
      setSelectedId(list[0].id)
    }
  }, [list, selectedId])
  const selected = useMemo(() => list.find(i => i.id === selectedId) || null, [list, selectedId])

  const scan = async () => {
    setLoading(true)
    setLogs([])
    let ws: WebSocket | null = null
    try {
      ws = openScanWS('/ws/scan/video', {
        onLog: (line) => setLogs(prev => [...prev, line].slice(-500)),
        onDone: async () => {
          await load()
          toast.success('视频扫描完成')
          setLoading(false)
        },
        onError: (msg) => {
          setLogs(prev => [...prev, `ERROR: ${msg}`])
          if (/already running/i.test(msg)) {
            toast.error('有一个视频扫描正在进行中，请稍后再试')
          } else if (/debounced/i.test(msg)) {
            const m = msg.match(/(~?(\d+)s)/i)
            const left = m?.[2] ? `约 ${m[2]} 秒后重试` : '稍后重试'
            toast.error(`操作过于频繁，${left}`)
          } else {
            toast.error(`视频扫描失败：${msg}`)
          }
          setLoading(false)
        },
        onClose: () => { if (ws) ws = null }
      })
    } catch {
      // fallback: use HTTP POST once
      try {
        const data = await postJSON<{ logs?: string[]; result?: unknown }>('/api/scan/video')
        setLogs(data.logs || [])
        await load()
        toast.success('视频扫描完成')
      } catch (err) {
        const msg = String((err as Error)?.message || err)
        setLogs(prev => [...prev, `ERROR: ${msg}`])
        if (/\b409\b/.test(msg) || /already running/i.test(msg)) {
          toast.error('有一个视频扫描正在进行中，请稍后再试')
        } else if (/\b429\b/.test(msg) || /debounced/i.test(msg)) {
          const m = msg.match(/(~?(\d+)s)/i)
          const left = m?.[2] ? `约 ${m[2]} 秒后重试` : '稍后重试'
          toast.error(`操作过于频繁，${left}`)
        } else {
          toast.error('视频扫描启动失败')
        }
      } finally { setLoading(false) }
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Play size={20}/> 视频列表</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button onClick={scan} disabled={loading} variant={loading ? 'outline' : 'default'}>
            <RefreshCw className="mr-1" size={16} /> {loading ? '扫描中…' : '开始工作'}
          </Button>
          <Button
            variant="outline"
            className={hasLogs ? 'border-blue-400/60 text-blue-600 dark:border-blue-500/60 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/20' : undefined}
            onClick={() => setShowLogs(true)}
          >
            <History className="mr-1" size={16} />
            <span>查看日志</span>
          </Button>
        </div>
      </div>
      <section>
        {list.length === 0 ? (
          <div className="text-sm text-slate-500">暂无条目</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 左侧：列表 */}
            <div className="lg:col-span-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-sm font-medium">共 {list.length} 条</div>
              <ul className="max-h-[55vh] lg:max-h-[70vh] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
                {list.map(item => {
                  const active = item.id === selectedId
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full text-left px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors ${active ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                      >
                        <div className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{item.title || item.id}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{item.artist || '—'}</div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            {/* 右侧：详情 */}
            <div className="lg:col-span-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              {selected ? (
                <div>
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="font-medium truncate text-slate-900 dark:text-slate-100">{selected.title || selected.id}</div>
                    <div className="text-slate-600 dark:text-slate-300 sm:ml-2 truncate">{selected.artist || '—'}</div>
                  </div>
                  <div className="p-4">
                    {selected.hlsUrl ? (
                      <HlsVideo src={selected.hlsUrl} className="w-full aspect-video bg-black" />
                    ) : (
                      <div className="w-full aspect-video grid place-items-center bg-slate-900 text-slate-200 text-sm">无 HLS，可点击上方按钮生成</div>
                    )}
                    <div className="mt-3 w-full text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2 w-full">
                        <div className="min-w-0 flex-1 flex items-center">
                          <span className="flex-none text-slate-500 dark:text-slate-400">原文件：</span>
                          <span className="truncate">{selected.originalFile || '—'}</span>
                        </div>
                        <div className="flex-none text-right whitespace-nowrap">
                          <span className="text-slate-500 dark:text-slate-400">格式：</span>
                          <span>{selected.format || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-sm text-slate-500">请选择左侧条目</div>
              )}
            </div>
          </div>
        )}
      </section>
      {showLogs && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLogs(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <Window size="lg">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <History size={16} /> 查看最近日志
                </div>
                <button
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                  aria-label="关闭"
                  onClick={() => setShowLogs(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4">
                {logs.length ? (
                  <pre className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded overflow-auto max-h-[60vh] text-xs whitespace-pre-wrap font-mono">{logs.join('\n')}</pre>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">暂无日志</div>
                )}
              </div>
            </Window>
          </div>
        </div>
      )}
    </div>
  )
}
