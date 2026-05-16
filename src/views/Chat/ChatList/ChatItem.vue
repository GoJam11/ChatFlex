<script setup lang="ts">
import { Chat } from "@/types/chat.ts";
import { useRouter, useRoute } from "vue-router";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Star, Edit3, Trash2, Download } from "lucide-vue-next";
import type { Msg } from "@/types/msg";
import { useMessageStore } from "@/features/msg/useMessageStore.ts";
import { getChatMessages } from "@/features/msg/messageDataAccess";
import { useI18n } from "@/features/i18n/useI18n";
import { saveTextFile } from "@/utils/save-file";

const router = useRouter();
const route = useRoute();
const messageStore = useMessageStore();
const { t } = useI18n();

const props = defineProps<{
    item: Chat;
    isActive: boolean;
}>();

const emit = defineEmits<{
    click: [item: Chat];
    delete: [item: Chat];
    rename: [item: Chat];
    pin: [item: Chat];
    export: [item: Chat];
}>();

function handleClick() {
    // 检查当前路由是否为会话路由
    if (route.name !== "Layout" && route.name !== "Chat") {
        // 如果不是会话路由，则导航回会话路由
        router.push("Layout");
    }

    emit("click", props.item);
}

function handleRename() {
    emit("rename", props.item);
}

function handleDelete() {
    emit("delete", props.item);
}

function handlePin() {
    emit("pin", props.item);
}

const resolveMessagesForExport = async (chatId: string): Promise<Msg[]> => {
    const storeMessages = messageStore.getMessages(chatId);

    if (storeMessages.length > 0) {
        return storeMessages;
    }

    const result = await getChatMessages(chatId);

    if (result.success && result.messages) {
        return result.messages;
    }

    throw new Error(result.error || t("chat.export.exportFailed"));
};

async function handleExport() {
    try {
        // 格式化聊天消息为 Markdown 格式
        const formatChatToMarkdown = (chat: Chat, messages: Msg[]): string => {
            let content = `# ${chat.short || t('chat.renameModal.newChatDefault')}\n\n`;
            content += `**${t('chat.export.createTime')}:** ${new Date(
                chat.time
            ).toLocaleString()}\n`;
            content += `**${t('chat.export.messageCount')}:** ${messages.length}\n\n`;
            content += `---\n\n`;

            messages.forEach((message, index) => {
                const role = message.role === "user"
                    ? t('chat.export.user')
                    : message.role === "assistant"
                        ? t('chat.export.assistant')
                        : t('chat.export.tool');
                content += `## ${role}\n\n`;

                // 处理消息内容，确保正确显示
                let messageContent = "";
                if (typeof message.content === "string") {
                    messageContent = message.content;
                } else if (Array.isArray(message.content)) {
                    // 处理混合内容（文本和图片）
                    messageContent = message.content
                        .map((item) =>
                            typeof item === "string" ? item : "[Image]"
                        )
                        .join("");
                } else {
                    messageContent = "[Image]";
                }

                content += `${messageContent}\n\n`;

                if (index < messages.length - 1) {
                    content += `---\n\n`;
                }
            });

            return content;
        };

        const messages = await resolveMessagesForExport(props.item.id);
        const markdownContent = formatChatToMarkdown(props.item, messages);

        const saved = await saveTextFile(
            `${props.item.short || t('chat.export.defaultFileName')}.md`,
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
            console.log(t('chat.export.exportSuccess'));
        }
    } catch (error) {
        console.error(t('chat.export.exportFailed'), error);
    }
}
</script>

<template>
    <ContextMenu>
        <ContextMenuTrigger as-child>
            <div
                class="group relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-black/[0.06] dark:hover:bg-white/10 cursor-pointer transition-colors duration-150"
                :class="{ 'bg-black/[0.06] dark:bg-white/10 text-text-100': isActive, 'text-text-100': !isActive }"
                @click="handleClick"
            >
                <div class="flex flex-1 items-center gap-2 overflow-hidden">
                    <div v-if="item.pinned" class="flex items-center justify-center text-text-300 group-hover:text-text-100 transition-colors">
                        <Star class="h-4 w-4 fill-current" />
                    </div>
                    <span class="truncate">{{
                        item.short || t('chat.renameModal.newChatDefault')
                    }}</span>
                </div>
            </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
            <ContextMenuItem @click="handlePin">
                <Star class="mr-2 h-4 w-4" />
                {{ item.pinned ? t('chat.chatItem.unpin') : t('chat.chatItem.pin') }}
            </ContextMenuItem>
            <ContextMenuItem @click="handleRename">
                <Edit3 class="mr-2 h-4 w-4" />
                {{ t('chat.chatItem.rename') }}
            </ContextMenuItem>
            <ContextMenuItem @click="handleExport">
                <Download class="mr-2 h-4 w-4" />
                {{ t('chat.chatItem.exportChat') }}
            </ContextMenuItem>
            <ContextMenuItem @click="handleDelete">
                <Trash2 class="mr-2 h-4 w-4" />
                {{ t('chat.chatItem.deleteChat') }}
            </ContextMenuItem>
        </ContextMenuContent>
    </ContextMenu>
</template>
