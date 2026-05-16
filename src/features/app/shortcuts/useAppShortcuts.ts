import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { isMacPlatform } from "@/utils/platform";

/**
 * 应用内快捷键管理
 * 用于处理应用内的键盘快捷键，不是全局快捷键
 */
export function useAppShortcuts() {
    const router = useRouter();
    const isMacOS = isMacPlatform;

    /**
     * 处理键盘事件
     */
    function handleKeydown(event: KeyboardEvent) {
        if (event.code !== "KeyN") {
            return;
        }

        const isMacShortcut = isMacOS && event.metaKey && !event.ctrlKey;
        const isCtrlBasedShortcut = !isMacOS && event.ctrlKey && !event.metaKey;

        if (!isMacShortcut && !isCtrlBasedShortcut) {
            return;
        }

        event.preventDefault();
        createNewChat();
    }

    /**
     * 创建新聊天
     */
    async function createNewChat() {
        await router.push({ name: "Layout" });
    }

    /**
     * 初始化快捷键监听
     */
    function initShortcuts() {
        document.addEventListener("keydown", handleKeydown);
    }

    /**
     * 清理快捷键监听
     */
    function cleanupShortcuts() {
        document.removeEventListener("keydown", handleKeydown);
    }

    // 自动管理生命周期
    onMounted(() => {
        initShortcuts();
    });

    onUnmounted(() => {
        cleanupShortcuts();
    });

    return {
        createNewChat,
        initShortcuts,
        cleanupShortcuts,
    };
}
