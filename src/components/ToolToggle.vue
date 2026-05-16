<script setup lang="ts">
/**
 * ToolToggle Component
 * 
 * 通用工具开关按钮，提供一致的状态管理与提示
 */

import { computed } from 'vue';
import { Search } from 'lucide-vue-next';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

// Props接口定义
interface Props {
    modelValue: boolean;
    available: boolean;
    configured: boolean;
    inProgress: boolean;
    disabled?: boolean;
    label?: string;
    tooltipActive?: string;
    tooltipInactive?: string;
    tooltipMissingConfig?: string;
}

// Emits接口定义
interface Emits {
    (e: 'update:modelValue', value: boolean): void;
    (e: 'toggle'): void;
}

// Props和Emits
const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    label: '搜索',
    tooltipActive: '点击关闭该工具，模型将不会调用它',
    tooltipInactive: '点击启用该工具，模型会按需决定是否使用',
    tooltipMissingConfig: '请先在设置中配置搜索功能',
});

const emit = defineEmits<Emits>();

// 计算属性
const isClickable = computed(() => {
    return props.available && !props.inProgress && !props.disabled;
});

const shouldShowActiveState = computed(() => {
    return props.modelValue && props.available;
});

const buttonClasses = computed(() => {
    const baseClasses =
        'tool-toggle-button flex items-center pt-1 pb-1 pl-2 pr-2 rounded-full transition-all';

    if (!isClickable.value) {
        return `${baseClasses} opacity-50 cursor-not-allowed`;
    }

    if (shouldShowActiveState.value) {
        return `${baseClasses} cursor-pointer`;
    }

    return `${baseClasses} hover:bg-[var(--icon-hover-color)] cursor-pointer`;
});

const activeStateClasses = computed(() => {
    if (shouldShowActiveState.value) {
        return 'tool-toggle-button--active';
    }
    return '';
});

const iconClasses = computed(() => {
    if (shouldShowActiveState.value) {
        return 'text-[var(--primary-color)]';
    } else {
        return 'text-[var(--icon-color)]';
    }
});

const textClasses = computed(() => {
    if (shouldShowActiveState.value) {
        return 'text-[var(--primary-color)] pl-1';
    } else {
        return 'text-[var(--icon-color)] pl-1';
    }
});

const displayText = computed(() => props.label ?? '搜索');

const tooltipText = computed(() => {
    if (!props.configured) {
        return props.tooltipMissingConfig;
    }

    return props.modelValue ? props.tooltipActive : props.tooltipInactive;
});

// 事件处理
const handleToggle = () => {
    if (isClickable.value) {
        const newValue = !props.modelValue;
        emit('update:modelValue', newValue);
        emit('toggle');
    }
};
</script>

<template>
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger as-child>
                <div
                    :class="[buttonClasses, activeStateClasses]"
                    @click="handleToggle"
                >
                    <slot name="icon" :icon-classes="iconClasses">
                        <Search :class="iconClasses" :size="16" />
                    </slot>
                    <span :class="textClasses">
                        {{ displayText }}
                    </span>
                </div>
            </TooltipTrigger>
            <TooltipContent side="top">
                {{ tooltipText }}
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
</template>

<style scoped lang="less">
@import "@/assets/token.less";

.tool-toggle-button--active {
    background-color: color-mix(in srgb, var(--primary-color) 30%, transparent);
}

.dark .tool-toggle-button--active {
    background-color: color-mix(in srgb, var(--primary-color) 45%, transparent);
}
</style>
