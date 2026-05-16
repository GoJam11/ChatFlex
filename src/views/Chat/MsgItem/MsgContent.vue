<script setup lang="ts">
import { useRemarkRenderer } from "@/views/Chat/MsgItem/useRemarkRenderer.ts";
import { MessageContent } from "@/types/msg.ts";

defineProps<{
    content: MessageContent;
    shouldFadeIn?: boolean;
    role?: "user" | "assistant" | "tool";
}>();

const { renderMarkdown } = useRemarkRenderer();
</script>

<template>
    <div class="message-content-area">
        <template v-if="typeof content === 'string'">
            <template v-if="role === 'user'">
                <div
                    class="plain-text"
                    :class="{ 'content-chunk-fade-in': shouldFadeIn }"
                >
                    {{ content }}
                </div>
            </template>
            <template v-else>
                <component
                    :is="vnode"
                    v-for="(vnode, index) in renderMarkdown(content)"
                    :key="index"
                    :class="{ 'content-chunk-fade-in': shouldFadeIn }"
                />
            </template>
        </template>
        <template v-else-if="Array.isArray(content)">
            <div
                v-for="(part, index) in content"
                :key="index"
                class="content-part"
                :class="{ 'content-chunk-fade-in': shouldFadeIn }"
            >
                <template v-if="typeof part === 'string'">
                    <template v-if="role === 'user'">
                        <div class="plain-text">
                            {{ part }}
                        </div>
                    </template>
                    <template v-else>
                        <component
                            :is="vnode"
                            v-for="(vnode, vnodeIndex) in renderMarkdown(part)"
                            :key="vnodeIndex"
                        />
                    </template>
                </template>
            </div>
        </template>
    </div>
</template>

<style scoped lang="less">
@import "../../../assets/function.less";

.content-chunk-fade-in {
    animation: chunkFadeIn 0.2s ease-out;
}

@keyframes chunkFadeIn {
    from {
        opacity: 0;
        transform: translateY(5px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.content-part {
    margin-bottom: 8px;
}

.content-part:last-child {
    margin-bottom: 0;
}

.plain-text {
    white-space: wrap;
    word-wrap: break-word;
    line-height: 1.5;
}

// 基础样式
:deep(h1),
:deep(h2),
:deep(h3),
:deep(h4),
:deep(h5),
:deep(h6) {
    margin: 16px 0 8px 0;
    font-weight: 600;
    line-height: 1.3;
}

:deep(h1) {
    font-size: 1.5em;
}
:deep(h2) {
    font-size: 1.3em;
}
:deep(h3) {
    font-size: 1.1em;
}
:deep(h4) {
    font-size: 1em;
}
:deep(h5) {
    font-size: 0.9em;
}
:deep(h6) {
    font-size: 0.8em;
}

:deep(p) {
    margin: 8px 0;
    line-height: 1.6;
}

:deep(blockquote) {
    margin: 16px 0;
    padding: 0 16px;
    border-left: 4px solid var(--border-color-primary);
    color: var(--color-text-secondary);
    font-style: italic;
}

:deep(ul),
:deep(ol) {
    margin: 8px 0;
    padding-left: 24px;
}

:deep(li) {
    margin: 4px 0;
}

:deep(hr) {
    border: none;
    border-top: 1px solid var(--border-color-secondary);
    margin: 20px 0;
}

// 链接样式现在由 MarkdownLink 组件处理

:deep(strong) {
    font-weight: 600;
}

:deep(em) {
    font-style: italic;
}

:deep(del) {
    text-decoration: line-through;
}

// table 样式
:deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 14px;

    th,
    td {
        border: none;
        /* 只保留底部边框，实现行分割 */
        border-bottom: 1px solid var(--border-color-secondary);
        padding: 12px 8px;
        text-align: left;
    }

    th {
        font-weight: bold;
        /* 使用颜色区分表头 */
        border-bottom: 1px solid var(--border-color-primary);
    }

    /* 移除最后一行多余的边框 */
    tbody tr:last-child th,
    tbody tr:last-child td {
        border-bottom: none;
    }
}

// 图片样式
:deep(.markdown-image-container) {
    margin: 16px 0;

    .markdown-image {
        max-width: 100%;
        border-radius: 8px;
    }

    .image-caption {
        margin-top: 8px;
        font-size: 12px;
        color: var(--color-text-secondary);
        text-align: center;
    }
}
</style>
