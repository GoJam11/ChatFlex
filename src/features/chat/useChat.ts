/**
 * useChat - 会话数据获取功能
 * 
 * 职责：
 * 1. 从chatDB获取会话配置信息
 * 2. 提供会话级别的模型配置查询
 * 3. 确保数据库作为唯一信源
 */

import { useSettingStore } from '@/features/setting/useSettingStore';
import { CREATE_NEW_CHAT } from '@/features/chat/useChatStore';
import { chatDb } from '@/persistence/ChatDatabase';
import type { Chat, ChatRecord } from '@/types/chat';
import { providerService } from '@/features/provider/providerService';
import { resolveProviderBaseUrl } from '@/types/provider';

/**
 * 获取会话的模型配置
 * @param chatId 会话ID
 * @returns 会话的模型和供应商配置
 */
export const getChatModelConfig = async (chatId: string): Promise<{
  success: boolean;
  model?: string;
  provider?: string;
  error?: string;
}> => {
  try {
    const chatRecord = await chatDb.getChatById(chatId);

    if (!chatRecord) {
      return {
        success: false,
        error: '会话不存在'
      };
    }

    const settingStore = useSettingStore();
    const globalModel = settingStore.currentModel || 'gpt-4o-mini';
    const globalProvider = settingStore.currentProvider || 'openai';

    // 会话级别配置优先，fallback到全局配置
    const model = chatRecord.model || globalModel;
    const provider = chatRecord.provider || globalProvider;

    return {
      success: true,
      model,
      provider
    };
  } catch (error: any) {
    console.error('[useChat] 获取会话模型配置失败:', error);
    return {
      success: false,
      error: error.message || '获取会话模型配置失败'
    };
  }
};

/**
 * 获取会话的完整配置信息
 * @param chatId 会话ID
 * @returns 会话的完整配置
 */
export const getChatConfig = async (chatId: string): Promise<{
  success: boolean;
  chatRecord?: Chat;
  error?: string;
}> => {
  try {
    const chatRecord = await chatDb.getChatById(chatId);

    if (!chatRecord) {
      return {
        success: false,
        error: '会话不存在'
      };
    }

    return {
      success: true,
      chatRecord: toChatObject(chatRecord)
    };
  } catch (error: any) {
    console.error('[useChat] 获取会话配置失败:', error);
    return {
      success: false,
      error: error.message || '获取会话配置失败'
    };
  }
};

/**
 * 验证 provider 配置是否有效
 * @param providerId Provider ID
 * @returns 验证结果
 */
const validateProviderConfig = async (providerId: string): Promise<{
  isValid: boolean;
  error?: string;
}> => {
  await providerService.ready();

  const provider = providerService.getProvider(providerId);

  if (!provider) {
    return {
      isValid: false,
      error: '未找到指定的 AI 服务商。请前往设置页面配置 API。'
    };
  }

  if (!provider.isActive) {
    return {
      isValid: false,
      error: `AI 服务商「${provider.displayName}」未启用。请前往设置页面启用。`
    };
  }

  // 检查是否有 API Key（必需）
  if (!provider.apiKey || provider.apiKey.trim().length === 0) {
    return {
      isValid: false,
      error: `AI 服务商「${provider.displayName}」缺少 API Key。请前往设置页面配置。`
    };
  }

  // 检查是否有 base URL（必需）
  const effectiveBaseUrl = resolveProviderBaseUrl(provider);
  if (!effectiveBaseUrl) {
    return {
      isValid: false,
      error: `AI 服务商「${provider.displayName}」缺少 Base URL。请前往设置页面配置。`
    };
  }

  return { isValid: true };
};

/**
 * 验证模型是否在 provider 的可用模型列表中
 * @param providerId Provider ID
 * @param modelName Model name
 * @returns 验证结果
 */
const validateModelAvailability = async (providerId: string, modelName: string): Promise<{
  isValid: boolean;
  error?: string;
}> => {
  await providerService.ready();

  const provider = providerService.getProvider(providerId);
  if (!provider) {
    return { isValid: false, error: '未找到 AI 服务商' };
  }

  const selectedModels = provider.selectedModels || [];

  if (selectedModels.length === 0) {
    return {
      isValid: false,
      error: `AI 服务商「${provider.displayName}」没有可用的模型。请前往设置页面配置模型。`
    };
  }

  if (!selectedModels.includes(modelName)) {
    return {
      isValid: false,
      error: `模型「${modelName}」在服务商「${provider.displayName}」中不可用。请前往设置页面选择其他模型。`
    };
  }

  return { isValid: true };
};

/**
 * 获取当前应该使用的模型配置（区分新会话和现有会话）
 * @param chatId 会话ID，如果是CREATE_NEW_CHAT则使用全局配置
 * @returns 当前应该使用的模型配置
 */
export const getCurrentModelConfig = async (chatId: string): Promise<{
  success: boolean;
  model?: string;
  provider?: string;
  error?: string;
}> => {
  try {
    let model: string;
    let provider: string;

    // 新建会话：使用全局配置（来自设置存储）
    if (chatId === CREATE_NEW_CHAT) {
      const settingStore = useSettingStore();
      const globalModel = settingStore.currentModel;
      const globalProvider = settingStore.currentProvider;

      // 检查是否有配置
      if (!globalModel || !globalProvider) {
        return {
          success: false,
          error: '请先前往设置页面配置 AI 模型和服务商。'
        };
      }

      model = globalModel;
      provider = globalProvider;
    } else {
      // 现有会话：从数据库获取会话配置
      const configResult = await getChatModelConfig(chatId);
      if (!configResult.success || !configResult.model || !configResult.provider) {
        return {
          success: false,
          error: configResult.error || '会话配置无效'
        };
      }

      model = configResult.model;
      provider = configResult.provider;
    }

    // 验证 provider 配置
    const providerValidation = await validateProviderConfig(provider);
    if (!providerValidation.isValid) {
      return {
        success: false,
        error: providerValidation.error
      };
    }

    // 验证模型可用性
    const modelValidation = await validateModelAvailability(provider, model);
    if (!modelValidation.isValid) {
      return {
        success: false,
        error: modelValidation.error
      };
    }

    return {
      success: true,
      model,
      provider
    };
  } catch (error: any) {
    console.error('[useChat] 获取当前模型配置失败:', error);
    return {
      success: false,
      error: error.message || '获取当前模型配置失败'
    };
  }
};
const toChatObject = (record: ChatRecord): Chat => ({
  id: record.id,
  short: record.short,
  time: record.time,
  lastMsgPreview: record.lastMsgPreview || '',
  lastMsgTime: record.lastMsgTime,
  messageCount: record.messageCount || 0,
  pinned: record.pinned || false,
  systemPrompt: record.systemPrompt,
  historyMsgCount: record.historyMsgCount,
  temperature: record.temperature,
  maxTokens: record.maxTokens,
  topP: record.topP,
  frequencyPenalty: record.frequencyPenalty,
  model: record.model,
  provider: record.provider,
  memoryTable: record.memoryTable,
  reasoningStrength: record.reasoningStrength ?? 'default',
});
