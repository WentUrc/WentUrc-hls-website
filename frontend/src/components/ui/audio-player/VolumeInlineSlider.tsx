import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface VolumeInlineSliderProps {
  volume: number
  muted?: boolean
  ready?: boolean
  onToggleMute?: () => void
  onChange?: (v: number) => void
  className?: string
}

export default function VolumeInlineSlider({ volume, muted, ready = true, onToggleMute, onChange, className }: VolumeInlineSliderProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={onToggleMute}
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
        onChange={(e) => onChange?.(parseFloat(e.currentTarget.value))}
        className={cn(
          'w-24 hidden sm:block appearance-none bg-transparent h-5 focus:outline-none',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:outline-none [&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:transition-none',
          '[&::-webkit-slider-thumb:active]:h-3.5 [&::-webkit-slider-thumb:active]:w-3.5',
          '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-slate-200 dark:[&::-webkit-slider-runnable-track]:bg-slate-700 [&::-webkit-slider-runnable-track]:rounded-full',
          '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:outline-none [&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:transition-none',
          '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-slate-200 dark:[&::-moz-range-track]:bg-slate-700 [&::-moz-range-track]:rounded-full',
        )}
        aria-label="音量"
        disabled={!ready}
      />
    </div>
  )
}
