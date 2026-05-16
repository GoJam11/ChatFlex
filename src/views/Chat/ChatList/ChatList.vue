<script setup lang="ts">
import { onMounted, computed, ref } from "vue";

import { useI18n } from 'vue-i18n';
import { useEnvStore } from "@/features/app/useEnvStore.ts";
import { useChatStore, CREATE_NEW_CHAT } from "@/features/chat/useChatStore.ts";
import { useChatList } from "@/features/chat/useChatList.ts";
import { useChat } from "@/views/Chat/composables/useChat";
import type { Chat, MemoryEntry } from "@/types/chat.ts";
import ChatItem from "./ChatItem.vue";
import SearchBox from "./SearchBox.vue";
import SidebarOperation from "@/views/Chat/ChatList/SidebarOperation.vue";
import { useRouter, useRoute } from "vue-router";
import { Settings, Sparkles, SquarePen, Brain } from "lucide-vue-next";
import RenameChatModal from "./RenameChatModal.vue";
import { useRouteChat } from "@/features/chat/useRouteChat";
import { useChatSearch } from "@/features/chat/search/useChatSearch";
import { useChatListOperations } from "@/features/chat/useChatListOperations";
import { saveTextFile } from "@/utils/save-file";
import { useMessageStore } from "@/features/msg/useMessageStore";
import { ScrollArea } from '@/components/ui/scroll-area'
import { isMacPlatform } from "@/utils/platform";

const showBottomContent = ref(true);

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

// 使用 composables
const { searchQuery, isSearching, searchResults, searchStats, prepareSearch } = useChatSearch();
const {
    showRenameModal,
    currentRenameChat,
    handleDeleteChatItem,
    handleRenameChatItem,
    handleRenameConfirm,
    handleClickChatItem,
    handlePinChatItem,
} = useChatListOperations();

const store = useChatStore();
const envStore = useEnvStore();
const messageStore = useMessageStore();
const { chatId } = useRouteChat();
const {
    chats,
    isLoading: isLoadingChats,
    hasLoadedInitialData: hasLoadedChatList,
} = useChatList();
const { updateChat } = useChat();

// 计算active状态
// 新建对话按钮点击后不保持active状态
const isNewChatActive = computed(() => false);

const isSettingActive = computed(() => {
    return route.name === 'Setting';
});

const isPromptActive = computed(() => {
    return route.name === 'Prompts';
});

const isMemoryActive = computed(() => {
    return route.name === 'Memory';
});

function handleSettingClick() {
    router.push({ name: "Setting", params: { tab: "api" } });
}

function handlePromptClick() {
    router.push({ name: "Prompts" });
}

function handleMemoryClick() {
    router.push({ name: "Memory" });
}

async function handleNewChatClick() {
    await router.push({ name: "Layout" });
}

function onTransitionLeave() {
    showBottomContent.value = false;
}

function onTransitionEnter() {
    showBottomContent.value = true;
}

// 导出聊天为 txt 格式
async function handleExportChatItem(item: Chat) {
    try {
        // 格式化聊天消息为 txt 格式
        const formatChatToTxt = (chat: Chat): string => {
            const messages = messageStore.getMessages(chat.id);
            let content = `${t('chat.export.chatTitle')}: ${chat.short || t('chat.newChat')}\n`;
            content += `${t('chat.export.createTime')}: ${new Date(chat.time).toLocaleString()}\n`;
            content += `${t('chat.export.messageCount')}: ${messages.length}\n`;
            content += `\n${'='.repeat(50)}\n\n`;
            
            messages.forEach((message, index) => {
                const role = message.role === 'user' ? t('chat.export.user') : t('chat.export.assistant');
                content += `[${index + 1}] ${role}:\n`;
                content += `${message.content}\n\n`;
                content += `${'-'.repeat(30)}\n\n`;
            });
            
            return content;
        };

        const txtContent = formatChatToTxt(item);

        const saved = await saveTextFile(
            `${item.short || t('chat.export.defaultFileName')}.txt`,
            txtContent,
            [{
                name: 'Text files',
                extensions: ['txt']
            }],
            'text/plain'
        );

        if (saved) {
            console.log(t('chat.export.exportSuccess'));
        }
    } catch (error) {
        console.error(t('chat.export.exportFailed'), error);
    }
}


