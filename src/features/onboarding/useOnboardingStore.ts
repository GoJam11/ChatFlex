import { useStorage } from "@vueuse/core";
import { defineStore } from "pinia";

export type OnboardingStep = 'welcome' | 'model-config' | 'complete';

/**
 * 新用户引导 Store
 * 用于管理新用户首次使用应用时的引导流程
 */
export const useOnboardingStore = defineStore("onboarding", () => {
    // --- State ---
    
    /**
     * 是否已完成引导流程
     * true: 已完成引导，不再显示引导界面
     * false: 未完成引导，需要显示引导界面
     */
    const hasCompletedOnboarding = useStorage<boolean>(
        "onboarding/hasCompletedOnboarding",
        false
    );
    
    /**
     * 当前引导步骤
     * 'welcome': 欢迎步骤
     * 'model-config': 模型配置步骤
     * 'complete': 完成引导
     */
    const currentStep = useStorage<OnboardingStep>(
        "onboarding/currentStep",
        "welcome"
    );
    
    /**
     * 是否显示引导对话框
     */
    const showOnboardingDialog = useStorage<boolean>(
        "onboarding/showOnboardingDialog",
        false
    );
    
    // --- Computed ---
    
    /**
     * 是否需要显示引导
     */
    const needsOnboarding = () => {
        return !hasCompletedOnboarding.value;
    };
    
    // --- Actions ---
    
    /**
     * 开始引导流程
     */
    function startOnboarding() {
        currentStep.value = "welcome";
        showOnboardingDialog.value = true;
    }
    
    /**
     * 进入下一步
     */
    function nextStep() {
        switch (currentStep.value) {
            case 'welcome':
                currentStep.value = 'model-config';
                break;
            case 'model-config':
                completeOnboarding();
                break;
            default:
                completeOnboarding();
                break;
        }
    }
    
    /**
     * 跳过引导
     */
    function skipOnboarding() {
        completeOnboarding();
    }
    
    /**
     * 完成引导流程
     */
    function completeOnboarding() {
        hasCompletedOnboarding.value = true;
        currentStep.value = "complete";
        showOnboardingDialog.value = false;
    }
    
    /**
     * 重置引导状态（用于开发测试）
     */
    function resetOnboarding() {
        hasCompletedOnboarding.value = false;
        currentStep.value = "welcome";
        showOnboardingDialog.value = false;
    }
    
    /**
     * 设置对话框显示状态
     */
    function setShowOnboardingDialog(show: boolean) {
        showOnboardingDialog.value = show;
    }
    
    /**
     * 设置当前步骤
     */
    function setCurrentStep(step: OnboardingStep) {
        currentStep.value = step;
    }
    
    return {
        // State
        hasCompletedOnboarding,
        currentStep,
        showOnboardingDialog,
        
        // Computed
        needsOnboarding,
        
        // Actions
        startOnboarding,
        nextStep,
        skipOnboarding,
        completeOnboarding,
        resetOnboarding,
        setShowOnboardingDialog,
        setCurrentStep,
    };
});