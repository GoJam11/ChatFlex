import { isTauri } from '@tauri-apps/api/core'
import { dirname } from '@tauri-apps/api/path'
import { save } from '@tauri-apps/plugin-dialog'
import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs'

export type SaveDialogFilter = { name: string; extensions: string[] }

const triggerBrowserDownload = (fileName: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function saveTextFile(
  defaultFileName: string,
  content: string,
  filters: SaveDialogFilter[],
  mimeType: string,
): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      if (isTauri()) {
        const filePath = await save({
          defaultPath: defaultFileName,
          filters,
        })

        if (filePath) {
          const parentDir = await dirname(filePath)
          await mkdir(parentDir, { recursive: true })
          await writeTextFile(filePath, content)
          return true
        }

        return false
      }
    } catch (error) {
      console.warn('[saveTextFile] Tauri save failed:', error)
    }
  }

  if (typeof window !== 'undefined') {
    triggerBrowserDownload(defaultFileName, content, mimeType)
    return true
  }

  throw new Error('File saving is not supported in this environment.')
}
