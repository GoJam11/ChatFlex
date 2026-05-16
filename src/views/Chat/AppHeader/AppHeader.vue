<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementSize } from "@vueuse/core";
import { PanelLeft, PanelRightOpen } from "lucide-vue-next";
import { useI18n } from 'vue-i18n';
import { useChatStore, CREATE_NEW_CHAT } from "@/features/chat/useChatStore.ts";
import { useEnvStore } from "@/features/app/useEnvStore.ts";
import { useUpdate } from "@/features/update/useUpdate.ts";
import { useRoute } from "vue-router";
import { Button } from "@/components/ui/button";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useRouteChat } from "@/features/chat/useRouteChat";
import { useChatList } from "@/features/chat/useChatList";

// ==================== 常量定义 ====================
const DIMENSIONS = {
    ICON_WIDTH: "5rem",           // 图标区域宽度
    TRAFFIC_LIGHTS_WIDTH: "5rem", // Mac信号灯宽度
    COMBINED_WIDTH: "7rem",     // 信号灯 + 图标的总宽度
    DEFAULT_PADDING: "0.5rem",    // 默认内边距
    MOBILE_BREAKPOINT: 728,       // 移动端断点
} as const;

// ==================== 依赖注入 ====================
const route = useRoute();
const store = useChatStore();
const envStore = useEnvStore();
const { t } = useI18n();
const { installUpdate } = useUpdate();
const { chatId } = useRouteChat();
const { chats } = useChatList();

// ==================== DOM引用 ====================
const appHeaderRef = ref<HTMLElement>();
const { width } = useElementSize(appHeaderRef);

// ==================== 环境检测 ====================
const environmentInfo = computed(() => ({
    isMac: !envStore.isWin,
    isElectron: envStore.isElectronEnv,
    isBrowser: !envStore.isElectronEnv,
    isFullscreen: envStore.isFullscreen,
}));

// ==================== 路由状态 ====================
const routeInfo = computed(() => ({
    isChatRoute: route.name === "Layout" || route.name === "Chat",
    isSettingRoute: route.name === "Setting",
    isPromptRoute: route.name === "Prompts",
    isMemoryRoute: route.name === "Memory",
}));

// ==================== 布局状态 ====================
const layoutState = computed(() => ({
    isCollapsed: store.isSidebarCollapsed,
    isCollapsedChatRoute: store.isSidebarCollapsed && routeInfo.value.isChatRoute,
    isCollapsedSettingRoute: store.isSidebarCollapsed && routeInfo.value.isSettingRoute,
    isCollapsedPromptRoute: store.isSidebarCollapsed && routeInfo.value.isPromptRoute,
    isCollapsedMemoryRoute: store.isSidebarCollapsed && routeInfo.value.isMemoryRoute,
}));

const shouldShowRightPanelToggle = computed(() => routeInfo.value.isChatRoute);
const currentChatTitle = computed(() => {
    if (!routeInfo.value.isChatRoute) {
        return "";
    }

    if (chatId.value === CREATE_NEW_CHAT) {
        return t("chat.newChat");
    }

    const chat = chats.value.find((item) => item.id === chatId.value);
    if (!chat?.short?.trim()) {
        return "";
    }

    return chat.short;
});

// ==================== 信号灯状态检测 ====================
const hasTrafficLights = computed(() => {
    const { isMac, isElectron, isFullscreen } = environmentInfo.value;
    return isMac && isElectron && !isFullscreen;
});

// ==================== 样式计算辅助函数 ====================
/**
 * 计算左侧内边距
 * @param hasIcon 是否有左侧图标
 * @param hasTrafficLights 是否有Mac信号灯
 */
function calculateLeftPadding(hasIcon: boolean, hasTrafficLights: boolean): string {
    if (!hasIcon) {
        return DIMENSIONS.DEFAULT_PADDING;
    }

    if (hasTrafficLights) {
        return DIMENSIONS.COMBINED_WIDTH; // 信号灯 + 图标
    }

    return DIMENSIONS.ICON_WIDTH; // 仅图标
}

