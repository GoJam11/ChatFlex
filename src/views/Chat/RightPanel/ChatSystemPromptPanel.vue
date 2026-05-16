<script setup lang="ts">
import { Text, computed, onBeforeUnmount, ref, watch } from "vue";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Plus, Trash2, X } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { CREATE_NEW_CHAT, useChatStore } from "@/features/chat/useChatStore";
import { getChatById } from "@/features/chat/chatDataAccess";
import { useChatConfig } from "@/features/chat/useChatConfig";
import { useChatDefaults } from "@/features/chat/useChatDefaults";
import { DEFAULT_HISTORY_MESSAGE_LIMIT } from "@/config/chat";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import MsgContent from "@/views/Chat/MsgItem/MsgContent.vue";
import { contentToString } from "@/utils/messageUtils";
import { useRemarkRenderer } from "@/views/Chat/MsgItem/useRemarkRenderer.ts";
import { MessageStatus } from "@/types/msg";
import type { MemoryEntry, ReasoningStrength } from "@/types/chat";

type ReasoningStrengthOption = ReasoningStrength;
type MemoryEntryForm = MemoryEntry;

const props = defineProps<{
    isOpen: boolean;
    chatId: string;
}>();

const chatStore = useChatStore();
const { updateChatConfig } = useChatConfig();
const { t } = useI18n();

const systemPrompt = ref("");
const initialPrompt = ref("");
const reasoningStrength = ref<ReasoningStrengthOption>("default");
const initialReasoningStrength = ref<ReasoningStrengthOption>("default");
const historyMsgCount = ref<number | undefined>(undefined);
const initialHistoryMsgCount = ref<number | undefined>(undefined);
const temperature = ref<number | undefined>(undefined);
const initialTemperature = ref<number | undefined>(undefined);
const maxTokens = ref<number | undefined>(undefined);
const initialMaxTokens = ref<number | undefined>(undefined);
const topP = ref<number | undefined>(undefined);
const initialTopP = ref<number | undefined>(undefined);
const frequencyPenalty = ref<number | undefined>(undefined);
const initialFrequencyPenalty = ref<number | undefined>(undefined);
const memoryTable = ref<MemoryEntryForm[]>([]);
const initialMemorySnapshot = ref("[]");

const isLoading = ref(false);
const isSaving = ref(false);
const loadError = ref<string | null>(null);
const isInitialized = ref(false);

const chatDefaults = useChatDefaults();
const isNewChat = computed(() => props.chatId === CREATE_NEW_CHAT);
const canEdit = computed(() => !!props.chatId);
const panelContext = computed(() => chatStore.rightPanelContext);
const isConfigView = computed(() => panelContext.value.type === "config");
const isToolDetailsView = computed(() => panelContext.value.type === "toolDetails");
const isThinkingDetailsView = computed(
    () => panelContext.value.type === "thinkingDetails"
);
const isResponseStepsView = computed(
    () => panelContext.value.type === "responseSteps"
);

const toolMessage = computed(() =>
    panelContext.value.type === "toolDetails"
        ? panelContext.value.message
        : null
);
const toolDeleteHandler = computed(() =>
    panelContext.value.type === "toolDetails"
        ? panelContext.value.onDelete
        : undefined
);
const toolName = computed(() =>
    toolMessage.value?.toolInvocation?.toolName
        ?? t("chat.toolMessage.defaultName")
);
const toolPanelTitle = computed(() =>
    t("chat.toolMessage.sheetTitle", { name: toolName.value })
);
const toolCallId = computed(
    () => toolMessage.value?.toolInvocation?.toolCallId ?? ""
);
const toolPreviewText = computed(() => {
    if (!toolMessage.value) {
        return "";
    }
    const raw = contentToString(toolMessage.value.content) ?? "";
    const singleLine = raw.replace(/\s+/g, " ").trim();
    return singleLine || t("chat.toolMessage.emptyPreview");
});

const { renderMarkdown } = useRemarkRenderer();
const textNodeType = Text;

