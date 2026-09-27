import { useEffect, useState } from 'react'
import { VectraLogo } from '@/components/brand/VectraLogo'

interface SplashScreenProps {
  onComplete: () => void
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    // in: 350ms, hold: 1200ms, out: 350ms — total ~1.9s
    const t1 = setTimeout(() => setPhase('hold'), 350)
    const t2 = setTimeout(() => setPhase('out'), 1550)
    const t3 = setTimeout(onComplete, 1900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onComplete])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[hsl(222_20%_6%)] select-none pointer-events-none"
      style={{
        opacity: phase === 'out' ? 0 : 1,
        transition: phase === 'in' ? 'opacity 350ms ease-out' : phase === 'out' ? 'opacity 350ms ease-in' : undefined,
      }}
      aria-label="VECTRA is loading"
      role="status"
    >
      <div
        style={{
          transform: phase === 'in' ? 'translateY(10px) scale(0.98)' : 'translateY(0) scale(1)',
          opacity: phase === 'in' ? 0 : 1,
          transition: 'transform 450ms cubic-bezier(0.16,1,0.3,1), opacity 400ms ease-out',
        }}
        className="flex flex-col items-center gap-6 text-center px-6"
      >
        {/* Official VECTRA brand logo mark */}
        <VectraLogo size={68} />

        {/* Wordmark and Taglines */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-widest text-white">
            VECTRA
          </h1>
          <p className="text-base sm:text-lg font-medium text-blue-400/90 tracking-wide">
            Software Engineering Intelligence &amp; Guided Repair
          </p>
          <p className="text-sm sm:text-base text-[hsl(215_16%_65%)] italic max-w-md leading-relaxed mt-1">
            &ldquo;Find the risk. Trace the cause. Fix with confidence.&rdquo;
          </p>
        </div>

        {/* Subtle minimalist progress bar */}
        <div className="w-36 h-1 bg-[hsl(222_18%_14%)] overflow-hidden rounded-full mt-2">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{
              width: phase === 'hold' ? '100%' : phase === 'out' ? '100%' : '0%',
              transition: phase === 'hold' ? 'width 1100ms cubic-bezier(0.4,0,0.2,1)' : 'none',
            }}
          />
        </div>
      </div>
    </div>
  )
}
