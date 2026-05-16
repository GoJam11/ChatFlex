/**
 * 浏览器环境下的文件系统操作工具
 * 通过 Tauri API 实现文件系统访问
 */

import { isTauri } from '@tauri-apps/api/core'
import { extname, join } from '@tauri-apps/api/path'
import { readDir, readTextFile, stat } from '@tauri-apps/plugin-fs'

interface FileToolOptions {
  displayPath?: string;
}

interface FileSearchOptions extends FileToolOptions {
  maxFiles?: number;
  maxDepth?: number;
  maxResults?: number;
  timeoutMs?: number;
}

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx',
  '.vue', '.html', '.css', '.less', '.scss', '.py', '.java',
  '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.rb', '.php',
  '.sql', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.conf',
  '.log', '.gitignore', '.env', '.sh', '.bat', '.ps1',
])

const normalizePathForCompare = (input: string): string => input.replace(/\\/g, '/')

const stripTrailingSeparators = (input: string): string => input.replace(/[\\/]+$/, '')

const stripLeadingSeparators = (input: string): string => input.replace(/^[\\/]+/, '')

const toRelativePath = (basePath: string, targetPath: string): string => {
  const normalizedBase = stripTrailingSeparators(normalizePathForCompare(basePath))
  const normalizedTarget = normalizePathForCompare(targetPath)
  if (normalizedTarget.startsWith(normalizedBase)) {
    return stripLeadingSeparators(normalizedTarget.slice(normalizedBase.length))
  }
  return targetPath
}

/**
 * 列出目录内容
 */
export async function listDirectory(dirPath: string, options?: FileToolOptions): Promise<string> {
  try {
    if (typeof window === 'undefined' || !isTauri()) {
      return '目录列表功能仅在桌面应用中可用'
    }

    const entries = await readDir(dirPath)
    const label = options?.displayPath ?? dirPath

    if (!entries || entries.length === 0) {
      return `目录 "${label}" 为空。`
    }

    const items = entries.map(entry => {
      const type = entry.isDirectory ? '📁' : '📄'
      const name = entry.name
      return `${type} ${name}`
    })

    return `目录 "${label}" 的内容：\n${items.join('\n')}`
  } catch (error) {
    console.error('[listDirectory] 错误:', error)
    const message = error instanceof Error ? error.message : '未知错误'
    return `目录列表失败：${message}`
  }
}

/**
 * 读取文件内容
 */
export async function readFile(filePath: string, options?: FileToolOptions): Promise<string> {
  try {
    if (typeof window === 'undefined' || !isTauri()) {
      return '文件读取功能仅在桌面应用中可用'
    }

    const label = options?.displayPath ?? filePath
    const info = await stat(filePath)

    if (info.isDirectory) {
      return `"${label}" 是一个目录，不是文件。请使用目录列表工具查看内容。`
    }

    // 检查文件大小（限制为 1MB）
    const maxSize = 1024 * 1024 // 1MB
    if (info.size > maxSize) {
      return `文件 "${label}" 过大 (${info.size} 字节)，超过 1MB 限制。`
    }

    // 检查文件类型（只读取文本文件）
    const extension = (await extname(filePath)).toLowerCase()
    if (extension && !TEXT_EXTENSIONS.has(extension)) {
      return `文件 "${label}" 的类型 "${extension}" 不支持文本读取。支持的类型包括: ${Array.from(TEXT_EXTENSIONS).join(', ')}`
    }

    const content = await readTextFile(filePath)

    if (!content.trim()) {
      return `文件 "${label}" 为空。`
    }

    // 限制返回内容长度
    const maxContentLength = 50000 // 约 50KB
    if (content.length > maxContentLength) {
      const truncated = content.substring(0, maxContentLength)
      return `文件 "${label}" 内容（已截取前 ${maxContentLength} 字符）：\n\n${truncated}\n\n...（内容已截断，完整文件大小：${content.length} 字符）`
    }

    return `文件 "${label}" 内容：\n\n${content}`
  } catch (error) {
    console.error('[readFile] 错误:', error)
    const message = error instanceof Error ? error.message : '未知错误'
    return `文件读取失败：${message}`
  }
}

