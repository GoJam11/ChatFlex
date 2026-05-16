<script setup lang="ts">
import { ref } from "vue";
import EditMessageDialog from "@/views/Chat/MsgItem/EditMessageDialog.vue";
import UserMessage from "@/views/Chat/MsgItem/UserMessage.vue";
import AssistantMessage from "@/views/Chat/MsgItem/AssistantMessage.vue";
import ToolMessage from "@/views/Chat/MsgItem/ToolMessage.vue";
import { MessageContent, Msg } from "@/types/msg.ts";
import {
    extractTextFromContent,
    reconstructContentWithNewText,
} from "@/utils/messageUtils.ts";

const props = withDefaults(
    defineProps<{
        item: Msg;
        showActions?: boolean;
        hideThinking?: boolean;
        hideToolMessage?: boolean;
    }>(),
    { showActions: true, hideThinking: false, hideToolMessage: false }
);

const emit = defineEmits<{
    retry: [item: Msg];
    delete: [item: Msg];
    edit: [item: Msg, newContent: MessageContent];
}>();

// Edit dialog state
const showEditDialog = ref(false);

function handleRetry(item: Msg) {
    emit("retry", item);
}

function handleDelete(item: Msg) {
    emit("delete", item);
}

function handleEdit() {
    showEditDialog.value = true;
}

function handleSaveEdit(newTextContent: string) {
    const newContent = reconstructContentWithNewText(
        props.item.content,
        newTextContent
    );
    emit("edit", props.item, newContent);
    showEditDialog.value = false;
}

function handleCancelEdit() {
    showEditDialog.value = false;
}
</script>

<template>
    <div 
        class="message-container"
        :data-message-id="item.id"
        :data-role="item.role"
    >
        <!-- 用户消息 -->
        <UserMessage
            v-if="item.role === 'user'"
            :item="item"
            @edit="handleEdit"
            @delete="handleDelete"
            @retry="handleRetry"
        />

        <!-- 工具调用结果（分组模式下由 AgentStepsBlock 统一处理） -->
        <ToolMessage
            v-else-if="item.role === 'tool' && !hideToolMessage"
            :item="item"
            @delete="handleDelete"
        />

        <!-- 助手消息 -->
        <AssistantMessage
            v-else-if="item.role === 'assistant'"
            :item="item"
            :show-actions="showActions"
            :hide-thinking="hideThinking"
            @retry="handleRetry"
            @delete="handleDelete"
        />
    </div>

    <!-- Edit Message Dialog -->
    <EditMessageDialog
        v-model:open="showEditDialog"
        :text-content="extractTextFromContent(item.content)"
        @save="handleSaveEdit"
        @cancel="handleCancelEdit"
    />
</template>

<style scoped lang="less">
.message-container {
    margin-bottom: 24px;
}
</style>
