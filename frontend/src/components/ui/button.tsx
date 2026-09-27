import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-blue-600 text-white hover:bg-blue-500 shadow-sm border border-blue-500/30 active:bg-blue-700',
  secondary:
    'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
  ghost:
    'bg-transparent hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-white',
  destructive:
    'bg-red-600 text-white hover:bg-red-500 shadow-sm',
  outline:
    'border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm font-medium rounded-lg',
  lg: 'h-12 px-6 text-base font-semibold rounded-xl',
  icon: 'h-10 w-10 rounded-lg flex items-center justify-center',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer select-none',
          'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
