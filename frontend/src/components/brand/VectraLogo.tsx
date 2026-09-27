import { cn } from '@/lib/utils'

interface VectraLogoProps {
  className?: string
  size?: number
  showText?: boolean
  textSize?: string
}

/**
 * Official VECTRA brand logo mark.
 * An angular geometric vector crest representing precision software engineering intelligence.
 */
export function VectraLogo({ className, size = 32, showText = false, textSize = 'text-xl' }: VectraLogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <div
        className="relative flex items-center justify-center shrink-0 rounded-xl transition-all duration-300"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 drop-shadow-md"
        >
          {/* Subtle outer glow gradient definition */}
          <defs>
            <linearGradient id="vectra-crest-gradient" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="vectra-inner-v" x1="14" y1="12" x2="34" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="50%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="vectra-facet-1" x1="24" y1="6" x2="40" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Hexagonal facet shield */}
          <polygon
            points="24,4 42,14 42,34 24,44 6,34 6,14"
            fill="url(#vectra-facet-1)"
            stroke="url(#vectra-crest-gradient)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Coordinate guide vertices */}
          <circle cx="24" cy="4" r="1.5" fill="#60a5fa" />
          <circle cx="42" cy="14" r="1.5" fill="#60a5fa" />
          <circle cx="42" cy="34" r="1.5" fill="#60a5fa" />
          <circle cx="24" cy="44" r="1.5" fill="#60a5fa" />
          <circle cx="6" cy="34" r="1.5" fill="#60a5fa" />
          <circle cx="6" cy="14" r="1.5" fill="#60a5fa" />

          {/* Internal chevron / vector velocity delta */}
          <path
            d="M15 16 L24 33 L33 16"
            stroke="url(#vectra-inner-v)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* High precision crosshair core node */}
          <circle cx="24" cy="22" r="2" fill="#ffffff" />
          <line x1="24" y1="18" x2="24" y2="20" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {showText && (
        <span className={cn('font-bold tracking-wider text-white select-none', textSize)} style={{ letterSpacing: '0.08em' }}>
          VECTRA
        </span>
      )}
    </div>
  )
}

/**
 * Visual indicator for the analyzed Target Project.
 * Visually distinct from VECTRA's brand logo mark.
 */
export function ProjectTargetIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-blue-400 shrink-0', className)}
    >
      <circle cx="12" cy="12" r="9" className="stroke-[hsl(var(--muted-foreground))]" strokeDasharray="3 3" />
      <circle cx="12" cy="12" r="4" className="stroke-blue-400" />
      <circle cx="12" cy="12" r="1.5" className="fill-blue-400 stroke-none" />
    </svg>
  )
}
