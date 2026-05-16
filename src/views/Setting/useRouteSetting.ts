import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

/**
 * 从路由参数获取设置Tab的composable
 * 用于设置页面的Tab路由管理
 */
export function useRouteSetting() {
    const route = useRoute();
    const router = useRouter();

    // 支持的设置Tab
    const validTabs = [
        "api",
        "model",
        "mcp",
        "ui",
        "data",
        "guide",
        "about"
    ];

    // 从路由参数获取当前Tab
    const activeTab = computed(() => {
        const tab = route.params.tab as string;
        return validTabs.includes(tab) ? tab : "api";
    });

    // 切换Tab
    const switchTab = async (tab: string) => {
        if (validTabs.includes(tab)) {
            await router.push({ name: "Setting", params: { tab } });
        }
    };

    return {
        activeTab,
        switchTab,
        validTabs,
    };
}
