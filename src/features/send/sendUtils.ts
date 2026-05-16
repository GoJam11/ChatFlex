/**
 * sendUtils - 从 send.ts 提取的纯函数，便于单元测试
 *
 * 这些函数不依赖数据库、Vue store 或浏览器 API，
 * 可以在 Node.js 环境下直接测试。
 */

import {
  isToolUIPart,
  type ModelMessage,
  type ToolModelMessage,
  type UIMessage,
} from 'ai';
import type { ToolResultOutput } from '@ai-sdk/provider-utils';
import { MessageStatus as MessageStatusEnum } from '@/types/msg';
import type { MessageRecord } from '@/types/msg';

// ==================== 类型 ====================

export interface TextSegment {
  text: string;
  reasoning: string;
  streaming: boolean;
}

export type ToolMessageSnapshot = {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  providerExecuted?: boolean;
  title?: string;
  preliminary?: boolean;
};

// ==================== 纯函数 ====================

export const stringifyForDisplay = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
};

export const isToolResultOutput = (value: unknown): value is ToolResultOutput => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { type?: unknown };
  return typeof candidate.type === 'string';
};

export const toToolResultOutput = (value: unknown): ToolResultOutput => {
  if (isToolResultOutput(value)) {
    return value;
  }
  return {
    type: 'text',
    value: stringifyForDisplay(value),
  };
};

/**
 * 从 UIMessage 的 parts 数组中提取按工具调用分隔的文本段。
 * 每当出现 tool part 后紧跟文本/推理 part，就产生一个新的文本段。
 */
export function extractTextSegments(parts: UIMessage['parts']): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentText = '';
  let currentReasoning = '';
  let currentStreaming = false;
  let afterTool = false;

  for (const part of parts) {
    if (part.type === 'text') {
      if (afterTool) {
        segments.push({ text: currentText, reasoning: currentReasoning, streaming: false });
        currentText = '';
        currentReasoning = '';
        currentStreaming = false;
        afterTool = false;
      }
      currentText += part.text;
      currentStreaming = part.state === 'streaming';
    } else if (part.type === 'reasoning') {
      if (afterTool) {
        segments.push({ text: currentText, reasoning: currentReasoning, streaming: false });
        currentText = '';
        currentReasoning = '';
        currentStreaming = false;
        afterTool = false;
      }
      currentReasoning += part.text;
      currentStreaming = currentStreaming || part.state === 'streaming';
    } else if (isToolUIPart(part)) {
      afterTool = true;
    }
  }

  segments.push({ text: currentText, reasoning: currentReasoning, streaming: currentStreaming });
  return segments;
}

export function deriveStatusFromSegment(segment: TextSegment, isFinal: boolean): MessageStatusEnum {
  if (isFinal) {
    return MessageStatusEnum.COMPLETED;
  }
  if (segment.text.trim().length > 0) {
    return segment.streaming ? MessageStatusEnum.GENERATING : MessageStatusEnum.COMPLETED;
  }
  if (segment.reasoning.trim().length > 0) {
    return segment.streaming ? MessageStatusEnum.THINKING : MessageStatusEnum.THINKING;
  }
  if (segment.streaming) {
    return MessageStatusEnum.GENERATING;
  }
  return MessageStatusEnum.WAITING;
}

export const buildToolMessageContent = (result: ToolMessageSnapshot): string => {
  const sections: string[] = [
    `**Tool**: ${result.toolName}`,
    `**Call ID**: ${result.toolCallId}`,
  ];

  if (result.title) {
    sections.push(`**Summary**: ${result.title}`);
  }

  if (typeof result.providerExecuted === 'boolean') {
    sections.push(`**Executed by provider**: ${result.providerExecuted ? 'Yes' : 'No'}`);
  }

  if (result.input !== undefined) {
    sections.push('\n#### Input');
    sections.push('```json');
    sections.push(stringifyForDisplay(result.input));
    sections.push('```');
  }

  if (result.output !== undefined) {
    sections.push('\n#### Output');
    sections.push('```json');
    sections.push(stringifyForDisplay(result.output));
    sections.push('```');
  }

  return sections.join('\n');
};

