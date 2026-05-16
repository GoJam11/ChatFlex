<script setup lang="ts">
import { Image, X, List, Paperclip, Check, Plus, Globe, Folder, History, Brain } from "lucide-vue-next";
import { computed, watch, nextTick, ref, onMounted, onBeforeUnmount } from "vue";
import { liveQuery, type Subscription } from "dexie";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "vue-sonner";
import { useSettingStore } from "@/features/setting/useSettingStore.ts";
import {
    getVisionSupportStatus,
    type VisionSupportStatus,
} from "@/config/model.ts";
import { useEditAreaStore } from "@/features/send/useEditAreaStore.ts"; // 使用专用 store
import { usePendingImages } from "@/views/Chat/EditArea/usePendingImages.ts"; // 导入图片处理 hooks（原生 input 方案）
import { usePendingAttachment } from "./usePendingAttachment.ts"; // 导入附件处理 hooks
import { useInputFocus } from "@/views/Chat/EditArea/useInputFocus.ts"; // 导入聚焦hooks
import { useKeyboardHandlers } from "./useKeyboardHandlers.ts"; // 导入按键处理hooks
import { send } from "@/features/send/send.ts";
import { useRouteChat } from "@/features/chat/useRouteChat";
import { useChat } from "@/views/Chat/composables/useChat";
import { useRouter } from "vue-router";
import { useChatStore, CREATE_NEW_CHAT } from "@/features/chat/useChatStore";
import { useI18n } from "@/features/i18n/useI18n";
import { getCurrentModelConfig } from "@/features/chat/useChat";
import { useProviderService } from '@/features/provider/providerService';
import { resolveProviderBaseUrl } from '@/types/provider';
import { isTauri } from "@tauri-apps/api/core";
import { toolDb } from "@/persistence/ToolDatabase";
import { chatFlexDb, type ToolRecord } from "@/persistence/chatflex-db";
import { FETCH_WEB_TOOL_ID } from "@/features/tools/fetchWebTool";
import { KNOWLEDGE_BASE_TOOL_IDS, selectKnowledgeBaseFolder, getCurrentChatKnowledgeBasePath } from "@/features/tools/knowledgeBaseTool";
import { CHAT_HISTORY_TOOL_IDS } from "@/features/tools/chatHistoryToolIds";
import { useMemoryStore } from "@/features/memory/useMemoryStore";
import ModelSwitch from "@/views/Chat/AppHeader/ModelSwitch.vue";
import McpToolSelector from "@/components/McpToolSelector.vue";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const chatStore = useChatStore();
const router = useRouter();
const { createChat } = useChat();
const settingStore = useSettingStore();
const editAreaStore = useEditAreaStore();
const providerService = useProviderService();
const memoryStore = useMemoryStore();
const { chatId } = useRouteChat();
const { t } = useI18n();
// 判断是否为新建会话（基于路由）
const isNewChat = computed(() => chatId.value === CREATE_NEW_CHAT);
// 由环境变量控制“附件/风格”功能是否可见
const enableAttachmentStyle = String(import.meta.env.VITE_ENABLE_ATTACHMENT_STYLE || "false") === "true";

// 使用附件处理
const { openFileSelector: openAttachmentSelector, removePendingAttachment } =
    usePendingAttachment();

const fetchEnabled = ref(false);
const fetchTogglePending = ref(false);
const knowledgeBaseEnabled = ref(false);
const knowledgeBaseTogglePending = ref(false);
const knowledgeBaseFolderPath = ref<string | null>(null);
const chatHistoryEnabled = ref(false);
const chatHistoryTogglePending = ref(false);
const isComposerMenuOpen = ref(false);
let toolsSubscription: Subscription | null = null;

const isFetchAvailable = computed(() => true);
const isFetchConfigured = computed(() => true);
const isKnowledgeBaseAvailable = computed(() => typeof window !== "undefined" && isTauri());
const isKnowledgeBaseConfigured = computed(() => Boolean(knowledgeBaseFolderPath.value));

const knowledgeBaseFolderName = computed(() => {
    if (!knowledgeBaseFolderPath.value) {
        return "";
    }
    const trimmed = knowledgeBaseFolderPath.value.replace(/[\\/]+$/, "");
    const segments = trimmed.split(/[/\\]/).filter(Boolean);
    return segments[segments.length - 1] ?? "";
});

