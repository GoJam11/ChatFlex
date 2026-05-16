/**
 * Model management functionality - replaces ModelManagementService
 */

import { createOpenAIInstance } from "@/features/provider/providerInstance";
import {
    fetchOllamaModels,
    isOllamaProvider,
} from "@/features/ollama/ollamaProvider";
import { providerService } from "@/features/provider/providerService";
import { resolveProviderBaseUrl } from "@/types/provider";

/**
 * Fetch available models for a provider
 */
export async function fetchProviderModels(
    providerId: string,
): Promise<{ success: boolean; models: string[]; error?: string }> {
    await providerService.ready();
    const provider = providerService.getProvider(providerId);

    if (!provider) {
        return { success: false, models: [], error: "Provider not found" };
    }

    try {
        // Handle Ollama specially
        if (isOllamaProvider(providerId)) {
            const models = await fetchOllamaModels();
            return { success: true, models };
        }

        // Handle OpenAI-compatible providers
        const openai = await createOpenAIInstance(providerId);
        if (!openai) {
            return {
                success: false,
                models: [],
                error: "Failed to create API client",
            };
        }

        const response = await openai.models.list();
        const models = (response.data ?? [])
            .map((model) => model.id?.trim())
            .filter((id): id is string => Boolean(id))
            .filter((id) => !id.includes("whisper") && !id.includes("dall-e"))
            .sort();

        return { success: true, models };
    } catch (error: any) {
        console.error(
            `[Model Management] Failed to fetch models for ${providerId}:`,
            error,
        );
        return {
            success: false,
            models: [],
            error: error.message || "Failed to fetch models",
        };
    }
}

/**
 * Test provider connection
 */
export async function testProviderConnection(
    providerId: string,
): Promise<{ success: boolean; message: string }> {
    await providerService.ready();
    const provider = providerService.getProvider(providerId);

    if (!provider) {
        return { success: false, message: "Provider not found" };
    }

    const effectiveBaseUrl = resolveProviderBaseUrl(provider);
    if (!provider.apiKey || !effectiveBaseUrl) {
        return { success: false, message: "Missing API key or base URL" };
    }

    try {
        const result = await fetchProviderModels(providerId);

        if (result.success) {
            return {
                success: true,
                message: `Connected successfully. Found ${result.models.length} models.`,
            };
        } else {
            return {
                success: false,
                message: result.error || "Connection failed",
            };
        }
    } catch (error: any) {
        return {
            success: false,
            message: error.message || "Connection test failed",
        };
    }
}

/**
 * Batch fetch models for multiple providers
 */
export async function fetchModelsForProviders(
    providerIds: string[],
): Promise<Map<string, string[]>> {
    const results = new Map<string, string[]>();

    await Promise.all(
        providerIds.map(async (providerId) => {
            const result = await fetchProviderModels(providerId);
            if (result.success) {
                results.set(providerId, result.models);
            } else {
                results.set(providerId, []);
            }
        }),
    );

    return results;
}

/**
 * Update provider with fetched models
 */
export async function refreshProviderModels(
    providerId: string,
): Promise<boolean> {
    await providerService.ready();
    const result = await fetchProviderModels(providerId);

    if (result.success && result.models.length > 0) {
        // Get current selected models
        const currentSelected =
            providerService.getProviderSelectedModels(providerId);

        // Keep only models that still exist, plus add any new ones if none selected
        const validSelected = currentSelected.filter((m) =>
            result.models.includes(m),
        );

        if (validSelected.length === 0 && result.models.length > 0) {
            // Auto-select popular models if available
            const popularModels = [
                "gpt-4o-mini",
                "gpt-4o",
                "claude-3-haiku",
                "llama3.2",
            ];
            const firstPopular = result.models.find((m) =>
                popularModels.some((pm) =>
                    m.toLowerCase().includes(pm.toLowerCase()),
                ),
            );

            if (firstPopular) {
                validSelected.push(firstPopular);
            } else {
                validSelected.push(result.models[0]);
            }
        }

        await providerService.updateProvider(providerId, {
            selectedModels: validSelected,
        });

        return true;
    }

    return false;
}
