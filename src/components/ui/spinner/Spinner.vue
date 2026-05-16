<template>
    <div :class="cn('inline-flex items-center justify-center', className)" :style="containerStyle">
        <div 
            :class="cn('animate-spin rounded-full border-2 border-solid border-current border-r-transparent', sizeClasses)"
            :style="spinnerStyle"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  size?: 'small' | 'medium' | 'large' | number | string
  color?: string
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  color: 'currentColor'
})

const sizeMap = {
  small: { width: '16px', height: '16px' },
  medium: { width: '24px', height: '24px' },
  large: { width: '32px', height: '32px' }
}

const sizeClasses = computed(() => {
  const size = props.size
  if (typeof size === 'string' && size in sizeMap) {
    return {
      small: 'w-4 h-4',
      medium: 'w-6 h-6', 
      large: 'w-8 h-8'
    }[size]
  }
  return ''
})

const spinnerStyle = computed(() => {
  const style: Record<string, string> = {}
  
  if (props.color && props.color !== 'currentColor') {
    style.borderColor = props.color
    style.borderRightColor = 'transparent'
  }
  
  if (typeof props.size === 'number') {
    const sizeValue = `${props.size}px`
    style.width = sizeValue
    style.height = sizeValue
  } else if (typeof props.size === 'string' && !(props.size in sizeMap)) {
    style.width = props.size
    style.height = props.size
  }
  
  return style
})

const containerStyle = computed(() => {
  // If custom size is provided, ensure container accommodates it
  if (typeof props.size === 'number' || (typeof props.size === 'string' && !(props.size in sizeMap))) {
    return {
      width: typeof props.size === 'number' ? `${props.size}px` : props.size,
      height: typeof props.size === 'number' ? `${props.size}px` : props.size
    }
  }
  return {}
})
</script>