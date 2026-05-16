import { Ref } from "vue";
import { useSettingStore } from "@/features/setting/useSettingStore.ts";
import { isMacPlatform } from "@/utils/platform";

export interface KeyboardHandlersOptions {
    /** 输入框引用 */
    inputRef: Ref<any>;
    /** 获取当前输入值 */
    getCurrentValue: () => string;
    /** 设置输入值 */
    setInputValue: (value: string) => void;
    /** 发送消息的回调 */
    onSend: () => void;
}

/**
 * 键盘事件处理 hooks
 * 处理 Enter 键的换行和发送逻辑
 */
export function useKeyboardHandlers(options: KeyboardHandlersOptions) {
    const { inputRef, getCurrentValue, setInputValue, onSend } = options;
    const settingStore = useSettingStore();

    /**
     * 处理键盘按下事件
     * @param e 键盘事件
     */
    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            const hasModifier = isMacPlatform ? e.metaKey : e.ctrlKey;

            if (settingStore.sendMessageWithModifier) {
                // 设置为 Command/Ctrl+Enter 发送模式
                if (hasModifier) {
                    // Command/Ctrl + Enter: 发送消息
                    e.preventDefault();
                    onSend();
                } else {
                    // 普通 Enter: 插入换行
                    insertNewLine(e);
                }
            } else {
                // 设置为 Enter 发送模式（默认）
                if (hasModifier) {
                    // Command/Ctrl + Enter: 插入换行
                    insertNewLine(e);
                } else {
                    // 普通 Enter: 发送消息
                    e.preventDefault();
                    onSend();
                }
            }
        }
    }

    /**
     * 在光标位置插入换行符
     * @param e 键盘事件
     */
    function insertNewLine(e: KeyboardEvent) {
        // 获取内部 textarea 元素（兼容组件根为 <textarea> 或容器包裹的情况）
        const root = inputRef.value?.$el ?? inputRef.value;
        const textarea: HTMLTextAreaElement | null =
            root instanceof HTMLTextAreaElement
                ? root
                : root?.querySelector?.("textarea") ?? null;

        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = getCurrentValue();
            const newValue =
                `${text.substring(0, start)  }\n${  text.substring(end)}`;

            setInputValue(newValue);

            // 设置光标位置到换行符后
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 1;
            }, 0);
        }
        e.preventDefault();
    }

    return {
        handleKeyDown,
        insertNewLine,
    };
}