const fetchToggleTexts = computed(() => ({
    label: t("chat.editArea.toolToggles.fetch.label"),
    tooltipMissing: t("chat.editArea.toolToggles.fetch.tooltipMissing"),
    tooltipActive: t("chat.editArea.toolToggles.fetch.tooltipActive"),
    tooltipInactive: t("chat.editArea.toolToggles.fetch.tooltipInactive"),
    updateError: t("chat.editArea.toolToggles.fetch.updateError"),
}));

const knowledgeBaseToggleTexts = computed(() => ({
    label: t("chat.editArea.toolToggles.knowledgeBase.label"),
    tooltipActive: t("chat.editArea.toolToggles.knowledgeBase.tooltipActive"),
    tooltipInactive: t("chat.editArea.toolToggles.knowledgeBase.tooltipInactive"),
    tooltipMissing: t("chat.editArea.toolToggles.knowledgeBase.tooltipMissing"),
    updateError: t("chat.editArea.toolToggles.knowledgeBase.updateError"),
}));

const chatHistoryToggleTexts = computed(() => ({
    label: t("chat.editArea.toolToggles.chatHistory.label"),
    tooltipActive: t("chat.editArea.toolToggles.chatHistory.tooltipActive"),
    tooltipInactive: t("chat.editArea.toolToggles.chatHistory.tooltipInactive"),
    updateError: t("chat.editArea.toolToggles.chatHistory.updateError"),
}));

const memoryToggleTexts = computed(() => ({
    label: t("chat.editArea.toolToggles.memory.label"),
    tooltipActive: t("chat.editArea.toolToggles.memory.tooltipActive"),
    tooltipInactive: t("chat.editArea.toolToggles.memory.tooltipInactive"),
    tooltipEmpty: t("chat.editArea.toolToggles.memory.tooltipEmpty"),
}));

const memoryToggleTooltip = computed(() => {
    if (!memoryStore.hasMemory) {
        return memoryToggleTexts.value.tooltipEmpty;
    }
    return memoryStore.memoryEnabled
        ? memoryToggleTexts.value.tooltipActive
        : memoryToggleTexts.value.tooltipInactive;
});

const knowledgeBaseTooltipActive = computed(() => {
    if (knowledgeBaseEnabled.value && knowledgeBaseFolderName.value) {
        return t("chat.editArea.toolToggles.knowledgeBase.activeFolderTooltip", {
            folder: knowledgeBaseFolderName.value,
        });
    }
    return knowledgeBaseToggleTexts.value.tooltipActive;
});

const syncToolToggleState = (tools: ToolRecord[]) => {
    const fetchTool = tools.find((tool) => tool.id === FETCH_WEB_TOOL_ID);
    const knowledgeBaseStates = KNOWLEDGE_BASE_TOOL_IDS.map((id) => {
        const record = tools.find((tool) => tool.id === id);
        return Boolean(record?.enabled);
    });
    const chatHistoryStates = CHAT_HISTORY_TOOL_IDS.map((id) => {
        const record = tools.find((tool) => tool.id === id);
        return Boolean(record?.enabled);
    });

    fetchEnabled.value = Boolean(fetchTool?.enabled);
    knowledgeBaseEnabled.value = knowledgeBaseStates.every(Boolean);
    chatHistoryEnabled.value = chatHistoryStates.every(Boolean);
};

// 获取当前会话的实际模型
const currentChatModel = ref<string>('');

// 异步获取当前模型
const updateCurrentChatModel = async () => {
    const modelConfig = await getCurrentModelConfig(chatId.value);
    if (modelConfig.success && modelConfig.model) {
        currentChatModel.value = modelConfig.model;
    } else {
        console.warn('[EditArea] 获取模型配置失败:', modelConfig.error);
        currentChatModel.value = 'gpt-4o-mini'; // fallback
    }
};

// 监听chatId变化，更新当前模型
watch(
    () => chatId.value,
    () => {
        updateCurrentChatModel();
    },
    { immediate: true }
);

// 监听chatStore.chatList变化，以便会话模型更新时能及时响应
// 已改为基于数据库获取模型配置，移除对 chatStore 的依赖，避免不必要的 store 监听

// 计算当前模型的视觉支持状态
const visionSupportStatus = computed<VisionSupportStatus>(() => {
    return getVisionSupportStatus(currentChatModel.value);
});

