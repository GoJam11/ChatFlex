<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useOllamaModelManager } from '@/features/ollama/useOllamaModelManager'
import { getOllamaConnectionStatus } from '@/features/ollama/ollamaProvider'
import { Button } from '@/components/ui/button'
import { Item, ItemContent, ItemTitle, ItemMedia, ItemGroup } from '@/components/ui/item'
import { RotateCcw, Box } from 'lucide-vue-next'

const {
  isRefreshingLocal,
  connectionError,
  getLocalModels,
  refreshLocalModels,
  checkOllamaConnection
} = useOllamaModelManager()

const localModels = computed(() => getLocalModels())

const isOllamaConnected = computed(() => getOllamaConnectionStatus().isConfigured)

const handleRefreshLocal = async () => {
  await refreshLocalModels()
}

const handleCheckConnection = async () => {
  const connected = await checkOllamaConnection()
  if (connected) {
    await refreshLocalModels()
  }
}

onMounted(async () => {
  if (isOllamaConnected.value) {
    await handleCheckConnection()
  }
})
</script>

<template>
    <div class="space-y-6">
        <!-- Connection Status -->
        <div v-if="connectionError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <div class="w-2 h-2 bg-red-500 rounded-full" />
                    <span class="text-sm text-red-800 dark:text-red-200">
                        {{ connectionError }}
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    @click="handleCheckConnection"
                >
                    重试连接
                </Button>
            </div>
        </div>

        <div v-else-if="!isOllamaConnected" class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <div class="w-2 h-2 bg-yellow-500 rounded-full" />
                    <span class="text-sm text-yellow-800 dark:text-yellow-200">
                        Ollama服务未连接，请检查配置和服务状态
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    @click="handleCheckConnection"
                >
                    检查连接
                </Button>
            </div>
        </div>

        <div v-else class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div class="flex items-center space-x-2">
                <div class="w-2 h-2 bg-green-500 rounded-full" />
                <span class="text-sm text-green-800 dark:text-green-200">
                    Ollama服务已连接
                </span>
            </div>
        </div>

        <!-- Local Models Section -->
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold">
                    本地模型
                </h3>
                <Button
                    variant="outline"
                    size="sm"
                    :disabled="!isOllamaConnected || isRefreshingLocal"
                    @click="handleRefreshLocal"
                >
                    <RotateCcw class="w-4 h-4 mr-2" :class="{ 'animate-spin': isRefreshingLocal }" />
                    {{ isRefreshingLocal ? '刷新中...' : '刷新' }}
                </Button>
            </div>

            <!-- Local Models List -->
            <ItemGroup v-if="localModels.length > 0" class="gap-2">
                <Item
                    v-for="modelName in localModels"
                    :key="modelName"
                    variant="outline"
                    size="sm"
                >
                    <ItemMedia variant="icon">
                        <Box class="size-4" />
                    </ItemMedia>
                    <ItemContent>
                        <ItemTitle>{{ modelName }}</ItemTitle>
                    </ItemContent>
                </Item>
            </ItemGroup>

            <div v-else class="text-center py-12 text-gray-500">
                <p class="text-lg font-medium mb-2">
                    暂无本地模型
                </p>
                <p class="text-sm">
                    请在 Ollama 中拉取模型后点击刷新
                </p>
            </div>
        </div>
    </div>
</template>
