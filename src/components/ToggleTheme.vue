<script setup lang='ts'>
import { isDark, toggleDark } from '~/logics'
</script>

<template>
  <button type="button" class="select-none" :title="$t('action-toggle-theme')" :aria-label="$t('action-dark-theme')" :aria-pressed="isDark" @click="toggleDark">
    <div i-ri-sun-line dark:i-ri-moon-line />
  </button>
</template>
