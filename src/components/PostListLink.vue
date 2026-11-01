<script setup lang="ts">
defineProps<{ to: string }>()
</script>

<template>
  <a v-if="to.includes('://')" :href="to" target="_blank" rel="noopener noreferrer">
    <slot />
  </a>
  <RouterLink v-else :to="to">
    <slot />
  </RouterLink>
</template>
