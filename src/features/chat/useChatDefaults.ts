import { computed } from "vue";
import { useStorage } from "@vueuse/core";
import type { ReasoningStrength } from "@/types/chat";
import { DEFAULT_HISTORY_MESSAGE_LIMIT } from "@/config/chat";

export interface ChatDefaultsState {
    systemPrompt: string;
    reasoningStrength: ReasoningStrength;
    historyMsgCount?: number;
}

const STORAGE_KEY = "chatflex:chat-defaults";

const defaultState: ChatDefaultsState = {
    systemPrompt: "",
    reasoningStrength: "default",
    historyMsgCount: DEFAULT_HISTORY_MESSAGE_LIMIT,
};

const storage = useStorage<ChatDefaultsState>(
    STORAGE_KEY,
    defaultState,
    undefined,
    {
        mergeDefaults: true,
        writeDefaults: true,
    }
);

export const useChatDefaults = () => {
    const systemPrompt = computed({
        get: () => storage.value.systemPrompt,
        set: (value: string) => {
            if (storage.value.systemPrompt === value) {
                return;
            }
            storage.value = {
                ...storage.value,
                systemPrompt: value,
            };
        },
    });

    const reasoningStrength = computed({
        get: () => storage.value.reasoningStrength,
        set: (value: ReasoningStrength) => {
            if (storage.value.reasoningStrength === value) {
                return;
            }
            storage.value = {
                ...storage.value,
                reasoningStrength: value,
            };
        },
    });

    const historyMsgCount = computed({
        get: () => storage.value.historyMsgCount,
        set: (value: number | undefined) => {
            if (storage.value.historyMsgCount === value) {
                return;
            }
            storage.value = {
                ...storage.value,
                historyMsgCount: value,
            };
        },
    });

    const setDefaults = (patch: Partial<ChatDefaultsState>) => {
        storage.value = {
            ...storage.value,
            ...patch,
        };
    };

    return {
        state: storage,
        systemPrompt,
        reasoningStrength,
        historyMsgCount,
        setDefaults,
    };
};

export const getChatDefaultsSnapshot = (): ChatDefaultsState => ({
    ...storage.value,
});
