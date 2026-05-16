import {v4 as uuidv4} from "uuid";

/**
 * 为供应商生成唯一ID
 * @param name 供应商名称
 * @returns 唯一ID字符串
 */
export const generateProviderId = (name: string): string =>
    `custom_${name.replace(/\s+/g, "_")}_${uuidv4()}`;

/**
 * 供应商的来源类型，用于区分是应用预设还是用户自定义。
 */
export type ProviderOrigin = "preset" | "custom";

/**
 * 供应商类型，用于区分不同的 API 协议
 */
export type ProviderType = "openai" | "ollama";

/**
 * 统一的供应商配置接口。
 * 这是应用运行时使用的最终数据结构，明确了其来源。
 */
export interface Provider {
    // --- 核心标识 ---
    key: string; // 唯一标识符
    origin: ProviderOrigin; // 数据来源：'preset' 或 'custom'
    providerType?: ProviderType; // 供应商类型：'openai' 或 'ollama'

    // --- 显示信息 (来自预设或用户自定义) ---
    displayName: string;

    // --- API 配置 (预设值可能被用户覆盖) ---
    apiKey: string;
    defaultBaseUrl?: string;
    baseUrl?: string;

    // --- 功能开关 (预设值可能被用户覆盖) ---
    isActive: boolean;

    // --- UI 控制 (部分由 origin 决定) ---
    showApiKey: boolean;
    showBaseUrl: boolean;
    showDelete: boolean; // 是否允许删除

    // --- 模型管理 (selectedModels 可能被用户覆盖) ---
    selectedModels: string[]; // 用户选择启用的模型
}

export type ProviderRecord = Omit<Provider, 'selectedModels'>;

export function toProviderRecord(provider: Provider): ProviderRecord {
    const { selectedModels: _selectedModels, ...rest } = provider;
    return rest;
}

export function fromProviderRecord(
    record: ProviderRecord,
    selectedModels: string[] = [],
): Provider {
    return { 
        ...record, 
        selectedModels,
        showDelete: true, // 强制允许所有供应商删除
    };
}

/**
 * 创建新供应商时所需的数据。
 */
export interface ProviderCreationData {
    name: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    defaultBaseUrl?: string;
    providerType: ProviderType;
}

/**
 * 根据传入数据创建一个新的自定义供应商配置对象。
 * @param data 创建供应商所需的数据
 * @returns 一个完整的 ProviderConfig 对象
 */
export function createProvider(data: ProviderCreationData): Provider {
    const isOllama = data.providerType === "ollama";
    return {
        key: generateProviderId(data.name),
        origin: "custom",
        providerType: data.providerType,
        displayName: data.name,
        apiKey: isOllama ? "ollama" : data.apiKey,
        baseUrl: data.baseUrl,
        defaultBaseUrl: data.defaultBaseUrl ?? data.baseUrl,
        showApiKey: !isOllama,
        showBaseUrl: true,
        showDelete: true,
        isActive: true,
        selectedModels: data.models,
    };
}

/**
 * 合并预设供应商和用户自定义供应商列表。
 *
 * 合并策略：
 * 1. 预设供应商（preset）：用户只能覆盖有限字段（isActive, selectedModels，ollama可额外覆盖baseUrl）
 * 2. 自定义供应商（custom）：用户可以完全覆盖所有字段
 * 3. 兼容性处理：自动过滤掉已废弃的 freetrial 供应商
 *
 * @param presets 应用预设的供应商列表（来自配置文件）
 * @param userConfigs 用户本地存储的供应商配置列表
 * @returns 合并后的最终供应商列表
 */
export function mergeProviders(
    presets: readonly Provider[],
    userConfigs: readonly Provider[]
): Provider[] {
    // 步骤1：数据预处理
    const cleanedUserConfigs = removeDeprecatedProviders(userConfigs);
    const userConfigsMap = createUserConfigsMap(cleanedUserConfigs);

    // 步骤2：合并预设供应商与用户配置
    const mergedPresets = mergePresetsWithUserConfigs(presets, userConfigsMap);

    // 步骤3：添加纯用户自定义供应商
    const customProviders = Array.from(userConfigsMap.values());

    return [...mergedPresets, ...customProviders];
}

/**
 * 移除已废弃的供应商配置
 */
function removeDeprecatedProviders(userConfigs: readonly Provider[]): Provider[] {
    const DEPRECATED_PROVIDERS = ["freetrial"];
    return userConfigs.filter(config => !DEPRECATED_PROVIDERS.includes(config.key));
}

/**
 * 创建用户配置映射表，便于快速查找
 */
function createUserConfigsMap(userConfigs: readonly Provider[]): Map<string, Provider> {
    return new Map(userConfigs.map(p => [p.key, p]));
}

/**
 * 合并预设供应商与用户配置
 */
function mergePresetsWithUserConfigs(
    presets: readonly Provider[],
    userConfigsMap: Map<string, Provider>
): Provider[] {
    return presets.map(preset => {
        const userConfig = userConfigsMap.get(preset.key);

        if (!userConfig) {
            return preset;
        }

        // 从Map中移除已处理的配置
        userConfigsMap.delete(preset.key);

        // 根据供应商类型选择合并策略
        return preset.origin === "preset"
            ? mergePresetProvider(preset, userConfig)
            : mergeCustomProvider(preset, userConfig);
    });
}

/**
 * 合并预设供应商：只允许覆盖特定字段
 */
function mergePresetProvider(preset: Provider, userConfig: Provider): Provider {
    const merged: Provider = {
        ...preset,
        defaultBaseUrl: preset.defaultBaseUrl ?? userConfig.defaultBaseUrl,
        showDelete: true, // 所有供应商都允许删除
    };

    if (userConfig.isActive !== undefined) {
        merged.isActive = userConfig.isActive;
    }

    if (userConfig.selectedModels !== undefined) {
        merged.selectedModels = userConfig.selectedModels;
    }

    if (userConfig.apiKey !== undefined) {
        merged.apiKey = userConfig.apiKey;
    }

    if (preset.showBaseUrl) {
        if (userConfig.baseUrl !== undefined) {
            merged.baseUrl = userConfig.baseUrl;
        } else if (preset.baseUrl !== undefined) {
            merged.baseUrl = preset.baseUrl;
        } else if (merged.defaultBaseUrl !== undefined) {
            merged.baseUrl = merged.defaultBaseUrl;
        }
    } else {
        merged.baseUrl = undefined;
    }

    return merged;
}

/**
 * 合并自定义供应商：允许完全覆盖
 */
function mergeCustomProvider(preset: Provider, userConfig: Provider): Provider {
    return { ...preset, ...userConfig };
}

/**
 * 获取供应商的有效 Base URL：优先返回用户自定义值，其次返回预设默认值。
 */
export function resolveProviderBaseUrl(provider?: Provider): string | undefined {
    if (!provider) {
        return undefined;
    }

    const override = provider.baseUrl?.trim();
    if (override) {
        return override;
    }

    return provider.defaultBaseUrl?.trim();
}
