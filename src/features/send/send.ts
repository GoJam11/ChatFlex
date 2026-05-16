/**
 * send - 简化的消息发送功能
 * 
 * 该文件实现发送消息流程：
 * 1. 接受prompt参数（用户发送的消息，包括text和image）（会话id）
 * 2. 从数据库中获取会话相关信息（配置、历史记录、模型等）
 * 3. 调用 ai-sdk 创建 model 对象并发送消息
 * 4. 响应 chunk 写到 indexDB 数据库
 * UI层组件直接通过 Dexie 订阅数据库实现组件级别响应式
 */

import {
  convertToModelMessages,
  extractReasoningMiddleware,
  getToolName,
  isToolUIPart,
  readUIMessageStream,
  stepCountIs,
  streamText,
  wrapLanguageModel,
  type DynamicToolUIPart,
  type ModelMessage,
  type ToolModelMessage,
  type ToolSet,
  type ToolUIPart,
  type UIMessage,
} from 'ai';
import { APICallError, type LanguageModelV3, type SharedV3ProviderOptions } from '@ai-sdk/provider';
import type { ToolResultOutput } from '@ai-sdk/provider-utils';
import { v4 as uuid } from 'uuid';
import { chatDb } from '@/persistence/ChatDatabase';
import { messageDb } from '@/persistence/MessageDatabase';
import { createLanguageModel, type ModelConfig } from '@/features/ai/languageModel';
import { useSettingStore } from '@/features/setting/useSettingStore';
import { deleteMessage as deleteMessageById, getChatMessages, getMessage as getMessageById } from '@/features/msg/messageDataAccess';
import type { MessageContent, MessageRecord, Msg } from '@/types/msg';
import { MessageStatus as MessageStatusEnum } from '@/types/msg';
import { summarizeConversationAsync } from './summary';
import { recordToUIMessage } from './recordToUIMessage';
import { providerService } from '@/features/provider/providerService';
import { createLogger } from '@/utils/logger';
const log = createLogger('send');
import { resolveProviderBaseUrl } from '@/types/provider';
import { toolDb } from '@/persistence/ToolDatabase';
import { buildToolSet, buildToolSetWithMcp } from '@/features/tools/toolRegistry';
import { getCurrentChatKnowledgeBasePath } from '@/features/tools/knowledgeBaseTool';
import { mcpDb } from '@/persistence/McpDatabase';
import { mcpClientService } from '@/features/mcp/mcpClientService';
import { fromSafeToolId } from '@/types/mcp';
import { useMemoryStore } from '@/features/memory/useMemoryStore';
import {
  extractTextSegments,
  deriveStatusFromSegment,
  stringifyForDisplay,
  isToolResultOutput,
  toToolResultOutput,
  buildToolMessageContent,
  buildToolModelMessage,
  mapToolRecordToModelMessage,
  buildModelMessages,
  mergeSystemPrompts,
  getKnowledgeBaseFolderName,
  type TextSegment,
  type ToolMessageSnapshot,
} from './sendUtils';

// Agent mode: allow the model to keep calling tools until it produces a final text response.
// A high upper bound prevents genuine infinite loops while not limiting normal agent workflows.
const MAX_TOOL_EXECUTION_STEPS = 50;

type ToolUIPartSnapshot = ToolUIPart | DynamicToolUIPart;

const getToolPartInput = (part: ToolUIPartSnapshot): unknown => {
  if ('input' in part && part.input !== undefined) {
    return part.input;
  }
  const rawInput = (part as { rawInput?: unknown }).rawInput;
  if (rawInput !== undefined) {
    return rawInput;
  }
  return undefined;
};

