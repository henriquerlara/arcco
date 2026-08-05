<script setup lang="ts">
import { Toaster } from 'vue-sonner';
</script>

<template>
  <RouterView />
  <Toaster
    position="top-right"
    :duration="4000"
    :toast-options="{
      style: {
        background: 'var(--arcco-branco)',
        color: 'var(--arcco-texto)',
        border: '1px solid var(--arcco-borda)',
        borderRadius: '10px',
      },
    }"
  />
</template>
