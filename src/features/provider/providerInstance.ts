/**
 * AI Provider instance creation
 */
import { useCurrentModel } from '@/features/currentModel/useCurrentModel';
import { isProviderApiConfigured } from '@/features/provider/providerValidator';
import { providerService } from '@/features/provider/providerService';
import { resolveProviderBaseUrl } from '@/types/provider';
import { corsSafeFetch } from '@/utils/http';

interface OpenAIModelListItem {
    id?: string;
}

interface OpenAIModelListResponse {
    data?: OpenAIModelListItem[];
}

export interface OpenAICompatibleClient {
    models: {
        list(): Promise<OpenAIModelListResponse>;
    };
}

interface GeminiModelListItem {
    name?: string;
    supportedGenerationMethods?: string[];
}

interface GeminiModelListResponse {
    models?: GeminiModelListItem[];
}

function resolveModelsEndpoint(baseUrl: string): string {
    const trimmed = baseUrl.trim();
    const withoutTrailingSlash = trimmed.replace(/\/+$/u, "");
    return `${withoutTrailingSlash}/models`;
}

async function requestModelList(
    endpoint: string,
    apiKey: string
): Promise<OpenAIModelListResponse> {
    const response = await corsSafeFetch(endpoint, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `[Provider Instance] Failed to fetch models: ${response.status} ${response.statusText} ${errorText}`
        );
    }

    try {
        return (await response.json()) as OpenAIModelListResponse;
    } catch (error) {
        throw new Error("[Provider Instance] Received invalid JSON from model list request");
    }
}

function normaliseGeminiModelId(name?: string): string | undefined {
    if (!name) {
        return undefined;
    }
    const trimmed = name.trim();
    if (!trimmed) {
        return undefined;
    }

    const parts = trimmed.split("/");
    return parts[parts.length - 1] || undefined;
}

async function requestGeminiModelList(
    endpoint: string,
    apiKey: string
): Promise<OpenAIModelListResponse> {
    let url: URL;
    try {
        url = new URL(endpoint);
    } catch (error) {
        throw new Error(`[Provider Instance] Invalid Gemini endpoint: ${endpoint}`);
    }
    url.searchParams.set("key", apiKey);

    const response = await corsSafeFetch(url.toString(), {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `[Provider Instance] Failed to fetch models: ${response.status} ${response.statusText} ${errorText}`
        );
    }

    let json: GeminiModelListResponse;
    try {
        json = (await response.json()) as GeminiModelListResponse;
    } catch (error) {
        throw new Error("[Provider Instance] Received invalid JSON from Gemini model list request");
    }

    const contentModels =
        json.models?.filter((model) =>
            model.supportedGenerationMethods?.includes("generateContent")
        ) ?? [];

    const data: OpenAIModelListItem[] = contentModels
        .map((model): OpenAIModelListItem | null => {
            const id = normaliseGeminiModelId(model.name);
            return id ? { id } : null;
        })
        .filter((item): item is OpenAIModelListItem => item !== null);

    return { data };
}

/**
 * Create OpenAI-compatible client for a specific provider
 */
export async function createOpenAIInstance(
    providerId?: string
): Promise<OpenAICompatibleClient | null> {
    // Use current provider if not specified
    if (!providerId) {
        const { currentProvider } = useCurrentModel();
        providerId = currentProvider.value;
    }

    if (!providerId) {
        console.error("[Provider Instance] No provider specified");
        return null;
    }

    await providerService.ready();
    const provider = providerService.getProvider(providerId);
    if (!provider) {
        console.error("[Provider Instance] Provider not found:", providerId);
        return null;
    }

    if (!isProviderApiConfigured(provider)) {
        console.error(
            `[Provider Instance] Provider "${provider.displayName}" is missing API Key or Base URL.`
        );
        return null;
    }

    const baseUrl = resolveProviderBaseUrl(provider);
    if (!baseUrl) {
        console.error(
            `[Provider Instance] Provider "${provider.displayName}" does not have a valid Base URL.`
        );
        return null;
    }

    const endpoint = resolveModelsEndpoint(baseUrl);

    if (providerId === "gemini") {
        return {
            models: {
                list: () => requestGeminiModelList(endpoint, provider.apiKey!),
            },
        };
    }

    return {
        models: {
            list: () => requestModelList(endpoint, provider.apiKey!),
        },
    };
}
