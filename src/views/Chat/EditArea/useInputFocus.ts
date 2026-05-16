import { ref, watch, onMounted, nextTick, Ref } from "vue";

/**
 * 输入框聚焦管理的hooks
 * @param watchValue 需要监听的响应式值，当该值变化时会自动聚焦输入框
 * @returns 包含inputRef和focusInput方法的对象
 */
export function useInputFocus(watchValue?: Ref<any> | (() => any)) {
    const inputRef = ref<any>(null);

    // 聚焦输入框的通用函数（兼容组件实例与原生元素）
    async function focusInput() {
        await nextTick();

        const refVal = inputRef.value as any;
        if (!refVal) return;

        // 直接是可聚焦的原生元素
        if (typeof refVal.focus === "function") {
            refVal.focus();
            return;
        }

        // 可能是组件实例，尝试使用 $el
        const rootEl = refVal.$el ?? null;

        // 组件根就是原生可聚焦元素
        if (rootEl && typeof rootEl.focus === "function") {
            rootEl.focus();
            return;
        }

        // 在容器内查找可聚焦的元素
        const container: any = rootEl ?? refVal;
        const candidate: HTMLElement | null =
            container?.querySelector?.(
                'textarea, input, [contenteditable=""], [contenteditable="true"]'
            ) ?? null;

        if (candidate && typeof (candidate as any).focus === "function") {
            (candidate as any).focus();
        }
    }

    // 组件挂载时聚焦输入框
    onMounted(() => {
        focusInput();
    });

    // 如果提供了监听值，则监听其变化并自动聚焦
    if (watchValue) {
        watch(watchValue, () => {
            focusInput();
        });
    }

    return {
        inputRef,
        focusInput,
    };
}
