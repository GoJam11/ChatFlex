<script setup lang="ts">
interface Props {
  code: string;
}

defineProps<Props>();
</script>

<template>
    <code class="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-foreground">{{ code }}</code>
</template>