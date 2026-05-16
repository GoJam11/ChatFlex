export {}

declare global {
  interface NativeWindowSize {
    width: number
    height: number
  }

  interface NativeUpdateInfo {
    version: string
    releaseNotes?: string
    releaseDate?: string
  }

  interface NativeDownloadProgress {
    percent: number
    bytesPerSecond: number
    transferred: number
    total: number
  }

  interface Window {
    __TAURI__?: unknown
  }
}