const toToolMessageSnapshot = (part: ToolUIPartSnapshot): ToolMessageSnapshot | null => {
  const toolName = getToolName(part);
  const input = getToolPartInput(part);

  if (part.state === 'output-available') {
    return {
      toolCallId: part.toolCallId,
      toolName,
      input,
      output: part.output,
      providerExecuted: part.providerExecuted,
      title: part.title,
      preliminary: part.preliminary,
    };
  }

  if (part.state === 'output-error') {
    return {
      toolCallId: part.toolCallId,
      toolName,
      input,
      output: part.errorText ?? 'Tool execution failed.',
      providerExecuted: part.providerExecuted,
      title: part.title,
    };
  }

  if (part.state === 'output-denied') {
    return {
      toolCallId: part.toolCallId,
      toolName,
      input,
      output: 'Tool execution denied.',
      providerExecuted: part.providerExecuted,
      title: part.title,
    };
  }

  return null;
};

const buildToolSnapshotSignature = (snapshot: ToolMessageSnapshot): string =>
  stringifyForDisplay({
    toolCallId: snapshot.toolCallId,
    toolName: snapshot.toolName,
    input: snapshot.input,
    output: snapshot.output,
    providerExecuted: snapshot.providerExecuted,
    title: snapshot.title,
    preliminary: snapshot.preliminary,
  });

const buildKnowledgeBaseNotice = (path: string): string => {
  const folderName = getKnowledgeBaseFolderName(path);
  if (folderName) {
    return `当前会话已关联名为 "${folderName}" 的本地知识库文件夹。可使用 knowledgeBase_list、knowledgeBase_read、knowledgeBase_search 工具列出、读取或搜索该目录中的内容。`;
  }
  return '当前会话已关联本地知识库文件夹。可使用 knowledgeBase_list、knowledgeBase_read、knowledgeBase_search 工具列出、读取或搜索该目录中的内容。';
};

// 发送消息的输入参数
export interface SendPromptInput {
  prompt: MessageContent; // 用户发送的消息内容（支持文本和图片）
  chatId: string; // 会话ID
  providerConfig?: {
    apiKey: string;
    baseURL?: string;
    provider: string;
    model: string;
  }; // 可选的供应商配置，如果提供则优先使用
  summaryConfig?: {
    apiKey?: string;
    baseURL?: string;
    provider: string;
    model: string;
  }; // 可选的总结专用配置
}

// 发送结果
export interface SendResult {
  success: boolean;
  error?: string;
  userMessage?: Msg;
  assistantMessage?: Msg;
}

export interface ResendMessageInput extends Pick<SendPromptInput, 'chatId' | 'providerConfig' | 'summaryConfig'> {
  messageId: string;
}

export interface ResendResult extends SendResult {
  deletedMessageIds?: string[];
}

const buildSummaryConfig = async (
  modelConfig: ModelConfig,
  override?: SendPromptInput['summaryConfig'],
): Promise<SendPromptInput['summaryConfig'] | undefined> => {
  if (override) {
    return override;
  }

  const settingStore = useSettingStore();
  if (!settingStore.enableAiSummary) {
    return undefined;
  }

  await providerService.ready();

  if (
    settingStore.enableSeparateSummaryModel &&
    settingStore.summaryModel &&
    settingStore.summaryProvider
  ) {
    const summaryProvider = providerService.getProvider(settingStore.summaryProvider);

    const summaryApiKey = settingStore.summaryApiKey ?? summaryProvider?.apiKey ?? undefined;
    const summaryBaseURL =
      settingStore.summaryBaseURL ?? resolveProviderBaseUrl(summaryProvider) ?? undefined;

    return {
      provider: settingStore.summaryProvider,
      model: settingStore.summaryModel,
      apiKey: summaryApiKey,
      baseURL: summaryBaseURL,
    };
  }

  const provider = providerService.getProvider(modelConfig.provider);

  return {
    provider: modelConfig.provider,
    model: modelConfig.model,
    apiKey: modelConfig.apiKey ?? provider?.apiKey,
    baseURL: modelConfig.baseURL ?? resolveProviderBaseUrl(provider),
  };
};

/**
 * 从数据库获取会话配置信息
 */
