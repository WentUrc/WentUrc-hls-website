"use client"
import Hls from 'hls.js'
import { useEffect, useRef } from 'react'

export function HlsVideo({ src, poster, className }: { src: string, poster?: string, className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    let hls: Hls | null = null
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hls.loadSource(src)
      hls.attachMedia(video)
    }
    return () => { if (hls) hls.destroy() }
  }, [src])
  return <video ref={ref} poster={poster} controls className={className} />
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
  return <audio ref={ref} controls className={className} />
}
