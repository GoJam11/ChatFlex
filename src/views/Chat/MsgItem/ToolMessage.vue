<script setup lang="ts">
import { computed } from "vue";
import type { Msg } from "@/types/msg";
import { contentToString } from "@/utils/messageUtils";
import { useI18n } from "vue-i18n";
import { useChatStore } from "@/features/chat/useChatStore";

const props = defineProps<{
  item: Msg;
}>();

const emit = defineEmits<{ delete: [item: Msg] }>();

const { t } = useI18n();
const chatStore = useChatStore();

const previewText = computed(() => {
  const raw = contentToString(props.item.content) ?? "";
  const singleLine = raw.replace(/\s+/g, " ").trim();
  return singleLine || t("chat.toolMessage.emptyPreview");
});

const toolName = computed(() => props.item.toolInvocation?.toolName ?? t("chat.toolMessage.defaultName"));

const collapsedLabel = computed(() =>
  t("chat.toolMessage.sheetTitle", { name: toolName.value }),
);

function openToolPanel() {
  chatStore.openRightPanel({
    type: "toolDetails",
    message: props.item,
    onDelete: () => emit("delete", props.item),
  });
}
</script>

<template>
    <button 
        class="block w-full text-left bg-transparent border-none text-text-300 hover:text-text-100 cursor-pointer text-[13px] font-semibold py-1 px-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2" 
        type="button" 
        :title="previewText" 
        @click="openToolPanel"
    >
        <span class="block leading-snug whitespace-nowrap overflow-hidden text-ellipsis">
            {{ collapsedLabel }}
        </span>
    </button>
</template>
