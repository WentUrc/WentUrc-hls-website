"use client"
import { useEffect, useMemo, useState } from "react"
import { cn } from '@/lib/utils'

interface BackgroundImageProps {
  src: string
  className?: string
}

export default function BackgroundImage({ src, className }: BackgroundImageProps) {
  const [loaded, setLoaded] = useState(false)
  const imgSrc = useMemo(() => src, [src])

  useEffect(() => {
    let active = true
    const img = new Image()
    img.decoding = 'async'
    img.loading = 'eager'
    img.src = imgSrc
    const onLoad = () => { if (active) setLoaded(true) }
    const onError = () => { if (active) setLoaded(false) }
    img.addEventListener('load', onLoad)
    img.addEventListener('error', onError)
    return () => {
      active = false
      img.removeEventListener('load', onLoad)
      img.removeEventListener('error', onError)
    }
  }, [imgSrc])

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-0 bg-no-repeat bg-center bg-cover transition-all duration-500 ease-out motion-reduce:transition-none",
        loaded ? "opacity-10 translate-y-0" : "opacity-0 translate-y-1",
        className,
      )}
      style={{ backgroundImage: `url('${imgSrc}')` }}
    />
  )
}
