"use client"
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'

export default function AppToaster() {
  // 底部中央固定，但与 Footer 保持可见间隙；根据 Footer 在视口中的可见高度动态偏移
  const [offsetPx, setOffsetPx] = useState(16)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const footer = document.querySelector('footer') as HTMLElement | null
    let frame = 0

    const measure = () => {
      if (!footer) {
        setOffsetPx(16)
        return
      }
      const rect = footer.getBoundingClientRect()
      const vh = window.innerHeight
      // 计算 Footer 在视口中可见的高度（可能为 0~footer.height）
      const visible = Math.max(0, Math.min(vh, rect.bottom) - Math.max(0, rect.top))
      const next = Math.max(16, Math.round(visible + 16)) // 与 Footer 顶部再留 16px 间距
      setOffsetPx(next)
    }

  const onScrollOrResize = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    measure()

    // 监听滚动与尺寸变化，确保靠近底部时不与 Footer 重叠
    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)

    // Footer 尺寸变化（如响应式换行）时也更新
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

  return (
    <Toaster
      richColors
      theme="system"
      position="bottom-center"
      // 同时考虑刘海等安全区域：env(safe-area-inset-bottom)
      offset={`calc(${offsetPx}px + env(safe-area-inset-bottom, 0px))`}
    />
  )
}