const imageMenuDescription = computed(() => {
    if (visionSupportStatus.value === "unsupported") {
        return t("chat.editArea.tooltips.modelNotSupported");
    }
    if (visionSupportStatus.value === "unknown") {
        return t("chat.editArea.tooltips.modelUnknownSupport");
    }
    return t("chat.editArea.image");
});

const isImageActionDisabled = computed(() => visionSupportStatus.value === "unsupported");

const handleImageMenuSelect = () => {
    if (isImageActionDisabled.value) {
        return;
    }
    openFileSelector();
};

const attachmentMenuDescription = computed(() => {
    if (editAreaStore.pendingAttachment) {
        return t("chat.editArea.tooltips.attachmentExists");
    }
    return t("chat.editArea.tooltips.markdownOnly");
});

const isAttachmentActionDisabled = computed(() => Boolean(editAreaStore.pendingAttachment));

const handleAttachmentMenuSelect = () => {
    if (isAttachmentActionDisabled.value) {
        return;
    }
    openAttachmentSelector();
};

const handleFetchToggle = async () => {
    if (fetchTogglePending.value) {
        return;
    }

    const desiredState = fetchEnabled.value;
    const previousState = !desiredState;

    if (!isFetchConfigured.value) {
        toast.warning(fetchToggleTexts.value.tooltipMissing);
        fetchEnabled.value = previousState;
        return;
    }

    // 如果是新会话，先创建会话
    if (isNewChat.value) {
        try {
            const created = await createChat();
            if (!created.success || !created.chat) {
                throw new Error(created.error || "创建新会话失败");
            }
            await router.push({ name: "Chat", params: { uuid: created.chat.id } });
            // 等待路由跳转完成，EditArea会响应chatId变化
            await nextTick();
        } catch (error) {
            console.error("[EditArea] 创建会话失败:", error);
            toast.error('创建会话失败');
            fetchEnabled.value = previousState;
            return;
        }
    }

    fetchTogglePending.value = true;
    try {
        await toolDb.setToolEnabled(FETCH_WEB_TOOL_ID, desiredState);
    } catch (error) {
        console.error("[EditArea] 更新抓取工具状态失败:", error);
        toast.error(fetchToggleTexts.value.updateError);
        fetchEnabled.value = previousState;
    } finally {
        fetchTogglePending.value = false;
    }
};

const handleKnowledgeBaseToggle = async () => {
    if (knowledgeBaseTogglePending.value) {
        return;
    }

    const desiredState = knowledgeBaseEnabled.value;
    const previousState = !desiredState;

    // 如果是新会话，先创建会话
    if (isNewChat.value) {
        try {
            const created = await createChat();
            if (!created.success || !created.chat) {
                throw new Error(created.error || "创建新会话失败");
            }
            await router.push({ name: "Chat", params: { uuid: created.chat.id } });
            // 等待路由跳转完成，EditArea会响应chatId变化
            await nextTick();
        } catch (error) {
            console.error("[EditArea] 创建会话失败:", error);
            toast.error('创建会话失败');
            knowledgeBaseEnabled.value = previousState;
            return;
        }
    }

    // 检查当前会话是否已配置知识库
    try {
        const currentPath = await getCurrentChatKnowledgeBasePath(chatId.value);
        knowledgeBaseFolderPath.value = currentPath;
        const isConfigured = Boolean(currentPath);

        if (!isConfigured) {
            // 如果未配置，提示用户选择文件夹
            const selectedPath = await selectKnowledgeBaseFolder(chatId.value);
            if (!selectedPath) {
                knowledgeBaseEnabled.value = previousState;
                return;
            }
            knowledgeBaseFolderPath.value = selectedPath;
            toast.success('知识库文件夹选择成功');
        }
    } catch (error) {
        console.error("[EditArea] 检查知识库配置失败:", error);
        toast.error('知识库配置检查失败');
        knowledgeBaseEnabled.value = previousState;
        return;
    }

    knowledgeBaseTogglePending.value = true;
    try {
        await toolDb.setToolsEnabled(KNOWLEDGE_BASE_TOOL_IDS, desiredState);
    } catch (error) {
        console.error("[EditArea] 更新知识库工具状态失败:", error);
        toast.error(knowledgeBaseToggleTexts.value.updateError);
        knowledgeBaseEnabled.value = previousState;
    } finally {
        knowledgeBaseTogglePending.value = false;
    }
};