const thinkingMessage = computed(() =>
    panelContext.value.type === "thinkingDetails"
        ? panelContext.value.message
        : null
);
const isThinkContentFlowing = computed(() => {
    const message = thinkingMessage.value;
    if (!message) {
        return false;
    }
    const hasThinkContent = !!message.thinkContent;
    const status = message.status;
    const flowing =
        status === MessageStatus.THINKING
        || status === MessageStatus.GENERATING
        || status === MessageStatus.WAITING;
    return hasThinkContent && flowing;
});
const renderedThinkContent = computed(() => {
    const message = thinkingMessage.value;
    return renderMarkdown(message?.thinkContent ?? "", isThinkContentFlowing.value);
});
const shouldShowCursor = computed(() => {
    const message = thinkingMessage.value;
    if (!isThinkContentFlowing.value || !message) {
        return false;
    }
    const content = message.thinkContent ?? "";
    if (!content) {
        return true;
    }
    return !content.includes("</think>");
});
const thinkingStatusLabel = computed(() => {
    const message = thinkingMessage.value;
    if (!message) {
        return "";
    }
    switch (message.status) {
        case MessageStatus.WAITING:
            return t("chat.thinkingBlock.waitingResponse");
        case MessageStatus.THINKING:
            return t("chat.thinking");
        case MessageStatus.GENERATING:
            return t("chat.generating");
        case MessageStatus.COMPLETED:
            return t("chat.thinkingBlock.completed");
        case MessageStatus.ERROR:
            return t("common.error");
        default:
            return t("chat.thinking");
    }
});

const responseSteps = computed(() =>
    panelContext.value.type === "responseSteps"
        ? panelContext.value.steps
        : []
);

const panelTitle = computed(() => {
    switch (panelContext.value.type) {
        case "toolDetails":
            return toolPanelTitle.value;
        case "thinkingDetails":
            return t("chat.thinkingBlock.title");
        case "responseSteps":
            return t("chat.agentSteps.detailTitle");
        default:
            return t("chat.config.title");
    }
});

const panelSubtitle = computed(() => {
    if (panelContext.value.type === "toolDetails" && toolCallId.value) {
        return `${t("chat.toolMessage.callId")} ${toolCallId.value}`;
    }
    if (panelContext.value.type === "thinkingDetails") {
        return thinkingStatusLabel.value;
    }
    if (panelContext.value.type === "responseSteps") {
        return t("chat.agentSteps.stepCount", { count: responseSteps.value.length });
    }
    return "";
});

const panelHasDivider = computed(() => panelContext.value.type !== "config");

let activeRequest = 0;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function clearSaveTimer() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
}

function sanitizeMemoryEntries(entries: MemoryEntryForm[]): MemoryEntryForm[] {
    return entries
        .map((entry) => ({
            keyword: entry.keyword?.trim() ?? "",
            content: entry.content?.trim() ?? "",
        }))
        .filter((entry) => entry.keyword.length > 0 && entry.content.length > 0);
}

function createMemorySnapshot(entries: MemoryEntryForm[] = memoryTable.value): string {
    return JSON.stringify(sanitizeMemoryEntries(entries));
}

function applyDefaults() {
    const defaults = chatDefaults.state.value;
    const prompt = defaults.systemPrompt?.trim() ?? "";
    const strength = defaults.reasoningStrength ?? "default";
    const defaultHistoryCount =
        defaults.historyMsgCount ?? DEFAULT_HISTORY_MESSAGE_LIMIT;

    systemPrompt.value = prompt;
    initialPrompt.value = prompt;
    reasoningStrength.value = strength;
    initialReasoningStrength.value = strength;

    historyMsgCount.value = defaultHistoryCount;
    initialHistoryMsgCount.value = defaultHistoryCount;
    temperature.value = undefined;
    initialTemperature.value = undefined;
    maxTokens.value = undefined;
    initialMaxTokens.value = undefined;
    topP.value = undefined;
    initialTopP.value = undefined;
    frequencyPenalty.value = undefined;
    initialFrequencyPenalty.value = undefined;

    memoryTable.value = [];
    initialMemorySnapshot.value = createMemorySnapshot([]);
}

