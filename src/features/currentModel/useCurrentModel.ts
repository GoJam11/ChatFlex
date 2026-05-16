import { computed } from "vue";
import {
  currentModelRef,
  currentProviderRef,
  setCurrentModelAndProvider,
  setCurrentModelOnly,
  setCurrentProviderOnly,
} from "./currentModelState";
import { useProviderService } from '@/features/provider/providerService';

export function useCurrentModel() {
  const providerService = useProviderService();

  const activeProvider = computed(() => {
    const providerId = currentProviderRef.value;
    return providerId ? providerService.getProvider(providerId) : undefined;
  });

  return {
    currentModel: currentModelRef,
    currentProvider: currentProviderRef,
    activeProvider,
    setCurrentModelOnly,
    setCurrentProviderOnly,
    setCurrentModelAndProvider,
  };
}
