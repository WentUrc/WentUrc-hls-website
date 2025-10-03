import { cn } from '@/lib/utils'

export interface TimeTextProps {
  value: string
  alignRight?: boolean
  className?: string
}

export default function TimeText({ value, alignRight, className }: TimeTextProps) {
  return (
    <div className={cn('text-xs tabular-nums text-slate-600 dark:text-slate-300 min-w-[56px]', alignRight ? 'text-right' : '', className)}>
      {value}
    </div>
  )
}
