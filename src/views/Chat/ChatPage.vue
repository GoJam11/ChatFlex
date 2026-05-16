<script setup>
import MsgList from "@/views/Chat/MsgList/MsgList.vue";
import EditArea from "@/views/Chat/EditArea/EditArea.vue";
import Home from "@/views/Chat/Home/Home.vue";
import AppHeader from "@/views/Chat/AppHeader/AppHeader.vue";
import SettingContent from "@/views/Setting/SettingContent.vue";
import PromptManager from "@/views/Prompts/PromptManager.vue";
import MemoryPage from "@/views/Memory/MemoryPage.vue";
import { useEnvStore } from "@/features/app/useEnvStore.ts";
import { CREATE_NEW_CHAT } from "@/features/chat/useChatStore.ts";
import { useCurrentModel } from "@/features/currentModel/useCurrentModel";
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useNewChatShortcut } from "@/features/chat/useNewChatShortcut";
import { useMessageList } from "@/features/msg/useMessageList";
import { useRouteChat } from "@/features/chat/useRouteChat";
import { useChatStore } from "@/features/chat/useChatStore.ts";
import ChatSystemPromptPanel from "@/views/Chat/RightPanel/ChatSystemPromptPanel.vue";
import { useModelSelection } from '@/features/model/useModelSelection';

const envStore = useEnvStore();
const { currentModel, setCurrentModelAndProvider } = useCurrentModel();
const { hasModels, allModelWithProvider } = useModelSelection();
const route = useRoute();
const chatStore = useChatStore();

// 获取当前聊天ID
const { chatId } = useRouteChat();

// 使用消息列表管理
const {
    messages: currentMessages,
    isLoading: isLoadingMessages,
    hasLoadedInitialData: hasLoadedMessageList,
} = useMessageList(chatId);

// 计算属性
const hasActiveChat = computed(() => chatId.value !== CREATE_NEW_CHAT);
const isSettingRoute = computed(() => route.name === 'Setting');
const isPromptRoute = computed(() => route.name === 'Prompts');
const isMemoryRoute = computed(() => route.name === 'Memory');
const isNonChatRoute = computed(() => isSettingRoute.value || isPromptRoute.value || isMemoryRoute.value);
const shouldShowInitialMessagePlaceholder = computed(() => {
    return !hasLoadedMessageList.value && !isLoadingMessages.value;
});

const shouldShowLoadingMessages = computed(() => isLoadingMessages.value);

const shouldShowConversation = computed(() => {
    return (
        hasLoadedMessageList.value &&
        hasActiveChat.value &&
        currentMessages.value.length > 0
    );
});

const shouldShowHome = computed(() => {
    return (
        hasLoadedMessageList.value &&
        !isLoadingMessages.value &&
        (!hasActiveChat.value || currentMessages.value.length === 0)
    );
});

const shouldCenterContent = computed(() => shouldShowHome.value);

const isRightPanelVisible = computed(
    () => chatStore.isRightPanelOpen && !isNonChatRoute.value
);

// 新建聊天快捷键 - 依赖EditArea的自动焦点管理
const { handleKeyDown } = useNewChatShortcut();

// 自动选择模型逻辑
onMounted(async () => {
    const currentModelValue = currentModel.value;

    // 如果数据库中没有模型配置，且本地模型列表非空，自动选择第一个模型
    if (
        !currentModelValue &&
        hasModels.value &&
        allModelWithProvider.value.length > 0
    ) {
        const firstModelWithProvider = allModelWithProvider.value[0];
        await setCurrentModelAndProvider(
            firstModelWithProvider.model,
            firstModelWithProvider.provider
        );
    }

    // 添加全局键盘事件监听器
    document.addEventListener("keydown", handleKeyDown);
});

// 组件卸载时清理事件监听器
onUnmounted(() => {
    document.removeEventListener("keydown", handleKeyDown);
});

watch(
    () => isNonChatRoute.value,
    (shouldClosePanel) => {
        if (shouldClosePanel) {
            chatStore.setRightPanelOpen(false);
        }
    }
);
</script>

<template>
    <!-- 右侧布局 min-width:0 重要属性 允许内容收窄 -->
    <div class="flex-grow max-w-[100dvw] h-[100dvh] flex flex-col min-w-0 bg-bg-100 transition-colors duration-200">
        <AppHeader v-if="!isSettingRoute" class="shrink-0" />
        <div class="flex-grow flex flex-col relative overflow-hidden">
            <!-- 设置页面内容 -->
            <template v-if="isSettingRoute">
                <SettingContent />
            </template>
            <template v-else-if="isPromptRoute">
                <PromptManager />
            </template>
            <template v-else-if="isMemoryRoute">
                <MemoryPage />
            </template>

            <!-- 聊天页面内容 -->
            <template v-else>
                <div
                    class="flex-grow flex justify-center h-full overflow-hidden transition-[padding] duration-200"
                    :class="{ 'pr-[320px]': isRightPanelVisible }"
                >
                    <div class="flex flex-col w-full h-full relative">
                        <div
                            class="flex flex-col flex-grow w-full px-4 pb-4 overflow-hidden"
                            :class="{
                                'justify-center': shouldCenterContent,
                                'pt-2': shouldShowHome,
                            }"
                        >
                            <template v-if="shouldShowInitialMessagePlaceholder">
                                <div class="flex-grow" />
                            </template>
                            <template v-else-if="shouldShowLoadingMessages">
                                <div
                                    class="flex justify-center items-center h-full text-text-400"
                                >
                                    Loading...
                                </div>
                            </template>
                            <template v-else>
                                <!-- 有活动会话且消息列表不为空时显示聊天界面 -->
                                <template v-if="shouldShowConversation">
                                    <MsgList />
                                    <EditArea />
                                </template>
                                <!-- 没有活动会话或消息列表为空时显示Home页面 -->
                                <template v-if="shouldShowHome">
                                    <Home />
                                </template>
                            </template>
                        </div>
                    </div>
                    <ChatSystemPromptPanel
                        :is-open="isRightPanelVisible"
                        :chat-id="chatId"
                    />
                </div>
            </template>
        </div>
    </div>
</template>
