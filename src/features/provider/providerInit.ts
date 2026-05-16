/**
 * Provider initialization and configuration
 */

import type { Provider } from '@/types/provider';
import { setCurrentModelOnly } from '@/features/currentModel/currentModelState';
import { providerService } from '@/features/provider/providerService';

/**
 * Initialize providers from config and merge with existing ones
 */
export async function initializeProviders(): Promise<void> {
    await providerService.ready();
}

/**
 * Check and apply URL parameters for provider configuration
 */
export async function applyUrlParameters(): Promise<void> {
    await providerService.ready();
    const urlParams = new URLSearchParams(window.location.search);
    const apiKey = urlParams.get("apiKey");
    const baseUrl = urlParams.get("baseUrl");
    const modelParam = urlParams.get("model");

    // Find custom provider
    const customProvider = providerService.providerList.value.find(
        (p: Provider) => p.key === "custom"
    );

    if (customProvider) {
        const updates: Partial<Provider> = {};
        if (apiKey) updates.apiKey = apiKey;
        if (baseUrl) {
            try {
                new URL(baseUrl); // Validate URL
                updates.baseUrl = baseUrl;
            } catch (e) {
                console.error("URL参数中提供的Base URL无效:", e);
            }
        }
        if (Object.keys(updates).length > 0) {
            await providerService.updateProvider(customProvider.key, updates);
        }
    }

    if (modelParam) {
        setCurrentModelOnly(modelParam).catch((error) => {
            console.error("[Provider Init] Failed to set model from URL:", error);
        });
    }
}

/**
 * Full initialization flow
 */
export async function initializeModelSystem(): Promise<void> {
    await initializeProviders();

    await applyUrlParameters();
}
