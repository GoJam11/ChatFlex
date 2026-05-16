import { isTauri } from '@tauri-apps/api/core'

/**
 * Detect whether the renderer is running inside the Tauri desktop shell.
 */
export function isElectronEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return isTauri()
  } catch {
    return false
  }
}

/**
 * Alias kept for backwards compatibility with legacy code paths.
 * Prefer using `isElectronEnvironment`.
 */
export function isDesktopEnvironment(): boolean {
  return isElectronEnvironment()
}

export default isElectronEnvironment
