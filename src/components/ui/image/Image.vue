<template>
    <div class="relative inline-block">
        <!-- Loading spinner -->
        <div
            v-if="loading"
            class="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800"
        >
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-gray-100" />
        </div>
    
        <!-- Error state -->
        <div
            v-if="error"
            class="flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 p-4 rounded-md"
            :style="{ width: width, height: height }"
        >
            <div class="text-center">
                <div class="text-sm">
                    Failed to load image
                </div>
                <button
                    v-if="showRetry"
                    class="mt-2 text-xs text-blue-500 hover:text-blue-700 underline"
                    @click="retry"
                >
                    Retry
                </button>
            </div>
        </div>
    
        <!-- Actual image -->
        <img
            v-show="!loading && !error"
            :src="src"
            :alt="alt"
            :width="width"
            :height="height"
            :class="cn('max-w-full h-auto', className, preview ? 'cursor-pointer' : '')"
            @load="handleLoad"
            @error="handleError"
            @click="handleClick"
        >
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  src: string
  alt?: string
  width?: string | number
  height?: string | number
  className?: string
  showRetry?: boolean
  preview?: boolean
  onLoad?: () => void
  onError?: () => void
  onClick?: () => void
  onPreview?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  showRetry: true,
  preview: false
})

const emit = defineEmits<{
  load: []
  error: []
  click: []
  preview: []
}>()

const loading = ref(true)
const error = ref(false)
const handleLoad = () => {
  loading.value = false
  error.value = false
  emit('load')
  props.onLoad?.()
}

const handleError = () => {
  loading.value = false
  error.value = true
  emit('error')
  props.onError?.()
}

const handlePreview = () => {
  emit('preview')
  props.onPreview?.()
}

const handleClick = () => {
  if (props.preview) {
    handlePreview()
    return
  }

  emit('click')
  props.onClick?.()
}

const retry = () => {
  loading.value = true
  error.value = false
  // Force reload by updating src
  const img = new Image()
  img.onload = handleLoad
  img.onerror = handleError
  img.src = props.src
}

onMounted(() => {
  if (props.src) {
    const img = new Image()
    img.onload = handleLoad
    img.onerror = handleError
    img.src = props.src
  } else {
    loading.value = false
    error.value = true
  }
})

// Watch for src changes
watch(() => props.src, () => {
  loading.value = true
  error.value = false
  retry()
})
</script>