const getChatConfig = async (
  chatId: string, 
  providerConfig?: SendPromptInput['providerConfig']
): Promise<{
  success: boolean;
  config?: ModelConfig;
  systemPrompt?: string;
  error?: string;
}> => {
  try {
    // 获取会话记录
    const chatRecord = await chatDb.getChatById(chatId);
    if (!chatRecord) {
      return { success: false, error: '会话不存在' };
    }

    // 从设置数据库获取默认值
    const settingStore = useSettingStore();
    const defaultModel = settingStore.currentModel;
    const defaultProvider = settingStore.currentProvider;
    const defaultTemperature = settingStore.defaultModelTemperature ?? undefined;
    const defaultMaxTokens = settingStore.defaultModelMaxTokens ?? undefined;

    await providerService.ready();

    // 构建模型配置 - 优先使用传入的配置，其次使用会话配置，最后使用全局设置
    const config: ModelConfig = {
      provider: providerConfig?.provider || chatRecord.provider || defaultProvider || 'openai',
      model: providerConfig?.model || chatRecord.model || defaultModel || 'gpt-4o-mini',
      apiKey: providerConfig?.apiKey, // 使用传入的apiKey
      baseURL: providerConfig?.baseURL, // 使用传入的baseURL
      temperature: chatRecord.temperature ?? defaultTemperature ?? 0.7,
      maxTokens: chatRecord.maxTokens ?? defaultMaxTokens ?? 4000,
      topP: chatRecord.topP,
      frequencyPenalty: chatRecord.frequencyPenalty,
      reasoningStrength: chatRecord.reasoningStrength ?? 'default',
    };

    const provider = providerService.getProvider(config.provider);

    const resolvedApiKey = config.apiKey?.trim() || provider?.apiKey?.trim();
    if (resolvedApiKey) {
      config.apiKey = resolvedApiKey;
    } else {
      config.apiKey = undefined;
    }

    const providerBaseURL = resolveProviderBaseUrl(provider);
    const resolvedBaseURL = config.baseURL?.trim() || providerBaseURL;
    if (resolvedBaseURL) {
      config.baseURL = resolvedBaseURL;
    } else {
      config.baseURL = undefined;
    }

    const systemPrompt = chatRecord.systemPrompt?.trim();

    return {
      success: true,
      config,
      systemPrompt: systemPrompt && systemPrompt.length > 0 ? systemPrompt : undefined,
    };
  } catch (error: any) {
    log.error('获取会话配置失败:', error);
    return { success: false, error: error.message || '获取会话配置失败' };
  }
};

/**
 * 处理AI流式响应 - 直接使用Vercel AI SDK
 */