function applyChatConfig(chat: {
    systemPrompt?: string | null;
    reasoningStrength?: ReasoningStrength | null;
    historyMsgCount?: number | null;
    temperature?: number | null;
    maxTokens?: number | null;
    topP?: number | null;
    frequencyPenalty?: number | null;
    memoryTable?: MemoryEntry[] | null;
}) {
    const prompt = chat.systemPrompt?.trim() ?? "";
    const strength = chat.reasoningStrength ?? "default";

    systemPrompt.value = prompt;
    initialPrompt.value = prompt;
    reasoningStrength.value = strength;
    initialReasoningStrength.value = strength;

    historyMsgCount.value = chat.historyMsgCount ?? undefined;
    initialHistoryMsgCount.value = chat.historyMsgCount ?? undefined;
    temperature.value = chat.temperature ?? undefined;
    initialTemperature.value = chat.temperature ?? undefined;
    maxTokens.value = chat.maxTokens ?? undefined;
    initialMaxTokens.value = chat.maxTokens ?? undefined;
    topP.value = chat.topP ?? undefined;
    initialTopP.value = chat.topP ?? undefined;
    frequencyPenalty.value = chat.frequencyPenalty ?? undefined;
    initialFrequencyPenalty.value = chat.frequencyPenalty ?? undefined;

    const entries = Array.isArray(chat.memoryTable)
        ? chat.memoryTable.map((entry) => ({
              keyword: entry.keyword ?? "",
              content: entry.content ?? "",
          }))
        : [];
    memoryTable.value = entries;
    initialMemorySnapshot.value = createMemorySnapshot(entries);
}

async function fetchChatConfig(chatId: string, requestId: number) {
    isLoading.value = true;
    loadError.value = null;
    isInitialized.value = false;

    try {
        const result = await getChatById(chatId);
        if (requestId !== activeRequest) {
            return;
        }

        if (result.success && result.chat) {
            applyChatConfig(result.chat);
            isInitialized.value = true;
        } else {
            loadError.value = result.error || t("messages.loadingFailed");
        }
    } catch (error: unknown) {
        if (requestId === activeRequest) {
            const message = error instanceof Error ? error.message : String(error);
            loadError.value = message || t("messages.loadingFailed");
        }
    } finally {
        if (requestId === activeRequest) {
            isLoading.value = false;
        }
    }
}

watch(
    () => ({
        open: props.isOpen,
        chatId: props.chatId,
        view: panelContext.value.type,
    }),
    async ({ open, chatId, view }, previous) => {
        if (view !== "config") {
            if (previous?.view === "config") {
                await runAutoSave(false);
                clearSaveTimer();
            }
            return;
        }

        const requestId = ++activeRequest;

        if (!open || !chatId) {
            if (requestId === activeRequest) {
                if (!open) {
                    await runAutoSave(false);
                }
                isLoading.value = false;
                isInitialized.value = false;
                if (!open) {
                    loadError.value = null;
                    clearSaveTimer();
                }
            }
            return;
        }

        clearSaveTimer();
        isInitialized.value = false;

        if (chatId === CREATE_NEW_CHAT) {
            applyDefaults();
            if (requestId === activeRequest) {
                isLoading.value = false;
                loadError.value = null;
                isInitialized.value = true;
            }
            return;
        }

        await fetchChatConfig(chatId, requestId);
    },
    { immediate: true }
);

async function handleRetry() {
    if (!props.isOpen || !props.chatId || panelContext.value.type !== "config") {
        return;
    }

    if (isNewChat.value) {
        applyDefaults();
        loadError.value = null;
        return;
    }

    const requestId = ++activeRequest;
    await fetchChatConfig(props.chatId, requestId);
}

function handleToolCopy() {
    const message = toolMessage.value;
    if (!message) {
        return;
    }
    const text = contentToString(message.content);
    if (!text) {
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        toast.success(t("chat.toolMessage.copySuccess"));
    });
}

function handleToolDelete() {
    if (toolDeleteHandler.value) {
        toolDeleteHandler.value();
    }
    chatStore.closeRightPanel();
}

function addMemoryEntry() {
    memoryTable.value = [
        ...memoryTable.value,
        { keyword: "", content: "" },
    ];
}

function removeMemoryEntry(index: number) {
    memoryTable.value = memoryTable.value.filter((_, itemIndex) => itemIndex !== index);
}

function sanitizeNumericValue(value: number | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    return Number.isFinite(value) ? value : undefined;
}

function toOptionalNumber(value: number | undefined): number | undefined {
    return sanitizeNumericValue(value);
}

