import { generateText } from 'ai';
import { createLanguageModel, type ModelConfig } from '@/features/ai/languageModel';
import { useSettingStore } from '@/features/setting/useSettingStore';
import { useProviderService } from '@/features/provider/providerService';
import { resolveProviderBaseUrl } from '@/types/provider';
import { loadAllChats } from '@/features/chat/chatDataAccess';
import { getMessagesForChats } from '@/features/msg/messageDataAccess';
import { useMemoryStore } from './useMemoryStore';
import { createLogger } from '@/utils/logger';

const log = createLogger('memory');

const MAX_RECENT_CHATS = 20;
const MAX_CHAR_PER_MESSAGE = 500;
const MAX_TOTAL_CHARS = 5000;

const GENERATE_SYSTEM_PROMPT = `你是一个记忆助手。请根据用户的聊天历史，提取关于该用户的关键信息，生成一段简洁的记忆摘要。这段记忆将用于在后续对话中帮助 AI 更好地了解用户。

要求：
- 提取用户的偏好、习惯、背景信息、常见需求等
- 使用第三人称（"用户"）描述，例如"用户是一名前端开发者"、"用户偏好使用 TypeScript"
- 简洁明了，按要点分行
- 不要包含具体的对话内容，只提取有价值的用户特征
- 总长度控制在 500 字以内`;

const UPDATE_SYSTEM_PROMPT = `你是一个记忆助手。请根据已有的记忆和新的聊天历史，更新关于该用户的记忆摘要。这段记忆将用于在后续对话中帮助 AI 更好地了解用户。

要求：
- 保留已有记忆中仍然有效的信息
- 整合新聊天中发现的用户特征
- 如果新信息与旧信息矛盾，以新信息为准
- 使用第三人称（"用户"）描述，例如"用户是一名前端开发者"、"用户偏好使用 TypeScript"
- 简洁明了，按要点分行
- 总长度控制在 500 字以内`;

async function getModelConfig(): Promise<ModelConfig> {
  const settingStore = useSettingStore();
  const providerService = useProviderService();
  await providerService.ready();

  const separateMemoryModel = settingStore.enableSeparateMemoryModel;
  const memoryModel = settingStore.memoryModel?.trim();
  const memoryProvider = settingStore.memoryProvider?.trim();
  const currentModel = settingStore.currentModel?.trim();
  const currentProvider = settingStore.currentProvider?.trim();

  const resolvedProvider =
    (separateMemoryModel
      ? memoryProvider || currentProvider
      : currentProvider) || 'openai';

  const resolvedModel =
    (separateMemoryModel
      ? memoryModel || currentModel
      : currentModel) || 'gpt-4o-mini';

  const provider = providerService.getProvider(resolvedProvider);

  const resolvedApiKey = provider?.apiKey ?? undefined;
  const resolvedBaseURL = resolveProviderBaseUrl(provider) ?? undefined;

  return {
    provider: resolvedProvider,
    model: resolvedModel,
    apiKey: resolvedApiKey,
    baseURL: resolvedBaseURL,
    temperature: 0.3,
  };
}

async function collectUserMessages(): Promise<string> {
  const chatsResult = await loadAllChats();
  if (!chatsResult.success || !chatsResult.chats || chatsResult.chats.length === 0) {
    throw new Error('NO_CHATS');
  }

  const recentChats = [...chatsResult.chats]
    .sort((a, b) => (b.lastMsgTime ?? b.time ?? 0) - (a.lastMsgTime ?? a.time ?? 0))
    .slice(0, MAX_RECENT_CHATS);

  const chatIds = recentChats.map((c) => c.id);
  const messagesResult = await getMessagesForChats(chatIds);
  if (!messagesResult.success || !messagesResult.messagesByChat) {
    throw new Error('NO_CHATS');
  }

  const userTexts: string[] = [];
  let totalChars = 0;

  for (const chatId of chatIds) {
    const msgs = messagesResult.messagesByChat[chatId];
    if (!msgs) continue;

    for (const msg of msgs) {
      if (msg.role !== 'user') continue;

      const text = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((c) => (typeof c === 'string' ? c : '')).join(' ')
          : '';

      if (!text.trim()) continue;

      const truncated = text.length > MAX_CHAR_PER_MESSAGE
        ? text.slice(0, MAX_CHAR_PER_MESSAGE) + '...'
        : text;

      if (totalChars + truncated.length > MAX_TOTAL_CHARS) break;
      userTexts.push(truncated);
      totalChars += truncated.length;
    }

    if (totalChars >= MAX_TOTAL_CHARS) break;
  }

  if (userTexts.length === 0) {
    throw new Error('NO_CHATS');
  }

  return userTexts.join('\n---\n');
}

export async function generateMemory(): Promise<void> {
  const memoryStore = useMemoryStore();
  memoryStore.isGenerating = true;

  try {
    const modelConfig = await getModelConfig();
    if (!modelConfig.model || (!modelConfig.apiKey && modelConfig.provider !== 'ollama')) {
      throw new Error('NO_MODEL_CONFIG');
    }

    const userMessages = await collectUserMessages();
    const existingMemory = memoryStore.content;
    const isUpdate = existingMemory.trim().length > 0;

    const systemPrompt = isUpdate ? UPDATE_SYSTEM_PROMPT : GENERATE_SYSTEM_PROMPT;
    const userPrompt = isUpdate
      ? `已有记忆：\n${existingMemory}\n\n新的聊天记录中用户的发言：\n${userMessages}`
      : `以下是用户最近的聊天发言：\n${userMessages}`;

    const model = createLanguageModel(modelConfig);

    const result = await generateText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    const memoryText = result.text.trim();
    if (memoryText) {
      memoryStore.setMemory(memoryText);
    }

    log.info('记忆生成完成');
  } finally {
    memoryStore.isGenerating = false;
  }
}