const handleChatHistoryToggle = async () => {
    if (chatHistoryTogglePending.value) {
        return;
    }

    const desiredState = chatHistoryEnabled.value;
    const previousState = !desiredState;

    // 如果是新会话，先创建会话
    if (isNewChat.value) {
        try {
            const created = await createChat();
            if (!created.success || !created.chat) {
                throw new Error(created.error || "创建新会话失败");
            }
            await router.push({ name: "Chat", params: { uuid: created.chat.id } });
            await nextTick();
        } catch (error) {
            console.error("[EditArea] 创建会话失败:", error);
            toast.error('创建会话失败');
            chatHistoryEnabled.value = previousState;
            return;
        }
    }

    chatHistoryTogglePending.value = true;
    try {
        await toolDb.setToolsEnabled(CHAT_HISTORY_TOOL_IDS, desiredState);
    } catch (error) {
        console.error("[EditArea] 更新聊天历史工具状态失败:", error);
        toast.error(chatHistoryToggleTexts.value.updateError);
        chatHistoryEnabled.value = previousState;
    } finally {
        chatHistoryTogglePending.value = false;
    }
};

onMounted(async () => {
    try {
        const tools = await toolDb.getAllTools();
        syncToolToggleState(tools);

        // 只在非新会话时检查知识库配置状态
        if (!isNewChat.value) {
            await refreshKnowledgeBaseConfigStatus();
        }
    } catch (error) {
        console.error("[EditArea] 初始化工具状态失败:", error);
    }

    toolsSubscription = liveQuery(() => chatFlexDb.tools.toArray()).subscribe({
        next: (records) => {
            syncToolToggleState(records);
        },
        error: (error) => {
            console.error("[EditArea] 监听工具状态失败:", error);
        },
    });
});

// 监听会话切换，重新检查知识库配置状态，并清空新会话的工具状态
watch(() => chatId.value, async () => {
    // 如果切换到新会话，关闭所有工具
    if (isNewChat.value) {
        if (fetchEnabled.value) {
            fetchEnabled.value = false;
            await toolDb.setToolEnabled(FETCH_WEB_TOOL_ID, false);
        }
        if (knowledgeBaseEnabled.value) {
            knowledgeBaseEnabled.value = false;
            await toolDb.setToolsEnabled(KNOWLEDGE_BASE_TOOL_IDS, false);
        }
        if (chatHistoryEnabled.value) {
            chatHistoryEnabled.value = false;
            await toolDb.setToolsEnabled(CHAT_HISTORY_TOOL_IDS, false);
        }
        knowledgeBaseFolderPath.value = null;
    } else {
        // 非新会话，检查知识库配置状态
        await refreshKnowledgeBaseConfigStatus();
    }
});

// 刷新知识库配置状态的辅助函数
async function refreshKnowledgeBaseConfigStatus() {
    // 新会话不需要检查知识库配置
    if (isNewChat.value) {
        knowledgeBaseFolderPath.value = null;
        return;
    }

    try {
        const currentPath = await getCurrentChatKnowledgeBasePath(chatId.value);
        knowledgeBaseFolderPath.value = currentPath;
        const isConfigured = Boolean(currentPath);

        // 如果当前会话未配置知识库，但工具状态为启用，则禁用工具
        if (!isConfigured && knowledgeBaseEnabled.value) {
            knowledgeBaseEnabled.value = false;
            await toolDb.setToolsEnabled(KNOWLEDGE_BASE_TOOL_IDS, false);
        }
    } catch (error) {
        console.error("[EditArea] 刷新知识库配置状态失败:", error);
        knowledgeBaseFolderPath.value = null;
    }
}

onBeforeUnmount(() => {
    toolsSubscription?.unsubscribe();
    toolsSubscription = null;
});

// Use the composable for image handling
const {
    pendingImages,
    isDragOver,
    openFileSelector,
    removePendingImage,
    clearPendingImages,
    handleDragOver,
    handleDragLeave,
    handleDrop,
} = usePendingImages();

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 使用聚焦hooks，监听会话切换时自动聚焦
const { inputRef } = useInputFocus(chatId);
const textareaRef = inputRef as typeof inputRef & { value: HTMLTextAreaElement | null };
const composerPrimaryRef = ref<HTMLElement | null>(null);
const textareaHeight = ref(48);
const developerModeActivated = ref(false);

