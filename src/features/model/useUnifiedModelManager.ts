import { ref } from "vue";
import { generateText } from 'ai';
import {
    fetchProviderModels as fetchProviderModelsFeature,
    testProviderConnection as testProviderConnectionFeature,
} from "@/features/model/modelManagement";
import { createLanguageModel, type ModelConfig } from "@/features/ai/languageModel";
import { toast } from "vue-sonner";
import { useI18n } from 'vue-i18n';
import { useProviderService } from '@/features/provider/providerService';
import { resolveProviderBaseUrl } from '@/types/provider';

export function useUnifiedModelManager() {
    const { t } = useI18n();
    const providerService = useProviderService();
    const isUpdatingModels = ref(false);
    const isFetchingAllModels = ref(false);

    /**
     * 获取供应商的模型列表
     */
    const fetchProviderModels = async (providerId: string): Promise<string[]> => {
        await providerService.ready();
        const provider = providerService.getProvider(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }

        const result = await fetchProviderModelsFeature(providerId);

        if (!result.success) {
            throw new Error(result.error || t('messages.fetchModelsFailed'));
        }

        return result.models || [];
    };

    /**
     * 更新供应商的模型列表（同步已选择的模型）
     */
    const updateProviderModels = async (providerId: string): Promise<boolean> => {
        isUpdatingModels.value = true;

        try {
            await providerService.ready();
            const provider = providerService.getProvider(providerId);
            if (!provider) {
                throw new Error(`Provider ${providerId} not found`);
            }

            const result = await fetchProviderModelsFeature(providerId);

            if (!result.success) {
                throw new Error(result.error || t('messages.updateModelsFailed'));
            }

            const models = result.models || [];

            // 检查是否成功获取到模型
            if (models.length === 0) {
                toast.warning(t('messages.noModelsFound'));
                return false;
            }

            // 获取当前已选择的模型
            const selectedModels = providerService.getProviderSelectedModels(providerId);

            // 找出需要添加的新模型（在获取到的列表中但不在已选择列表中）
            const modelsToAdd = models.filter(model => !selectedModels.includes(model));

            // 找出需要移除的模型（在已选择列表中但不在获取到的列表中）
            const modelsToRemove = selectedModels.filter(model => !models.includes(model));

            // 添加新模型
            for (const model of modelsToAdd) {
                await providerService.addModelToProvider(providerId, model);
            }

            // 移除不存在的模型
            for (const model of modelsToRemove) {
                await providerService.removeModelFromProvider(providerId, model);
            }

            toast.success(t('messages.modelsUpdated', { added: modelsToAdd.length, removed: modelsToRemove.length }));
            return true;
        } catch (error: any) {
            const errorMessage = error.message || t('messages.updateModelsFailed');
            toast.error(errorMessage);
            console.error("[useUnifiedModelManager] 更新模型列表失败:", error);
            return false;
        } finally {
            isUpdatingModels.value = false;
        }
    };

    /**
     * 获取供应商的全部可用模型（仅用于展示，不同步到已选择列表）
     */
    const fetchAllModels = async (providerId: string): Promise<string[]> => {
        isFetchingAllModels.value = true;

        try {
            const models = await fetchProviderModels(providerId);
            return models;
        } catch (error: any) {
            const errorMessage = error.message || t('messages.fetchModelsFailed');
            toast.error(errorMessage);
            console.error("[useUnifiedModelManager] 获取全部模型失败:", error);
            return [];
        } finally {
            isFetchingAllModels.value = false;
        }
    };

    /**
     * 测试供应商连接
     */
    const testProviderConnection = async (providerId: string): Promise<boolean> => {
        await providerService.ready();
        const provider = providerService.getProvider(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }

        try {
            const result = await testProviderConnectionFeature(providerId);

            if (result.success) {
                toast.success(result.message || `${provider.displayName} 连接测试成功 ✅`);
                return true;
            } else {
                toast.error(result.message || `${provider.displayName} 连接测试失败 ❌`);
                return false;
            }
        } catch (error: any) {
            const errorMessage = error.message || `${provider.displayName} 连接测试失败`;
            toast.error(`${errorMessage} ❌`);
            console.error(`[useUnifiedModelManager] 连接测试失败:`, error);
            return false;
        }
    };

    /**
     * 测试供应商的模型（保留原有功能，用于具体模型测试）
     */
    const testProviderModel = async (providerId: string, modelName: string): Promise<boolean> => {
        await providerService.ready();
        const provider = providerService.getProvider(providerId);
        if (!provider) {
            throw new Error(`Provider ${providerId} not found`);
        }

        try {
            const modelConfig: ModelConfig = {
                provider: providerId,
                model: modelName,
                baseURL: resolveProviderBaseUrl(provider) ?? undefined,
                apiKey: provider.apiKey || undefined,
            };

            const languageModel = createLanguageModel(modelConfig);

            await generateText({
                model: languageModel,
                messages: [
                    { role: "user", content: "Hello, this is a test message." },
                ],
                temperature: 0.1,
                maxOutputTokens: 10,
            });

            toast.success(`模型 ${modelName} 测试成功 ✅`);
            return true;
        } catch (error: any) {
            console.error(`Model ${modelName} test failed:`, error);

            // 提供更具体的错误信息
            let errorMessage = `模型 ${modelName} 测试失败 ❌`;
            if (error.message) {
                if (
                    error.message.includes("401") ||
                    error.message.includes("invalid_api_key")
                ) {
                    errorMessage += " - API Key 无效";
                } else if (
                    error.message.includes("404") ||
                    error.message.includes("model_not_found")
                ) {
                    errorMessage += " - 模型不存在";
                } else if (
                    error.message.includes("quota") ||
                    error.message.includes("limit")
                ) {
                    errorMessage += " - 配额不足";
                } else if (
                    error.message.includes("连接") ||
                    error.message.includes("ECONNREFUSED")
                ) {
                    errorMessage += " - 无法连接到服务";
                } else {
                    errorMessage += ` - ${error.message}`;
                }
            }

            toast.error(errorMessage);
            return false;
        }
    };

    return {
        isUpdatingModels,
        isFetchingAllModels,
        fetchProviderModels,
        updateProviderModels,
        fetchAllModels,
        testProviderConnection,
        testProviderModel,
    };
}
