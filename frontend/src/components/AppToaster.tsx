"use client"
import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'

export default function AppToaster() {
  const [offsetBottomPx, setOffsetBottomPx] = useState(16)
  const [offsetRightPx, setOffsetRightPx] = useState(16)
  const [isDesktop, setIsDesktop] = useState(false)
  const lastDesktopRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

  const footer = document.querySelector('footer') as HTMLElement | null
    let frame = 0

    const measure = () => {
      const desktop = window.innerWidth >= 1024
      if (desktop !== lastDesktopRef.current) {
        lastDesktopRef.current = desktop
        setIsDesktop(desktop)
      }

      if (!footer) {
        setOffsetBottomPx(16)
        const mainContainer = document.querySelector('main .max-w-6xl, header .max-w-6xl') as HTMLElement | null
        if (mainContainer) {
          const mrect = mainContainer.getBoundingClientRect()
          const rightGap = Math.max(16, Math.round(window.innerWidth - mrect.right))
          setOffsetRightPx(rightGap)
        } else {
          setOffsetRightPx(16)
        }
        return
      }
      const rect = footer.getBoundingClientRect()
      const vh = window.innerHeight
      const visible = Math.max(0, Math.min(vh, rect.bottom) - Math.max(0, rect.top))
      const next = Math.max(16, Math.round(visible + 16)) 
      setOffsetBottomPx(next)

      const inner = footer.querySelector('.max-w-6xl') as HTMLElement | null
      if (inner) {
        const crect = inner.getBoundingClientRect()
        const rightGap = Math.max(16, Math.round(window.innerWidth - crect.right))
        setOffsetRightPx(rightGap)
      } else {
        setOffsetRightPx(16)
      }
    }

  const onScrollOrResize = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    measure()

    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)

    const ro = ('ResizeObserver' in window && footer)
      ? new ResizeObserver(() => measure())
      : null
    ro?.observe(footer!)

    return () => {
  window.removeEventListener('scroll', onScrollOrResize)
  window.removeEventListener('resize', onScrollOrResize)
      if (frame) cancelAnimationFrame(frame)
      ro?.disconnect()
    }
  }, [])

  const commonBottom = `calc(${offsetBottomPx}px + env(safe-area-inset-bottom, 0px))`
  const position: 'bottom-right' | 'bottom-center' = isDesktop ? 'bottom-right' : 'bottom-center'
  const desktopOffset = { bottom: commonBottom, right: `${offsetRightPx}px` }
  const mobileOffset = { bottom: commonBottom }

  return (
    <Toaster
      richColors
      theme="system"
      position={position}
      offset={desktopOffset}
      mobileOffset={mobileOffset}
    />
  )
}
