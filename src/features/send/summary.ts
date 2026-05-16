/**
 * summary - 消息发送后的会话总结功能
 * 
 * 该文件实现发送消息后的会话总结流程：
 * 1. 检查是否开启了会话总结功能
 * 2. 检查会话是否已有标题（short字段），如果已有则跳过
 * 3. 获取会话的前几条消息
 * 4. 调用AI生成简洁的会话标题
 * 5. 更新会话的short字段
 */

import { generateText, Output } from 'ai';
import type { SharedV2ProviderOptions } from '@ai-sdk/provider';
import { z } from 'zod';
import { createLanguageModel, type ModelConfig } from '@/features/ai/languageModel';
import { useSettingStore } from '@/features/setting/useSettingStore';
import { useProviderService } from '@/features/provider/providerService';
import { resolveProviderBaseUrl } from '@/types/provider';
import { getChatById, updateChat } from '@/features/chat/chatDataAccess';
import { getChatMessages } from '@/features/msg/messageDataAccess';
import { createLogger } from '@/utils/logger';
const log = createLogger('summary');

// 总结输入参数
export interface SummaryInput {
  chatId: string; // 会话ID
  providerConfig?: {
    apiKey?: string;
    baseURL?: string;
    provider: string;
    model: string;
  }; // 可选的供应商配置
}

// 总结结果
export interface SummaryResult {
  success: boolean;
  title?: string;
  error?: string;
}

/**
 * 检查是否应该进行会话总结
 */
const shouldSummarize = async (chatId: string): Promise<{
  should: boolean;
  reason?: string;
}> => {
  try {
    // 1. 检查是否开启了会话总结功能
    const settingStore = useSettingStore();
    if (!settingStore.enableAiSummary) {
      return { should: false, reason: '会话自动总结功能未开启' };
    }

    // 2. 获取会话信息
    const chatResult = await getChatById(chatId);
    if (!chatResult.success) {
      return { should: false, reason: chatResult.error || '获取会话信息失败' };
    }

    if (!chatResult.chat) {
      return { should: false, reason: '会话不存在' };
    }

    const chat = chatResult.chat;

    // 3. 检查会话是否已有标题
    if (chat.short && chat.short.trim() !== '') {
      return { should: false, reason: '会话已有标题' };
    }

    // 4. 检查消息数量是否足够（至少需要2条消息：用户问题+AI回答）
    if ((chat.messageCount || 0) < 2) {
      return { should: false, reason: '消息数量不足，需要至少2条消息' };
    }

    return { should: true };
  } catch (error: any) {
    log.error('检查总结条件失败:', error);
    return { should: false, reason: error.message || '检查失败' };
  }
};

/**
 * 获取用于总结的消息内容
 */
const getMessagesForSummary = async (chatId: string): Promise<{
  success: boolean;
  messages?: Array<{ role: string; content: string }>;
  error?: string;
}> => {
  try {
    // 获取前几条消息用于生成标题（最多取前4条消息）
    const messagesResult = await getChatMessages(chatId);

    if (!messagesResult.success || !messagesResult.messages || messagesResult.messages.length === 0) {
      return {
        success: false,
        error: messagesResult.error || '没有找到消息',
      };
    }

    // 转换为适合AI处理的格式，仅保留用户/助手消息
    const formattedMessages = messagesResult.messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .slice(0, 4)
      .map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content :
                 Array.isArray(msg.content) ?
                 msg.content.map(c => typeof c === 'string' ? c : '[图片]').join(' ') : 
                 '[未知内容]'
      }));

    return { success: true, messages: formattedMessages };
  } catch (error: any) {
    log.error('获取消息失败:', error);
    return { success: false, error: error.message || '获取消息失败' };
  }
};

/**
 * 生成会话标题
 */
const SummarySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '标题为空')
    .max(50, '标题过长'),
});

const TITLE_SYSTEM_PROMPT =
  '你是一名标题助手。请为给定的对话生成一个简洁的中文标题。标题需要 5-15 个字，只描述对话主题，不要包含引号、标点或多余的词。必须严格返回 JSON 对象 {\"title\":\"<标题>\"}，字段名使用英文 title，不要输出任何额外内容。';


