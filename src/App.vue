<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { useEnvStore } from "@/features/app/useEnvStore.ts";
import { useUpdate } from "@/features/update/useUpdate.ts";
import { useAppShortcuts } from "@/features/app/shortcuts/useAppShortcuts";
import { useTheme } from "@/features/setting/theme/useTheme";
import { Toaster } from "@/components/ui/sonner";
import ChatList from "@/views/Chat/ChatList/ChatList.vue";
import SettingSidebar from "@/views/Setting/SettingSidebar.vue";
import OnboardingDialog from "@/components/OnboardingDialog.vue";
import { useOnboarding } from "@/features/onboarding/useOnboarding";
import { useChatStore } from "@/features/chat/useChatStore";

const envStore = useEnvStore();
const route = useRoute();
const chatStore = useChatStore();

// 使用自定义主题管理
const { currentTheme } = useTheme();

// 初始化应用内快捷键
useAppShortcuts();

// 初始化更新检查
useUpdate();

// 初始化新用户引导
const { initializeOnboarding } = useOnboarding();

const isSettingRoute = computed(() => route.name === "Setting");

// --- 侧边栏拖拽调整宽度 ---
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 480;
const isResizing = ref(false);

function onResizeStart(e: MouseEvent) {
    if (chatStore.isSidebarCollapsed) return;
    e.preventDefault();
    isResizing.value = true;

    const onMouseMove = (ev: MouseEvent) => {
        const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, ev.clientX));
        chatStore.sidebarWidth = newWidth;
    };

    const onMouseUp = () => {
        isResizing.value = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
}



onMounted(async () => {
    // 初始化新用户引导
    initializeOnboarding();

    // Electron 预加载脚本会在收到此消息后移除启动 loading 层
    window.postMessage({ payload: "removeLoading" }, "*");
});

watchEffect(() => {
    const isDark = currentTheme.value === "dark";
    envStore.themeStatus = isDark ? "dark" : "light";

    // Apply dark class to document root for Tailwind dark mode and portaled content
    if (isDark) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
});

watch(
    () => route.fullPath,
    (path) => {
        if (route.name === "Layout" || route.name === "Chat") {
            chatStore.setLastChatRoutePath(path);
        }
    },
    { immediate: true }
);
</script>

<template>
    <div class="w-[100dvw] h-[100dvh] flex bg-bg-100 text-text-100 font-ui overflow-hidden" :class="{ 'select-none': isResizing }">
        <SettingSidebar v-if="isSettingRoute" />
        <template v-else>
            <ChatList :class="{ 'no-transition': isResizing }" />
            <div
                v-if="!chatStore.isSidebarCollapsed"
                class="resize-handle"
                @mousedown="onResizeStart"
            />
        </template>
        <router-view />
    </div>
    <Toaster rich-colors close-button />
    
    <!-- 新用户引导对话框 -->
    <OnboardingDialog />
</template>

<style scoped>
.resize-handle {
    width: 4px;
    cursor: col-resize;
    flex-shrink: 0;
    position: relative;
    z-index: 10;
    transition: background-color 0.15s;
}
.resize-handle:hover,
.resize-handle:active {
    background-color: var(--color-primary, hsl(var(--primary)));
    opacity: 0.5;
}
.no-transition :deep(.side-container) {
    transition: none !important;
}
</style>
