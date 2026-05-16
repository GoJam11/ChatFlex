<script setup lang="ts">
import { computed, ref } from "vue";
import hljs from "highlight.js";
import { Copy, Check, Terminal, Eye, Code } from "lucide-vue-next";

interface Props {
    code: string;
    language?: string;
    meta?: string;
    enableAnimation?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    language: "",
    meta: "",
    enableAnimation: false,
});

const showCopyFeedback = ref(false);
const showPreview = ref(false);

const isHtml = computed(() => {
    const lang = props.language.toLowerCase();
    return lang === "html" || lang === "htm";
});

const highlightedCode = computed(() => {
    if (!props.code) return "";

    if (props.language && hljs.getLanguage(props.language)) {
        try {
            return hljs.highlight(props.code, {
                language: props.language,
                ignoreIllegals: true,
            }).value;
        } catch (error) {
            console.warn("代码高亮失败:", error);
        }
    }

    return hljs.highlight(props.code, { language: "plaintext" }).value;
});

const copyCode = async () => {
    try {
        await navigator.clipboard.writeText(props.code);
        showCopyFeedback.value = true;
        setTimeout(() => {
            showCopyFeedback.value = false;
        }, 2000);
    } catch (error) {
        console.error("复制失败:", error);
    }
};
</script>

<template>
    <div
        class="group/code relative my-3 rounded-lg border border-border bg-muted/50 overflow-hidden"
        :class="enableAnimation ? 'animate-in fade-in slide-in-from-bottom-1 duration-300' : ''"
    >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/80">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <Terminal class="size-3.5" />
                <span class="font-medium">{{ language || 'text' }}</span>
            </div>
            <div class="flex items-center gap-1">
                <button
                    v-if="isHtml"
                    class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    @click="showPreview = !showPreview"
                >
                    <Eye v-if="!showPreview" class="size-3.5" />
                    <Code v-else class="size-3.5" />
                    {{ showPreview ? "源码" : "预览" }}
                </button>
                <button
                    class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    @click="copyCode"
                >
                    <Transition name="icon-swap" mode="out-in">
                        <Check v-if="showCopyFeedback" class="size-3.5" />
                        <Copy v-else class="size-3.5" />
                    </Transition>
                    {{ showCopyFeedback ? "已复制" : "复制" }}
                </button>
            </div>
        </div>
        <!-- Code -->
        <pre v-show="!showPreview" class="hljs overflow-x-auto p-4 m-0 text-[13px] leading-relaxed bg-transparent"><code v-html="highlightedCode" /></pre>
        <!-- HTML Preview -->
        <iframe
            v-if="isHtml && showPreview"
            :srcdoc="code"
            sandbox="allow-scripts"
            class="w-full border-0 bg-white"
            style="min-height: 200px"
            @load="($event.target as HTMLIFrameElement).style.height = ($event.target as HTMLIFrameElement).contentDocument?.documentElement?.scrollHeight + 'px'"
        />
    </div>
</template>

<style scoped>
.icon-swap-enter-active,
.icon-swap-leave-active {
    transition: all 0.15s ease;
}
.icon-swap-enter-from {
    opacity: 0;
    transform: scale(0.8);
}
.icon-swap-leave-to {
    opacity: 0;
    transform: scale(0.8);
}

pre code {
    background: none;
    padding: 0;
    border-radius: 0;
}
</style>
