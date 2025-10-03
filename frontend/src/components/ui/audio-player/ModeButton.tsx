import { Repeat, Repeat1, Shuffle } from 'lucide-react'
import { PlayMode } from './index'
import { cn } from '@/lib/utils'

export interface ModeButtonProps {
  mode: PlayMode
  onClick?: () => void
  className?: string
  disabled?: boolean
}

export function modeLabel(mode: PlayMode) {
  return mode === 'one' ? '单曲循环' : mode === 'shuffle' ? '随机播放' : '列表循环'
}

export default function ModeButton({ mode, onClick, className, disabled }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
        className,
      )}
      aria-label={modeLabel(mode)}
      title={modeLabel(mode)}
      disabled={disabled}
    >
      {mode === 'one' ? <Repeat1 size={16} /> : mode === 'shuffle' ? <Shuffle size={16} /> : <Repeat size={16} />}
    </button>
  )
}