const SINGLE_LINE_HEIGHT = 48;
const MAX_TEXTAREA_HEIGHT = 192;

let primaryResizeObserver: ResizeObserver | null = null;

const canSendMessage = computed(() => {
    return pendingImages.value.length > 0 || editAreaStore.hasContent;
});

const isSendDisabled = computed(() => {
    return !canSendMessage.value || isProcessing.value;
});

const updateTextareaSize = () => {
    const textareaEl = textareaRef.value;
    if (!textareaEl) return;

    // 重置高度以准确测量
    textareaEl.style.height = "auto";

    // 计算目标高度：至少 SINGLE_LINE_HEIGHT，最多 MAX_TEXTAREA_HEIGHT
    const targetHeight = Math.max(
        SINGLE_LINE_HEIGHT,
        Math.min(textareaEl.scrollHeight, MAX_TEXTAREA_HEIGHT)
    );

    textareaHeight.value = targetHeight;
    textareaEl.style.height = `${targetHeight}px`;
    textareaEl.style.overflowY = targetHeight >= MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
};

const observePrimaryResize = (element: HTMLElement | null) => {
    if (primaryResizeObserver) {
        primaryResizeObserver.disconnect();
        primaryResizeObserver = null;
    }

    if (typeof ResizeObserver === "undefined" || !element) {
        return;
    }

    primaryResizeObserver = new ResizeObserver(() => {
        updateTextareaSize();
    });

    primaryResizeObserver.observe(element);
};

watch(
    () => editAreaStore.inputValue,
    () => {
        nextTick(() => {
            updateTextareaSize();
        });
    }
);

const DEVELOPER_MODE_TRIGGER = "chatflex developer mode";
const DEVELOPER_MODE_TRIGGER_NORMALIZED = DEVELOPER_MODE_TRIGGER.toLowerCase();

watch(
    () => editAreaStore.inputValue,
    async (value) => {
        const normalized = (value ?? "").trim().toLowerCase();
        const matches = normalized === DEVELOPER_MODE_TRIGGER_NORMALIZED;

        if (matches && !developerModeActivated.value) {
            developerModeActivated.value = true;
            if (typeof window !== "undefined" && isTauri()) {
                console.warn("[EditArea] Tauri 暂不支持通过应用内触发 DevTools。");
            }
        } else if (!matches) {
            developerModeActivated.value = false;
        }
    },
);

watch(
    () => composerPrimaryRef.value,
    (element) => {
        nextTick(() => {
            observePrimaryResize(element ?? null);
        });
    }
);

onMounted(() => {
    nextTick(() => {
        updateTextareaSize();
        observePrimaryResize(composerPrimaryRef.value);
    });
});

onBeforeUnmount(() => {
    if (primaryResizeObserver) {
        primaryResizeObserver.disconnect();
        primaryResizeObserver = null;
    }
});

// 监听聊天ID变化，保存草稿并加载新草稿
watch(
    () => chatId.value,
    (newChatId, oldChatId) => {
        if (oldChatId && editAreaStore.inputValue.trim()) {
            editAreaStore.saveDraft(oldChatId);
        }
        if (newChatId) {
            editAreaStore.loadDraft(newChatId);
        }
    }
);

// 使用简化的消息发送逻辑
const isProcessing = ref(false);

// 使用按键处理hooks
// 需求：EditArea 必须支持使用 Ctrl 或 Command + Enter 插入换行（辅助按键根据系统自动判断）
const { handleKeyDown } = useKeyboardHandlers({
    inputRef,
    getCurrentValue: () => editAreaStore.inputValue,
    setInputValue: (value: string) => {
        editAreaStore.inputValue = value;
    },
    onSend: handleSend,
});