/**
 * 获取header的内边距样式
 */
const headerStyle = computed(() => {
    const {
        isCollapsedChatRoute,
        isCollapsedSettingRoute,
        isCollapsedPromptRoute,
        isCollapsedMemoryRoute,
        isCollapsed,
    } = layoutState.value;
    const { isSettingRoute, isPromptRoute, isMemoryRoute } = routeInfo.value;

    // 设置/提示词/记忆页面展开状态 - 操作按钮在侧边栏中
    if ((isSettingRoute || isPromptRoute || isMemoryRoute) && !isCollapsed) {
        return {
            paddingLeft: DIMENSIONS.DEFAULT_PADDING,
            paddingRight: DIMENSIONS.DEFAULT_PADDING,
        };
    }

    // 折叠状态下需要为左侧图标预留空间
    const needsIconSpace =
        isCollapsedChatRoute || isCollapsedSettingRoute || isCollapsedPromptRoute || isCollapsedMemoryRoute;

    return {
        paddingLeft: calculateLeftPadding(needsIconSpace, hasTrafficLights.value),
        paddingRight: DIMENSIONS.DEFAULT_PADDING,
    };
});

/**
 * 获取固定定位图标的位置样式
 */
const fixedIconStyle = computed(() => ({
    position: "fixed" as const,
    left: hasTrafficLights.value ? DIMENSIONS.ICON_WIDTH : DIMENSIONS.DEFAULT_PADDING,
}));

/**
 * 将带单位的尺寸转换为 rem（用于居中校准）
 */
function parseRem(value: string): number {
    const trimmed = value.trim();
    if (trimmed.endsWith("rem")) {
        return parseFloat(trimmed);
    }
    if (trimmed.endsWith("px")) {
        return parseFloat(trimmed) / 16;
    }
    const numeric = parseFloat(trimmed);
    return Number.isNaN(numeric) ? 0 : numeric;
}

/**
 * 生成居中内容的平移值，修正左右 padding 差异
 */
const centerTransform = computed(() => {
    const paddingLeft = (headerStyle.value.paddingLeft ?? DIMENSIONS.DEFAULT_PADDING) as string;
    const paddingRight = (headerStyle.value.paddingRight ?? DIMENSIONS.DEFAULT_PADDING) as string;

    const leftRem = parseRem(paddingLeft);
    const rightRem = parseRem(paddingRight);
    const offset = (leftRem - rightRem) / 2;

    if (Math.abs(offset) < 0.01) {
        return "translate(-50%, -50%)";
    }

    const absOffset = Math.abs(offset);
    const formattedOffset = Number.isInteger(absOffset)
        ? `${absOffset}`
        : `${absOffset.toFixed(3).replace(/\.?0+$/, "")}`;
    const operator = offset > 0 ? "-" : "+";

    return `translate(calc(-50% ${operator} ${formattedOffset}rem), -50%)`;
});

/**
 * 是否显示底部边框
 */
const showBorderBottom = computed(() => {
    // 调整为始终展示底部边框，确保桌面宽度下也有分隔感
    return true;
});

// ====================  事件处理函数 ====================
/**
 * 切换侧边栏折叠状态，并在展开时自动调整窗口宽度
 */
async function toggleCollapse() {
    if (store.isSidebarCollapsed) {
        // 展开时检查窗口宽度
        await expandWithWindowAdjustment();
    } else {
        // 收起逻辑保持不变
        store.isSidebarCollapsed = true;
    }
}

/**
 * 展开聊天列表并调整窗口宽度
 */
