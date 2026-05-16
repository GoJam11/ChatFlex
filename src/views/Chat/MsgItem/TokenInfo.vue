<script setup lang="ts">
import { computed } from "vue";
import type { LanguageModelUsage } from "ai";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSettingStore } from "@/features/setting/useSettingStore.ts";
import { useI18n } from "@/features/i18n/useI18n";

const props = defineProps<{
    usage?: LanguageModelUsage;
}>();

const settingStore = useSettingStore();
const { t } = useI18n();

const tokenStats = computed(() => {
    if (!props.usage) {
        return { input: 0, output: 0, total: 0 };
    }

    const input = props.usage.inputTokens ?? 0;
    const output = props.usage.outputTokens ?? 0;
    const total = props.usage.totalTokens ?? (input || output ? input + output : 0);

    return { input, output, total };
});

const tooltipText = computed(() => {
    const { input, output, total } = tokenStats.value;
    if (!props.usage) return "";
    return `${t('chat.tokenInfo.prompt')}: ${input} | ${t('chat.tokenInfo.completion')}: ${output} | ${t('chat.tokenInfo.total')}: ${total}`;
});

const totalTokenText = computed(() => {
    return tokenStats.value.total;
});
</script>

<template>
    <TooltipProvider v-if="usage && settingStore.showTokenUsage">
        <Tooltip>
            <TooltipTrigger as-child>
                <div class="token-info">
                    <svg
                        class="token-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
                            stroke="currentColor"
                            stroke-width="2"
                            fill="none"
                        />
                        <path
                            d="M8 12h8M12 8v8"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                    </svg>
                    <span class="token-text">{{ totalTokenText }}T</span>
                </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                {{ tooltipText }}
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
</template>

<style scoped lang="less">
.token-info {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-color-3);
    padding: 3px 8px;
    background-color: color-mix(
        in srgb,
        var(--body-color) 90%,
        var(--text-color-3) 8%
    );
    border: 1px solid
        color-mix(in srgb, var(--border-color) 80%, transparent 20%);
    border-radius: 12px;
    transition: all 0.2s ease;
    user-select: none;

    &:hover {
        background-color: color-mix(
            in srgb,
            var(--body-color) 85%,
            var(--text-color-3) 12%
        );
        border-color: color-mix(
            in srgb,
            var(--border-color) 70%,
            var(--text-color-3) 15%
        );
    }

    .token-icon {
        width: 14px;
        height: 14px;
        color: var(--text-color-3);
        opacity: 0.7;
        flex-shrink: 0;
    }

    .token-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 80px;
        line-height: 1.2;
    }
}
</style>