async function handleSend() {
    // 防止重复发送
    if (isProcessing.value) {
        return;
    }

    // 验证输入内容
    const textInput = editAreaStore.inputValue.trim();
    if (!textInput && pendingImages.value.length === 0) {
        return; // 静默处理空输入
    }

    // 如果有附件，将其内容附加到输入值（由环境变量控制）
    let finalInputValue = editAreaStore.inputValue;
    if (enableAttachmentStyle && editAreaStore.pendingAttachment) {
        finalInputValue += `\n[附件内容：${editAreaStore.pendingAttachment.content}]`;
    }

    // 构建消息内容
    const contentParts: (string | any)[] = [];
    
    // 添加文本内容
    if (finalInputValue.trim()) {
        contentParts.push(finalInputValue.trim());
    }

    // 添加图片内容
    pendingImages.value.forEach((pImage) => {
        contentParts.push({
            type: "image",
            imageId: pImage.imageId,
            alt: pImage.alt,
            mimeType: pImage.mimeType,
        });
    });

    // 确定最终的消息内容格式
    let messageContent;
    if (contentParts.length === 1) {
        messageContent = contentParts[0];
    } else {
        messageContent = contentParts;
    }

    // 设置处理状态
    isProcessing.value = true;

    try {
        // 先获取模型配置（在创建会话之前确定）
        const modelConfig = await getCurrentModelConfig(chatId.value);

        if (!modelConfig.success || !modelConfig.model || !modelConfig.provider) {
            const errorMessage = modelConfig.error || "未找到模型配置，请先设置模型";

            // 显示错误提示，并提供跳转到设置页面的选项
            toast.error(errorMessage, {
                duration: 6000,
                action: {
                    label: "前往设置",
                    onClick: () => {
                        router.push({ name: "Setting", params: { tab: "api" } });
                    }
                }
            });

            return;
        }

        const currentModelFromDB = modelConfig.model;
        const currentProviderFromDB = modelConfig.provider;

        // 确保存在真实会话
        let targetChatId = chatId.value;
        if (isNewChat.value) {
            const created = await createChat();
            if (!created.success || !created.chat) {
                throw new Error(created.error || "创建新会话失败");
            }
            await router.push({ name: "Chat", params: { uuid: created.chat.id } });
            targetChatId = created.chat.id;
            
            // 等待路由跳转完成，确保useRouteChat能获取到正确的chatId
            await nextTick();
        }

        // 用户消息创建成功后立即清除输入内容
        editAreaStore.clearInput();
        clearPendingImages();

        // 滚动到底部
        chatStore.scrollTo("bottom");
        
        await providerService.ready();
        const currentProvider = providerService.getProvider(currentProviderFromDB);
        const providerConfig = currentProvider ? {
            apiKey: currentProvider.apiKey,
            baseURL: resolveProviderBaseUrl(currentProvider),
            provider: currentProviderFromDB,
            model: currentModelFromDB,
        } : undefined;

        let summaryConfig = undefined;

        if (settingStore.enableAiSummary) {
            if (settingStore.summaryModel && settingStore.summaryProvider) {
                const summaryProvider = providerService.getProvider(settingStore.summaryProvider);

                if (summaryProvider) {
                    summaryConfig = {
                        apiKey: summaryProvider.apiKey ?? settingStore.summaryApiKey ?? undefined,
                        baseURL: settingStore.summaryBaseURL || resolveProviderBaseUrl(summaryProvider) || undefined,
                        provider: settingStore.summaryProvider,
                        model: settingStore.summaryModel,
                    };
                } else {
                    console.warn(`[EditArea] 未找到总结供应商 ${settingStore.summaryProvider}，回退到当前配置`);
                    summaryConfig = providerConfig;
                }
            } else {
                summaryConfig = providerConfig;
            }
        }

        // 调用简化的send函数
        const result = await send({
            prompt: messageContent,
            chatId: targetChatId,
            providerConfig,
            summaryConfig,
        });

        // 根据结果处理UI反馈
        if (!result.success) {
            // 只有当有具体错误信息时才显示错误提示
            if (result.error) {
                toast.error(result.error);
            }
            return;
        }

    } catch (error: any) {
        console.error("[EditArea] 发送消息失败:", error);
        toast.error(error.message || "发送消息失败");
    } finally {
        isProcessing.value = false;
    }
}
</script>

