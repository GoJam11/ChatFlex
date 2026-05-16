<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMemoryStore } from '@/features/memory/useMemoryStore';
import { generateMemory } from '@/features/memory/generateMemory';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
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
import { toast } from 'vue-sonner';

const { t } = useI18n();
const memoryStore = useMemoryStore();

const isEditing = ref(false);
const editContent = ref('');
const isClearDialogOpen = ref(false);

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const formattedLastUpdated = computed(() => {
  if (!memoryStore.lastUpdated) return '';
  return t('memory.lastUpdated', {
    time: dateFormatter.format(new Date(memoryStore.lastUpdated)),
  });
});

const actionButtonText = computed(() => {
  if (memoryStore.isGenerating) return t('memory.generating');
  return memoryStore.hasMemory ? t('memory.update') : t('memory.generate');
});

function startEdit() {
  editContent.value = memoryStore.content;
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  editContent.value = '';
}

function saveEdit() {
  memoryStore.setMemory(editContent.value.trim());
  isEditing.value = false;
  editContent.value = '';
  toast.success(t('memory.saveSuccess'));
}

async function handleGenerate() {
  try {
    await generateMemory();
    toast.success(t('memory.generateSuccess'));
  } catch (error: any) {
    if (error.message === 'NO_CHATS') {
      toast.error(t('memory.noChatsFound'));
    } else if (error.message === 'NO_MODEL_CONFIG') {
      toast.error(t('memory.noModelConfig'));
    } else {
      toast.error(t('memory.generateFailed'));
    }
  }
}

function handleClear() {
  memoryStore.clearMemory();
  isEditing.value = false;
  isClearDialogOpen.value = false;
  toast.success(t('memory.clearSuccess'));
}
</script>

<template>
  <div class="memory-page">
    <div class="memory-page__header">
      <div>
        <h1 class="memory-page__title">
          {{ t('memory.title') }}
        </h1>
        <p class="memory-page__description">
          {{ t('memory.description') }}
        </p>
      </div>
      <div class="memory-page__actions">
        <template v-if="isEditing">
          <Button variant="ghost" size="sm" @click="cancelEdit">
            {{ t('memory.cancelEdit') }}
          </Button>
          <Button size="sm" @click="saveEdit">
            {{ t('memory.save') }}
          </Button>
        </template>
        <template v-else>
          <Button
            v-if="memoryStore.hasMemory"
            variant="ghost"
            size="sm"
            @click="startEdit"
          >
            {{ t('memory.edit') }}
          </Button>
          <Button
            v-if="memoryStore.hasMemory"
            variant="ghost"
            size="sm"
            class="memory-page__clear-btn"
            @click="isClearDialogOpen = true"
          >
            {{ t('memory.clear') }}
          </Button>
          <Button
            size="sm"
            :disabled="memoryStore.isGenerating"
            @click="handleGenerate"
          >
            <Spinner v-if="memoryStore.isGenerating" class="mr-2" size="small" />
            {{ actionButtonText }}
          </Button>
        </template>
      </div>
    </div>

    <div class="memory-page__content">
      <template v-if="memoryStore.isGenerating && !memoryStore.hasMemory">
        <div class="memory-page__loading">
          <Spinner size="large" />
          <p>{{ t('memory.generating') }}</p>
        </div>
      </template>
      <template v-else-if="isEditing">
        <Textarea
          v-model="editContent"
          class="memory-page__editor"
          :rows="16"
        />
      </template>
      <template v-else-if="memoryStore.hasMemory">
        <ScrollArea class="memory-page__scroll">
          <pre class="memory-page__text">{{ memoryStore.content }}</pre>
        </ScrollArea>
        <p v-if="formattedLastUpdated" class="memory-page__timestamp">
          {{ formattedLastUpdated }}
        </p>
      </template>
      <template v-else>
        <div class="memory-page__empty">
          <h2>{{ t('memory.emptyTitle') }}</h2>
          <p>{{ t('memory.emptyDescription') }}</p>
        </div>
      </template>
    </div>

    <AlertDialog v-model:open="isClearDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('memory.clearTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('memory.clearDescription') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <AlertDialogAction class="memory-page__clear-action" @click="handleClear">
            {{ t('common.confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<style scoped lang="less">
.memory-page {
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

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
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

  &__scroll {
    flex: 1;
  }

  &__text {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.7;
    font-family: inherit;
    font-size: 14px;
  }

  &__editor {
    flex: 1;
    resize: none;
    font-size: 14px;
    line-height: 1.7;
  }

  &__timestamp {
    margin-top: 12px;
    font-size: 12px;
    color: var(--text-tertiary, #94a3b8);
    text-align: right;
  }

  &__clear-btn {
    color: var(--danger-color, #ef4444);
  }

  &__clear-action {
    background-color: var(--danger-color, #ef4444);
    color: #fff;

    &:hover {
      background-color: color-mix(in srgb, var(--danger-color, #ef4444) 90%, #000 10%);
    }
  }
}

@media (max-width: 768px) {
  .memory-page {
    padding: 16px;

    &__header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
}
</style>