/**
 * 在文件中搜索字符串
 */
export async function findString(dirPath: string, pattern: string, options?: FileSearchOptions): Promise<string> {
  try {
    if (typeof window === 'undefined' || !isTauri()) {
      return '文件搜索功能仅在桌面应用中可用'
    }

    const {
      maxFiles = 100,
      maxDepth = 3,
      maxResults = 50,
      timeoutMs = 5000,
    } = options ?? {}

    let regex: RegExp
    try {
      regex = new RegExp(pattern, 'i')
    } catch (error) {
      const message = error instanceof Error ? `搜索条件无效：${error.message}` : '搜索条件无效'
      return `文件搜索失败：${message}`
    }

    const matches: Array<{ file: string; line: number; text: string }> = []
    let totalMatches = 0
    let processedFiles = 0
    const maxDuration = Math.max(1000, Math.min(timeoutMs, 15000))
    const startTime = Date.now()
    let aborted = false

    const shouldAbort = (): boolean => {
      if (aborted) {
        return true
      }
      if (Date.now() - startTime > maxDuration) {
        aborted = true
        return true
      }
      return false
    }

    const searchInFile = async (filePath: string, relativePath: string): Promise<void> => {
      if (shouldAbort()) {
        return
      }

      try {
        const info = await stat(filePath)
        if (info.isDirectory || info.size > 1024 * 1024) {
          return
        }

        const extension = (await extname(filePath)).toLowerCase()
        if (extension && !TEXT_EXTENSIONS.has(extension)) {
          return
        }

        const content = await readTextFile(filePath)
        const lines = content.split('\n')

        for (let index = 0; index < lines.length; index += 1) {
          if (shouldAbort()) {
            return
          }

          if (regex.test(lines[index])) {
            totalMatches += 1
            if (matches.length < maxResults) {
              matches.push({
                file: relativePath,
                line: index + 1,
                text: lines[index].trim(),
              })
            }
          }
        }
      } catch {
        // 忽略无法读取的文件
      }
    }

    const searchDirectory = async (currentPath: string, currentDepth = 0): Promise<void> => {
      if (currentDepth > maxDepth || processedFiles >= maxFiles || shouldAbort()) {
        return
      }

      let entries
      try {
        entries = await readDir(currentPath)
      } catch {
        return
      }

      for (const entry of entries) {
        if (processedFiles >= maxFiles || shouldAbort()) {
          break
        }

        const fullPath = await join(currentPath, entry.name)
        const relativePath = toRelativePath(dirPath, fullPath)

        if (entry.isDirectory) {
          await searchDirectory(fullPath, currentDepth + 1)
        } else if (entry.isFile) {
          await searchInFile(fullPath, relativePath)
          processedFiles += 1
        }
      }
    }

    await searchDirectory(dirPath)
    const label = options?.displayPath ?? dirPath

    if (aborted) {
      return '文件搜索失败：搜索超时：正则表达式过于复杂或匹配范围过大，请尝试简化搜索条件。'
    }

    if (matches.length === 0) {
      return `在目录 "${label}" 中未找到匹配 "${pattern}" 的内容。`
    }

    let output = `在目录 "${label}" 中搜索 "${pattern}" 的结果（找到 ${totalMatches} 个匹配）：\n\n`
    output += matches.map(match => `${match.file}:${match.line}: ${match.text.trim()}`).join('\n')

    if (totalMatches > matches.length) {
      output += `\n\n...（还有 ${totalMatches - matches.length} 个结果未显示）`
    }

    return output
  } catch (error) {
    console.error('[findString] 错误:', error)
    const message = error instanceof Error ? error.message : '未知错误'
    return `文件搜索失败：${message}`
  }
}
