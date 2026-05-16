<template>
    <Dialog 
        :open="showOnboardingDialog" 
        @update:open="onDialogOpenChange"
    >
        <DialogContent 
            class="sm:max-w-[500px] p-0"
        >
            <!-- 步骤指示器 -->
            <div class="flex justify-center pt-6 pb-4">
                <div class="flex space-x-2">
                    <div
                        v-for="(step, index) in steps"
                        :key="step"
                        class="w-2 h-2 rounded-full transition-colors"
                        :class="getCurrentStepIndex() >= index ? 'bg-primary' : 'bg-muted'"
                    />
                </div>
            </div>

            <DialogHeader class="px-6 pb-2">
                <DialogTitle class="text-xl font-semibold text-center">
                    {{ currentStepConfig.title }}
                </DialogTitle>
            </DialogHeader>

            <div class="px-6 pb-6">
                <DialogDescription class="text-center text-base leading-relaxed mb-6">
                    {{ currentStepConfig.content }}
                </DialogDescription>

                <!-- 加载状态 -->
                <div 
                    v-if="currentStep === 'model-config' && isCheckingOllama"
                    class="text-center py-4"
                >
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                    <p class="text-sm text-muted-foreground">
                        {{ t('onboarding.checkingOllama') }}
                    </p>
                </div>

                <!-- 操作按钮 -->
                <div class="flex justify-center space-x-3">
                    <Button
                        v-if="currentStepConfig.showSecondaryButton"
                        variant="outline"
                        :disabled="isCheckingOllama"
                        @click="handleSecondaryAction"
                    >
                        {{ currentStepConfig.secondaryButtonText }}
                    </Button>
          
                    <Button
                        :disabled="isCheckingOllama"
                        class="min-w-[80px]"
                        @click="handlePrimaryAction"
                    >
                        <span v-if="isCheckingOllama && currentStep === 'welcome'">
                            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        </span>
                        {{ currentStepConfig.primaryButtonText }}
                    </Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useOnboarding } from '@/features/onboarding/useOnboarding'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// 使用引导 composable
const {
  showOnboardingDialog,
  currentStep,
  currentStepConfig,
  isCheckingOllama,
  nextStep,
  skipOnboarding,
  completeOnboarding,
  closeOnboardingDialog,
} = useOnboarding()

const { t } = useI18n()

// 引导步骤定义
const steps = ['welcome', 'model-config'] as const

// 获取当前步骤索引
const getCurrentStepIndex = () => {
  return steps.findIndex(step => step === currentStep.value)
}

// 处理对话框打开状态变化
const onDialogOpenChange = (open: boolean) => {
  if (!open) {
    closeOnboardingDialog()
  }
}

// 处理主要操作按钮点击
const handlePrimaryAction = async () => {
  if (currentStep.value === 'welcome') {
    await nextStep()
  } else if (currentStep.value === 'model-config') {
    completeOnboarding()
  }
}

// 处理次要操作按钮点击
const handleSecondaryAction = () => {
  if (currentStep.value === 'welcome') {
    skipOnboarding()
  } else if (currentStep.value === 'model-config') {
    // 稍后配置：完成引导但不跳转
    completeOnboarding({ navigate: false })
  }
}


</script>

<style>

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
