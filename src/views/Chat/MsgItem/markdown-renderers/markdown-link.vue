<script setup lang="ts">
interface Props {
  href: string;
  title?: string;
  children?: any;
}

withDefaults(defineProps<Props>(), {
  title: "",
});

// 不需要处理点击事件，Tauri 的 on_navigation 插件会自动拦截所有导航
// 外部链接会被自动在系统浏览器中打开
</script>

<template>
    <a 
        :href="href"
        :title="title"
        class="markdown-link"
        target="_blank"
        rel="noopener noreferrer"
    >
        <slot />
    </a>
</template>

<style scoped lang="less">
.markdown-link {
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    text-decoration: underline;
    opacity: 0.8;
  }
  
  &:active {
    opacity: 0.6;
  }
}
</style>