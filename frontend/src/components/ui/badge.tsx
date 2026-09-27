import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Severity } from '@/types'

const severityClasses: Record<Severity, string> = {
  critical: 'bg-red-950/60 text-red-400 border-red-800/60 font-semibold',
  high: 'bg-orange-950/60 text-orange-400 border-orange-800/60 font-semibold',
  medium: 'bg-amber-950/60 text-amber-300 border-amber-800/60 font-semibold',
  low: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60 font-semibold',
  info: 'bg-blue-950/60 text-blue-400 border-blue-800/60 font-semibold',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | Severity
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const isSeverity = variant in severityClasses
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase',
        isSeverity
          ? severityClasses[variant as Severity]
          : variant === 'secondary'
          ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border-[hsl(var(--border))]'
          : variant === 'outline'
          ? 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
          : 'bg-blue-600 text-white border-blue-500/40',
        className
      )}
      {...props}
    />
  )
}