function hasPendingChanges(): boolean {
    return (
        systemPrompt.value !== initialPrompt.value ||
        reasoningStrength.value !== initialReasoningStrength.value ||
        historyMsgCount.value !== initialHistoryMsgCount.value ||
        temperature.value !== initialTemperature.value ||
        maxTokens.value !== initialMaxTokens.value ||
        topP.value !== initialTopP.value ||
        frequencyPenalty.value !== initialFrequencyPenalty.value ||
        createMemorySnapshot() !== initialMemorySnapshot.value
    );
}

async function persistChanges() {
    if (!canEdit.value) {
        return;
    }

    const trimmedPrompt = systemPrompt.value.trim();
    const payloadPrompt = trimmedPrompt.length > 0 ? trimmedPrompt : "";
    const selectedStrength = reasoningStrength.value;
    const sanitizedEntries = sanitizeMemoryEntries(memoryTable.value);

    const payload = {
        systemPrompt: payloadPrompt,
        reasoningStrength: selectedStrength,
        historyMsgCount: toOptionalNumber(historyMsgCount.value),
        temperature: toOptionalNumber(temperature.value),
        maxTokens: toOptionalNumber(maxTokens.value),
        topP: toOptionalNumber(topP.value),
        frequencyPenalty: toOptionalNumber(frequencyPenalty.value),
        memoryTable: sanitizedEntries,
    };

    if (isNewChat.value) {
        chatDefaults.setDefaults({
            systemPrompt: payloadPrompt,
            reasoningStrength: selectedStrength,
            historyMsgCount: sanitizeNumericValue(historyMsgCount.value),
        });

        systemPrompt.value = payloadPrompt;
        initialPrompt.value = payloadPrompt;
        reasoningStrength.value = selectedStrength;
        initialReasoningStrength.value = selectedStrength;

        historyMsgCount.value = sanitizeNumericValue(historyMsgCount.value);
        initialHistoryMsgCount.value = historyMsgCount.value;
        temperature.value = sanitizeNumericValue(temperature.value);
        initialTemperature.value = temperature.value;
        maxTokens.value = sanitizeNumericValue(maxTokens.value);
        initialMaxTokens.value = maxTokens.value;
        topP.value = sanitizeNumericValue(topP.value);
        initialTopP.value = topP.value;
        frequencyPenalty.value = sanitizeNumericValue(frequencyPenalty.value);
        initialFrequencyPenalty.value = frequencyPenalty.value;
        memoryTable.value = sanitizedEntries;
        initialMemorySnapshot.value = createMemorySnapshot(sanitizedEntries);
        return;
    }

    const result = await updateChatConfig(props.chatId, payload);

    if (!result.success) {
        throw new Error(result.error || t("messages.updateFailed"));
    }

    systemPrompt.value = payloadPrompt;
    initialPrompt.value = payloadPrompt;
    reasoningStrength.value = selectedStrength;
    initialReasoningStrength.value = selectedStrength;

    historyMsgCount.value = sanitizeNumericValue(historyMsgCount.value);
    initialHistoryMsgCount.value = historyMsgCount.value;
    temperature.value = sanitizeNumericValue(temperature.value);
    initialTemperature.value = temperature.value;
    maxTokens.value = sanitizeNumericValue(maxTokens.value);
    initialMaxTokens.value = maxTokens.value;
    topP.value = sanitizeNumericValue(topP.value);
    initialTopP.value = topP.value;
    frequencyPenalty.value = sanitizeNumericValue(frequencyPenalty.value);
    initialFrequencyPenalty.value = frequencyPenalty.value;

    memoryTable.value = sanitizedEntries;
    initialMemorySnapshot.value = createMemorySnapshot(sanitizedEntries);
}

async function runAutoSave(allowReschedule = true) {
    if (!isInitialized.value || isSaving.value || !hasPendingChanges()) {
        return;
    }

    isSaving.value = true;

    try {
        await persistChanges();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(message || t("messages.updateFailed"));
    } finally {
        isSaving.value = false;

        if (allowReschedule && isInitialized.value && hasPendingChanges()) {
            scheduleAutoSave();
        }
    }
}

function scheduleAutoSave() {
    if (!isInitialized.value) {
        return;
    }

    if (!hasPendingChanges()) {
        return;
    }

    clearSaveTimer();
    saveTimeout = setTimeout(() => {
        saveTimeout = null;
        void runAutoSave();
    }, 300);
}