<template>
    <div class="w-full max-w-3xl mx-auto flex flex-col mb-4">
        <!-- Claude-style floating card composer -->
        <div
            class="editarea-input-container-border relative flex flex-col bg-bg-300/50 dark:bg-bg-200 mx-2 md:mx-0 rounded-[28px] cursor-text border border-transparent transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.15)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.25)] focus-within:shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:focus-within:shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
            :class="{
                'ring-1 ring-border-300': isComposerMenuOpen || developerModeActivated,
                'ring-2 ring-accent': isDragOver
            }"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            @click="inputRef?.focus()"
        >
            <div class="flex flex-col m-3.5 gap-3">
                <!-- Pending Images Preview Area -->
                <div
                    v-if="pendingImages.length > 0 || (enableAttachmentStyle && editAreaStore.pendingAttachment)"
                    class="flex flex-wrap gap-2"
                >
                    <TooltipProvider
                        v-for="(pImage, index) in pendingImages"
                        :key="pImage.imageId"
                    >
                        <Tooltip>
                            <TooltipTrigger as-child>
                                <div class="relative group">
                                    <img
                                        :src="pImage.previewUrl"
                                        :alt="pImage.alt"
                                        class="w-14 h-14 rounded-md object-cover"
                                    >
                                    <div
                                        class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-text-400 hover:bg-text-500 rounded-full cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 text-white"
                                        :title="t('chat.editArea.removeImage')"
                                        @click.stop="removePendingImage(pImage, index)"
                                    >
                                        <X :size="10" />
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <div class="text-xs">
                                    <div>{{ pImage.file.name }}</div>
                                    <div class="text-text-400">{{ formatFileSize(pImage.file.size) }}</div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <!-- Pending Attachment Preview -->
                    <div
                        v-if="enableAttachmentStyle && editAreaStore.pendingAttachment"
                        class="relative group"
                    >
                        <div
                            class="w-14 h-14 rounded-md border border-border-200 shadow-sm bg-bg-200 flex items-center justify-center"
                        >
                            <span
                                class="text-xs font-bold text-text-400"
                            >MD</span>
                        </div>
                        <div
                            class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-text-400 hover:bg-text-500 rounded-full cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 text-white"
                            :title="t('chat.editArea.removeAttachment')"
                            @click="removePendingAttachment"
                        >
                            <X :size="10" />
                        </div>
                    </div>
                </div>

                <!-- Input area -->
                <div
                    ref="composerPrimaryRef"
                    class="relative"
                >
                    <div class="w-full overflow-y-auto break-words transition-opacity duration-200 max-h-96 min-h-[3rem] pl-1.5 pt-1.5">
                        <textarea
                            ref="inputRef"
                            v-model="editAreaStore.inputValue"
                            :placeholder="t('chat.inputPlaceholder')"
                            class="w-full bg-transparent border-0 resize-none text-[0.9375rem] leading-6 text-text-100 placeholder:text-text-500 focus:ring-0 focus:outline-none p-0 whitespace-pre-wrap break-words"
                            :style="{ height: `${textareaHeight}px` }"
                            @keydown="handleKeyDown"
                        />
                    </div>
                </div>

                <!-- Toolbar -->
                <div class="relative flex gap-2 w-full items-center" @click.stop>
                    <!-- Left side: attachment menu and tools -->
                    <div class="relative flex-1 flex items-center shrink min-w-0 gap-1">
                        <DropdownMenu v-model:open="isComposerMenuOpen">
                            <DropdownMenuTrigger as-child>
                                <button
                                    type="button"
                                    class="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors duration-150 text-text-300 hover:text-text-200 hover:bg-black/[0.06] active:scale-95 focus:outline-none"
                                    :aria-label="t('chat.editArea.moreActions')"
                                    :title="t('chat.editArea.moreActions')"
                                >
                                    <Plus :size="18" :stroke-width="1.75" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="start"
                                side="top"
                                class="w-[240px] p-1 bg-bg-100 border border-border-200 shadow-lg rounded-xl"
                            >
                                <DropdownMenuItem
                                    class="editarea-menu-item flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg cursor-pointer"
                                    :disabled="isImageActionDisabled"
                                    :title="imageMenuDescription"
                                    @select="handleImageMenuSelect"
                                >
                                    <Image :size="16" />
                                    <span>{{ t('chat.editArea.image') }}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    class="flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded-lg cursor-pointer"
                                    :class="chatHistoryEnabled ? 'editarea-menu-item--selected' : 'editarea-menu-item'"
                                    :title="chatHistoryEnabled ? chatHistoryToggleTexts.tooltipActive : chatHistoryToggleTexts.tooltipInactive"
                                    @select="(e: Event) => { e.preventDefault(); chatHistoryEnabled = !chatHistoryEnabled; handleChatHistoryToggle(); }"
                                >
                                    <div class="flex items-center gap-2">
                                        <History :size="16" />
                                        <span>{{ chatHistoryToggleTexts.label }}</span>
                                    </div>
                                    <Check v-if="chatHistoryEnabled" :size="16" class="editarea-menu-item__check-icon" />
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    class="flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded-lg cursor-pointer"
                                    :class="memoryStore.memoryEnabled && memoryStore.hasMemory ? 'editarea-menu-item--selected' : 'editarea-menu-item'"
                                    :disabled="!memoryStore.hasMemory"
                                    :title="memoryToggleTooltip"
                                    @select="(e: Event) => { e.preventDefault(); if (memoryStore.hasMemory) { memoryStore.memoryEnabled = !memoryStore.memoryEnabled; } }"
                                >
                                    <div class="flex items-center gap-2">
                                        <Brain :size="16" />
                                        <span>{{ memoryToggleTexts.label }}</span>
                                    </div>
                                    <Check v-if="memoryStore.memoryEnabled && memoryStore.hasMemory" :size="16" class="editarea-menu-item__check-icon" />
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    v-if="enableAttachmentStyle"
                                    class="editarea-menu-item flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg cursor-pointer"
                                    :disabled="isAttachmentActionDisabled"
                                    :title="attachmentMenuDescription"
                                    @select="handleAttachmentMenuSelect"
                                >
                                    <Paperclip :size="16" />
                                    <span>{{ t('chat.editArea.attachment') }}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div class="flex flex-row items-center min-w-0 gap-1">
                            <!-- MCP 工具选择器 -->
                            <McpToolSelector :chat-id="chatId" />
                        </div>
                    </div>

                    <!-- Right side: model switch and send button -->
                    <div class="transition-all duration-200 ease-out" @click.stop>
                        <div class="overflow-hidden shrink-0 p-1 -m-1">
                            <ModelSwitch />
                        </div>
                    </div>

                    <div class="shrink-0 flex items-center" @click.stop>
                        <button
                            type="button"
                            aria-label="Send"
                            class="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors bg-text-100 text-bg-100 disabled:opacity-50 disabled:cursor-default active:scale-95 focus:outline-none"
                            :disabled="isSendDisabled"
                            @click="handleSend"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                fill="currentColor"
                                viewBox="0 0 256 256"
                            >
                                <path d="M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/*
 * EditArea Menu Item Color System
 * ================================
 * Uses project interactive-* CSS variables that adapt to light/dark themes automatically.
 *
 * States:
 *   Default  — secondary label color, transparent bg
 *   Hover    — subtle secondary bg tint
 *   Press    — deeper secondary bg tint
 *   Selected — accent bg with accent label/icon colors
 *   Selected + Hover — deeper accent bg
 *   Selected + Press — strongest accent bg
 *   Disabled — reduced opacity
 */