const generateTitle = async (
  messages: Array<{ role: string; content: string }>,
  modelConfig: ModelConfig
): Promise<{ success: boolean; title?: string; error?: string }> => {
  try {
    const roleLabel = (role: string) => {
      if (role === 'user') return '用户';
      if (role === 'assistant') return 'AI';
      return '工具';
    };

    const conversationText = messages
      .map((msg) => `${roleLabel(msg.role)}: ${msg.content}`)
      .join('\n\n');

    const model = createLanguageModel(modelConfig);
    const providerOptions = modelConfig.model.toLowerCase().includes('qwen')
      ? ({
          [modelConfig.provider]: {
            enable_thinking: false,
          },
        } satisfies SharedV2ProviderOptions)
      : undefined;

    const result = await generateText({
      model,
      messages: [
        { role: 'system', content: TITLE_SYSTEM_PROMPT },
        { role: 'user', content: conversationText },
      ],
      output: Output.object({
        schema: SummarySchema,
      }),
      temperature: 0.3,
      ...(providerOptions ? { providerOptions } : {}),
    });

    const title = result.output.title
      .replace(/^标题[：:]/, '')
      .replace(/^["']+/, '')
      .replace(/["'\s]+$/g, '')
      .trim();

    if (!title) {
      return { success: false, error: '生成的标题为空' };
    }

    return { success: true, title };
  } catch (error: any) {
    log.error('生成标题失败:', error);
    return { success: false, error: error.message || '生成标题失败' };
  }
};

/**
 * 获取模型配置
 */
const getModelConfig = async (
  providerConfig?: SummaryInput['providerConfig']
): Promise<{
  success: boolean;
  config?: ModelConfig;
  error?: string;
}> => {
  try {
    // 从设置数据库获取总结专用配置
    const settingStore = useSettingStore();
    const providerService = useProviderService();

    await providerService.ready();

    const separateModelEnabled = settingStore.enableSeparateSummaryModel;
    const summaryModel = settingStore.summaryModel?.trim();
    const summaryProvider = settingStore.summaryProvider?.trim();
    const summaryApiKey = settingStore.summaryApiKey ?? undefined;
    const summaryBaseURL = settingStore.summaryBaseURL ?? undefined;
    const currentModel = settingStore.currentModel?.trim();
    const currentProvider = settingStore.currentProvider?.trim();

    const resolvedProvider =
      providerConfig?.provider ||
      (separateModelEnabled
        ? summaryProvider || currentProvider
        : currentProvider || summaryProvider) ||
      'openai';

    const resolvedModel =
      providerConfig?.model ||
      (separateModelEnabled
        ? summaryModel || currentModel
        : currentModel || summaryModel) ||
      'gpt-4o-mini';

    const provider = providerService.getProvider(resolvedProvider);

    const resolvedApiKey =
      providerConfig?.apiKey ||
      (separateModelEnabled
        ? summaryApiKey ?? provider?.apiKey ?? undefined
        : provider?.apiKey ?? undefined);

    const resolvedBaseURL =
      providerConfig?.baseURL ||
      (separateModelEnabled
        ? summaryBaseURL ?? resolveProviderBaseUrl(provider) ?? undefined
        : resolveProviderBaseUrl(provider) ?? undefined);

    const config: ModelConfig = {
      provider: resolvedProvider,
      model: resolvedModel,
      apiKey: resolvedApiKey,
      baseURL: resolvedBaseURL,
      temperature: 0.3, // 总结时使用较低的温度
    };

    return { success: true, config };
  } catch (error: any) {
    log.error('获取模型配置失败:', error);
    return { success: false, error: error.message || '获取模型配置失败' };
  }
};

/**
 * 总结会话的主要方法
 */
export const summarizeConversation = async (
  input: SummaryInput
): Promise<SummaryResult> => {
  try {
    log.info('开始会话总结:', input.chatId);

    // 1. 检查是否应该进行总结
    const shouldCheck = await shouldSummarize(input.chatId);
    if (!shouldCheck.should) {
      log.debug('跳过总结:', shouldCheck.reason);
      return { success: true }; // 不是错误，只是不需要总结
    }

    // 2. 获取模型配置
    const configResult = await getModelConfig(input.providerConfig);
    if (!configResult.success || !configResult.config) {
      return { success: false, error: configResult.error || '获取模型配置失败' };
    }

    // 3. 获取用于总结的消息
    const messagesResult = await getMessagesForSummary(input.chatId);
    if (!messagesResult.success || !messagesResult.messages) {
      return { success: false, error: messagesResult.error || '获取消息失败' };
    }

    // 4. 生成标题
    const titleResult = await generateTitle(messagesResult.messages, configResult.config);
    if (!titleResult.success || !titleResult.title) {
      return { success: false, error: titleResult.error || '生成标题失败' };
    }

    // 5. 更新会话标题
    const updateResult = await updateChat(input.chatId, { short: titleResult.title });
    if (!updateResult.success) {
      return { success: false, error: updateResult.error || '更新会话标题失败' };
    }
    
    log.info('会话总结完成:', titleResult.title);
    
    return { 
      success: true, 
      title: titleResult.title 
    };

  } catch (error: any) {
    log.error('会话总结失败:', error);
    return { 
      success: false, 
      error: error.message || '会话总结失败' 
    };
  }
};

/**
 * 异步总结会话（不阻塞主流程）
 */
export const summarizeConversationAsync = (input: SummaryInput): void => {
  summarizeConversation(input).catch((error) => {
    log.error('异步会话总结失败:', error);
  });
};
