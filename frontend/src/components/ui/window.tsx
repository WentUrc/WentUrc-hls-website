"use client"
import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const windowVariants = cva(
  'w-full rounded-md shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
  {
    variants: {
      size: {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-[90vw] sm:max-w-3xl',
        xl: 'max-w-[95vw] sm:max-w-5xl',
      },
    },
    defaultVariants: {
      size: 'lg',
    },
  }
)

export interface WindowProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof windowVariants> {}

export function Window({ className, size, ...props }: WindowProps) {
  return <div className={cn(windowVariants({ size }), className)} {...props} />
}
