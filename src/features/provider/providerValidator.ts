/**
 * Provider validation utilities
 */

import { Provider, resolveProviderBaseUrl } from "@/types/provider";

/**
 * Check if a provider's API is configured
 */
export function isProviderApiConfigured(provider?: Provider): boolean {
    if (!provider) return false;
    return !!(provider.apiKey && resolveProviderBaseUrl(provider));
}
