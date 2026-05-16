/**
 * Auto selection logic for models when provider state changes
 */

import { useCurrentModel } from '@/features/currentModel/useCurrentModel';
import type { Provider } from '@/types/provider';

/**
 * Handle provider activation - auto-select if no current selection
 */
export async function handleProviderActivation(
    provider: Provider
): Promise<void> {
    const {
        currentProvider,
        currentModel,
        setCurrentProviderOnly,
        setCurrentModelAndProvider,
    } = useCurrentModel();

    if (!provider.isActive) return;

    // If no current provider, set this one
    if (!currentProvider.value) {
        await setCurrentProviderOnly(provider.key);
    }

    // If no current model and this is now the current provider
    if (!currentModel.value && provider.key === currentProvider.value) {
        const availableModels = provider.selectedModels || [];
        if (availableModels.length > 0) {
            await setCurrentModelAndProvider(availableModels[0], provider.key);
        }
    }
}

/**
 * Handle model list changes - ensure current model is still valid
 */
export async function handleModelListChange(
    providerId: string,
    newModelList: string[]
): Promise<void> {
    const {
        currentProvider,
        currentModel,
        setCurrentModelAndProvider,
        setCurrentModelOnly
    } = useCurrentModel();

    // Only process if this is the current provider
    if (providerId !== currentProvider.value) return;

    // If no current model, auto-select first available
    if (!currentModel.value && newModelList.length > 0) {
        await setCurrentModelAndProvider(newModelList[0], providerId);
        return;
    }

    // If current model was removed, switch to another
    if (currentModel.value && !newModelList.includes(currentModel.value)) {
        if (newModelList.length > 0) {
            await setCurrentModelAndProvider(newModelList[0], providerId);
        } else {
            await setCurrentModelOnly("");
        }
    }
}
