import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Prompt } from '@/types/prompt';
import { promptDb } from '@/persistence/PromptDatabase';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

function sortPrompts(items: Prompt[]): Prompt[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

export const usePromptStore = defineStore('prompt', () => {
  const prompts = ref<Prompt[]>([]);
  const isLoading = ref(false);
  const hasLoaded = ref(false);

  const promptCount = computed(() => prompts.value.length);

  async function fetchPrompts() {
    try {
      isLoading.value = true;
      const items = await promptDb.getAllPrompts();
      prompts.value = sortPrompts(items);
      hasLoaded.value = true;
      return { success: true, data: prompts.value } as const;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('[PromptStore] 获取提示词失败:', message);
      return { success: false, error: message } as const;
    } finally {
      isLoading.value = false;
    }
  }

  async function createPrompt(payload: { title: string; content: string }) {
    try {
      const newPrompt = await promptDb.createPrompt(payload);
      prompts.value = sortPrompts([...prompts.value, newPrompt]);
      return { success: true, data: newPrompt } as const;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('[PromptStore] 创建提示词失败:', message);
      return { success: false, error: message } as const;
    }
  }

  async function updatePrompt(id: string, payload: { title: string; content: string }) {
    try {
      const updatedPrompt = await promptDb.updatePrompt(id, payload);
      if (!updatedPrompt) {
        const message = 'Prompt not found';
        console.warn('[PromptStore] 未找到提示词:', id);
        return { success: false, error: message } as const;
      }

      prompts.value = sortPrompts(
        prompts.value.map((item) => (item.id === id ? updatedPrompt : item)),
      );

      return { success: true, data: updatedPrompt } as const;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('[PromptStore] 更新提示词失败:', message);
      return { success: false, error: message } as const;
    }
  }

  async function deletePrompt(id: string) {
    try {
      await promptDb.deletePrompt(id);
      prompts.value = prompts.value.filter((item) => item.id !== id);
      return { success: true } as const;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('[PromptStore] 删除提示词失败:', message);
      return { success: false, error: message } as const;
    }
  }

  function getPromptById(id: string) {
    return prompts.value.find((item) => item.id === id);
  }

  return {
    prompts,
    promptCount,
    isLoading,
    hasLoaded,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    getPromptById,
  };
});
