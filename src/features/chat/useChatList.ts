/**
 * useChatList - 聊天列表管理 Composable
 * 
 * 使用 Dexie liveQuery 实现响应式聊天列表订阅
 * 职责：
 * 1. 订阅聊天列表数据
 * 2. 自动响应数据库变化
 * 3. 提供聊天列表的响应式数据
 */

import { ref, computed, onUnmounted, readonly } from 'vue';
import type { Subscription } from 'dexie';
import type { Chat } from '@/types/chat';
import { subscribeToChatList } from '@/features/chat/chatDataAccess';

export function useChatList() {
  const chats = ref<Chat[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const hasLoadedInitialData = ref(false);

  // 使用 liveQuery 订阅聊天列表变化
  let subscription: Subscription | null = null;

  const subscribeToChats = (options?: { skipLoading?: boolean }) => {
    // 清理之前的订阅
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }

    const shouldSkipLoading = options?.skipLoading ?? !hasLoadedInitialData.value;

    if (!shouldSkipLoading) {
      isLoading.value = true;
    } else {
      isLoading.value = false;
    }
    error.value = null;

    try {
      // 使用 liveQuery 订阅数据库变化
      subscription = subscribeToChatList({
        next: (chatItems) => {
          chats.value = chatItems;
          isLoading.value = false;
          error.value = null;
          hasLoadedInitialData.value = true;
        },
        error: (err) => {
          console.error('[useChatList] 订阅聊天列表失败:', err);
          error.value = (err as Error).message || '获取聊天列表失败';
          isLoading.value = false;
          chats.value = [];
          hasLoadedInitialData.value = true;
        }
      });
    } catch (err: any) {
      console.error('[useChatList] 创建订阅失败:', err);
      error.value = err.message || '创建订阅失败';
      isLoading.value = false;
      chats.value = [];
      hasLoadedInitialData.value = true;
    }
  };

  // 立即开始订阅
  subscribeToChats({ skipLoading: true });

  // 组件卸载时清理订阅
  onUnmounted(() => {
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
  });

  // 计算属性：聊天数量
  const chatCount = computed(() => chats.value.length);

  // 计算属性：是否有聊天
  const hasChats = computed(() => chatCount.value > 0);

  // 计算属性：最新聊天
  const latestChat = computed(() => {
    if (chats.value.length === 0) return null;
    return chats.value[0];
  });

  return {
    // 响应式数据
    chats: readonly(chats),
    isLoading: readonly(isLoading),
    error: readonly(error),
    hasLoadedInitialData: readonly(hasLoadedInitialData),

    // 计算属性
    chatCount,
    hasChats,
    latestChat,

    // 方法
    refresh: () => subscribeToChats({ skipLoading: false }),
  };
}
