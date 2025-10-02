"use client"
import Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Pause, Play, Volume2, VolumeX, SkipBack, SkipForward, Repeat, Repeat1, Shuffle } from 'lucide-react'

export interface AudioPlayerProps {
  src: string
  className?: string
  autoPlay?: boolean
  onPrev?: (mode: PlayMode) => void
  onNext?: (mode: PlayMode) => void
}

export type PlayMode = 'all' | 'one' | 'shuffle'

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '--:--'
  const s = Math.floor(sec % 60)
  const m = Math.floor(sec / 60)
  const mm = m.toString()
  const ss = s.toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export function AudioPlayer({ src, className, autoPlay, onPrev, onNext }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(NaN)
  const [seeking, setSeeking] = useState(false)
  const [seekValuePct, setSeekValuePct] = useState<number | null>(null)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [mode, setMode] = useState<PlayMode>('all')

  // attach HLS
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    let hls: Hls | null = null
    setReady(false)
    setPlaying(false)
    setCurrent(0)
    setDuration(NaN)
    setBufferedEnd(0)

    const attachListeners = () => {
      const onLoadedMeta = () => { setDuration(el.duration) }
      const onTimeUpdate = () => { setCurrent(el.currentTime) }
      const onProgress = () => {
        try {
          const b = el.buffered
          const end = b.length ? b.end(b.length - 1) : 0
          setBufferedEnd(end)
        } catch { /* ignore */ }
      }
      const onPlay = () => setPlaying(true)
      const onPause = () => setPlaying(false)
      const onCanPlay = () => setReady(true)
      const onVolume = () => { setMuted(el.muted); setVolume(el.volume) }
  const onEnded = () => setPlaying(false)

      el.addEventListener('loadedmetadata', onLoadedMeta)
      el.addEventListener('timeupdate', onTimeUpdate)
      el.addEventListener('progress', onProgress)
      el.addEventListener('play', onPlay)
      el.addEventListener('pause', onPause)
      el.addEventListener('canplay', onCanPlay)
      el.addEventListener('volumechange', onVolume)
  el.addEventListener('ended', onEnded)

      return () => {
        el.removeEventListener('loadedmetadata', onLoadedMeta)
        el.removeEventListener('timeupdate', onTimeUpdate)
        el.removeEventListener('progress', onProgress)
        el.removeEventListener('play', onPlay)
        el.removeEventListener('pause', onPause)
        el.removeEventListener('canplay', onCanPlay)
        el.removeEventListener('volumechange', onVolume)
        el.removeEventListener('ended', onEnded)
      }
    }

    const detachListeners = attachListeners()

    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src
      el.load()
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hls.loadSource(src)
      hls.attachMedia(el)
    } else {
      el.src = src
      el.load()
    }

    if (autoPlay) {
      el.play().catch(() => { /* require user gesture */ })
    }

    return () => {
      if (hls) hls.destroy()
      detachListeners()
    }
  }, [src, autoPlay])

  // reflect loop based on mode
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = (mode === 'one')
  }, [mode])

  // on ended -> ask parent to go next when needed
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const handle = () => {
      // 单曲循环由浏览器 loop 处理；其余交给父组件
      if (mode === 'one') return
      onNext?.(mode)
    }
    el.addEventListener('ended', handle)
    return () => el.removeEventListener('ended', handle)
  }, [mode, onNext])

  const progress = useMemo(() => {
    if (!isFinite(duration) || duration <= 0) return 0
    return Math.min(100, Math.max(0, (current / duration) * 100))
  }, [current, duration])

  const bufferedPct = useMemo(() => {
    if (!isFinite(duration) || duration <= 0) return 0
    return Math.min(100, Math.max(0, (bufferedEnd / duration) * 100))
  }, [bufferedEnd, duration])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (!ready) return
    if (playing) el.pause(); else el.play().catch(() => {})
  }

  const seekTo = (pct: number) => {
    const el = audioRef.current
    if (!el || !ready || !isFinite(duration) || duration <= 0) return
    el.currentTime = (pct / 100) * duration
  }

  const stepSeek = (delta: number) => {
    const el = audioRef.current
    if (!el || !ready) return
    el.currentTime = Math.max(0, Math.min(duration || 0, el.currentTime + delta))
  }

  const toggleMute = () => {
    const el = audioRef.current
    if (!el) return
    el.muted = !el.muted
  }

  const changeVolume = (v: number) => {
    const el = audioRef.current
    if (!el) return
    el.volume = Math.min(1, Math.max(0, v))
    el.muted = el.volume === 0
  }

  // keyboard shortcuts on wrapper
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); togglePlay() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepSeek(-5) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepSeek(5) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); changeVolume(Math.min(1, volume + 0.05)) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); changeVolume(Math.max(0, volume - 0.05)) }
    else if (e.key.toLowerCase() === 'm') { e.preventDefault(); toggleMute() }
  }

  const cycleMode = () => {
    setMode(m => (m === 'all' ? 'one' : m === 'one' ? 'shuffle' : 'all'))
  }

  const sliderValue = useMemo(() => {
    if (!ready) return 0
    if (seeking && seekValuePct != null) return seekValuePct
    return progress
  }, [ready, seeking, seekValuePct, progress])

  return (
    <div
      className={cn(
        'rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 select-none',
        'px-3 py-2',
        className,
      )}
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="region"
      aria-label="音频播放器"
    >
      {/* hidden backing <audio> */}
      <audio ref={audioRef} preload="metadata" className="hidden" />

      {/* controls row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
          aria-label={playing ? '暂停' : '播放'}
          disabled={!ready}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          onClick={() => onPrev?.(mode)}
          className="h-9 px-2 inline-flex items-center gap-1 rounded-md border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
          aria-label="上一曲"
          title="上一曲"
          disabled={!ready}
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          onClick={() => onNext?.(mode)}
          className="h-9 px-2 inline-flex items-center gap-1 rounded-md border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
          aria-label="下一曲"
          title="下一曲"
          disabled={!ready}
        >
          <SkipForward size={16} />
        </button>
        <button
          type="button"
          onClick={cycleMode}
          className="h-9 px-2 inline-flex items-center gap-1 rounded-md border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
          aria-label={mode === 'one' ? '单曲循环' : mode === 'shuffle' ? '随机播放' : '列表循环'}
          title={mode === 'one' ? '单曲循环' : mode === 'shuffle' ? '随机播放' : '列表循环'}
        >
          {mode === 'one' ? <Repeat1 size={16} /> : mode === 'shuffle' ? <Shuffle size={16} /> : <Repeat size={16} />}
        </button>
        <div className="ml-1 text-xs tabular-nums text-slate-600 dark:text-slate-300 min-w-[56px] text-right">
          {formatTime(current)}
        </div>
        <div className="flex-1 mx-2">
          {/* progress wrapper with aligned thumb */}
          <div className="relative h-5">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300 dark:bg-slate-600" style={{ width: `${bufferedPct}%` }} />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={sliderValue}
              onMouseDown={() => setSeeking(true)}
              onTouchStart={() => setSeeking(true)}
              onChange={(e) => { if (!ready) return; setSeekValuePct(parseFloat(e.target.value)) }}
              onMouseUp={() => { if (seekValuePct != null) seekTo(seekValuePct); setSeeking(false); setSeekValuePct(null) }}
              onTouchEnd={() => { if (seekValuePct != null) seekTo(seekValuePct); setSeeking(false); setSeekValuePct(null) }}
              className={cn(
                'absolute inset-0 w-full h-full appearance-none bg-transparent',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:-mt-1',
                '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:h-1.5',
                // Firefox styling
                '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600',
                '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-slate-200 dark:[&::-moz-range-track]:bg-slate-700',
              )}
              aria-label="进度"
              disabled={!ready}
            />
          </div>
        </div>
        <div className="text-xs tabular-nums text-slate-600 dark:text-slate-300 min-w-[56px]">
          {formatTime(duration)}
        </div>
        <button
          type="button"
          onClick={toggleMute}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
          aria-label={muted ? '取消静音' : '静音'}
          disabled={!ready}
        >
          {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={ready ? volume : 0}
          onChange={(e) => changeVolume(parseFloat(e.target.value))}
          className={cn(
            'w-24 hidden sm:block appearance-none bg-transparent h-5',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-500 [&::-webkit-slider-thumb]:-mt-1',
            '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-slate-200 dark:[&::-webkit-slider-runnable-track]:bg-slate-700',
            // Firefox styling
            '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-slate-500',
            '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-slate-200 dark:[&::-moz-range-track]:bg-slate-700',
          )}
          aria-label="音量"
          disabled={!ready}
        />
      </div>
    </div>
  )
}
