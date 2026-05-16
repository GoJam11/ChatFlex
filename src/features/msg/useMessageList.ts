/**
 * useMessageList - 消息列表管理 Composable
 * 
 * 使用 Dexie liveQuery 实现响应式消息列表订阅
 * 职责：
 * 1. 订阅指定会话的消息列表
 * 2. 自动响应数据库变化
 * 3. 提供消息列表的响应式数据
 */

import { ref, computed, watch, onUnmounted, type Ref } from 'vue';
import type { Msg } from '@/types/msg';
import { CREATE_NEW_CHAT } from '@/features/chat/useChatStore';
import { subscribeToChatMessages } from '@/features/msg/messageDataAccess';

export function useMessageList(chatId: Ref<string>) {
  const messages = ref<Msg[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const hasLoadedInitialData = ref(false);

  // 使用 liveQuery 订阅消息变化
  let subscription: ReturnType<typeof subscribeToChatMessages> = null;
  let hasSubscribedOnce = false;
  let lastSubscribedChatId: string | null = null;

  const subscribeToMessages = (currentChatId: string) => {
    // 清理之前的订阅
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }

    // 如果是新建会话草稿，清空消息列表
    if (!currentChatId || currentChatId === CREATE_NEW_CHAT) {
      messages.value = [];
      isLoading.value = false;
      error.value = null;
      hasLoadedInitialData.value = true;
      lastSubscribedChatId = currentChatId;
      return;
    }

    const shouldSkipLoading = !hasSubscribedOnce;
    hasSubscribedOnce = true;

    // 订阅新会话前清理旧数据，避免展示上一会话的消息
    if (lastSubscribedChatId !== currentChatId) {
      messages.value = [];
    }
    lastSubscribedChatId = currentChatId;

    if (!shouldSkipLoading) {
      isLoading.value = true;
    } else {
      isLoading.value = false;
    }
    error.value = null;
    hasLoadedInitialData.value = false;

    try {
      // 使用 liveQuery 订阅数据库变化
      subscription = subscribeToChatMessages(currentChatId, {
        next: (chatMessages) => {
          messages.value = chatMessages;
          isLoading.value = false;
          error.value = null;
          hasLoadedInitialData.value = true;
        },
        error: (err) => {
          console.error('[useMessageList] 订阅消息失败:', err);
          error.value = (err as Error).message || '获取消息失败';
          isLoading.value = false;
          messages.value = [];
          hasLoadedInitialData.value = true;
        }
      });
    } catch (err: any) {
      console.error('[useMessageList] 创建订阅失败:', err);
      error.value = err.message || '创建订阅失败';
      isLoading.value = false;
      messages.value = [];
      hasLoadedInitialData.value = true;
    }
  };

  // 监听 chatId 变化
  watch(
    chatId,
    (newChatId) => {
      subscribeToMessages(newChatId);
    },
    { immediate: true }
  );

  // 组件卸载时清理订阅
  onUnmounted(() => {
    subscription?.unsubscribe();
    subscription = null;
  });

  // 计算属性：消息数量
  const messageCount = computed(() => messages.value.length);

  // 计算属性：是否有消息
  const hasMessages = computed(() => messageCount.value > 0);

  // 计算属性：最新消息
  const latestMessage = computed(() => {
    if (messages.value.length === 0) return null;
    return messages.value[messages.value.length - 1];
  });

  return {
    // 响应式数据
    messages,
    isLoading,
    error,
    hasLoadedInitialData,

    // 计算属性
    messageCount,
    hasMessages,
    latestMessage,
    
    // 方法
    refresh: () => subscribeToMessages(chatId.value),
  };
}
