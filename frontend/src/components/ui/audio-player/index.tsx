"use client"
import Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Pause, Play, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react'
import ProgressBar from './ProgressBar'
import VolumePopover from './VolumePopover'
import ModeButton from './ModeButton'
import TimeText from './TimeText'
import VolumeInlineSlider from './VolumeInlineSlider'
import { formatTime } from '@/lib/time'

export interface AudioPlayerProps {
  src: string
  className?: string
  autoPlay?: boolean
  onPrev?: (mode: PlayMode) => void
  onNext?: (mode: PlayMode) => void
  variant?: 'full' | 'compact'
  mode?: PlayMode
  onModeChange?: (mode: PlayMode) => void
}

export type PlayMode = 'all' | 'one' | 'shuffle'

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
  const wasPlayingRef = useRef(false)

  useEffect(() => { seekingRef.current = seeking }, [seeking])

  const [internalMode, setInternalMode] = useState<PlayMode>('all')
  const mode = modeProp ?? internalMode
  const setMode = (m: PlayMode) => {
    if (onModeChange) onModeChange(m); else setInternalMode(m)
  }

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

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = (mode === 'one')
  }, [mode])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const handle = () => {
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

  const commitSeek = (pct: number | null) => {
    if (!ready || pct == null || !isFinite(duration) || duration <= 0) {
      setSeeking(false)
      seekingRef.current = false
      setSeekValuePct(null)
      if (wasPlayingRef.current) {
        audioRef.current?.play().catch(() => { /* ignore */ })
      }
      wasPlayingRef.current = false
      return
    }
    seekTo(pct)
    const targetTime = (pct / 100) * duration
    setCurrent(targetTime)
    setSeeking(false)
    seekingRef.current = false
    setSeekValuePct(null)
    if (wasPlayingRef.current) {
      audioRef.current?.play().catch(() => { /* ignore autoplay restrictions */ })
    }
    wasPlayingRef.current = false
  }

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
    if (seeking && seekValuePct != null) return seekValuePct
    return progress
  }, [ready, seeking, seekValuePct, progress])

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
        <ModeButton mode={mode} onClick={cycleMode} />
        <TimeText value={formatTime(current)} alignRight className="ml-1" />
        <div className="flex-1 mx-2">
          <ProgressBar
            valuePct={sliderValue}
            bufferedPct={bufferedPct}
            ready={ready}
            variant="default"
            showPreviewTooltip
            durationSeconds={Number.isFinite(duration) ? duration : undefined}
            formatPreview={formatTime}
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
        <TimeText value={formatTime(duration)} />
        <VolumeInlineSlider
          volume={volume}
          muted={muted}
          ready={ready}
          onToggleMute={toggleMute}
          onChange={(v) => changeVolume(v)}
        />
      </div>
    </div>
  )

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
        {/* 播放/暂停按钮 */}
        <button
          type="button"
          onClick={togglePlay}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-300/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-900/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={playing ? '暂停' : '播放'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        {/* 时间 */}
        <div className="text-[11px] sm:text-xs tabular-nums text-slate-900/90 dark:text-slate-200/90 min-w-[44px] text-right">{formatTime(current)}</div>
        {/* 进度条 */}
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
        {/* 总时长 */}
  <div className="text-[11px] sm:text-xs tabular-nums text-slate-900/90 dark:text-slate-200/90 min-w-[44px]">{formatTime(duration)}</div>
        {/* 音量按钮 + 音量面板 */}
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

  return (
    <>
      <audio ref={audioRef} preload="metadata" className="hidden" />
      {variant === 'compact' ? compactControls : fullControls}
    </>
  )
}

export default AudioPlayer
