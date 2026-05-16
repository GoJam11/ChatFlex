import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { CREATE_NEW_CHAT } from '@/features/chat/useChatStore'

/**
 * 从路由参数获取聊天ID的composable
 * 用于替代直接监听pinia store的activeChat
 */
export function useRouteChat() {
  const route = useRoute()
  
  // 从路由参数获取聊天ID
  const chatId = computed(() => {
    // 如果是根路径，返回新建聊天标识
    if (route.name === 'Layout') {
      return CREATE_NEW_CHAT
    }
    
    // 如果是聊天路径，返回UUID参数
    if (route.name === 'Chat' && route.params.uuid) {
      return route.params.uuid as string
    }
    
    // 默认返回新建聊天标识
    return CREATE_NEW_CHAT
  })
  
  return {
    chatId
  }
}