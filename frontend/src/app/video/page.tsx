"use client"
import { useEffect, useState } from 'react'
import { HlsVideo } from '@/components/HlsPlayer'
import { getJSON, postJSON, openScanWS } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type Track = { id: string; artist?: string; title?: string; originalFile?: string; hlsUrl?: string; hasHLS?: boolean; format?: string }

export default function VideoPage() {
  const [list, setList] = useState<Track[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      const data = await getJSON<Track[]>('/api/video/playlist')
      setList(data)
    } catch (e) {
      setLogs([`加载失败: ${String((e as Error).message)}`])
    }
  }
  useEffect(() => { load() }, [])

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
        onError: (msg) => setLogs(prev => [...prev, `ERROR: ${msg}`]),
        onClose: () => { if (ws) ws = null }
      })
    } catch {
      // fallback: use HTTP POST once
      try {
        const data = await postJSON<{ logs?: string[]; result?: unknown }>('/api/scan/video')
        setLogs(data.logs || [])
        await load()
        toast.success('视频扫描完成')
      } finally { setLoading(false) }
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Play size={20}/> 视频列表</h1>
        <Button onClick={scan} disabled={loading} variant={loading ? 'outline' : 'default'}>
          <RefreshCw className="mr-1" size={16} /> {loading ? '扫描中…' : '扫描并生成 HLS'}
        </Button>
      </div>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(item => (
          <li key={item.id} className="rounded border border-slate-200 p-0 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-sm flex items-center justify-between">
              <div className="font-medium truncate">{item.title || item.id}</div>
              <div className="text-slate-500 ml-2 truncate">{item.artist}</div>
            </div>
            <div className="p-3">
            {item.hlsUrl ? (
              <HlsVideo src={item.hlsUrl} className="w-full aspect-video bg-black" />
            ) : (
              <div className="text-sm text-slate-500">无 HLS，可点击右上角按钮生成</div>
            )}
              <div className="text-xs text-slate-500 mt-2 break-all">原文件：{item.originalFile}</div>
            </div>
          </li>
        ))}
      </ul>
      {logs.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer">查看最近日志</summary>
          <pre className="p-3 bg-slate-100 rounded overflow-auto max-h-64 text-xs whitespace-pre-wrap">{logs.join('\n')}</pre>
        </details>
      )}
    </div>
  )
}
