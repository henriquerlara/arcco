<script setup lang="ts">
import { cn } from '@/composables/cn';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <svg
    :class="cn('pointer-events-none select-none', props.class)"
    viewBox="0 0 400 400"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M20 380V210C20 111.6 100.6 31 199 31C297.4 31 378 111.6 378 210V380"
      stroke="currentColor"
      stroke-width="10"
      stroke-linecap="round"
    />
    <path
      d="M92 380V214C92 155.1 140.1 107 199 107C257.9 107 306 155.1 306 214V380"
      stroke="currentColor"
      stroke-width="10"
      stroke-linecap="round"
      stroke-opacity="0.75"
    />
    <path
      d="M162 380V220C162 199.6 178.6 183 199 183C219.4 183 236 199.6 236 220V380"
      stroke="currentColor"
      stroke-width="10"
      stroke-linecap="round"
      stroke-opacity="0.5"
    />
  </svg>
</template>