export const buildToolModelMessage = (result: ToolMessageSnapshot): ToolModelMessage => ({
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: result.toolCallId,
      toolName: result.toolName,
      output: toToolResultOutput(result.output),
    },
  ],
});

export const mapToolRecordToModelMessage = (record: MessageRecord): ToolModelMessage | null => {
  if (Array.isArray(record.messages)) {
    for (const candidate of record.messages) {
      if (
        candidate &&
        typeof candidate === 'object' &&
        (candidate as ToolModelMessage).role === 'tool'
      ) {
        return candidate as ToolModelMessage;
      }
    }
  }

  if (record.toolInvocation) {
    return {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: record.toolInvocation.toolCallId,
          toolName: record.toolInvocation.toolName,
          output: toToolResultOutput(record.toolInvocation.output ?? record.content),
        },
      ],
    } satisfies ToolModelMessage;
  }

  return null;
};

/**
 * 从数据库记录和已转换的 ModelMessage 列表构建最终发送给 API 的消息序列。
 *
 * 核心逻辑：
 * - tool 记录直接转为 ToolModelMessage
 * - assistant 记录后面如果紧跟 tool 记录，自动注入 tool-call parts
 *   (否则 API 会因为 tool result 缺少对应的 tool-call 而报 400)
 * - 其它记录直接使用 convertToModelMessages 的输出
 */
export function buildModelMessages(
  relevantRecords: MessageRecord[],
  convertedMessages: ModelMessage[],
): ModelMessage[] {
  const modelMessages: ModelMessage[] = [];
  let convertedIndex = 0;

  for (let ri = 0; ri < relevantRecords.length; ri++) {
    const record = relevantRecords[ri];

    if (record.role === 'tool') {
      const toolMessage = mapToolRecordToModelMessage(record);
      if (toolMessage) {
        modelMessages.push(toolMessage);
      }
      continue;
    }

    const nextMessage = convertedMessages[convertedIndex];
    convertedIndex += 1;

    if (!nextMessage) {
      continue;
    }

    // 如果这是 assistant 消息且后面紧跟 tool 记录，需要注入 tool-call parts
    if (record.role === 'assistant') {
      const toolCallParts: Array<{ type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }> = [];
      for (let tj = ri + 1; tj < relevantRecords.length; tj++) {
        const following = relevantRecords[tj];
        if (following.role !== 'tool') break;
        if (following.toolInvocation) {
          toolCallParts.push({
            type: 'tool-call',
            toolCallId: following.toolInvocation.toolCallId,
            toolName: following.toolInvocation.toolName,
            input: following.toolInvocation.input ?? {},
          });
        }
      }

      if (toolCallParts.length > 0) {
        const existingContent = nextMessage.role === 'assistant'
          ? (typeof nextMessage.content === 'string'
            ? (nextMessage.content.trim() ? [{ type: 'text' as const, text: nextMessage.content }] : [])
            : Array.isArray(nextMessage.content) ? [...nextMessage.content] : [])
          : [];
        modelMessages.push({
          ...nextMessage,
          content: [...existingContent, ...toolCallParts],
        } as ModelMessage);
        continue;
      }
    }

    modelMessages.push(nextMessage);
  }

  return modelMessages;
}

export const getKnowledgeBaseFolderName = (path: string): string => {
  if (!path) {
    return '';
  }
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
};

export const mergeSystemPrompts = (
  basePrompt?: string,
  knowledgeBasePrompt?: string,
): string | undefined => {
  const trimmedBase = basePrompt?.trim();
  const trimmedKnowledgeBase = knowledgeBasePrompt?.trim();
  if (trimmedBase && trimmedKnowledgeBase) {
    return `${trimmedBase}\n\n${trimmedKnowledgeBase}`;
  }
  return trimmedBase || trimmedKnowledgeBase || undefined;
};
