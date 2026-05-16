<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { useChatStore } from "@/features/chat/useChatStore";
import { useI18n } from "vue-i18n";
import type { Msg } from "@/types/msg";

const props = defineProps<{
    steps: Msg[];
    finalMessage?: Msg;
}>();

const { t } = useI18n();
const chatStore = useChatStore();
const isExpanded = ref(false);

const stepCount = computed(() => props.steps.length);

const summaryLabel = computed(() => {
    const base = t("chat.agentSteps.summary");
    return `${base} · ${t("chat.agentSteps.stepCount", { count: stepCount.value })}`;
});

const stepItems = computed(() =>
    props.steps.map((step) => {
        if (step.role === "tool") {
            const name = step.toolInvocation?.toolName
                ?? t("chat.toolMessage.defaultName");
            return {
                id: step.id,
                icon: "tool" as const,
                label: name,
            };
        }
        return {
            id: step.id,
            icon: "thinking" as const,
            label: t("chat.agentSteps.thinking"),
        };
    })
);

function toggleExpand() {
    isExpanded.value = !isExpanded.value;
}

function openStepsPanel() {
    chatStore.openRightPanel({
        type: "responseSteps",
        steps: props.steps,
        finalMessage: props.finalMessage,
    });
}
</script>

<template>
    <div v-if="steps.length > 0" class="agent-steps-block">
        <!-- 折叠状态：摘要按钮 -->
        <button
            type="button"
            class="steps-summary"
            @click="toggleExpand"
        >
            <ChevronRight
                :size="14"
                class="steps-chevron"
                :class="{ 'steps-chevron-expanded': isExpanded }"
            />
            <span class="steps-summary-text">{{ summaryLabel }}</span>
        </button>

        <!-- 展开状态：步骤列表 -->
        <div v-if="isExpanded" class="steps-list">
            <button
                v-for="item in stepItems"
                :key="item.id"
                type="button"
                class="step-item"
                @click="openStepsPanel"
            >
                <span class="step-icon">
                    {{ item.icon === 'tool' ? '🔧' : '💭' }}
                </span>
                <span class="step-item-label">{{ item.label }}</span>
            </button>
        </div>
    </div>
</template>

<style scoped lang="less">
.agent-steps-block {
    margin-bottom: 8px;
}

.steps-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--text-color-2);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    padding: 4px 0;
    text-align: left;
    width: 100%;
    transition: color 0.15s ease;

    &:hover {
        color: var(--text-color-1);
    }

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
}

.steps-chevron {
    flex-shrink: 0;
    transition: transform 0.2s ease;
}

.steps-chevron-expanded {
    transform: rotate(90deg);
}

.steps-summary-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.steps-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 20px;
    margin-top: 2px;
}

.step-item {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--text-color-3);
    cursor: pointer;
    font-size: 12px;
    padding: 3px 0;
    text-align: left;
    width: 100%;
    transition: color 0.15s ease;

    &:hover {
        color: var(--text-color-1);
    }

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
}

.step-icon {
    flex-shrink: 0;
    font-size: 12px;
}

.step-item-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
