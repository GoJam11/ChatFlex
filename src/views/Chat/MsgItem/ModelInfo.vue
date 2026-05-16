<script setup lang="ts">
import { Layers } from "lucide-vue-next";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

defineProps<{
    model?: string;
}>();
</script>

<template>
    <TooltipProvider v-if="model">
        <Tooltip>
            <TooltipTrigger as-child>
                <div class="model-info">
                    <Layers :size="14" class="model-icon" />
                    <span class="model-text">{{ model }}</span>
                </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">{{ model }}</TooltipContent>
        </Tooltip>
    </TooltipProvider>
</template>

<style scoped lang="less">
.model-info {
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

    .model-icon {
        color: var(--text-color-3);
        opacity: 0.7;
        flex-shrink: 0;
    }

    .model-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
        line-height: 1.2;
    }
}
</style>