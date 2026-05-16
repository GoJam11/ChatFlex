// 供应商类型定义

import { Provider } from "@/types";

// 所有预设供应商配置 - 使用Map结构
export const providerConfigs = new Map<string, Provider>([
    [
        "ollama",
        {
            key: "ollama",
            origin: "preset",
            displayName: "Ollama",
            apiKey: "ollama",
            defaultBaseUrl: "http://127.0.0.1:11434",
            baseUrl: "http://127.0.0.1:11434",
            showApiKey: false,
            showBaseUrl: true,
            showDelete: true,
            isActive: true,
            selectedModels: [],
            providerType: "ollama",
        },
    ],
]);

// Helper function to convert Map to array for compatibility
export const getProviderConfigsArray = (): Provider[] => {
    return Array.from(providerConfigs.values());
};

// Helper function to generate UUID for custom providers
export const generateProviderKey = (): string => {
    return crypto.randomUUID();
};