const handleAIStream = async (
  chatId: string,
  messageId: string,
  modelConfig: ModelConfig,
  modelMessages: ModelMessage[],
  summaryConfig?: SendPromptInput['summaryConfig'],
  toolSet?: ToolSet,
  systemPrompt?: string,
): Promise<{ success: boolean; error?: string }> => {
  // 捕获流内部错误（上游 API 错误等），供 catch 块使用
  let streamError: unknown = undefined;

  try {
    // 创建模型实例
    const baseModel = createLanguageModel(modelConfig) as LanguageModelV3;
    const model = wrapLanguageModel({
      model: baseModel,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    });

    // 构建请求配置
    const requestConfig: {
      temperature?: number;
      maxOutputTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      providerOptions?: SharedV3ProviderOptions;
    } = {};
    if (modelConfig.temperature !== undefined) requestConfig.temperature = modelConfig.temperature;
    if (modelConfig.maxTokens !== undefined) requestConfig.maxOutputTokens = modelConfig.maxTokens;
    if (modelConfig.topP !== undefined) requestConfig.topP = modelConfig.topP;
    if (modelConfig.frequencyPenalty !== undefined) requestConfig.frequencyPenalty = modelConfig.frequencyPenalty;
    if (modelConfig.reasoningStrength && modelConfig.reasoningStrength !== 'default') {
      requestConfig.providerOptions = {
        [modelConfig.provider]: {
          reasoningEffort: modelConfig.reasoningStrength,
        },
      };
    }

    // 使用 UI 消息流让 SDK 处理推理/正文事件
    // Agent 模式：设置较高的步数上限，让模型自行决定何时停止调用工具
    const toolNames = toolSet ? Object.keys(toolSet) : [];
    log.info(`[TOOL-DEBUG] streamText 启动: chatId=${chatId}, messageId=${messageId}, toolCount=${toolNames.length}, tools=[${toolNames.join(', ')}], maxSteps=${toolSet ? MAX_TOOL_EXECUTION_STEPS : 'N/A'}`);
    log.info(`[TOOL-DEBUG] modelMessages 数量: ${modelMessages.length}, 各角色: ${JSON.stringify(modelMessages.reduce((acc, m) => { acc[m.role] = (acc[m.role] || 0) + 1; return acc; }, {} as Record<string, number>))}`);

    const result = streamText({
      model,
      messages: modelMessages,
      system: systemPrompt,
      stopWhen: toolSet ? stepCountIs(MAX_TOOL_EXECUTION_STEPS) : undefined,
      experimental_context: { chatId },
      onError: ({ error }) => {
        log.error(`[TOOL-DEBUG] onError 回调触发:`, error);
        streamError = error;
      },
      ...requestConfig,
      ...(toolSet ? { tools: toolSet } : {}),
    });

    // ====== 段追踪：每个"文本段"对应一个 assistant 消息 ======
    // segments[0] 始终使用预创建的 assistant 消息
    const segmentMessages: { messageId: string; text: string; reasoning: string }[] = [
      { messageId, text: '', reasoning: '' },
    ];

    const toolMessageEntries = new Map<string, { messageId: string; timestamp: number }>();
    const toolMessageSnapshots = new Map<string, string>();
    let timestampOffset = 0;

    /** 为新的文本段分配一个递增时间戳 */
    const nextTimestamp = () => {
      const ts = Date.now() + timestampOffset;
      timestampOffset += 1;
      return ts;
    };

    const saveToolMessage = async (toolResult: ToolMessageSnapshot) => {
      log.info(`[TOOL-DEBUG] saveToolMessage: tool=${toolResult.toolName}, callId=${toolResult.toolCallId?.slice(-6)}, hasOutput=${toolResult.output !== undefined}, providerExecuted=${toolResult.providerExecuted}, preliminary=${toolResult.preliminary}`);
      // 将 AI 返回的安全格式工具名转换回内部格式（下划线 -> 冒号）
      const internalToolName = fromSafeToolId(toolResult.toolName);
      const content = buildToolMessageContent({ ...toolResult, toolName: internalToolName });
      const rawMessages: readonly ToolModelMessage[] = [buildToolModelMessage({ ...toolResult, toolName: internalToolName })];
      const status = toolResult.preliminary ? MessageStatusEnum.GENERATING : MessageStatusEnum.COMPLETED;
      const toolInvocation = {
        toolCallId: toolResult.toolCallId,
        toolName: internalToolName,
        input: toolResult.input,
        output: toToolResultOutput(toolResult.output),
        providerExecuted: toolResult.providerExecuted,
        title: toolResult.title,
      };

      const existing = toolMessageEntries.get(toolResult.toolCallId);
      if (existing) {
        await messageDb.updateMessage(existing.messageId, {
          content,
          status,
          toolInvocation,
          messages: rawMessages,
          short: `[工具] ${internalToolName}`,
        });
        return;
      }

      const timestamp = nextTimestamp();

      const toolMsg: Msg = {
        id: uuid(),
        content,
        role: 'tool',
        status,
        timestamp,
        short: `[工具] ${internalToolName}`,
        model: internalToolName,
        provider: 'tool',
        toolInvocation,
        messages: rawMessages,
      } as Msg;

      await messageDb.createMessageFromObject(chatId, toolMsg);
      toolMessageEntries.set(toolResult.toolCallId, {
        messageId: toolMsg.id,
        timestamp,
      });
    };

    const uiStream = result.toUIMessageStream({
      sendReasoning: true,
    });

    const messageStream = readUIMessageStream({
      stream: uiStream,
    });

    let streamIterationCount = 0;
    for await (const uiMessage of messageStream) {
      streamIterationCount++;
      const toolParts = uiMessage.parts.filter(isToolUIPart);
      const toolStates = toolParts.map(p => `${getToolName(p)}(${p.toolCallId?.slice(-6)}):${p.state}`);
      log.info(`[TOOL-DEBUG] stream iteration #${streamIterationCount}: parts=${uiMessage.parts.length}, toolParts=${toolParts.length}, toolStates=[${toolStates.join(', ')}]`);

      // --- 1. 提取按工具边界分隔的文本段 ---
      const segments = extractTextSegments(uiMessage.parts);

      // --- 2. 为新出现的段创建对应的 assistant 消息 ---
      for (let i = segmentMessages.length; i < segments.length; i++) {
        const seg = segments[i];
        // 仅当段内有实际内容时才创建消息，避免空消息
        if (!seg.text.trim() && !seg.reasoning.trim() && !seg.streaming) {
          break;
        }
        const newMsgId = uuid();
        const ts = nextTimestamp();
        const newMsg: Msg = {
          id: newMsgId,
          content: seg.text,
          role: 'assistant',
          status: MessageStatusEnum.GENERATING,
          timestamp: ts,
          model: modelConfig.model,
          provider: modelConfig.provider,
        } as Msg;
        await messageDb.createMessageFromObject(chatId, newMsg);
        segmentMessages.push({ messageId: newMsgId, text: '', reasoning: '' });
      }

      // --- 3. 更新各段对应的 assistant 消息 ---
      for (let i = 0; i < segmentMessages.length && i < segments.length; i++) {
        const seg = segments[i];
        const tracked = segmentMessages[i];

        if (seg.text !== tracked.text || seg.reasoning !== tracked.reasoning) {
          tracked.text = seg.text;
          tracked.reasoning = seg.reasoning;

          const status = deriveStatusFromSegment(seg, false);

          const updatePayload: Partial<Omit<import('@/types/msg').MessageRecord, 'id' | 'chatId'>> = {
            content: seg.text,
            status,
          };
          // 思考内容只放在第一个段
          if (i === 0 && seg.reasoning) {
            updatePayload.thinkContent = seg.reasoning;
          }

          await messageDb.updateMessage(tracked.messageId, updatePayload);
        }
      }

      // --- 4. 处理工具调用消息 ---
      // toolParts 已在上方日志处声明
      for (const part of toolParts) {
        const snapshot = toToolMessageSnapshot(part);
        if (!snapshot) {
          log.debug(`[TOOL-DEBUG] 工具 part 无法转为快照 (state=${part.state}), tool=${getToolName(part)}, callId=${part.toolCallId?.slice(-6)}`);
          continue;
        }

        const signature = buildToolSnapshotSignature(snapshot);
        if (toolMessageSnapshots.get(snapshot.toolCallId) === signature) {
          log.debug(`[TOOL-DEBUG] 工具快照未变化，跳过: tool=${snapshot.toolName}, callId=${snapshot.toolCallId?.slice(-6)}`);
          continue;
        }
        log.info(`[TOOL-DEBUG] 工具快照已更新，保存: tool=${snapshot.toolName}, callId=${snapshot.toolCallId?.slice(-6)}, state变化`);

        toolMessageSnapshots.set(snapshot.toolCallId, signature);
        await saveToolMessage(snapshot);
      }
    }

    // ====== 流结束，完成处理 ======
    log.info(`[TOOL-DEBUG] 流结束: 总迭代次数=${streamIterationCount}, 文本段数=${segmentMessages.length}, 工具消息数=${toolMessageEntries.size}`);

    const finishReason = await result.finishReason;
    log.info(`[TOOL-DEBUG] finishReason: ${finishReason}`);

    const steps = await result.steps;
    log.info(`[TOOL-DEBUG] steps 数量: ${steps.length}`);
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si];
      log.info(`[TOOL-DEBUG] step[${si}]: finishReason=${step.finishReason}, toolCalls=${step.toolCalls?.length ?? 0}, toolResults=${step.toolResults?.length ?? 0}, text="${step.text?.slice(0, 100)}"`);
      if (step.toolCalls && step.toolCalls.length > 0) {
        for (const tc of step.toolCalls) {
          log.info(`[TOOL-DEBUG]   toolCall: name=${tc.toolName}, id=${tc.toolCallId?.slice(-6)}, input=${JSON.stringify((tc as any).args)?.slice(0, 200)}`);
        }
      }
      if (step.toolResults && step.toolResults.length > 0) {
        for (const tr of step.toolResults) {
          log.info(`[TOOL-DEBUG]   toolResult: name=${tr.toolName}, id=${tr.toolCallId?.slice(-6)}, output=${JSON.stringify((tr as any).result)?.slice(0, 200)}`);
        }
      }
    }

    const usage = await result.usage;
    const response = await result.response;
    log.info(`[TOOL-DEBUG] usage: ${JSON.stringify(usage)}`);
    log.info(`[TOOL-DEBUG] response.messages 数量: ${response.messages?.length}, 各角色: ${JSON.stringify(response.messages?.reduce((acc: Record<string, number>, m: any) => { acc[m.role] = (acc[m.role] || 0) + 1; return acc; }, {} as Record<string, number>))}`);

    // 打印每条 response message 的摘要
    for (let ri = 0; ri < (response.messages?.length ?? 0); ri++) {
      const rm = response.messages[ri];
      const contentSummary = Array.isArray(rm.content)
        ? rm.content.map((c: any) => c.type).join(', ')
        : typeof rm.content === 'string' ? `text(${rm.content.length}chars)` : String(rm.content);
      log.info(`[TOOL-DEBUG] response.msg[${ri}]: role=${rm.role}, content=[${contentSummary}]`);
    }

    const reasoningText = await result.reasoningText;

    // 找到最后一个有实际内容的段作为"主 assistant 消息"，保存 usage / raw 等元数据
    // 如果所有段都空（不太可能），回退到第一个段
    let primaryIdx = segmentMessages.length - 1;
    for (let i = segmentMessages.length - 1; i >= 0; i--) {
      if (segmentMessages[i].text.trim()) {
        primaryIdx = i;
        break;
      }
    }

    for (let i = 0; i < segmentMessages.length; i++) {
      const tracked = segmentMessages[i];
      const isPrimary = i === primaryIdx;
      const finalContent = tracked.text.trim();

      // 如果是无内容的中间段且不是主段，删除空消息
      if (!finalContent && !isPrimary && i > 0) {
        await messageDb.deleteMessage(tracked.messageId);
        continue;
      }

      const updatePayload: Partial<Omit<import('@/types/msg').MessageRecord, 'id' | 'chatId'>> = {
        content: finalContent,
        status: MessageStatusEnum.COMPLETED,
      };

      if (i === 0) {
        updatePayload.thinkContent = reasoningText;
      }

      if (isPrimary) {
        updatePayload.usage = usage;
        updatePayload.raw = response;
        updatePayload.messages = response.messages;
      }

      await messageDb.updateMessage(tracked.messageId, updatePayload);
    }

    // AI响应完成后，异步处理会话总结（不阻塞返回）
    if (summaryConfig) {
      summarizeConversationAsync({
        chatId,
        providerConfig: summaryConfig
      });
    }

    return { success: true };
  } catch (error: any) {
    log.error('[TOOL-DEBUG] catch 错误:', error);
    log.error(`[TOOL-DEBUG] error.name=${error?.name}, error.message=${error?.message}`);
    log.error(`[TOOL-DEBUG] error.cause=${error?.cause}, cause.name=${error?.cause?.name}, cause.message=${error?.cause?.message}`);
    log.error(`[TOOL-DEBUG] error.cause.cause=${error?.cause?.cause}, cause.cause.name=${error?.cause?.cause?.name}, cause.cause.message=${error?.cause?.cause?.message}`);
    log.error(`[TOOL-DEBUG] APICallError.isInstance(error)=${APICallError.isInstance(error)}, APICallError.isInstance(cause)=${APICallError.isInstance(error?.cause)}`);
    if (error?.cause && typeof error.cause === 'object') {
      log.error(`[TOOL-DEBUG] cause keys: ${Object.keys(error.cause).join(', ')}`);
      if (error.cause.responseBody) log.error(`[TOOL-DEBUG] cause.responseBody=${error.cause.responseBody}`);
    }

    // 递归查找 cause 链中的 APICallError
    const findAPICallError = (err: unknown, depth = 0): APICallError | null => {
      if (!err || depth > 5) return null as any;
      if (APICallError.isInstance(err)) return err;
      return findAPICallError((err as any)?.cause, depth + 1);
    };

    const apiError = findAPICallError(error);

    // 从 cause 链中提取最有意义的错误消息
    let errorMsg = error.message || '处理失败';

    if (apiError?.responseBody) {
      try {
        const body = JSON.parse(apiError.responseBody);
        if (body.error?.message) {
          errorMsg = body.error.message;
        }
      } catch {
        errorMsg = apiError.responseBody;
      }
    } else if (apiError?.message) {
      errorMsg = apiError.message;
    } else if (error.cause?.message && error.cause.message !== error.message) {
      // NoOutputGeneratedError 等包装错误，取 cause 的消息
      errorMsg = error.cause.message;
    }

    // 如果仍是泛化消息，尝试从 onError 捕获的流错误中提取
    if (streamError && errorMsg === error.message) {
      const streamApiError = findAPICallError(streamError);
      if (streamApiError?.responseBody) {
        try {
          const body = JSON.parse(streamApiError.responseBody);
          if (body.error?.message) {
            errorMsg = body.error.message;
          }
        } catch {
          errorMsg = streamApiError.responseBody;
        }
      } else if (streamApiError?.message) {
        errorMsg = streamApiError.message;
      } else if ((streamError as any)?.message) {
        errorMsg = (streamError as any).message;
      }
    }

    // 设置错误状态
    await messageDb.updateMessage(messageId, {
      status: MessageStatusEnum.ERROR,
      errorMsg,
    });

    return { success: false, error: errorMsg };
  }
};

