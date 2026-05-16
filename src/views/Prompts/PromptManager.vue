<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { usePromptStore } from '@/features/prompt/usePromptStore';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'vue-sonner';
import type { Prompt } from '@/types/prompt';
import { useRouter } from 'vue-router';
import { useEditAreaStore } from '@/features/send/useEditAreaStore';
import { CREATE_NEW_CHAT } from '@/features/chat/useChatStore';

const promptStore = usePromptStore();
const { prompts, isLoading, hasLoaded } = storeToRefs(promptStore);
const { t } = useI18n();
const router = useRouter();
const editAreaStore = useEditAreaStore();

const searchQuery = ref('');
const isDialogOpen = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const editingPromptId = ref<string | null>(null);
const formState = reactive({
  title: '',
  content: '',
});

const isDeleteDialogOpen = ref(false);
const promptToDelete = ref<Prompt | null>(null);

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const filteredPrompts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return prompts.value;
  }
  return prompts.value.filter((item) => {
    return (
      item.title.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query)
    );
  });
});

const hasPrompts = computed(() => filteredPrompts.value.length > 0);
const showEmptyState = computed(
  () => hasLoaded.value && !isLoading.value && prompts.value.length === 0,
);
const showNoResults = computed(
  () =>
    hasLoaded.value &&
    !isLoading.value &&
    prompts.value.length > 0 &&
    !hasPrompts.value &&
    searchQuery.value.trim().length > 0,
);

function formatUpdatedAt(timestamp: number) {
  return dateFormatter.format(new Date(timestamp));
}

function resetForm() {
  formState.title = '';
  formState.content = '';
}

function hasPromptTitle(title: string) {
  return title.trim().length > 0;
}

function openCreateDialog() {
  dialogMode.value = 'create';
  editingPromptId.value = null;
  resetForm();
  isDialogOpen.value = true;
}

function openEditDialog(prompt: Prompt) {
  dialogMode.value = 'edit';
  editingPromptId.value = prompt.id;
  formState.title = prompt.title;
  formState.content = prompt.content;
  isDialogOpen.value = true;
}

function closeDialog() {
  isDialogOpen.value = false;
  resetForm();
  editingPromptId.value = null;
}

function validateForm() {
  if (!formState.content.trim()) {
    toast.error(t('prompts.validation.contentRequired'));
    return false;
  }
  return true;
}

async function handleSubmit() {
  if (!validateForm()) {
    return;
  }

  const payload = {
    title: formState.title.trim(),
    content: formState.content.trim(),
  };

  if (dialogMode.value === 'create') {
    const result = await promptStore.createPrompt(payload);
    if (result.success) {
      toast.success(t('prompts.createSuccess'));
      closeDialog();
    } else {
      toast.error(t('prompts.error', { message: result.error }));
    }
    return;
  }

  if (!editingPromptId.value) {
    toast.error(t('prompts.error', { message: t('prompts.validation.unknownPrompt') }));
    return;
  }

  const result = await promptStore.updatePrompt(editingPromptId.value, payload);
  if (result.success) {
    toast.success(t('prompts.updateSuccess'));
    closeDialog();
  } else {
    toast.error(t('prompts.error', { message: result.error }));
  }
}

function confirmDelete(prompt: Prompt) {
  promptToDelete.value = prompt;
  isDeleteDialogOpen.value = true;
}

function closeDeleteDialog() {
  isDeleteDialogOpen.value = false;
  promptToDelete.value = null;
}

async function handleDelete() {
  if (!promptToDelete.value) {
    return;
  }
  const result = await promptStore.deletePrompt(promptToDelete.value.id);
  if (result.success) {
    toast.success(t('prompts.deleteSuccess'));
    closeDeleteDialog();
  } else {
    toast.error(t('prompts.error', { message: result.error }));
  }
}

async function handleUsePrompt(prompt: Prompt) {
  editAreaStore.loadDraft(CREATE_NEW_CHAT);
  editAreaStore.setPendingAttachment(null);
  editAreaStore.setInputValue(prompt.content);
  editAreaStore.saveDraft(CREATE_NEW_CHAT);
  await router.push({ name: 'Layout' });
}

onMounted(async () => {
  if (!hasLoaded.value) {
    const result = await promptStore.fetchPrompts();
    if (!result.success) {
      toast.error(t('prompts.loadFailed', { message: result.error }));
    }
  }
});
</script>