function handleClose() {
    chatStore.closeRightPanel();
}

watch(historyMsgCount, (value) => {
    if (typeof value === "number" && Number.isNaN(value)) {
        historyMsgCount.value = undefined;
    }
});
watch(temperature, (value) => {
    if (typeof value === "number" && Number.isNaN(value)) {
        temperature.value = undefined;
    }
});
watch(maxTokens, (value) => {
    if (typeof value === "number" && Number.isNaN(value)) {
        maxTokens.value = undefined;
    }
});
watch(topP, (value) => {
    if (typeof value === "number" && Number.isNaN(value)) {
        topP.value = undefined;
    }
});
watch(frequencyPenalty, (value) => {
    if (typeof value === "number" && Number.isNaN(value)) {
        frequencyPenalty.value = undefined;
    }
});

watch(
    [
        systemPrompt,
        reasoningStrength,
        historyMsgCount,
        temperature,
        maxTokens,
        topP,
        frequencyPenalty,
    ],
    () => {
        if (!isInitialized.value) {
            return;
        }
        scheduleAutoSave();
    }
);

watch(
    memoryTable,
    () => {
        if (!isInitialized.value) {
            return;
        }
        scheduleAutoSave();
    },
    { deep: true }
);

onBeforeUnmount(() => {
    clearSaveTimer();
    void runAutoSave(false);
});
</script>