/**
 * 发送消息的主要方法
 */
export const send = async (
  input: SendPromptInput
): Promise<SendResult> => {
  try {
    // 1. 获取会话配置信息
    const configResult = await getChatConfig(input.chatId, input.providerConfig);
    if (!configResult.success || !configResult.config) {
      return { success: false, error: configResult.error || '获取会话配置失败' };
    }

    const { config: modelConfig, systemPrompt } = configResult;

    // 2. 创建用户消息
    const userResult = await messageDb.createUserMessage(input.chatId, input.prompt);
    if (!userResult.success || !userResult.message) {
      return { success: false, error: userResult.error || '创建用户消息失败' };
    }

    // 3. 创建助手消息
    const assistantResult = await messageDb.createAssistantMessage(input.chatId, modelConfig.model, modelConfig.provider);
    if (!assistantResult.success || !assistantResult.message) {
      return { success: false, error: assistantResult.error || '创建助手消息失败' };
    }

    const assistantMessage = assistantResult.message;

    // 4. 直接从数据库获取聊天记录
    const messageRecords = await messageDb.getChatMessages(input.chatId);

    const relevantRecords = messageRecords.filter((record) => record.id !== assistantMessage.id);
    const nonToolRecords = relevantRecords.filter((record) => record.role !== 'tool');

    const uiMessages = await Promise.all(
      nonToolRecords.map(async (record) => {
        const uiMessage = await recordToUIMessage(record);
        const { id: _id, ...messageWithoutId } = uiMessage;
        return messageWithoutId;
      }),
    );

    const convertedMessages: ModelMessage[] =
      uiMessages.length > 0 ? await convertToModelMessages(uiMessages) : [];

    const modelMessages = buildModelMessages(relevantRecords, convertedMessages);

    const knowledgeBasePath = await getCurrentChatKnowledgeBasePath(input.chatId);
    const knowledgeBaseNotice = knowledgeBasePath ? buildKnowledgeBaseNotice(knowledgeBasePath) : undefined;

    // 注入记忆内容到系统提示
    const memoryStore = useMemoryStore();
    const memoryContent = memoryStore.memoryEnabled && memoryStore.hasMemory
      ? `以下是关于当前用户的记忆信息，请在回复时参考：\n${memoryStore.content}`
      : undefined;

    const mergedSystemPrompt = mergeSystemPrompts(
      mergeSystemPrompts(systemPrompt, memoryContent),
      knowledgeBaseNotice,
    );

    let toolSet: ToolSet | undefined;
    try {
      // 获取内置工具
      const enabledToolIds = await toolDb.getEnabledToolIds();

      // 获取会话的 MCP 工具
      const mcpToolIds = await mcpDb.getChatMcpToolState(input.chatId);

      // 如果有 MCP 工具，确保 MCP 服务已初始化
      if (mcpToolIds.length > 0) {
        await mcpClientService.initialize();
      }

      // 构建包含 MCP 工具的工具集
      toolSet = buildToolSetWithMcp(enabledToolIds, mcpToolIds);
    } catch (error) {
      log.error('加载工具配置失败:', error);
    }

    // 5. 异步处理AI响应（不阻塞返回）
    const summaryConfig = await buildSummaryConfig(modelConfig, input.summaryConfig);

    handleAIStream(
      input.chatId,
      assistantMessage.id,
      modelConfig,
      modelMessages,
      summaryConfig,
      toolSet,
      mergedSystemPrompt
    ).catch((error) => {
      log.error('AI流式响应异步处理失败:', error);
    });

    return {
      success: true,
      userMessage: userResult.message,
      assistantMessage: assistantResult.message,
    };

  } catch (error: any) {
    log.error('发送消息失败:', error);
    return {
      success: false,
      error: error.message || '发送消息失败'
    };
  }
};

