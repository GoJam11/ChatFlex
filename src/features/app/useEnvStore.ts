import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useStorage, useWindowSize } from "@vueuse/core";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const useEnvStore = defineStore("environment", () => {
    // 根据构建模式判断生产/开发环境
    const isProd = ref(import.meta.env.PROD);

    const isWin = navigator.platform.startsWith("Win");
    const isMacOS = computed(() => {
        return (
            typeof navigator !== "undefined" &&
            /Mac|iPod|iPhone|iPad/.test(navigator.platform)
        );
    });

    // 检测是否为移动平台（iOS/Android）
    const isMobile = computed(() => {
        const userAgent = navigator.userAgent || navigator.vendor;
        return (
            /android|ipad|iphone|ipod/i.test(userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
        ); // iPad
    });

    // 检测是否为桌面平台（支持自更新）
    const isDesktop = computed(() => !isMobile.value);
    const autoUpdateDisabled = computed(() => {
        const flag = String(import.meta.env.VITE_DISABLE_AUTO_UPDATE ?? "true").toLowerCase();
        return flag === "true";
    });

    const isDevModeOn = ref(false);
    // 持久化更新状态
    const updateAvailable = useStorage("update/available", false);
    const updateDownloaded = useStorage("update/downloaded", false);
    const updateInstalling = ref(false); // 安装状态不需要持久化
    const updateInfo = useStorage("update/info", {
        version: "",
        notes: "",
        date: "",
    });
    // 存储更新下载路径，用于应用重启后恢复更新实例
    const updateDownloadPath = useStorage("update/downloadPath", "");

    const themeStatus = useStorage("theme-status", "dark");
    const showSomeShortCuts = useStorage("ui/showSomeShortCuts", false);

    const { width } = useWindowSize();
    const isPC = computed(() => width.value >= 768);
    const isM = computed(() => width.value < 768);

    // Desktop fullscreen state
    const isFullscreen = ref(false);

    const isElectronEnv = typeof window !== "undefined" && isTauri();

    if (isElectronEnv) {
        const appWindow = getCurrentWindow();

        const updateFullscreenState = async () => {
            try {
                const newFullscreenState = await appWindow.isFullscreen();
                isFullscreen.value = newFullscreenState;
            } catch (error) {
                console.warn("Failed to get fullscreen state:", error);
            }
        };

        // Update initial state
        updateFullscreenState();

        appWindow.onResized(() => {
            updateFullscreenState().catch(error => {
                console.warn("Failed to update fullscreen state after resize:", error);
            });
        }).catch(error => {
            console.warn("Failed to subscribe to window resize events:", error);
        });
    }

    return {
        isWin,
        isMacOS,
        isMobile,
        isDesktop,
        isDevModeOn,
        themeStatus,
        isProd,
        updateAvailable,
        updateDownloaded,
        updateInstalling,
        updateInfo,
        updateDownloadPath,
        isPC,
        isM,
        isFullscreen,
        showSomeShortCuts,
        isElectronEnv,
        autoUpdateDisabled,
    };
});
