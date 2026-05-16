import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { useChat } from "@/views/Chat/composables/useChat.ts";
import { useProviderService } from '@/features/provider/providerService';
import type { Provider } from '@/types/provider';
import { saveTextFile } from '@/utils/save-file';

type ChatMessage = {
    role: string;
    content: string | Array<string | object>;
};

type ChatWithMessages = {
    id: string;
    short?: string;
    time: number;
    messages: ChatMessage[];
};

type ChatHistoryExportFormat = "json" | "markdown";

const EXPORT_VERSION = "1.0.0";

const createDefaultFilename = (prefix: string, extension: string) =>
    `${prefix}_${new Date().toISOString().split("T")[0]}.${extension}`;

const buildModelConfigExportData = (
    providerList: Provider[]
) => ({
    meta: {
        exportedAt: new Date().toISOString(),
        version: EXPORT_VERSION,
        type: "model-config",
        providerCount: providerList.length,
    },
    providers: providerList.map((provider) => ({
        key: provider.key,
        origin: provider.origin,
        displayName: provider.displayName,
        apiKey: provider.apiKey,
        defaultBaseUrl: provider.defaultBaseUrl,
        baseUrl: provider.baseUrl,
        isActive: provider.isActive,
        showApiKey: provider.showApiKey,
        showBaseUrl: provider.showBaseUrl,
        showDelete: provider.showDelete,
        selectedModels: [...provider.selectedModels],
    })),
});

const buildChatHistoryExportData = (chatsWithMessages: ChatWithMessages[]) => ({
    meta: {
        exportedAt: new Date().toISOString(),
        version: EXPORT_VERSION,
        type: "chat-history",
        conversationCount: chatsWithMessages.length,
    },
    conversations: chatsWithMessages.map((chat) => ({
        id: chat.id,
        short: chat.short,
        time: chat.time,
        messages: chat.messages.map((message) => ({
            role: message.role,
            content: message.content,
        })),
    })),
});

export function useDataExport() {
    const providerService = useProviderService();
    const { exportChatHistory: loadChatHistory } = useChat();
    const { t } = useI18n();

    const chatHistoryExportFormat = ref<ChatHistoryExportFormat>("markdown");
    const chatHistoryFormatLabel = computed(() =>
        chatHistoryExportFormat.value === "json"
            ? t("dataExport.formatJson")
            : t("dataExport.formatMarkdown")
    );

    const isExporting = reactive({
        modelConfig: false,
        chatHistory: false,
    });

    const formatChatHistoryToMarkdown = (chatsWithMessages: ChatWithMessages[]): string => {
        let content = `# 会话历史记录导出\n\n`;
        content += `**导出时间:** ${new Date().toLocaleString()}\n`;
        content += `**版本:** ${EXPORT_VERSION}\n`;
        content += `**类型:** 会话历史记录\n`;
        content += `**会话数量:** ${chatsWithMessages.length}\n\n`;
        content += `---\n\n`;

        if (chatsWithMessages.length === 0) {
            content += `暂无会话记录\n`;
        } else {
            chatsWithMessages.forEach((chat, chatIndex) => {
                content += `## 会话 ${chatIndex + 1}: ${
                    chat.short || t("chat.renameModal.newChatDefault")
                }\n\n`;
                content += `**创建时间:** ${new Date(chat.time).toLocaleString()}\n`;
                content += `**消息数量:** ${chat.messages.length}\n\n`;

                if (chat.messages.length > 0) {
                    content += `### 对话内容\n\n`;
                    chat.messages.forEach((message) => {
                        const role =
                            message.role === "user"
                                ? t("dataExport.user")
                                : message.role === "assistant"
                                    ? t("dataExport.assistant")
                                    : t("dataExport.tool");
                        content += `#### ${role}\n\n`;

                        let messageContent = "";
                        if (typeof message.content === "string") {
                            messageContent = message.content;
                        } else if (Array.isArray(message.content)) {
                            messageContent = message.content
                                .map((item) => (typeof item === "string" ? item : "[图片]"))
                                .join("");
                        } else {
                            messageContent = "[图片]";
                        }

                        content += `${messageContent}\n\n`;
                    });
                }

                if (chatIndex < chatsWithMessages.length - 1) {
                    content += `---\n\n`;
                }
            });
        }

        return content;
    };

    const exportModelConfig = async () => {
        if (isExporting.modelConfig) return;

        isExporting.modelConfig = true;
        try {
            await providerService.ready();
            const jsonContent = JSON.stringify(
                buildModelConfigExportData(providerService.providerList.value),
                null,
                2
            );

            const saved = await saveTextFile(
                createDefaultFilename("模型配置", "json"),
                jsonContent,
                [
                    {
                        name: "JSON files",
                        extensions: ["json"],
                    },
                ],
                "application/json"
            );

            if (saved) {
                toast.success(t("dataExport.modelConfigExportSuccess"));
            }
        } catch (error) {
            console.error("导出模型配置失败:", error);
            toast.error(t("dataExport.modelConfigExportFailed"));
        } finally {
            isExporting.modelConfig = false;
        }
    };

    const exportChatHistory = async () => {
        if (isExporting.chatHistory) return;

        isExporting.chatHistory = true;
        try {
            const result = await loadChatHistory();

            if (!result.success || !result.data) {
                throw new Error(result.error || t("dataExport.exportFailed"));
            }

            const chatsWithMessages = result.data as ChatWithMessages[];

            if (chatHistoryExportFormat.value === "json") {
                const jsonContent = JSON.stringify(
                    buildChatHistoryExportData(chatsWithMessages),
                    null,
                    2
                );
                const saved = await saveTextFile(
                    createDefaultFilename("会话历史记录", "json"),
                    jsonContent,
                    [
                        {
                            name: "JSON files",
                            extensions: ["json"],
                        },
                    ],
                    "application/json"
                );

                if (saved) {
                    toast.success(t("dataExport.chatHistoryExportSuccess"));
                }
            } else {
                const markdownContent = formatChatHistoryToMarkdown(chatsWithMessages);
                const saved = await saveTextFile(
                    createDefaultFilename("会话历史记录", "md"),
                    markdownContent,
                    [
                        {
                            name: "Markdown files",
                            extensions: ["md"],
                        },
                    ],
                    "text/markdown"
                );

                if (saved) {
                    toast.success(t("dataExport.chatHistoryExportSuccess"));
                }
            }
        } catch (error) {
            console.error("导出会话历史记录失败:", error);
            toast.error(t("dataExport.chatHistoryExportFailed"));
        } finally {
            isExporting.chatHistory = false;
        }
    };

    return {
        chatHistoryExportFormat,
        chatHistoryFormatLabel,
        exportChatHistory,
        exportModelConfig,
        isExporting,
    };
}

export type { ChatHistoryExportFormat };
