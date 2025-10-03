import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface VolumePopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ready: boolean
  volume: number
  onVolumeChange: (v: number) => void
  anchorRef?: React.RefObject<HTMLElement | null>
  referenceClassName?: string
  panelClassName?: string
}

export function VolumePopover({ open, onOpenChange, ready, volume, onVolumeChange, anchorRef, referenceClassName, panelClassName }: VolumePopoverProps) {
  const volWrapRef = useRef<HTMLDivElement | null>(null)
  const volPanelRef = useRef<HTMLDivElement | null>(null)
  const [volMaxHeight, setVolMaxHeight] = useState<number | null>(null)
  const [volSliderLength, setVolSliderLength] = useState<number>(96)

  // outside click
  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      const el = volWrapRef.current
      if (!el) return
      const target = e.target as Node | null
      if (target && !el.contains(target)) onOpenChange(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('touchstart', onDocDown)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('touchstart', onDocDown)
    }
  }, [open, onOpenChange])

  // lock body scroll while volume popover is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, anchorRef])

  // compute max height inside nearest media boundary
  useEffect(() => {
    if (!open) return
    const btn = (anchorRef?.current as HTMLElement | null) ?? volWrapRef.current
    if (!btn) return
    const boundary = btn.closest('[data-media-boundary]') as HTMLElement | null
    const btnRect = btn.getBoundingClientRect()
    const viewportTop = 0
    let topLimit = viewportTop
    if (boundary) {
      const b = boundary.getBoundingClientRect()
      topLimit = Math.max(viewportTop, b.top)
    }
    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize || '16') || 16
    const bottomOffset = 2.5 * rootFont // Tailwind bottom-10
    const safetyGap = 8
    const available = Math.max(0, (btnRect.bottom - topLimit) - bottomOffset - safetyGap)
    const MAX_PANEL = 140
    const maxH = Math.min(MAX_PANEL, Math.max(56, available))
    setVolMaxHeight(maxH)
    const candidate = Math.max(48, Math.min(120, maxH - 24))
    setVolSliderLength(candidate)
  }, [open, anchorRef])

  return (
    <div className={cn(referenceClassName)} ref={volWrapRef}>
      {/* reference area uses children in parent */}
      {open && (
        <div ref={volPanelRef} className={cn('absolute right-0 bottom-10 z-10 rounded-md border border-slate-300/70 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm w-8 px-1 py-2 overscroll-contain overflow-hidden select-none shadow-sm', panelClassName)} style={volMaxHeight ? { maxHeight: volMaxHeight } : undefined}>
          <div className="w-full flex items-center justify-center" style={{ height: volMaxHeight ? Math.max(40, Math.min(132, volMaxHeight - 8)) : 112 }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.currentTarget.value))}
              className={cn(
                'appearance-none bg-transparent h-5 -rotate-90 origin-center focus:outline-none',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:outline-none [&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:transition-none',
                '[&::-webkit-slider-thumb:active]:h-3.5 [&::-webkit-slider-thumb:active]:w-3.5',
                '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-slate-200 dark:[&::-webkit-slider-runnable-track]:bg-slate-700 [&::-webkit-slider-runnable-track]:rounded-full',
                '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:outline-none [&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:transition-none',
                '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-slate-200 dark:[&::-moz-range-track]:bg-slate-700 [&::-moz-range-track]:rounded-full',
              )}
              aria-label="音量"
              disabled={!ready}
              style={{ width: volSliderLength }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default VolumePopover