/* Default (unselected) menu item */
.editarea-menu-item {
    color: var(--interactive-label-secondary-default);
    background-color: transparent;
    transition: background-color 150ms ease, color 150ms ease;
}
.editarea-menu-item:hover {
    background-color: var(--interactive-bg-secondary-hover);
    color: var(--interactive-label-secondary-hover);
}
.editarea-menu-item:active {
    background-color: var(--interactive-bg-secondary-press);
    color: var(--interactive-label-secondary-press);
}
.editarea-menu-item[disabled],
.editarea-menu-item[data-disabled] {
    opacity: 0.45;
    pointer-events: none;
}

/* Selected (active/toggled-on) menu item */
.editarea-menu-item--selected {
    background-color: var(--interactive-bg-accent-default);
    color: var(--interactive-label-accent-default);
    transition: background-color 150ms ease, color 150ms ease;
}
.editarea-menu-item--selected:hover {
    background-color: var(--interactive-bg-accent-hover);
    color: var(--interactive-label-accent-hover);
}
.editarea-menu-item--selected:active {
    background-color: var(--interactive-bg-accent-press);
    color: var(--interactive-label-accent-press);
}

/* Check icon inside selected item */
.editarea-menu-item__check-icon {
    color: var(--interactive-icon-accent-selected);
}

</style>
