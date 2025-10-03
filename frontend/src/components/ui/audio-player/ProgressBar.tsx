import { cn } from '@/lib/utils'

export interface ProgressBarProps {
  valuePct: number
  bufferedPct?: number
  ready: boolean
  variant?: 'default' | 'overlay'
  className?: string
  onSeekStart?: (initialPct: number) => void
  onSeekChange?: (pct: number) => void
  onSeekCommit?: (pct: number | null) => void
  // optional preview tooltip while dragging/moving
  showPreviewTooltip?: boolean
  formatPreview?: (seconds: number) => string
  durationSeconds?: number
}

export function ProgressBar({
  valuePct,
  bufferedPct = 0,
  ready,
  variant = 'default',
  className,
  onSeekStart,
  onSeekChange,
  onSeekCommit,
  showPreviewTooltip,
  formatPreview,
  durationSeconds,
}: ProgressBarProps) {
  const bgTrack = variant === 'overlay' ? 'bg-slate-200/80 dark:bg-slate-700/80' : 'bg-slate-200 dark:bg-slate-700'
  const bgBuffered = variant === 'overlay' ? 'bg-slate-300/90 dark:bg-slate-600/90' : 'bg-slate-300 dark:bg-slate-600'
  // simple tooltip state using HTML title fallback; callers can enhance later
  const useTooltip = !!showPreviewTooltip && Number.isFinite(durationSeconds)

  return (
    <div className={cn('relative h-5', className)}>
      <div className={cn('absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full', bgTrack)}>
        <div className={cn('absolute inset-y-0 left-0 rounded-full', bgBuffered)} style={{ width: `${bufferedPct}%` }} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={valuePct}
        title={useTooltip && durationSeconds ? (formatPreview ? formatPreview((valuePct / 100) * durationSeconds) : undefined) : undefined}
        onMouseDown={(e) => {
          const v = parseFloat((e.currentTarget as HTMLInputElement).value)
          onSeekStart?.(Number.isFinite(v) ? v : valuePct)
        }}
        onTouchStart={(e) => {
          const v = parseFloat((e.currentTarget as HTMLInputElement).value)
          onSeekStart?.(Number.isFinite(v) ? v : valuePct)
        }}
        onChange={(e) => onSeekChange?.(parseFloat(e.currentTarget.value))}
        onMouseUp={() => onSeekCommit?.(valuePct)}
        onTouchEnd={() => onSeekCommit?.(valuePct)}
        className={cn(
          'absolute inset-0 w-full h-full appearance-none bg-transparent touch-none focus:outline-none',
          // WebKit thumb: lock size/shape even when active/pressed
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:outline-none [&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:transition-none',
          '[&::-webkit-slider-thumb:active]:h-3.5 [&::-webkit-slider-thumb:active]:w-3.5',
          '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:h-1.5',
          // Firefox styling
          '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:outline-none [&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:transition-none',
          '[&::-moz-range-thumb:active]:h-3.5 [&::-moz-range-thumb:active]:w-3.5',
          '[&::-moz-range-track]:h-1.5',
        )}
        aria-label="进度"
        disabled={!ready}
      />
    </div>
  )
}

export default ProgressBar
