import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI, google as defaultGoogle } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';
import type { ReasoningStrength } from '@/types/chat';

export interface ModelConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  reasoningStrength?: ReasoningStrength;
}

type ProviderDefaults = {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
};

function normalizeProviderBaseUrl(providerId: string, baseUrl?: string): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/u, '');

  const lowerCaseProvider = providerId.toLowerCase();
  if (lowerCaseProvider.includes('google') || lowerCaseProvider.includes('gemini')) {
    return withoutTrailingSlash.replace(/\/openai$/iu, '');
  }

  return withoutTrailingSlash;
}

function normalizeOllamaApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return 'http://127.0.0.1:11434/api';
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/u, '');

  if (/\/api$/u.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  if (/\/api\/v1$/u.test(withoutTrailingSlash)) {
    return withoutTrailingSlash.replace(/\/v1$/u, '');
  }

  if (/\/v1$/u.test(withoutTrailingSlash)) {
    return `${withoutTrailingSlash.replace(/\/v1$/u, '')}/api`;
  }

  return `${withoutTrailingSlash}/api`;
}

const PROVIDER_DEFAULTS: Record<string, ProviderDefaults> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
  },
  ollama: {
    baseUrl: 'http://127.0.0.1:11434',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'app://chatflex',
      'X-Title': 'ChatFlex',
    },
  },
  perplexity: {
    baseUrl: 'https://api.perplexity.ai',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
  },
};

const FALLBACK_BASE_URL = 'https://api.openai.com/v1';

function resolveBaseUrl(config: ModelConfig): string {
  const providerId = config.provider.toLowerCase();
  const normalizedConfigBase = normalizeProviderBaseUrl(providerId, config.baseURL);
  if (normalizedConfigBase) {
    return normalizedConfigBase;
  }

  const defaults = PROVIDER_DEFAULTS[providerId];
  if (defaults?.baseUrl) {
    const normalizedDefaultBase = normalizeProviderBaseUrl(providerId, defaults.baseUrl);
    if (normalizedDefaultBase) {
      return normalizedDefaultBase;
    }
  }

  return FALLBACK_BASE_URL;
}

function resolveHeaders(provider: string): Record<string, string> | undefined {
  return PROVIDER_DEFAULTS[provider.toLowerCase()]?.defaultHeaders;
}

export function createLanguageModel(config: ModelConfig): LanguageModel {
  const providerId = config.provider.toLowerCase();
  const baseURL = resolveBaseUrl(config);
  const headers = resolveHeaders(providerId);

  switch (providerId) {
    case 'openai': {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL,
        headers,
      });
      return provider.languageModel(config.model);
    }
    case 'google':
    case 'gemini': {
      const useCustomProvider =
        Boolean(config.apiKey) || Boolean(config.baseURL) || Boolean(headers);

      const provider = useCustomProvider
        ? createGoogleGenerativeAI({
            apiKey: config.apiKey,
            baseURL,
            headers,
          })
        : defaultGoogle;

      return provider(config.model);
    }
    case 'anthropic': {
      const provider = createAnthropic({
        apiKey: config.apiKey,
        baseURL,
        headers,
      });
      return provider.languageModel(config.model);
    }
    case 'deepseek': {
      const provider = createDeepSeek({
        apiKey: config.apiKey,
        baseURL,
        headers,
      });
      return provider.languageModel(config.model);
    }
    case 'ollama': {
      const provider = createOllama({
        baseURL: normalizeOllamaApiBaseUrl(baseURL),
        headers,
        compatibility: 'strict',
      });
      return provider(config.model);
    }
    default: {
      return createOpenAICompatible({
        name: config.provider,
        apiKey: config.apiKey,
        baseURL,
        headers,
      })(config.model);
    }
  }
}
