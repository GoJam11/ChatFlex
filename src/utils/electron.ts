/**
 * Electron API wrapper
 * 封装 Electron API 调用，提供类型安全的接口
 */

// 检测是否在 Electron 环境中
export function isElectronEnvironment(): boolean {
    return typeof window !== 'undefined' && 'electron' in window;
}

// Electron API 类型定义
export interface ElectronAPI {
    // 对话框 API
    dialog: {
        showSaveDialog: (options: {
            defaultPath?: string;
            filters?: Array<{ name: string; extensions: string[] }>;
        }) => Promise<string | null>;
    };

    // 文件系统 API
    fs: {
        writeTextFile: (path: string, content: string) => Promise<void>;
    };

    // 窗口 API
    window: {
        getCurrentWindow: () => {
            isVisible: () => Promise<boolean>;
            hide: () => Promise<void>;
            show: () => Promise<void>;
            setFocus: () => Promise<void>;
            unminimize: () => Promise<void>;
            isFullscreen: () => Promise<boolean>;
            onResized: (callback: () => void) => void;
            innerSize: () => Promise<{ width: number; height: number }>;
            setSize: (size: { width: number; height: number }) => Promise<void>;
        };
    };

    // IPC API (用于 invoke 调用)
    ipc: {
        invoke: <T = any>(channel: string, ...args: any[]) => Promise<T>;
    };

    // Shell API
    shell: {
        openExternal: (url: string) => Promise<void>;
    };

    // 全局快捷键 API
    globalShortcut: {
        register: (shortcut: string, callback: () => void) => Promise<boolean>;
        unregisterAll: () => Promise<void>;
    };

    // 更新器 API
    updater: {
        check: () => Promise<{
            version: string;
            date: string;
            body: string;
            download: (callback: (event: any) => void) => Promise<void>;
            install: () => Promise<void>;
        } | null>;
    };

    // 应用 API
    app: {
        relaunch: () => Promise<void>;
    };
}

// 获取 Electron API 实例
export function getElectronAPI(): ElectronAPI | null {
    if (isElectronEnvironment()) {
        return (window as any).electron as ElectronAPI;
    }
    return null;
}

// 导出便捷函数
export const electronAPI = {
    get dialog() {
        return getElectronAPI()?.dialog;
    },
    get fs() {
        return getElectronAPI()?.fs;
    },
    get window() {
        return getElectronAPI()?.window;
    },
    get ipc() {
        return getElectronAPI()?.ipc;
    },
    get shell() {
        return getElectronAPI()?.shell;
    },
    get globalShortcut() {
        return getElectronAPI()?.globalShortcut;
    },
    get updater() {
        return getElectronAPI()?.updater;
    },
    get app() {
        return getElectronAPI()?.app;
    },
};
