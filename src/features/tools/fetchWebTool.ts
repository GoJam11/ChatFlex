import { tool } from 'ai';
import { z } from 'zod';

export const FETCH_WEB_TOOL_ID = 'fetchWeb';

const DEFAULT_MAX_CHARACTERS = 4500;
const MIN_CHAR_LIMIT = 500;
const MAX_CHAR_LIMIT = 8000;
const FETCH_TIMEOUT = 20_000;

function normalizeUrl(input: string): string {
  let urlValue = input.trim();

  if (!/^https?:\/\//i.test(urlValue)) {
    urlValue = `https://${urlValue}`;
  }

  const url = new URL(urlValue);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('仅支持 http 或 https 协议的链接');
  }

  return url.toString();
}

async function fetchWithTimeout(resource: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function fetchReadableContent(targetUrl: string): Promise<string> {
  const proxiedUrl = `https://r.jina.ai/${encodeURI(targetUrl)}`;
  const response = await fetchWithTimeout(proxiedUrl, {
    headers: {
      'Accept': 'text/plain, text/markdown, text/html;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`抓取失败：${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  return text.trim();
}

function trimContent(content: string, maxCharacters: number): string {
  if (content.length <= maxCharacters) {
    return content;
  }

  return `${content.slice(0, maxCharacters)}\n\n---\n内容已截断，若需更多信息请再次抓取或缩小范围。`;
}

export const fetchWebToolDefinition = {
  name: FETCH_WEB_TOOL_ID,
  description: '抓取网页正文内容并返回可阅读的纯文本片段',
  parameters: z.object({
    url: z
      .string()
      .min(4, '请输入有效的网页地址')
      .describe('目标网页地址，支持 http/https'),
    maxCharacters: z
      .number()
      .int()
      .min(MIN_CHAR_LIMIT)
      .max(MAX_CHAR_LIMIT)
      .optional()
      .describe('最大返回字符数，默认约 4500 字符'),
  }),
  execute: async ({ url, maxCharacters }: { url: string; maxCharacters?: number }) => {
    try {
      const normalizedUrl = normalizeUrl(url);
      const resolvedMaxChars = maxCharacters ?? DEFAULT_MAX_CHARACTERS;
      const rawContent = await fetchReadableContent(normalizedUrl);

      if (!rawContent) {
        return `未能从 ${normalizedUrl} 提取到可用内容。`;
      }

      const sanitizedContent = rawContent.replace(/\s+\n/g, '\n').trim();
      const limitedContent = trimContent(sanitizedContent, resolvedMaxChars);

      return [
        `**抓取链接**: ${normalizedUrl}`,
        '',
        limitedContent,
      ].join('\n');
    } catch (error: unknown) {
      console.error('[fetchWebTool] 执行失败:', error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
          ? error
          : '未知错误';
      return `抓取失败：${message}`;
    }
  },
};

export type FetchWebToolInput = z.infer<typeof fetchWebToolDefinition.parameters>;

export const fetchWebTool = tool({
  title: 'Fetch Web Content',
  description: fetchWebToolDefinition.description,
  inputSchema: fetchWebToolDefinition.parameters,
  execute: fetchWebToolDefinition.execute,
});