<template>
    <div class="prompt-manager">
        <div class="prompt-manager__header">
            <div>
                <h1 class="prompt-manager__title">
                    {{ t('prompts.title') }}
                </h1>
                <p class="prompt-manager__description">
                    {{ t('prompts.description') }}
                </p>
            </div>
            <Button size="sm" @click="openCreateDialog">
                {{ t('prompts.create') }}
            </Button>
        </div>

        <div class="prompt-manager__toolbar">
            <Input
                v-model="searchQuery"
                :placeholder="t('prompts.searchPlaceholder')"
                class="prompt-manager__search"
            />
            <span v-if="searchQuery.trim() && hasPrompts" class="prompt-manager__result-info">
                {{ t('prompts.searchResults', { count: filteredPrompts.length }) }}
            </span>
        </div>

        <div class="prompt-manager__content">
            <div v-if="isLoading" class="prompt-manager__loading">
                <Spinner size="large" />
            </div>
            <div v-else-if="showEmptyState" class="prompt-manager__empty">
                <h2>{{ t('prompts.emptyTitle') }}</h2>
                <p>{{ t('prompts.emptyDescription') }}</p>
            </div>
            <div v-else-if="showNoResults" class="prompt-manager__empty">
                <h2>{{ t('prompts.noResultsTitle') }}</h2>
                <p>{{ t('prompts.noResultsDescription') }}</p>
            </div>
            <ScrollArea v-else class="prompt-manager__list">
                <div class="prompt-list">
                    <div
                        v-for="prompt in filteredPrompts"
                        :key="prompt.id"
                        class="prompt-card"
                    >
                        <div class="prompt-card__header">
                            <h3
                                v-if="hasPromptTitle(prompt.title)"
                                class="prompt-card__title"
                            >
                                {{ prompt.title }}
                            </h3>
                            <span class="prompt-card__timestamp">
                                {{ t('prompts.lastUpdated', { time: formatUpdatedAt(prompt.updatedAt) }) }}
                            </span>
                        </div>
                        <p class="prompt-card__content">
                            {{ prompt.content }}
                        </p>
                        <div class="prompt-card__actions">
                            <Button variant="secondary" size="sm" @click="handleUsePrompt(prompt)">
                                {{ t('prompts.use') }}
                            </Button>
                            <Button variant="ghost" size="sm" @click="openEditDialog(prompt)">
                                {{ t('prompts.edit') }}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                class="prompt-card__delete"
                                @click="confirmDelete(prompt)"
                            >
                                {{ t('prompts.delete') }}
                            </Button>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>

        <Dialog v-model:open="isDialogOpen">
            <DialogContent class="prompt-dialog">
                <DialogHeader>
                    <DialogTitle>
                        {{
                            dialogMode === 'create'
                                ? t('prompts.createTitle')
                                : t('prompts.editTitle')
                        }}
                    </DialogTitle>
                </DialogHeader>
                <div class="prompt-dialog__body">
                    <div class="prompt-dialog__field">
                        <label for="prompt-title">{{ t('prompts.nameLabel') }}</label>
                        <Input
                            id="prompt-title"
                            v-model="formState.title"
                            :placeholder="t('prompts.namePlaceholder')"
                        />
                    </div>
                    <div class="prompt-dialog__field">
                        <label for="prompt-content">{{ t('prompts.contentLabel') }}</label>
            <Textarea
              id="prompt-content"
              v-model="formState.content"
              :placeholder="t('prompts.contentPlaceholder')"
              :rows="8"
            />
          </div>
        </div>
                <DialogFooter>
                    <Button variant="ghost" @click="closeDialog">
                        {{ t('common.cancel') }}
                    </Button>
                    <Button @click="handleSubmit">
                        {{ dialogMode === 'create' ? t('common.create') : t('common.save') }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog v-model:open="isDeleteDialogOpen">
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{{ t('prompts.deleteTitle') }}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {{ t('prompts.deleteDescription') }}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel @click="closeDeleteDialog">
                        {{ t('common.cancel') }}
                    </AlertDialogCancel>
                    <AlertDialogAction class="prompt-delete" @click="handleDelete">
                        {{ t('prompts.confirmDelete') }}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
</template>

<style scoped lang="less">
.prompt-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  gap: 16px;
  color: var(--color-text);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  &__title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  &__description {
    color: var(--text-secondary, #6b7280);
    font-size: 14px;
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  &__search {
    max-width: 320px;
  }

  &__result-info {
    font-size: 13px;
    color: var(--text-secondary, #6b7280);
  }

  &__content {
    flex: 1;
    min-height: 0;
    border-radius: 12px;
    background: var(--color-surface, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--border-color-primary);
    padding: 16px;
    display: flex;
    flex-direction: column;
  }

  &__loading,
  &__empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 8px;
    color: var(--text-secondary, #6b7280);
  }

  &__list {
    flex: 1;
  }
}

.prompt-list {
  display: grid;
  gap: 16px;
}

.prompt-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: var(--color-background, rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border-color-secondary, rgba(148, 163, 184, 0.2));

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  &__title {
    font-size: 18px;
    font-weight: 600;
    word-break: break-word;
  }

  &__timestamp {
    font-size: 12px;
    color: var(--text-tertiary, #94a3b8);
    white-space: nowrap;
  }

  &__content {
    line-height: 1.5;
    color: var(--color-text);
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  &__delete {
    color: var(--danger-color, #ef4444);
  }
}

.prompt-dialog {
  max-width: 560px;

  &__body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 12px;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 8px;

    label {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text);
    }
  }
}

.prompt-delete {
  background-color: var(--danger-color, #ef4444);
  color: #fff;

  &:hover {
    background-color: color-mix(in srgb, var(--danger-color, #ef4444) 90%, #000 10%);
  }
}

@media (max-width: 768px) {
  .prompt-manager {
    padding: 16px;

    &__header {
      flex-direction: column;
      align-items: flex-start;
    }

    &__search {
      width: 100%;
      max-width: none;
    }
  }
}
</style>
