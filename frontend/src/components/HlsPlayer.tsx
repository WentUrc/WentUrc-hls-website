"use client"
import Hls from 'hls.js'
import { useEffect, useRef } from 'react'

export function HlsVideo({ src, poster, className, onCanPlay }: { src: string, poster?: string, className?: string, onCanPlay?: () => void }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    let hls: Hls | null = null
    const handleCanPlay = () => { try { onCanPlay?.() } catch { /* noop */ } }
    video.addEventListener('canplay', handleCanPlay)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hls.loadSource(src)
      hls.attachMedia(video)
    }
    return () => { if (hls) hls.destroy(); video.removeEventListener('canplay', handleCanPlay) }
  }, [src, onCanPlay])
  return <video ref={ref} poster={poster} controls className={`my-4 rounded-sm overflow-hidden [color-scheme:light] dark:[color-scheme:dark] ${className ?? ''}`} />
}

export function HlsAudio({ src, className }: { src: string, className?: string }) {
  const ref = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    let hls: Hls | null = null
    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = src
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hls.loadSource(src)
      hls.attachMedia(audio)
    }
    return () => { if (hls) hls.destroy() }
  }, [src])
  return <audio ref={ref} controls className={`my-4 rounded-sm overflow-hidden bg-white dark:bg-slate-900 [color-scheme:light] dark:[color-scheme:dark] ${className ?? ''}`} />
}
