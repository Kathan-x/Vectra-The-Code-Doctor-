import { cn } from '@/lib/utils'
import type { Severity } from '@/types'

export const severityColor: Record<Severity, string> = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-yellow-400',
  low:      'text-green-400',
  info:     'text-blue-400',
}

export const severityBg: Record<Severity, string> = {
  critical: 'bg-red-950/60 border-red-800/50',
  high:     'bg-orange-950/60 border-orange-800/50',
  medium:   'bg-yellow-950/40 border-yellow-800/40',
  low:      'bg-green-950/40 border-green-800/40',
  info:     'bg-blue-950/40 border-blue-800/40',
}

export const severityDot: Record<Severity, string> = {
  critical: 'bg-red-400',
  high:     'bg-orange-400',
  medium:   'bg-yellow-400',
  low:      'bg-green-400',
  info:     'bg-blue-400',
}

export const categoryLabel: Record<string, string> = {
  security: 'Security',
  bug:      'Bug',
  async:    'Async',
  quality:  'Quality',
  test:     'Test',
}

export { cn }
