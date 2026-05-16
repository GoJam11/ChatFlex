import { tool, type ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { listDirectory, readFile, findString } from './terminal-tools';
import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { chatFlexDb } from '@/persistence/chatflex-db';
import {
  KNOWLEDGE_BASE_LIST_TOOL_ID,
  KNOWLEDGE_BASE_READ_TOOL_ID,
  KNOWLEDGE_BASE_SEARCH_TOOL_ID,
  KNOWLEDGE_BASE_TOOL_IDS,
} from './knowledgeBaseToolIds';

export {
  KNOWLEDGE_BASE_LIST_TOOL_ID,
  KNOWLEDGE_BASE_READ_TOOL_ID,
  KNOWLEDGE_BASE_SEARCH_TOOL_ID,
  KNOWLEDGE_BASE_TOOL_IDS,
} from './knowledgeBaseToolIds';

const knowledgeBaseListToolDefinition = {
  name: KNOWLEDGE_BASE_LIST_TOOL_ID,
  description: '列出当前会话绑定知识库中的文件和目录，可选指定子目录。',
  parameters: z.object({
    folder: z
      .string()
      .trim()
      .optional()
      .describe('可选子目录，例如 "docs" 或 "docs/guides"。省略时列出知识库根目录。'),
  }),
  execute: async ({ folder }: { folder?: string }, options?: ToolExecutionOptions) => {
    try {
      const context = await getKnowledgeBasePathFromToolContext(options);
      if (!context.ok) {
        return context.message;
      }

      const target = normalizeRelativeInput(folder);
      const fullPath = resolvePath(context.knowledgeBasePath, target);

      if (!isPathSafe(fullPath, context.knowledgeBasePath)) {
        return '访问被拒绝：目标超出知识库范围。';
      }

      const result = await listDirectory(fullPath, {
        displayPath: buildDisplayLabel(target),
      });

      return maskKnowledgeBasePath(result, context.knowledgeBasePath);
    } catch (error) {
      console.error('[knowledgeBaseListTool] 执行失败:', error);
      const message = error instanceof Error ? error.message : '未知错误';
      return `知识库目录读取失败：${message}`;
    }
  },
};

const knowledgeBaseReadToolDefinition = {
  name: KNOWLEDGE_BASE_READ_TOOL_ID,
  description: '读取当前知识库中的文件内容。请先通过目录工具确认文件名。',
  parameters: z.object({
    file: z
      .string()
      .min(1, '请输入要读取的文件名。')
      .describe('要读取的文件名或相对路径，例如 "docs/intro.md"。'),
  }),
  execute: async ({ file }: { file: string }, options?: ToolExecutionOptions) => {
    try {
      const context = await getKnowledgeBasePathFromToolContext(options);
      if (!context.ok) {
        return context.message;
      }

      const target = normalizeRelativeInput(file);
      if (!target) {
        return '读取未执行：请输入要读取的文件名。';
      }

      const fullPath = resolvePath(context.knowledgeBasePath, target);

      if (!isPathSafe(fullPath, context.knowledgeBasePath)) {
        return '访问被拒绝：目标超出知识库范围。';
      }

      const result = await readFile(fullPath, {
        displayPath: buildDisplayLabel(target),
      });

      return maskKnowledgeBasePath(result, context.knowledgeBasePath);
    } catch (error) {
      console.error('[knowledgeBaseReadTool] 执行失败:', error);
      const message = error instanceof Error ? error.message : '未知错误';
      return `知识库文件读取失败：${message}`;
    }
  },
};

const knowledgeBaseSearchToolDefinition = {
  name: KNOWLEDGE_BASE_SEARCH_TOOL_ID,
  description:
    '在绑定的知识库目录中搜索文本内容，默认搜索整个知识库，可选限定子目录。注意：该搜索为精确匹配，行为类似 grep，不进行模糊匹配，支持标准正则表达式（复杂正则可能因性能限制而超时）。',
  parameters: z.object({
    query: z
      .string()
      .min(1, '请输入要搜索的关键词。')
      .describe('要搜索的关键词或正则表达式（精确匹配，类似 grep；复杂正则可能导致超时）。'),
    folder: z
      .string()
      .trim()
      .optional()
      .describe('可选子目录，用于限制搜索范围，例如 "docs/reference"。'),
  }),
  execute: async (
    { query, folder }: { query: string; folder?: string },
    options?: ToolExecutionOptions,
  ) => {
    try {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        return '搜索未执行：请输入要搜索的关键词。';
      }

      const context = await getKnowledgeBasePathFromToolContext(options);
      if (!context.ok) {
        return context.message;
      }

      const target = normalizeRelativeInput(folder);
      const fullPath = resolvePath(context.knowledgeBasePath, target);

      if (!isPathSafe(fullPath, context.knowledgeBasePath)) {
        return '访问被拒绝：目标超出知识库范围。';
      }

      const result = await findString(fullPath, normalizedQuery, {
        displayPath: buildDisplayLabel(target),
        timeoutMs: 5000,
      });

      return maskKnowledgeBasePath(result, context.knowledgeBasePath);
    } catch (error) {
      console.error('[knowledgeBaseSearchTool] 执行失败:', error);
      const message = error instanceof Error ? error.message : '未知错误';
      return `知识库搜索失败：${message}`;
    }
  },
};

export const knowledgeBaseListTool = tool({
  title: 'Knowledge Base · List',
  description: knowledgeBaseListToolDefinition.description,
  inputSchema: knowledgeBaseListToolDefinition.parameters,
  execute: knowledgeBaseListToolDefinition.execute,
});

