"use client"
import Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Pause, Play, Volume2, VolumeX, SkipBack, SkipForward, Repeat, Repeat1, Shuffle } from 'lucide-react'
import ProgressBar from './ProgressBar'
import VolumePopover from './VolumePopover'

export interface AudioPlayerProps {
  src: string
  className?: string
  autoPlay?: boolean
  onPrev?: (mode: PlayMode) => void
  onNext?: (mode: PlayMode) => void
  // UI variant: full (default) shows完整控制; compact 仅显示进度+音量，用于叠加在图片底部
  variant?: 'full' | 'compact'
  // 受控播放模式（可选）。若提供，组件将使用此模式并通过 onModeChange 通知外部。
  mode?: PlayMode
  onModeChange?: (mode: PlayMode) => void
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

export function AudioPlayer({ src, className, autoPlay, onPrev, onNext, variant = 'full', mode: modeProp, onModeChange }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(NaN)
  const [seeking, setSeeking] = useState(false)
  const seekingRef = useRef(false)
  const [seekValuePct, setSeekValuePct] = useState<number | null>(null)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [showVol, setShowVol] = useState(false)
  const volWrapRef = useRef<HTMLDivElement | null>(null)
  // remember if it was playing when user begins seeking, so we can pause during drag and resume afterward
  const wasPlayingRef = useRef(false)

  // keep a ref in sync to avoid stale closure inside media event listeners
  useEffect(() => { seekingRef.current = seeking }, [seeking])

  // moved volume popover effects into VolumePopover

  // removed: timed auto-close; keep manual toggle and outside-click close only
  const [internalMode, setInternalMode] = useState<PlayMode>('all')
  const mode = modeProp ?? internalMode
  const setMode = (m: PlayMode) => {
    if (onModeChange) onModeChange(m); else setInternalMode(m)
  }

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
      const onTimeUpdate = () => {
        // 拖动中不让 timeupdate 反向推动 current，避免手柄被“抢回去”造成跳变
        if (seekingRef.current) return
        setCurrent(el.currentTime)
      }
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
    // 即使还未 ready，也尝试触发播放（移动端需要手势触发）
    if (playing) {
      el.pause()
    } else {
      el.play().catch(() => { /* 需用户手势或资源未就绪时忽略错误 */ })
    }
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

  // commit seeking: jump to pct, optimistically sync UI current to avoid one-frame fallback, and optionally resume
  const commitSeek = (pct: number | null) => {
    if (!ready || pct == null || !isFinite(duration) || duration <= 0) {
      // even if invalid, still clear seeking flags
      setSeeking(false)
      seekingRef.current = false
      setSeekValuePct(null)
      if (wasPlayingRef.current) {
        audioRef.current?.play().catch(() => { /* ignore */ })
      }
      wasPlayingRef.current = false
      return
    }
    // perform the seek on media element
    seekTo(pct)
    // optimistically set current to target time to keep slider from snapping back for a frame
    const targetTime = (pct / 100) * duration
    setCurrent(targetTime)
    // close seeking guard and clear temp value
    setSeeking(false)
    seekingRef.current = false
    setSeekValuePct(null)
    // resume if it was playing
    if (wasPlayingRef.current) {
      audioRef.current?.play().catch(() => { /* ignore autoplay restrictions */ })
    }
    wasPlayingRef.current = false
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
    const next = mode === 'all' ? 'one' : mode === 'one' ? 'shuffle' : 'all'
    setMode(next)
  }

  const sliderValue = useMemo(() => {
    if (!ready) return 0
    // 拖动中：使用 seekValuePct 作为受控值，避免 timeupdate 推动跳变
    if (seeking && seekValuePct != null) return seekValuePct
    return progress
  }, [ready, seeking, seekValuePct, progress])

  // 完整样式（不再包含 <audio>，以便在 variant 切换时复用同一音频元素）
  const fullControls = (
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
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
          aria-label="上一曲"
          title="上一曲"
          disabled={!ready}
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          onClick={() => onNext?.(mode)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
          aria-label="下一曲"
          title="下一曲"
          disabled={!ready}
        >
          <SkipForward size={16} />
        </button>
        <button
          type="button"
          onClick={cycleMode}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
          aria-label={mode === 'one' ? '单曲循环' : mode === 'shuffle' ? '随机播放' : '列表循环'}
          title={mode === 'one' ? '单曲循环' : mode === 'shuffle' ? '随机播放' : '列表循环'}
        >
          {mode === 'one' ? <Repeat1 size={16} /> : mode === 'shuffle' ? <Shuffle size={16} /> : <Repeat size={16} />}
        </button>
        <div className="ml-1 text-xs tabular-nums text-slate-600 dark:text-slate-300 min-w-[56px] text-right">
          {formatTime(current)}
        </div>
        <div className="flex-1 mx-2">
          <ProgressBar
            valuePct={sliderValue}
            bufferedPct={bufferedPct}
            ready={ready}
            variant="default"
            onSeekStart={(initialPct) => {
              seekingRef.current = true
              setSeeking(true)
              wasPlayingRef.current = playing
              if (playing) audioRef.current?.pause()
              setSeekValuePct(Number.isFinite(initialPct) ? initialPct : progress)
            }}
            onSeekChange={(pct) => { if (!ready) return; setSeekValuePct(pct) }}
            onSeekCommit={(pct) => commitSeek(pct)}
          />
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
          value={volume}
          onChange={(e) => changeVolume(parseFloat(e.target.value))}
          className={cn(
            'w-24 hidden sm:block appearance-none bg-transparent h-5 focus:outline-none',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:outline-none [&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:transition-none',
            '[&::-webkit-slider-thumb:active]:h-3.5 [&::-webkit-slider-thumb:active]:w-3.5',
            '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-slate-200 dark:[&::-webkit-slider-runnable-track]:bg-slate-700 [&::-webkit-slider-runnable-track]:rounded-full',
            // Firefox styling
            '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:outline-none [&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:transition-none',
            '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-slate-200 dark:[&::-moz-range-track]:bg-slate-700 [&::-moz-range-track]:rounded-full',
          )}
          aria-label="音量"
          disabled={!ready}
        />
      </div>
    </div>
  )

  // 精简样式：仅进度 + 音量 + 两端时间（不包含 <audio>）
  const compactControls = (
    <div
      className={cn(
        'rounded-sm border border-transparent bg-transparent text-slate-900 dark:text-slate-100 select-none',
        'px-2 py-2',
        className,
      )}
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="region"
      aria-label="音频播放器（精简）"
    >
      <div className="flex items-center gap-2">
        {/* 播放/暂停按钮（移动端紧凑模式需要手势触发播放） */}
        <button
          type="button"
          onClick={togglePlay}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-300/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={playing ? '暂停' : '播放'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        {/* 左侧当前时间 */}
        <div className="text-[11px] sm:text-xs tabular-nums text-slate-900/90 dark:text-slate-200/90 min-w-[44px] text-right">{formatTime(current)}</div>
        {/* 中部更长的进度条 */}
        <div className="flex-1">
          <div className="relative h-5">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80">
              <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300/90 dark:bg-slate-600/90" style={{ width: `${bufferedPct}%` }} />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={sliderValue}
              onMouseDown={(e) => {
                seekingRef.current = true
                setSeeking(true)
                wasPlayingRef.current = playing
                if (playing) audioRef.current?.pause()
                const v = parseFloat((e.currentTarget as HTMLInputElement).value)
                setSeekValuePct(Number.isFinite(v) ? v : progress)
              }}
              onTouchStart={(e) => {
                seekingRef.current = true
                setSeeking(true)
                wasPlayingRef.current = playing
                if (playing) audioRef.current?.pause()
                const v = parseFloat((e.currentTarget as HTMLInputElement).value)
                setSeekValuePct(Number.isFinite(v) ? v : progress)
              }}
              onChange={(e) => { if (!ready) return; setSeekValuePct(parseFloat(e.target.value)) }}
              onMouseUp={() => commitSeek(seekValuePct)}
              onTouchEnd={() => commitSeek(seekValuePct)}
              className={cn(
                'absolute inset-0 w-full h-full appearance-none bg-transparent touch-none focus:outline-none',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:outline-none [&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:transition-none',
                '[&::-webkit-slider-thumb:active]:h-3.5 [&::-webkit-slider-thumb:active]:w-3.5',
                '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:h-1.5',
                '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:outline-none [&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:transition-none',
                '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-slate-200 dark:[&::-moz-range-track]:bg-slate-700',
              )}
              aria-label="进度"
              disabled={!ready}
            />
          </div>
        </div>
        {/* 右侧总时长 */}
  <div className="text-[11px] sm:text-xs tabular-nums text-slate-900/90 dark:text-slate-200/90 min-w-[44px]">{formatTime(duration)}</div>
        {/* 音量按钮 + 上拉式音量面板（不占行） */}
        <div className="relative" ref={volWrapRef}>
          <button
            type="button"
            onClick={() => setShowVol(v => !v)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-300/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={muted ? '取消静音' : '静音/音量'}
            disabled={!ready}
          >
            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <VolumePopover
            open={showVol}
            onOpenChange={setShowVol}
            ready={ready}
            volume={volume}
            onVolumeChange={(v) => changeVolume(v)}
            anchorRef={volWrapRef}
          />
        </div>
      </div>
    </div>
  )

  // 顶层渲染：始终渲染同一个隐藏的 <audio>，避免在 variant 切换时中断播放
  return (
    <>
      <audio ref={audioRef} preload="metadata" className="hidden" />
      {variant === 'compact' ? compactControls : fullControls}
    </>
  )
}

export default AudioPlayer
