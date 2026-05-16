import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { CREATE_NEW_CHAT } from "@/features/chat/useChatStore.ts";

interface PendingAttachment {
    name: string;
    content: string;
}

export const useEditAreaStore = defineStore("editArea", () => {
    // 状态
    const inputValue = ref("");
    const draftInputs = ref<Record<string, string>>({});
    const currentChatId = ref(CREATE_NEW_CHAT);
    const pendingAttachment = ref<PendingAttachment | null>(null);

    // Getters
    const hasContent = computed(() => {
        return (
            inputValue.value.trim().length > 0 ||
            pendingAttachment.value !== null
        );
    });

    // Actions
    function setInputValue(value: string) {
        inputValue.value = value;
    }

    function setPendingAttachment(attachment: PendingAttachment | null) {
        pendingAttachment.value = attachment;
    }

    function clearInput() {
        inputValue.value = "";
        pendingAttachment.value = null;

        // 清除新会话草稿（处理从草稿状态发送消息的场景）
        delete draftInputs.value[CREATE_NEW_CHAT];

        // 也清除当前会话的草稿（如果与新会话草稿不同）
        if (currentChatId.value !== CREATE_NEW_CHAT) {
            delete draftInputs.value[currentChatId.value];
        }

    }

    // 保存当前输入为草稿
    function saveDraft(chatId: string = currentChatId.value) {
        if (inputValue.value.trim()) {
            draftInputs.value[chatId] = inputValue.value;
        } else {
            // 如果输入为空，删除草稿
            delete draftInputs.value[chatId];
        }
    }

    // 加载草稿
    function loadDraft(chatId: string) {
        currentChatId.value = chatId;
        inputValue.value = draftInputs.value[chatId] || "";
    }

    return {
        // 现有状态和方法
        inputValue,
        draftInputs,
        currentChatId,
        pendingAttachment,
        hasContent,
        setInputValue,
        setPendingAttachment,
        clearInput,
        saveDraft,
        loadDraft,
    };
});
