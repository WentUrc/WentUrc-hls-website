"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
// import { HlsAudio } from '@/components/HlsPlayer'
import { AudioPlayer, type PlayMode } from '@/components/ui/audio-player'
import { getJSON, postJSON, openScanWS } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Window } from '@/components/ui/window'
import { Skeleton } from '@/components/ui/skeleton'
import { Music, RefreshCw, History, X, Repeat, Repeat1, Shuffle } from 'lucide-react'
import { toast } from 'sonner'

type Track = { id: string; artist?: string; title?: string; originalFile?: string; hlsUrl?: string; hasHLS?: boolean; format?: string }

export default function MusicPage() {
  const [list, setList] = useState<Track[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [showLogs, setShowLogs] = useState(false)
  const hasLogs = logs.length > 0
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playMode, setPlayMode] = useState<PlayMode>('all')
  const leftRef = useRef<HTMLDivElement | null>(null)
  const rightRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  const load = async () => {
    setListLoading(true)
    try {
      const data = await getJSON<Track[]>('/api/music/playlist')
      setList(data)
    } catch (e) {
      setLogs([`加载失败: ${String((e as Error).message)}`])
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!list.length) { setSelectedId(null); return }
    if (!selectedId || !list.some(i => i.id === selectedId)) {
      setSelectedId(list[0].id)
    }
  }, [list, selectedId])
  const selected = useMemo(() => list.find(i => i.id === selectedId) || null, [list, selectedId])
  const indexById = useMemo(() => new Map(list.map((t, idx) => [t.id, idx])), [list])
  const gotoByIndex = (idx: number) => {
    if (!list.length) return
    const n = ((idx % list.length) + list.length) % list.length
    setSelectedId(list[n].id)
  }
  const handlePrev = (mode: PlayMode) => {
    if (!list.length) return
    if (mode === 'shuffle') {
      const r = Math.floor(Math.random() * list.length)
      gotoByIndex(r)
    } else {
      const cur = indexById.get(selectedId || '') ?? 0
      gotoByIndex(cur - 1)
    }
  }
  const handleNext = (mode: PlayMode) => {
    if (!list.length) return
    if (mode === 'shuffle') {
      const r = Math.floor(Math.random() * list.length)
      gotoByIndex(r)
    } else if (mode === 'one') {
      // stay on current
      const cur = indexById.get(selectedId || '') ?? 0
      gotoByIndex(cur)
    } else {
      const cur = indexById.get(selectedId || '') ?? 0
      gotoByIndex(cur + 1)
    }
  }
  const cycleMode = () => setPlayMode(m => (m === 'all' ? 'one' : m === 'one' ? 'shuffle' : 'all'))

  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : undefined
    const leftEl = leftRef.current
    const rightEl = rightRef.current
    if (!leftEl || !rightEl) return

    const apply = () => {
      if (!leftEl || !rightEl) return
      if (!mq?.matches) {
        leftEl.style.height = ''
        return
      }
      const h = rightEl.getBoundingClientRect().height
      leftEl.style.height = `${Math.max(0, Math.floor(h))}px`
    }

    const ro = new ResizeObserver(() => apply())
    ro.observe(rightEl)

    window.addEventListener('resize', apply)

    apply()
    const id = window.setTimeout(apply, 0)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      window.clearTimeout(id)
    }
  }, [selectedId, list.length, playMode])

  useEffect(() => {
    const el = imgRef.current
    if (el && el.complete && el.naturalWidth > 0) setImgLoaded(true)
  }, [selectedId])

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
    } catch {

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
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Music size={20}/> 音乐列表</h1>
        <div className="flex flex-row flex-nowrap items-center gap-2 w-full sm:w-auto">
          <Button onClick={scan} disabled={loading} variant={loading ? 'outline' : 'default'} className="whitespace-nowrap">
            <RefreshCw className="mr-1" size={16} /> {loading ? '扫描中…' : '开始工作'}
          </Button>
          <Button
            variant="outline"
            className={`${hasLogs ? 'border-blue-400/60 text-blue-600 dark:border-blue-500/60 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/20' : ''} whitespace-nowrap`}
            onClick={() => setShowLogs(true)}
          >
            <History className="mr-1" size={16} />
            <span>查看日志</span>
          </Button>
        </div>
      </div>
      <section>
        {listLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div ref={leftRef} className="hidden lg:flex lg:col-span-1 min-h-0 flex-col rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <Skeleton className="h-4 w-24" />
              </div>
              <ul className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </li>
                ))}
              </ul>
            </div>
            <div ref={rightRef} className="lg:col-span-2 min-h-0 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="p-4 space-y-3">
                <Skeleton className="w-full aspect-video" />
                <div className="flex items-center gap-2 lg:hidden">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </div>
          </div>
        ) : list.length === 0 ? (
          <div className="text-sm text-slate-500">暂无条目</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div ref={leftRef} className="hidden lg:flex lg:col-span-1 min-h-0 flex-col rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-sm font-medium">共 {list.length} 条</div>
              <ul className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
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
            <div ref={rightRef} className="lg:col-span-2 min-h-0 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
              {selected ? (
                <div>
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="font-medium truncate text-slate-900 dark:text-slate-100">{selected.title || selected.id}</div>
                    <div className="text-slate-600 dark:text-slate-300 sm:ml-2 truncate">{selected.artist || '—'}</div>
                  </div>
                  <div className="p-4">
                    <div className="relative w-full aspect-video overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800" data-media-boundary>
                      <Image
                        src="/image/artist.webp"
                        alt="音频占位图"
                        fill
                        sizes="(max-width: 1024px) 100vw, 66vw"
                        priority={false}
                        className={`object-cover rounded-sm ${imgLoaded ? 'animate-fade-in-up' : 'opacity-0'}`}
                        onLoad={() => setImgLoaded(true)}
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/80 via-white/40 to-transparent dark:from-black/70 dark:via-black/35 dark:to-transparent lg:hidden" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/80 via-white/40 to-transparent dark:from-black/70 dark:via-black/35 dark:to-transparent hidden lg:block" />
                      {selected.hlsUrl ? (
                        <>
                          <div className="absolute inset-x-0 bottom-0 p-2 lg:hidden">
                            <AudioPlayer
                              src={selected.hlsUrl}
                              className="bg-transparent dark:bg-transparent border-0 shadow-none rounded-none"
                              onPrev={handlePrev}
                              onNext={handleNext}
                              variant="compact"
                              mode={playMode}
                              onModeChange={setPlayMode}
                            />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-2 hidden lg:block">
                            <AudioPlayer
                              src={selected.hlsUrl}
                              className="bg-transparent dark:bg-transparent border-0 shadow-none rounded-none"
                              onPrev={handlePrev}
                              onNext={handleNext}
                              mode={playMode}
                              onModeChange={setPlayMode}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-x-0 bottom-0 p-3 text-xs sm:text-sm text-white/90 dark:text-slate-200/90">
                          无 HLS，可点击上方按钮生成
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 lg:hidden">
                      <Button variant="outline" size="sm" onClick={() => handlePrev(playMode)}>上一曲</Button>
                      <Button variant="outline" size="sm" onClick={() => handleNext(playMode)}>下一曲</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cycleMode}
                        aria-label={playMode === 'one' ? '单曲循环' : playMode === 'shuffle' ? '随机播放' : '列表循环'}
                        title={playMode === 'one' ? '单曲循环' : playMode === 'shuffle' ? '随机播放' : '列表循环'}
                      >
                        {playMode === 'one' ? <Repeat1 size={16} /> : playMode === 'shuffle' ? <Shuffle size={16} /> : <Repeat size={16} />}
                      </Button>
                    </div>
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
