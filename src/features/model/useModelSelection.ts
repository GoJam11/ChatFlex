/**
 * Model selection helpers and computed properties
 */

import { computed } from 'vue';
import { useProviderService } from '@/features/provider/providerService';
import { resolveProviderBaseUrl } from '@/types/provider';

export function useModelSelection() {
    const providerService = useProviderService();
    const activeProviders = providerService.activeProviders;

    /**
     * All unique models across all active providers
     */
    const allModelList = computed(() => {
        return [
            ...new Set(
                activeProviders.value.flatMap((p) => p.selectedModels || [])
            ),
        ];
    });

    /**
     * All models with their provider information
     */
    const allModelWithProvider = computed(() => {
        return activeProviders.value.flatMap((provider) =>
            (provider.selectedModels || []).map((model) => ({
                model,
                provider: provider.key,
                providerName: provider.displayName,
            }))
        );
    });

    /**
     * Check if there are any models available
     */
    const hasModels = computed(() => allModelList.value.length > 0);

    /**
     * Get models for a specific provider
     */
    function getProviderModels(providerId: string): string[] {
        return providerService.getProviderSelectedModels(providerId);
    }

    /**
     * Find which providers have a specific model
     */
    function findProvidersWithModel(modelName: string) {
        return activeProviders.value
            .filter(p => p.selectedModels?.includes(modelName))
            .map(p => ({
                providerId: p.key,
                providerName: p.displayName,
                isActive: p.isActive,
                hasValidConfig: !!(p.apiKey && resolveProviderBaseUrl(p)),
            }));
    }

    return {
        allModelList,
        allModelWithProvider,
        hasModels,
        getProviderModels,
        findProvidersWithModel,
    };
}
