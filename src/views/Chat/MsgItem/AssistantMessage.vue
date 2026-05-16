<script setup lang="ts">
import { computed } from "vue";
import { Refresh } from "@vicons/ionicons5";
import { Copy, Trash } from "@vicons/tabler";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import MsgContent from "@/views/Chat/MsgItem/MsgContent.vue";
import ThinkingBlock from "@/views/Chat/MsgItem/ThinkingBlock.vue";
import ModelInfo from "@/views/Chat/MsgItem/ModelInfo.vue";
import TokenInfo from "@/views/Chat/MsgItem/TokenInfo.vue";
import { MessageStatus, Msg } from "@/types/msg.ts";
import { contentToString } from "@/utils/messageUtils.ts";
import { useI18n } from 'vue-i18n';

const props = withDefaults(
    defineProps<{
        item: Msg;
        showActions?: boolean;
        hideThinking?: boolean;
    }>(),
    { showActions: true, hideThinking: false }
);

const emit = defineEmits<{
    retry: [item: Msg];
    delete: [item: Msg];
}>();

const { t } = useI18n();

// 判断是否显示操作按钮
const shouldShowActions = computed(() => {
    return (
        props.item.status === MessageStatus.COMPLETED ||
        props.item.status === MessageStatus.ERROR
    );
});

// 判断是否显示内容
const shouldShowContent = computed(() => {
    return (
        props.item.content &&
        props.item.status !== MessageStatus.ERROR &&
        props.item.content.toString().trim().length > 0
    );
});

const processingStatusText = computed(() => {
    switch (props.item.status) {
        case MessageStatus.WAITING:
            return t('chat.thinkingBlock.waitingResponse');
        case MessageStatus.THINKING:
            return t('chat.thinkingBlock.thinking');
        case MessageStatus.GENERATING:
            return t('chat.thinkingBlock.generating');
        default:
            return "";
    }
});

const shouldShowProcessingPlaceholder = computed(() => {
    return (
        !shouldShowContent.value &&
        props.item.status !== MessageStatus.ERROR &&
        processingStatusText.value.length > 0
    );
});

// 判断是否应用淡入动画
const shouldFadeIn = computed(() => {
    return (
        props.item.status === MessageStatus.GENERATING ||
        props.item.status === MessageStatus.WAITING ||
        props.item.status === MessageStatus.THINKING
    );
});

function handleRetry() {
    emit("retry", props.item);
}

function handleDelete() {
    emit("delete", props.item);
}

function handleCopy() {
    const contentStr = contentToString(props.item.content);
    navigator.clipboard.writeText(contentStr).then(() => {
        toast.success(t('messages.copySuccess'));
    });
}
</script>

<template>
    <div class="w-full group">
        <div class="w-full rounded-xl p-0">
            <div class="flex flex-col gap-0 grow min-w-0">
                <!-- 思考过程，位于内容之前（分组模式下由 AgentStepsBlock 统一处理） -->
                <ThinkingBlock v-if="!hideThinking" :item="item" />

                <!-- 错误提示 -->
                <Alert
                    v-if="item.status === MessageStatus.ERROR"
                    variant="destructive"
                    class="mb-4"
                >
                    <AlertTitle>{{ t('errors.operationFailed') }}</AlertTitle>
                    <AlertDescription>
                        {{ item.errorMsg || contentToString(item.content) }}
                    </AlertDescription>
                </Alert>

                <!-- 消息内容（非错误状态下展示） -->
                <MsgContent
                    v-else-if="shouldShowContent || shouldShowProcessingPlaceholder"
                    :content="shouldShowContent ? item.content : processingStatusText"
                    :role="item.role"
                    :should-fade-in="shouldFadeIn"
                />

                <!-- 操作按钮和信息（最后展示） -->
                <div v-if="showActions && shouldShowActions" class="flex justify-between items-center mt-1">
                    <TooltipProvider>
                        <div class="flex gap-1 -ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Tooltip>
                                <TooltipTrigger as-child>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-7 w-7 text-text-400 hover:text-text-100 hover:bg-bg-300"
                                        @click="handleRetry"
                                    >
                                        <Refresh class="w-3 h-3" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    {{ t('chat.messageActions.regenerate') }}
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger as-child>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-7 w-7 text-text-400 hover:text-text-100 hover:bg-bg-300"
                                        @click="handleCopy"
                                    >
                                        <Copy class="w-3 h-3" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    {{ t('chat.messageActions.copy') }}
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger as-child>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-7 w-7 text-text-400 hover:text-text-100 hover:bg-bg-300"
                                        @click="handleDelete"
                                    >
                                        <Trash class="w-3 h-3" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    {{ t('chat.messageActions.delete') }}
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
                    <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <TokenInfo :usage="item.usage" />
                        <ModelInfo :model="item.model" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* No scoped styles needed */
</style>
