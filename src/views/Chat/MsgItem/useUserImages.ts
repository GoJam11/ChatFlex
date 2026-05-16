import { computed, type Ref } from "vue";
import { 
    extractImagesFromContent, 
    filterImagesFromContent 
} from "@/utils/messageUtils.ts";
import { Msg, MessageContent } from "@/types/msg.ts";

export function useUserImages(item: Ref<Msg>) {
    // 提取用户消息中的图片
    const userImages = computed(() => {
        if (item.value.role !== "user") return [];
        return extractImagesFromContent(item.value.content);
    });

    // 过滤掉图片后的用户消息内容
    const filteredUserContent = computed<MessageContent | null>(() => {
        if (item.value.role !== "user") return item.value.content;
        return filterImagesFromContent(item.value.content);
    });

    return {
        userImages,
        filteredUserContent,
    };
}