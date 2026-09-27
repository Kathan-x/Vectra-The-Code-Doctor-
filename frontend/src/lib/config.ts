/**
 * VECTRA active project configuration.
 *
 * The active project is the TARGET being analyzed — NOT VECTRA itself.
 * VECTRA is the engineering intelligence platform.
 * The "project" here is the code being inspected.
 *
 * Default demo target: sample-app (intentionally vulnerable Express demo service)
 * Override: VITE_PROJECT_PATH env var, or set dynamically via Project Import.
 */

/** Absolute filesystem path to the active target project */
export const DEFAULT_PROJECT_PATH: string =
  import.meta.env.VITE_PROJECT_PATH ??
  import.meta.env.VITE_SAMPLE_APP_PATH ??
  'C:/Users/Patel Kathan/Desktop/VECTRA/sample-app'

/** Friendly name for the demo default */
export const DEFAULT_PROJECT_DISPLAY_NAME = 'VECTRA Demo Service'

/** Short tech descriptor for the demo default */
export const DEFAULT_PROJECT_TYPE_LABEL = 'Node.js · Express · JavaScript'

// ── Legacy aliases (kept for backwards compatibility) ──────────────────────
/** @deprecated use useActiveProject hook */
export const PROJECT_PATH = DEFAULT_PROJECT_PATH
/** @deprecated use useActiveProject hook */
export const PROJECT_DISPLAY_NAME = DEFAULT_PROJECT_DISPLAY_NAME
/** @deprecated use useActiveProject hook */
export const PROJECT_TYPE_LABEL = DEFAULT_PROJECT_TYPE_LABEL
