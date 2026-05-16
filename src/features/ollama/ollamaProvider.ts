/**
 * Ollama provider specific functionality
 */

import { providerService } from '@/features/provider/providerService';
import { corsSafeFetch } from '@/utils/http';

const OLLAMA_PROVIDER_ID = 'ollama';

/**
 * Check if a provider is Ollama
 */
export function isOllamaProvider(providerId: string): boolean {
    return providerId === OLLAMA_PROVIDER_ID;
}

/**
 * Get Ollama connection status
 */
export function getOllamaConnectionStatus(): {
    isConfigured: boolean;
    isActive: boolean;
    baseUrl?: string;
} {
    const ollamaProvider = providerService.getProvider(OLLAMA_PROVIDER_ID);

    if (!ollamaProvider) {
        return { isConfigured: false, isActive: false };
    }

    return {
        isConfigured: !!ollamaProvider.baseUrl,
        isActive: !!ollamaProvider.isActive,
        baseUrl: ollamaProvider.baseUrl,
    };
}

/**
 * Update Ollama models
 */
export async function updateOllamaModels(models: string[]): Promise<void> {
    const ollamaProvider = providerService.getProvider(OLLAMA_PROVIDER_ID);

    if (ollamaProvider) {
        await providerService.updateProvider(OLLAMA_PROVIDER_ID, { selectedModels: models });
    }
}

/**
 * Fetch available Ollama models from server
 */
export async function fetchOllamaModels(): Promise<string[]> {
    const { baseUrl } = getOllamaConnectionStatus();

    if (!baseUrl) {
        throw new Error('Ollama base URL not configured');
    }

    try {
        const response = await corsSafeFetch(`${baseUrl}/api/tags`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const models = data.models || [];

        return models.map((model: any) => model.name).filter(Boolean);
    } catch (error) {
        console.error('[Ollama] Failed to fetch models:', error);
        throw error;
    }
}

/**
 * Test Ollama connection
 */
export async function testOllamaConnection(): Promise<boolean> {
    const { baseUrl, isConfigured } = getOllamaConnectionStatus();

    if (!isConfigured || !baseUrl) {
        return false;
    }

    try {
        const response = await corsSafeFetch(`${baseUrl}/api/version`);
        return response.ok;
    } catch (error) {
        console.error('[Ollama] Connection test failed:', error);
        return false;
    }
}
