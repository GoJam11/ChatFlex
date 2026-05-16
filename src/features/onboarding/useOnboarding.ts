import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from 'vue-i18n';
import { useOnboardingStore } from "@/features/onboarding/useOnboardingStore";
import { useUnifiedModelManager } from "@/features/model/useUnifiedModelManager";
import { useCurrentModel } from "@/features/currentModel/useCurrentModel";
import { useProviderService } from '@/features/provider/providerService';

/**
 * 新用户引导 Composable
 * 处理引导流程的业务逻辑，包括 Ollama 连接检测
 */
export function useOnboarding() {
    const onboardingStore = useOnboardingStore();
    const providerService = useProviderService();
    const { fetchProviderModels } = useUnifiedModelManager();
    const { setCurrentModelAndProvider, currentModel, currentProvider } = useCurrentModel();
    const router = useRouter();
    const { t } = useI18n();
    
    const isCheckingOllama = ref(false);
    const ollamaConnected = ref<boolean | null>(null);
    
    // 计算属性
    const needsOnboarding = computed(() => {
        return onboardingStore.needsOnboarding();
    });
    
    const showOnboardingDialog = computed(() => {
        return onboardingStore.showOnboardingDialog;
    });
    
    const currentStep = computed(() => {
        return onboardingStore.currentStep;
    });
    
    /**
     * 检测 Ollama 连接状态并自动配置
     * 通过尝试获取模型列表来检测 Ollama 是否可用
     * 如果连接成功，自动启用供应商并添加所有模型
     */
    async function checkOllamaConnection(): Promise<boolean> {
        isCheckingOllama.value = true;
        
        try {
            await providerService.ready();
            const ollamaProvider = providerService.getProvider("ollama");
            if (!ollamaProvider) {
                console.log("[useOnboarding] Ollama provider not found");
                return false;
            }
            
            // 使用统一的 fetchProviderModels 方法检测连接
            const models = await fetchProviderModels("ollama");
            const connected = models && models.length > 0;
            
            console.log(`[useOnboarding] Ollama connection check: ${connected ? 'success' : 'failed'}`, {
                modelsCount: models?.length || 0
            });
            
            if (connected) {
                // 自动配置 Ollama
                await autoConfigureOllama(models);
            }
            
            ollamaConnected.value = connected;
            return connected;
        } catch (error) {
            console.log("[useOnboarding] Ollama connection check failed:", error);
            ollamaConnected.value = false;
            return false;
        } finally {
            isCheckingOllama.value = false;
        }
    }
    
    /**
     * 自动配置 Ollama 供应商
     * 1. 启用 Ollama 供应商
     * 2. 将所有检测到的模型添加到 selectedModels
     * 3. 如果当前没有选择模型，自动选择第一个模型
     */
    async function autoConfigureOllama(availableModels: string[]) {
        try {
            console.log("[useOnboarding] Auto-configuring Ollama with models:", availableModels);
            
            // 1. 启用 Ollama 供应商
            await providerService.setProviderActive("ollama", true);
            
            // 2. 添加所有模型到 selectedModels
            await providerService.updateProvider("ollama", {
                selectedModels: availableModels
            });
            
            // 3. 如果当前没有选择模型，自动选择第一个 Ollama 模型
            if (!currentModel.value && availableModels.length > 0) {
                await setCurrentModelAndProvider(availableModels[0], "ollama");
                console.log(`[useOnboarding] Auto-selected model: ${availableModels[0]}`);
            }
            
            console.log(`[useOnboarding] Ollama auto-configuration completed:`, {
                modelsAdded: availableModels.length,
                providerActive: true,
                currentModel: currentModel.value,
                currentProvider: currentProvider.value
            });
        } catch (error) {
            console.error("[useOnboarding] Failed to auto-configure Ollama:", error);
        }
    }
    
    /**
     * 开始引导流程
     */
    function startOnboarding() {
        onboardingStore.startOnboarding();
    }
    
    /**
     * 进入下一步
     * 在 welcome 步骤时会检测 Ollama 连接状态
     */
    async function nextStep() {
        if (currentStep.value === 'welcome') {
            // 在进入模型配置步骤前检测 Ollama
            await checkOllamaConnection();
        }
        
        onboardingStore.nextStep();
    }
    
    /**
     * 跳过引导
     */
    function skipOnboarding() {
        onboardingStore.skipOnboarding();
    }
    
    /**
     * 完成引导
     * 如果是在模型配置步骤且Ollama未连通，则跳转到API配置页面
     */
    function completeOnboarding(options: { navigate?: boolean } = { navigate: true }) {
        // 如果是在模型配置步骤且Ollama未连通，并且需要导航
        if (options.navigate && currentStep.value === 'model-config' && ollamaConnected.value === false) {
            router.push('/setting/api?showAddProvider=true');
        }
        onboardingStore.completeOnboarding();
    }
    
    /**
     * 关闭引导对话框
     */
    function closeOnboardingDialog() {
        onboardingStore.setShowOnboardingDialog(false);
    }
    
    /**
     * 重置引导状态（开发用）
     */
    function resetOnboarding() {
        onboardingStore.resetOnboarding();
        ollamaConnected.value = null;
    }
    
    /**
     * 初始化引导流程
     * 在应用启动时调用，检查是否需要显示引导
     */
    function initializeOnboarding() {
        if (needsOnboarding.value) {
            startOnboarding();
        }
    }
    
    /**
     * 获取当前步骤的内容配置
     */
    const currentStepConfig = computed(() => {
        switch (currentStep.value) {
            case 'welcome':
                return {
                    title: t('onboarding.welcome.title'),
                    content: t('onboarding.welcome.content'),
                    primaryButtonText: t('onboarding.welcome.primaryButton'),
                    showSecondaryButton: true,
                    secondaryButtonText: t('onboarding.welcome.secondaryButton')
                };
            case 'model-config':
                if (ollamaConnected.value === true) {
                    return {
                        title: t('onboarding.ollamaConnected.title'),
                        content: t('onboarding.ollamaConnected.content'),
                        primaryButtonText: t('onboarding.ollamaConnected.primaryButton'),
                        showSecondaryButton: false,
                        secondaryButtonText: ""
                    };
                } else {
                    return {
                        title: t('onboarding.modelConfig.title'),
                        content: t('onboarding.modelConfig.content'),
                        primaryButtonText: t('onboarding.modelConfig.primaryButton'),
                        showSecondaryButton: true,
                        secondaryButtonText: t('onboarding.modelConfig.secondaryButton')
                    };
                }
            default:
                return {
                    title: "",
                    content: "",
                    primaryButtonText: t('common.confirm'),
                    showSecondaryButton: false,
                    secondaryButtonText: ""
                };
        }
    });
    
    return {
        // State
        isCheckingOllama,
        ollamaConnected,
        needsOnboarding,
        showOnboardingDialog,
        currentStep,
        currentStepConfig,
        
        // I18n
        t,
        
        // Actions
        startOnboarding,
        nextStep,
        skipOnboarding,
        completeOnboarding,
        closeOnboardingDialog,
        resetOnboarding,
        initializeOnboarding,
        checkOllamaConnection,
    };
}
