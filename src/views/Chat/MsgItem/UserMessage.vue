<script setup lang="ts">
import { toRef } from "vue";
import { Edit, Trash, Copy } from "@vicons/tabler";
import { Refresh } from "@vicons/ionicons5";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import ImageDisplayComponent from "@/views/Chat/MsgItem/ImageDisplayComponent.vue";
import MsgContent from "@/views/Chat/MsgItem/MsgContent.vue";
import { useUserImages } from "@/views/Chat/MsgItem/useUserImages.ts";
import { Msg, ImageData as MsgImageData } from "@/types/msg.ts";
import { extractTextFromContent } from "@/utils/messageUtils.ts";
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    item: Msg;
}>();

const emit = defineEmits<{
    delete: [item: Msg];
    edit: [item: Msg];
    retry: [item: Msg];
}>();

const { t } = useI18n();

const { userImages, filteredUserContent } = useUserImages(toRef(props, "item"));

function handleEdit() {
    emit("edit", props.item);
}

function handleDelete() {
    emit("delete", props.item);
}

function handleRetry() {
    emit("retry", props.item);
}

async function handleCopy() {
    const textContent = extractTextFromContent(props.item.content);
    if (textContent) {
        try {
            await navigator.clipboard.writeText(textContent);
        } catch (error) {
            console.error('Failed to copy text:', error);
        }
    }
}
</script>

<template>
    <div class="flex flex-col items-end group">
        <!-- 用户图片显示在消息气泡上方 -->
        <div v-if="userImages.length > 0" class="w-full flex justify-end mb-2">
            <div class="flex flex-wrap gap-2 max-w-[300px]">
                <ImageDisplayComponent
                    v-for="(image, index) in userImages"
                    :key="index"
                    :image-data="image as MsgImageData"
                />
            </div>
        </div>

        <!-- 用户消息气泡 -->
        <div class="w-fit max-w-full rounded-2xl self-end px-4 py-3 bg-bg-200/60 dark:bg-bg-200/85 text-text-100">
            <MsgContent
                v-if="filteredUserContent"
                :content="filteredUserContent"
                :role="item.role"
                :should-fade-in="false"
            />
        </div>

        <!-- 用户消息操作按钮 -->
        <div class="flex justify-end mt-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger as-child>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6 text-text-400 hover:text-text-100 hover:bg-bg-300"
                            @click="handleRetry"
                        >
                            <Refresh class="w-3 h-3" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        {{ t('chat.messageActions.retry') }}
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger as-child>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6 text-text-400 hover:text-text-100 hover:bg-bg-300"
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
                        <Button variant="ghost" size="icon" class="h-6 w-6 text-text-400 hover:text-text-100 hover:bg-bg-300" @click="handleEdit">
                            <Edit class="w-3 h-3" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        {{ t('chat.messageActions.edit') }}
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger as-child>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6 text-text-400 hover:text-text-100 hover:bg-bg-300"
                            @click="handleDelete"
                        >
                            <Trash class="w-3 h-3" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        {{ t('chat.messageActions.delete') }}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    </div>
</template>

<style scoped>
/* No scoped styles needed */
</style>