async function expandWithWindowAdjustment() {
    try {
        if (!envStore.isElectronEnv) {
            console.log('不在桌面环境中，跳过窗口大小调整');
            store.isSidebarCollapsed = false;
            return;
        }

        const appWindow = getCurrentWindow();
        const size = await appWindow.innerSize();
        const scaleFactor = await appWindow.scaleFactor();
        const logicalSize = size.toLogical(scaleFactor);
        const currentSize = { width: logicalSize.width, height: logicalSize.height };

        if (!currentSize.width || !currentSize.height) {
            console.warn('无法获取窗口大小，跳过调整');
            store.isSidebarCollapsed = false;
            return;
        }

        console.log('当前窗口大小:', currentSize);

        if (currentSize.width < 768) {
            console.log('窗口宽度不足768px，开始调整窗口大小');

            // 设置状态标志，防止竞态条件
            store.setAdjustingWindow(true);

            // 调整窗口宽度至768px，保持当前高度
            await appWindow.setSize(new LogicalSize(768, Math.round(currentSize.height)));
            console.log('窗口大小调整完成: 768 x', currentSize.height);

            // 等待一个微小的延迟，确保窗口调整完成
            await new Promise(resolve => setTimeout(resolve, 150));

            // 清除状态标志
            store.setAdjustingWindow(false);
        } else {
            console.log('窗口宽度已足够，无需调整');
        }

        store.isSidebarCollapsed = false;
    } catch (error) {
        console.error('窗口大小调整失败:', error);
        // 清除状态标志
        store.setAdjustingWindow(false);
        // 即使窗口调整失败，仍然展开聊天列表
        store.isSidebarCollapsed = false;
    }
}

/**
 * 处理升级点击
 */
async function handleUpgradeClick() {
    try {
        await installUpdate();
    } catch {
        // 错误处理：可以添加用户通知
    }
}

function toggleRightPanelVisibility() {
    if (!shouldShowRightPanelToggle.value) {
        store.setRightPanelOpen(false);
        return;
    }
    store.toggleRightPanel();
}

// ==================== 升级按钮配置 ====================
const upgradeButtonProps = computed(() => ({
    visible: envStore.updateDownloaded && envStore.isDesktop && !envStore.autoUpdateDisabled,
    loading: envStore.updateInstalling,
    disabled: envStore.updateInstalling,
    text: envStore.updateInstalling ? t('update.upgrading') : t('update.upgrade'),
}));
</script>

<template>
    <div
        ref="appHeaderRef"
        data-tauri-drag-region
        class="flex items-center justify-between h-12 bg-bg-100 transition-colors duration-200"
        :style="headerStyle"
    >
        <!-- 统一布局：左侧操作区 + 右侧操作区 + 居中内容 -->
        <div data-tauri-drag-region class="relative flex items-center w-full min-w-0 gap-2">
            <!-- 左侧操作区 -->
            <div class="flex items-center gap-2 min-w-0">
                <div class="flex items-center z-[999]" :style="fixedIconStyle">
                    <div class="p-1.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors cursor-pointer text-text-300 hover:text-text-100" @click="toggleCollapse">
                        <PanelLeft :size="18" />
                    </div>
                </div>
                <div v-if="routeInfo.isChatRoute" class="min-w-0">
                    <p data-tauri-drag-region class="text-sm font-medium text-text-200 truncate max-w-[50vw] select-none">
                        {{ currentChatTitle }}
                    </p>
                </div>
            </div>

            <!-- 右侧操作区 -->
            <div class="ml-auto flex items-center gap-2 right-actions">
                <div
                    v-if="shouldShowRightPanelToggle"
                    class="p-1.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors cursor-pointer text-text-300 hover:text-text-100"
                    :class="{ 'bg-black/[0.06] dark:bg-white/10 text-text-100': store.isRightPanelOpen }"
                    @click.stop="toggleRightPanelVisibility"
                >
                    <PanelRightOpen :size="18" />
                </div>
                <Button
                    v-if="upgradeButtonProps.visible"
                    size="sm"
                    :disabled="upgradeButtonProps.disabled"
                    class="ml-2 h-7 px-3 rounded-full text-xs font-medium"
                    @click="handleUpgradeClick"
                >
                    {{ upgradeButtonProps.text }}
                </Button>
            </div>
        </div>

    </div>
</template>
