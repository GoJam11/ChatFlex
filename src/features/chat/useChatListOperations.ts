/**
 * 聊天列表操作 Composable
 * 负责聊天的增删改操作和相关状态管理
 */

import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import { Chat } from '@/types/chat';
import { useChat } from '@/views/Chat/composables/useChat';
import { useChatStore } from '@/features/chat/useChatStore';
import { useEnvStore } from '@/features/app/useEnvStore';

export function useChatListOperations() {
  const router = useRouter();
  const { t } = useI18n();
  const store = useChatStore();
  const envStore = useEnvStore();
  
  // 使用现有的 useChat composable
  const { deleteChatAndSwitch, updateChat } = useChat();

  // 重命名模态框相关状态
  const showRenameModal = ref(false);
  const currentRenameChat = ref<Chat | null>(null);

  /**
   * 删除聊天项
   */
  async function handleDeleteChatItem(item: Chat) {
    const result = await deleteChatAndSwitch(item.id);

    if (result.success) {
      toast.success(t('messages.deleteSuccess'));
    } else {
      const errorMsg = result.error || t('messages.deleteFailed');
      toast.error(errorMsg);
    }
  }

  /**
   * 开始重命名聊天项
   */
  function handleRenameChatItem(item: Chat) {
    currentRenameChat.value = item;
    showRenameModal.value = true;
  }

  /**
   * 确认重命名
   */
  async function handleRenameConfirm(chatId: string, newTitle: string) {
    try {
      const result = await updateChat(chatId, { short: newTitle });

      if (result.success) {
        toast.success(t('messages.renameSuccess'));
      } else {
        throw new Error(result.error || t('messages.updateFailed'));
      }
    } catch (error) {
      console.error('Rename failed:', error);
      toast.error(t('messages.renameFailed'));
    }
  }

  /**
   * 点击聊天项
   */
  async function handleClickChatItem(item: Chat) {
    await router.push({ name: 'Chat', params: { uuid: item.id } });

    // 移动端折叠侧边栏
    if (envStore.isM) {
      store.isSidebarCollapsed = true;
    }
  }

  /**
   * 置顶/取消置顶聊天项
   */
  async function handlePinChatItem(item: Chat) {
    try {
      const newPinnedState = !item.pinned;
      const result = await updateChat(item.id, { pinned: newPinnedState });

      if (result.success) {
        toast.success(newPinnedState ? t('messages.pinSuccess') : t('messages.unpinSuccess'));
      } else {
        throw new Error(result.error || t('messages.updateFailed'));
      }
    } catch (error) {
      console.error('Pin operation failed:', error);
      toast.error(t('messages.pinFailed'));
    }
  }


  return {
    // 状态
    showRenameModal,
    currentRenameChat,
    
    // 方法
    handleDeleteChatItem,
    handleRenameChatItem,
    handleRenameConfirm,
    handleClickChatItem,
    handlePinChatItem,
  };
}