onMounted(() => {
    // 检查初始窗口宽度
    if (window.innerWidth < 768) {
        store.isSidebarCollapsed = true;
    }

    // 会话列表初始化现在由 ChatPage 统一管理，这里不再需要重复调用
});

// 注意：移除了自动折叠的watch监听器以避免与expandWithWindowAdjustment函数的竞争条件
// 侧边栏的展开/折叠现在完全由用户通过AppHeader中的按钮控制

// 时间分类工具函数
function getTimeCategory(timestamp: number): string {
    const now = new Date();
    const chatDate = new Date(timestamp);
    
    // 重置时间到当天的00:00:00以便比较日期
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const chatDateOnly = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());
    
    if (chatDateOnly.getTime() >= today.getTime()) {
        return t('chat.timeCategories.today');
    } else if (chatDateOnly.getTime() >= yesterday.getTime()) {
        return t('chat.timeCategories.yesterday');
    } else if (chatDateOnly.getTime() >= sevenDaysAgo.getTime()) {
        return t('chat.timeCategories.within7Days');
    } else {
        return t('chat.timeCategories.earlier');
    }
}

type MaybeReadonlyChat =
    | Chat
    | (Omit<Chat, 'memoryTable'> & { memoryTable?: ReadonlyArray<MemoryEntry> });

function toMutableChat(chat: MaybeReadonlyChat): Chat {
    const base = { ...(chat as Chat) };
    if (chat.memoryTable) {
        base.memoryTable = [...chat.memoryTable];
    } else if ('memoryTable' in base) {
        base.memoryTable = undefined;
    }
    return base;
}

const chatGroups = computed(() => {
    // 如果有搜索查询，返回扁平列表（不分组）
    if (searchQuery.value.trim()) {
        // 如果正在搜索且还没有结果，显示全部列表（避免闪现空状态）
        const source = isSearching.value && searchResults.value.length === 0
            ? chats.value
            : searchResults.value;

        const sorted = [...source]
            .sort((a, b) => (b.lastMsgTime || b.time) - (a.lastMsgTime || a.time))
            .map(toMutableChat);
        return [{ category: '', chats: sorted }];
    }

    // 显示全部聊天列表，先分离置顶和普通聊天
    const pinnedChats = chats.value.filter(chat => chat.pinned).map(toMutableChat);
    const unpinnedChats = chats.value.filter(chat => !chat.pinned).map(toMutableChat);

    // 置顶聊天按最后消息时间排序，如果没有消息则按创建时间排序
    pinnedChats.sort((a, b) => (b.lastMsgTime || b.time) - (a.lastMsgTime || a.time));
    // 普通聊天按最后消息时间排序，如果没有消息则按创建时间排序
    unpinnedChats.sort((a, b) => (b.lastMsgTime || b.time) - (a.lastMsgTime || a.time));

    // 创建分组
    const groups: { category: string; chats: Chat[] }[] = [];

    // 置顶聊天作为一个特殊组（不显示分类标题）
    if (pinnedChats.length > 0) {
        groups.push({ category: '', chats: pinnedChats });
    }

    // 按分类分组普通聊天
    let currentCategory = '';
    let currentChats: Chat[] = [];

    for (const chat of unpinnedChats) {
        const category = getTimeCategory(chat.lastMsgTime || chat.time);
        if (category !== currentCategory) {
            if (currentChats.length > 0) {
                groups.push({ category: currentCategory, chats: currentChats });
            }
            currentCategory = category;
            currentChats = [chat];
        } else {
            currentChats.push(chat);
        }
    }

    if (currentChats.length > 0) {
        groups.push({ category: currentCategory, chats: currentChats });
    }

    return groups;
});

// 向后兼容：提供扁平的聊天列表
const showChatList = computed(() => {
    return chatGroups.value.flatMap(group => group.chats);
});

const shouldShowInitialPlaceholder = computed(() => {
    return !hasLoadedChatList.value && !isSearching.value;
});

const shouldShowEmptyState = computed(() => {
    return (
        hasLoadedChatList.value &&
        !isLoadingChats.value &&
        !isSearching.value &&
        showChatList.value.length === 0
    );
});

const newChatShortcutKeys = computed(() => (isMacPlatform ? ['⌘', 'N'] : ['Ctrl', 'N']));
</script>