export const knowledgeBaseReadTool = tool({
  title: 'Knowledge Base · Read',
  description: knowledgeBaseReadToolDefinition.description,
  inputSchema: knowledgeBaseReadToolDefinition.parameters,
  execute: knowledgeBaseReadToolDefinition.execute,
});

export const knowledgeBaseSearchTool = tool({
  title: 'Knowledge Base · Search',
  description: knowledgeBaseSearchToolDefinition.description,
  inputSchema: knowledgeBaseSearchToolDefinition.parameters,
  execute: knowledgeBaseSearchToolDefinition.execute,
});

// 辅助函数
export async function getCurrentChatKnowledgeBasePath(chatId: string): Promise<string | null> {
  try {
    if (!chatId || chatId === '0') {
      // 如果是新建会话，返回 null
      return null;
    }

    // 从数据库获取当前会话的知识库路径
    const chatRecord = await chatFlexDb.chats.get(chatId);
    return chatRecord?.knowledgeBasePath || null;
  } catch (error) {
    console.error('[getCurrentChatKnowledgeBasePath] 获取会话知识库路径失败:', error);
    return null;
  }
}

export async function setKnowledgeBasePath(chatId: string, path: string): Promise<void> {
  try {
    if (!chatId || chatId === '0') {
      // 如果是新建会话，暂时存储在内存中，等会话创建后保存
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('pending-knowledge-base-path', path);
      }
      return;
    }

    // 更新数据库中的会话记录
    await chatFlexDb.chats.update(chatId, {
      knowledgeBasePath: path,
      updated: Date.now()
    });
  } catch (error) {
    console.error('[setKnowledgeBasePath] 设置知识库路径失败:', error);
    throw error;
  }
}

export async function selectKnowledgeBaseFolder(chatId: string): Promise<string | null> {
  if (typeof window === 'undefined' || !isTauri()) {
    throw new Error('文件夹选择功能仅在桌面应用中可用');
  }

  try {
    const selectedPath = await open({
      title: '选择知识库文件夹',
      directory: true,
      multiple: false,
      recursive: true,
    });

    const resolvedPath = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;

    if (resolvedPath) {
      await setKnowledgeBasePath(chatId, resolvedPath);
      return resolvedPath;
    }

    return null;
  } catch (error) {
    console.error('[selectKnowledgeBaseFolder] 选择文件夹失败:', error);
    throw error;
  }
}

/**
 * 在会话创建时，将临时存储的知识库路径保存到数据库
 */
export async function savePendingKnowledgeBasePath(chatId: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const pendingPath = window.sessionStorage.getItem('pending-knowledge-base-path');
      if (pendingPath) {
        await chatFlexDb.chats.update(chatId, { 
          knowledgeBasePath: pendingPath,
          updated: Date.now()
        });
        window.sessionStorage.removeItem('pending-knowledge-base-path');
      }
    }
  } catch (error) {
    console.error('[savePendingKnowledgeBasePath] 保存待定知识库路径失败:', error);
  }
}

function resolvePath(basePath: string, relativePath: string): string {
  const normalizedBase = normalizeAbsolutePath(basePath);
  const normalizedRelative = normalizeRelativeInput(relativePath);
  if (!normalizedRelative) {
    return normalizedBase;
  }
  return `${normalizedBase}/${normalizedRelative}`;
}

function isPathSafe(path: string, basePath: string): boolean {
  const normalizedPath = normalizeAbsolutePath(path);
  const normalizedBase = normalizeAbsolutePath(basePath);
  if (normalizedPath === normalizedBase) {
    return true;
  }
  return normalizedPath.startsWith(`${normalizedBase}/`);
}

function normalizeRelativeInput(input?: string): string {
  if (!input) {
    return '';
  }

  const segments = input
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment) && segment !== '.');

  const resolved: string[] = [];
  segments.forEach((segment) => {
    if (segment === '..') {
      resolved.pop();
      return;
    }
    resolved.push(segment);
  });

  return resolved.join('/');
}

function normalizeAbsolutePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

function buildDisplayLabel(relativePath: string): string {
  if (!relativePath) {
    return '知识库根目录';
  }
  return `知识库/${relativePath}`;
}

type ToolExecutionContext = {
  chatId?: string;
};

function getChatIdFromToolContext(options?: ToolExecutionOptions): string | null {
  const context = options?.experimental_context;
  if (!context || typeof context !== 'object') {
    return null;
  }

  const { chatId } = context as ToolExecutionContext;
  if (!chatId || typeof chatId !== 'string') {
    return null;
  }

  return chatId;
}

async function getKnowledgeBasePathFromToolContext(
  options?: ToolExecutionOptions,
): Promise<
  | { ok: true; knowledgeBasePath: string }
  | { ok: false; message: string }
> {
  const chatId = getChatIdFromToolContext(options);
  if (!chatId) {
    return { ok: false as const, message: '无法获取当前会话上下文。' };
  }

  const knowledgeBasePath = await getCurrentChatKnowledgeBasePath(chatId);
  if (!knowledgeBasePath) {
    return { ok: false as const, message: '知识库未配置，请先选择知识库文件夹。' };
  }

  return { ok: true as const, knowledgeBasePath };
}

function maskKnowledgeBasePath(message: string, knowledgeBasePath: string): string {
  if (!message) {
    return message;
  }

  const normalizedBase = normalizeAbsolutePath(knowledgeBasePath);
  const forwardPattern = new RegExp(
    String.raw`${escapeRegExp(normalizedBase)}(?=[\\/]|$)`,
    'g',
  );
  const backwardPattern = new RegExp(
    String.raw`${escapeRegExp(normalizedBase.replace(/\//g, '\\\\'))}(?=[\\/]|$)`,
    'g',
  );

  return message.replace(forwardPattern, '知识库').replace(backwardPattern, '知识库');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
