"use client"
import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'

export default function AppToaster() {
  // 桌面：底部右侧；移动端：底部居中。均与 Footer 保持可见间隙（动态 bottom 偏移）。
  const [offsetBottomPx, setOffsetBottomPx] = useState(16)
  const [offsetRightPx, setOffsetRightPx] = useState(16)
  const [isDesktop, setIsDesktop] = useState(false)
  const lastDesktopRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

  const footer = document.querySelector('footer') as HTMLElement | null
    let frame = 0

    const measure = () => {
      // 判定断点（与 Tailwind lg 一致）
      const desktop = window.innerWidth >= 1024
      if (desktop !== lastDesktopRef.current) {
        lastDesktopRef.current = desktop
        setIsDesktop(desktop)
      }

      if (!footer) {
        setOffsetBottomPx(16)
        // 右侧：若无 footer，尝试用主内容容器作为参考
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
      // 计算 Footer 在视口中可见的高度（可能为 0~footer.height）
      const visible = Math.max(0, Math.min(vh, rect.bottom) - Math.max(0, rect.top))
      const next = Math.max(16, Math.round(visible + 16)) // 与 Footer 顶部再留 16px 间距
      setOffsetBottomPx(next)

      // 计算与 Footer 内层容器右侧对齐的横向间隙
      const inner = footer.querySelector('.max-w-6xl') as HTMLElement | null
      if (inner) {
        const crect = inner.getBoundingClientRect()
        const rightGap = Math.max(16, Math.round(window.innerWidth - crect.right))
        setOffsetRightPx(rightGap)
      } else {
        // 回退为 16px
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