<template>
    <Transition name="chat-panel-slide">
        <aside v-if="isOpen" class="system-prompt-panel">
            <div class="panel-header">
                <div class="panel-header-text">
                    <h3 class="panel-title">
                        {{ panelTitle }}
                    </h3>
                    <p v-if="panelSubtitle" class="panel-subtitle">
                        {{ panelSubtitle }}
                    </p>
                </div>
                <button type="button" class="icon-button" @click="handleClose">
                    <X :size="16" />
                </button>
            </div>
            <Separator v-if="panelHasDivider" class="panel-divider" />

            <div class="panel-body">
                <template v-if="isConfigView">
                <div v-if="isLoading" class="panel-state">
                    <Loader2 class="w-4 h-4 animate-spin" />
                    <span>{{ t('common.loading') }}</span>
                </div>

                <div v-else-if="loadError" class="panel-state panel-state-error">
                    <p class="text-sm">
                        {{ loadError }}
                    </p>
                    <Button size="sm" variant="outline" @click="handleRetry">
                        {{ t('common.retry') }}
                    </Button>
                </div>

                <ScrollArea v-else class="panel-scroll-area">
                    <div class="panel-content">
                        <section class="panel-section">
                            <h4 class="section-title">{{ t('chat.config.basicSettings') }}</h4>
                            <div class="field-group">
                                <label class="text-sm font-medium">{{ t('chat.config.systemPrompt') }}</label>
                                <Textarea
                                    v-model="systemPrompt"
                                    :disabled="isSaving || !canEdit"
                                    :placeholder="t('chat.config.systemPromptPlaceholder')"
                                    class="min-h-[160px]"
                                />
                                <p class="field-description">
                                    {{ t('chat.config.systemPromptDesc') }}
                                </p>
                            </div>

                            <div class="field-group">
                                <label class="text-sm font-medium">{{ t('chat.config.reasoningStrength') }}</label>
                                <Select v-model="reasoningStrength" :disabled="isSaving || !canEdit">
                                    <SelectTrigger class="w-full">
                                        <SelectValue :placeholder="t('chat.config.reasoningStrengthDefault')" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">
                                            {{ t('chat.config.reasoningStrengthDefault') }}
                                        </SelectItem>
                                        <SelectItem value="low">
                                            {{ t('chat.config.reasoningStrengthLow') }}
                                        </SelectItem>
                                        <SelectItem value="medium">
                                            {{ t('chat.config.reasoningStrengthMedium') }}
                                        </SelectItem>
                                        <SelectItem value="high">
                                            {{ t('chat.config.reasoningStrengthHigh') }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p class="field-description">
                                    {{ t('chat.config.reasoningStrengthDesc') }}
                                </p>
                            </div>

                            <div class="field-group">
                                <label class="text-sm font-medium">{{ t('chat.config.historyLimit') }}</label>
                                <Input
                                    v-model.number="historyMsgCount"
                                    type="number"
                                    :placeholder="t('chat.config.historyLimitPlaceholder')"
                                    :disabled="isSaving || !canEdit"
                                    min="0"
                                />
                                <p class="field-description">
                                    {{ t('chat.config.historyLimitDesc') }}
                                </p>
                            </div>
                        </section>

                        <section class="panel-section">
                            <h4 class="section-title">{{ t('chat.config.advancedSettings') }}</h4>
                            <div class="field-grid">
                                <div class="field-group">
                                    <label class="text-sm font-medium">{{ t('chat.config.temperature') }}</label>
                                    <Input
                                        v-model.number="temperature"
                                        type="number"
                                        placeholder="0.0 - 2.0"
                                        :disabled="isSaving || !canEdit"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                    />
                                    <p class="field-description">
                                        {{ t('chat.config.temperatureDesc') }}
                                    </p>
                                </div>

                                <div class="field-group">
                                    <label class="text-sm font-medium">{{ t('chat.config.maxTokens') }}</label>
                                    <Input
                                        v-model.number="maxTokens"
                                        type="number"
                                        :placeholder="t('chat.config.maxTokensPlaceholder')"
                                        :disabled="isSaving || !canEdit"
                                        min="1"
                                    />
                                    <p class="field-description">
                                        {{ t('chat.config.maxTokensDesc') }}
                                    </p>
                                </div>
                            </div>

                            <div class="field-grid">
                                <div class="field-group">
                                    <label class="text-sm font-medium">Top P</label>
                                    <Input
                                        v-model.number="topP"
                                        type="number"
                                        placeholder="0.0 - 1.0"
                                        :disabled="isSaving || !canEdit"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                    />
                                    <p class="field-description">
                                        {{ t('chat.config.topPDesc') }}
                                    </p>
                                </div>

                                <div class="field-group">
                                    <label class="text-sm font-medium">{{ t('chat.config.frequencyPenalty') }}</label>
                                    <Input
                                        v-model.number="frequencyPenalty"
                                        type="number"
                                        placeholder="-2.0 - 2.0"
                                        :disabled="isSaving || !canEdit"
                                        min="-2"
                                        max="2"
                                        step="0.1"
                                    />
                                    <p class="field-description">
                                        {{ t('chat.config.frequencyPenaltyDesc') }}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section class="panel-section">
                            <div class="section-header">
                                <h4 class="section-title">{{ t('chat.config.memoryTable') }}</h4>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    class="h-8"
                                    :disabled="isSaving || !canEdit"
                                    @click="addMemoryEntry"
                                >
                                    <Plus class="h-4 w-4 mr-1" />
                                    {{ t('common.add') }}
                                </Button>
                            </div>

                            <p class="field-description">
                                {{ t('chat.config.memoryTableDesc') }}
                            </p>

                            <div
                                v-if="memoryTable.length === 0"
                                class="memory-empty"
                            >
                                {{ t('chat.config.noMemoryEntries') }}
                            </div>

                            <div v-else class="memory-list">
                                <div
                                    v-for="(entry, index) in memoryTable"
                                    :key="index"
                                    class="memory-item"
                                >
                                    <div class="memory-field">
                                        <label class="text-xs text-muted-foreground">{{ t('chat.config.keyword') }}</label>
                                        <Input
                                            v-model="entry.keyword"
                                            :disabled="isSaving || !canEdit"
                                            :placeholder="t('chat.config.keywordPlaceholder')"
                                            class="h-8"
                                        />
                                    </div>
                                    <div class="memory-field">
                                        <label class="text-xs text-muted-foreground">{{ t('chat.config.content') }}</label>
                                        <Textarea
                                            v-model="entry.content"
                                            :disabled="isSaving || !canEdit"
                                            :placeholder="t('chat.config.contentPlaceholder')"
                                            class="min-h-[48px] max-h-24 text-sm"
                                        />
                                    </div>
                                    <div class="memory-actions">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                            :disabled="isSaving || !canEdit"
                                            @click="removeMemoryEntry(index)"
                                        >
                                            <Trash2 class="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </ScrollArea>
                </template>

                <template v-else-if="isToolDetailsView">
                    <ScrollArea v-if="toolMessage" class="panel-scroll-area">
                        <div class="panel-detail tool-detail">
                            <div class="panel-content">
                                <section class="panel-section detail-section">
                                    <div class="section-header">
                                        <h4 class="section-title">{{ toolPanelTitle }}</h4>
                                        <div class="detail-actions">
                                            <Button variant="ghost" size="icon" @click="handleToolCopy">
                                                <Copy class="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                class="text-destructive hover:text-destructive"
                                                @click="handleToolDelete"
                                            >
                                                <Trash2 class="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <p class="section-description detail-preview" :title="toolPreviewText">
                                        {{ toolPreviewText }}
                                    </p>
                                    <div class="section-body">
                                        <MsgContent :content="toolMessage.content" role="tool" />
                                    </div>
                                </section>
                            </div>
                        </div>
                    </ScrollArea>
                    <div v-else class="panel-state">
                        <span>{{ t('messages.loadingFailed') }}</span>
                    </div>
                </template>

                <template v-else-if="isThinkingDetailsView">
                    <ScrollArea v-if="thinkingMessage" class="panel-scroll-area">
                        <div class="panel-detail thinking-detail">
                            <div class="panel-content">
                                <section class="panel-section">
                                    <div class="section-header">
                                        <h4 class="section-title">{{ t('chat.thinkingBlock.title') }}</h4>
                                        <span v-if="thinkingStatusLabel" class="section-caption">
                                            {{ thinkingStatusLabel }}
                                        </span>
                                    </div>
                                    <div class="section-body thinking-body">
                                        <div
                                            class="think-content-rendered"
                                            :class="{ 'think-content-flowing': isThinkContentFlowing }"
                                        >
                                            <template v-for="(vnode, index) in renderedThinkContent" :key="index">
                                                <component :is="vnode" v-if="typeof vnode !== 'string'" />
                                                <component :is="textNodeType" v-else>
                                                    {{ vnode }}
                                                </component>
                                            </template>
                                            <span
                                                v-if="shouldShowCursor"
                                                class="thinking-caret"
                                                aria-hidden="true"
                                            />
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </ScrollArea>
                    <div v-else class="panel-state">
                        <span>{{ t('messages.loadingFailed') }}</span>
                    </div>
                </template>

                <template v-else-if="isResponseStepsView">
                    <ScrollArea v-if="responseSteps.length > 0" class="panel-scroll-area">
                        <div class="panel-detail">
                            <div class="panel-content">
                                <section
                                    v-for="(step, idx) in responseSteps"
                                    :key="step.id"
                                    class="panel-section step-section"
                                >
                                    <div class="section-header">
                                        <div class="step-label">
                                            <span class="step-index">{{ idx + 1 }}</span>
                                            <h4 class="section-title">
                                                {{ step.role === 'tool'
                                                    ? t('chat.toolMessage.sheetTitle', { name: step.toolInvocation?.toolName ?? t('chat.toolMessage.defaultName') })
                                                    : t('chat.thinkingBlock.title')
                                                }}
                                            </h4>
                                        </div>
                                    </div>
                                    <div class="section-body" :class="{ 'thinking-body': step.role === 'assistant' }">
                                        <template v-if="step.role === 'tool'">
                                            <MsgContent :content="step.content" role="tool" />
                                        </template>
                                        <template v-else-if="step.thinkContent">
                                            <div class="think-content-rendered">
                                                <template v-for="(vnode, vi) in renderMarkdown(step.thinkContent, false)" :key="vi">
                                                    <component :is="vnode" v-if="typeof vnode !== 'string'" />
                                                    <component :is="textNodeType" v-else>{{ vnode }}</component>
                                                </template>
                                            </div>
                                        </template>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </ScrollArea>
                    <div v-else class="panel-state">
                        <span>{{ t('chat.agentSteps.noSteps') }}</span>
                    </div>
                </template>
            </div>

            <div class="panel-footer" v-if="isConfigView">
                <span v-if="isSaving" class="saving-indicator">{{ t('common.saving') || 'Saving' }}</span>
                <Button variant="outline" size="sm" @click="handleClose">
                    {{ t('common.close') }}
                </Button>
            </div>
        </aside>
    </Transition>
</template>

<style scoped lang="less">
@panel-width: 320px;

.system-prompt-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(100%, @panel-width);
    background: var(--bg-primary);
    border-left: 1px solid rgba(148, 163, 184, 0.35);
    box-shadow: none;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    padding: 20px;
    gap: 12px;
    z-index: 10;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    overflow: hidden;

    @media screen and (max-width: 767px) {
        top: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        border-radius: 0;
        border-left: none;
        border-top: 1px solid rgba(148, 163, 184, 0.35);
        border-right: none;
        border-bottom: none;
        padding: 16px;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }

    @media (prefers-color-scheme: dark) {
        background: var(--bg-primary);
        border-left-color: rgba(148, 163, 184, 0.25);
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        .panel-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .panel-header-text {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .panel-subtitle {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.3;
        }

        .icon-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 9999px;
            color: var(--text-secondary);
            transition: background-color 0.2s ease;

            &:hover {
                background: rgba(148, 163, 184, 0.2);
            }
        }
    }

    .panel-divider {
        margin: 8px 0 16px;
    }

    .panel-body {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    .panel-scroll-area {
        flex: 1 1 auto;
        min-height: 0;
    }

    .panel-detail {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        gap: 12px;
        min-height: 0;
    }

    .step-section {
        padding: 0 0 16px 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);

        &:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }
    }

    .step-label {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .step-index {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        flex-shrink: 0;
    }

    .step-section .section-title {
        font-size: 14px;
        font-weight: 600;
        text-transform: none;
        letter-spacing: normal;
    }

    .step-section .section-body {
        border: none;
        border-radius: 0;
        background: none;
        padding: 4px 0 0 0;
    }

    .detail-preview {
        word-break: break-word;
    }

    .detail-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .section-description {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.5;
    }

    .section-caption {
        font-size: 11px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .section-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 12px;
        padding: 16px;
        background: rgba(148, 163, 184, 0.08);
    }

    .thinking-body {
        background: rgba(148, 163, 184, 0.06);
    }

    .panel-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding-right: 8px;
    }

    .panel-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .section-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .field-grid {
        display: grid;
        grid-template-columns: repeat(1, minmax(0, 1fr));
        gap: 12px;
    }

    .field-description {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
    }

    .memory-empty {
        padding: 16px;
        text-align: center;
        font-size: 13px;
        color: var(--text-secondary);
        border: 1px dashed rgba(148, 163, 184, 0.35);
        border-radius: 10px;
    }

    .memory-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 220px;
        overflow-y: auto;
        padding-right: 4px;
    }

    .memory-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
        gap: 12px;
        padding: 12px;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 12px;
        background: rgba(148, 163, 184, 0.08);
    }

    .memory-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .memory-actions {
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
    }

    .panel-state {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        text-align: center;

        &.panel-state-error {
            color: var(--destructive);
        }
    }

    .think-content-rendered {
        font-size: 13px;
        line-height: 1.5;
        color: var(--text-primary);
        opacity: 0.92;
        position: relative;

        .thinking-caret {
            display: inline-block;
            width: 2px;
            height: 1.2em;
            background-color: var(--primary-color, #18a058);
            margin-left: 2px;
            animation: blink 1s infinite;
            vertical-align: text-bottom;
        }

        :deep(pre) {
            background-color: color-mix(in srgb, var(--body-color) 90%, var(--text-color-3) 5%);
            border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent 30%);
            margin: 8px 0;
            padding: 12px;
            border-radius: 6px;
            font-size: 13px;
        }

        :deep(p) {
            margin: 6px 0;
        }

        :deep(h1),
        :deep(h2),
        :deep(h3),
        :deep(h4),
        :deep(h5),
        :deep(h6) {
            margin: 12px 0 6px 0;
            font-size: 14px;
            font-weight: 600;
        }

        :deep(ul),
        :deep(ol) {
            margin: 6px 0;
            padding-left: 20px;
        }

        :deep(li) {
            margin: 2px 0;
        }
    }

    .think-content-flowing {
        .thinking-caret {
            opacity: 1;
        }
    }

    .panel-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
    }

    .saving-indicator {
        font-size: 12px;
        color: var(--text-secondary);
    }

    @keyframes blink {
        0%,
        50% {
            opacity: 1;
        }
        51%,
        100% {
            opacity: 0;
        }
    }
}
</style>