export const resendMessage = async (
  input: ResendMessageInput,
): Promise<ResendResult> => {
  try {
    const messageResult = await getMessageById(input.messageId);
    if (!messageResult.success) {
      return { success: false, error: messageResult.error || '获取消息失败' };
    }

    if (!messageResult.exists || !messageResult.message) {
      return { success: false, error: '指定的消息不存在' };
    }

    const allMessagesResult = await getChatMessages(input.chatId);
    if (!allMessagesResult.success || !allMessagesResult.messages) {
      return { success: false, error: allMessagesResult.error || '获取聊天消息失败' };
    }

    const targetMessage = messageResult.message;
    const chatMessages = allMessagesResult.messages;

    const belongsToChat = chatMessages.some((msg) => msg.id === targetMessage.id);
    if (!belongsToChat) {
      return { success: false, error: '消息不属于指定会话' };
    }

    let sourceMessage: Msg | undefined = targetMessage;

    if (targetMessage.role !== 'user') {
      const targetTimestamp = targetMessage.timestamp ?? 0;
      for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
        const candidate = chatMessages[index];
        if ((candidate.timestamp ?? 0) <= targetTimestamp && candidate.role === 'user') {
          sourceMessage = candidate;
          break;
        }
      }
    }

    if (!sourceMessage || sourceMessage.role !== 'user') {
      return { success: false, error: '未找到对应的用户消息' };
    }

    const cutoffTimestamp = sourceMessage.timestamp ?? 0;
    const idsToDelete = chatMessages
      .filter((msg) => (msg.timestamp ?? 0) >= cutoffTimestamp)
      .map((msg) => msg.id);

    for (const id of idsToDelete) {
      const deleteResult = await deleteMessageById(id);
      if (!deleteResult.success) {
        return { success: false, error: deleteResult.error || '删除历史消息失败', deletedMessageIds: idsToDelete };
      }
    }

    const result = await send({
      chatId: input.chatId,
      prompt: sourceMessage.content,
      providerConfig: input.providerConfig,
      summaryConfig: input.summaryConfig,
    });

    return { ...result, deletedMessageIds: idsToDelete };
  } catch (error: any) {
    log.error('重发消息失败:', error);
    return {
      success: false,
      error: error?.message || '重发消息失败',
    };
  }
};