<template>
    <div
        class="side-container flex flex-col h-full flex-shrink-0 overflow-hidden transition-[width] duration-200 bg-bg-200 dark:bg-sidebar dark:border-r dark:border-white/10"
        :style="{ width: store.isSidebarCollapsed ? '0px' : `${store.sidebarWidth}px` }"
    >
        <div
            class="side flex flex-col h-full flex-shrink-0 bg-bg-200 dark:bg-sidebar text-text-100"
            :style="{ width: `${store.sidebarWidth}px` }"
        >
            <div data-tauri-drag-region class="min-h-10" />

            <!-- 新聊天按钮 -->
            <div v-if="!store.isSidebarCollapsed" class="px-3">
                <SidebarOperation
                    :icon="SquarePen"
                    :text="t('chat.newChat')"
                    :shortcut="newChatShortcutKeys"
                    :is-active="isNewChatActive"
                    @click="handleNewChatClick"
                />
            </div>

            <!-- 搜索框 -->
             <div v-if="!store.isSidebarCollapsed" class="px-3 py-2">
                <SearchBox
                    v-model:search-query="searchQuery"
                    :is-searching="isSearching"
                    @focus="prepareSearch"
                />
            </div>

            <!-- 搜索统计信息 -->
            <div
                v-if="searchQuery.trim() && searchStats && !isSearching"
                class="px-3 pb-2"
            >
                <div class="px-3 py-2 bg-bg-200/50 rounded-lg">
                    <p class="text-xs text-text-300">
                        {{ t('chat.searchStats', { count: searchResults.length, time: searchStats.searchTime.toFixed(1) }) }}
                    </p>
                </div>
            </div>

            <ScrollArea class="flex-grow px-3">
                <!-- 初始订阅完成前保持占位 -->
                <div
                    v-if="shouldShowInitialPlaceholder"
                    class="min-h-4"
                />

                <!-- 加载完成且无数据时显示空状态 -->
                <div v-else-if="shouldShowEmptyState" class="p-4 text-center">
                    <div v-if="searchQuery.trim()" class="opacity-0 translate-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-forwards">
                        <p class="text-text-300 mb-2">
                            🔍 {{ t('chat.noSearchResults') }}
                        </p>
                        <p class="text-xs text-text-400">
                            {{ t('chat.tryOtherKeywords') }}
                        </p>
                    </div>
                    <div v-else>
                        <p class="text-text-300">
                            {{ t('chat.noChats') }}
                        </p>
                    </div>
                </div>
                <template v-else>
                    <div class="flex flex-col gap-0.5">
                        <template v-for="group in chatGroups" :key="group.category">
                            <!-- 分类标题 -->
                            <div
                                v-if="group.category"
                                class="px-3 pt-4 pb-1 text-xs font-semibold text-text-300 select-none"
                            >
                                {{ group.category }}
                            </div>
                            
                            <!-- 该分类下的聊天项目 -->
                            <ChatItem
                                v-for="item in group.chats"
                                :key="item.id"
                                :item="item"
                                :is-active="
                                    item.id === chatId && chatId !== CREATE_NEW_CHAT
                                "
                                @click="handleClickChatItem"
                                @rename="handleRenameChatItem"
                                @delete="handleDeleteChatItem"
                                @pin="handlePinChatItem"
                                @export="handleExportChatItem"
                            />
                        </template>
                    </div>
                </template>
            </ScrollArea>

            <transition
                name="fade"
                @leave="onTransitionLeave"
                @after-enter="onTransitionEnter"
            >
                <div
                    v-if="!store.isSidebarCollapsed"
                    class="flex flex-col"
                />
            </transition>

            <div v-if="!store.isSidebarCollapsed" class="px-3 py-2 mt-auto">
                <SidebarOperation
                    :icon="Sparkles"
                    :text="t('prompts.sidebar.myPrompts')"
                    :is-active="isPromptActive"
                    @click="handlePromptClick"
                />
                <SidebarOperation
                    :icon="Brain"
                    :text="t('memory.sidebar.myMemory')"
                    :is-active="isMemoryActive"
                    @click="handleMemoryClick"
                />
                <SidebarOperation
                    :icon="Settings"
                    :text="t('settings.menu.preferences')"
                    :is-active="isSettingActive"
                    @click="handleSettingClick"
                />
            </div>
            <!-- 跳转路由后不再渲染弹窗组件 -->
        </div>

        <!-- 重命名会话模态框 -->
        <RenameChatModal
            v-model:show="showRenameModal"
            :chat-item="currentRenameChat"
            @confirm="handleRenameConfirm"
        />
    </div>
</template>
