import { useStorage } from "@vueuse/core";
import { ref, readonly } from "vue";
import { defineStore } from "pinia";
import type { Msg } from "@/types/msg";

// 会话状态常量
export const CREATE_NEW_CHAT = "0"; // 创建新会话的标识符（草稿状态）

export type ScrollTarget = "top" | "bottom" | number;

export type ScrollFn = (
    position?: ScrollTarget,
    onlyScrollWhenAtBottom?: boolean
) => void;

export type ChatRightPanelContext =
    | { type: "config" }
    | { type: "toolDetails"; message: Msg; onDelete?: () => void }
    | { type: "thinkingDetails"; message: Msg }
    | { type: "responseSteps"; steps: Msg[]; finalMessage?: Msg };

export const useChatStore = defineStore("chat", () => {
    // --- UI 状态 ---
    const isSidebarCollapsed = useStorage<boolean>(
        "config/isSidebarCollapsed",
        false
    );
    const sidebarWidth = useStorage<number>("config/sidebarWidth", 288);
    const isAdjustingWindow = ref(false);
    const isRightPanelOpen = ref(false);
    const rightPanelContext = ref<ChatRightPanelContext>({ type: "config" });
    const lastChatRoutePath = useStorage<string>("ui/lastChatRoutePath", "/");

    // 按会话管理忙碌状态 (替代原来的全局 isLoading)
    const chatBusyStates = ref(new Map<string, boolean>());

    const scrollTo = ref<ScrollFn>(() => {});

    // --- 会话忙碌状态管理 ---

    function setChatBusy(chatId: string, busy: boolean) {
        if (busy) {
            chatBusyStates.value.set(chatId, true);
        } else {
            chatBusyStates.value.delete(chatId);
        }
    }

    function isChatBusy(chatId: string): boolean {
        return chatBusyStates.value.get(chatId) || false;
    }

    function setAdjustingWindow(adjusting: boolean) {
        isAdjustingWindow.value = adjusting;
    }

    function openRightPanel(context: ChatRightPanelContext) {
        rightPanelContext.value = context;
        isRightPanelOpen.value = true;
    }

    function closeRightPanel() {
        isRightPanelOpen.value = false;
    }

    function setRightPanelOpen(open: boolean) {
        if (open) {
            openRightPanel({ type: "config" });
        } else {
            closeRightPanel();
        }
    }

    function setLastChatRoutePath(path: string) {
        lastChatRoutePath.value = path;
    }

    function toggleRightPanel(context: ChatRightPanelContext = { type: "config" }) {
        if (isRightPanelOpen.value && rightPanelContext.value.type === context.type) {
            closeRightPanel();
        } else {
            openRightPanel(context);
        }
    }

    return {
        // --- 状态 ---
        isSidebarCollapsed,
        sidebarWidth,
        isAdjustingWindow,
        isRightPanelOpen,
        chatBusyStates: readonly(chatBusyStates),

        // --- 会话忙碌状态管理 ---
        setChatBusy,
        isChatBusy,

        // --- UI 相关 ---
        setAdjustingWindow,
        setRightPanelOpen,
        toggleRightPanel,
        openRightPanel,
        closeRightPanel,
        rightPanelContext,
        scrollTo,
        lastChatRoutePath,
        setLastChatRoutePath,
    };
});
