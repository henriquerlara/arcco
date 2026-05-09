<script setup>
import logoUrl from '@/assets/logo.png'

defineProps({
  /**
   * Anima a entrada do logo (fade + leve scale).
   */
  animated: {
    type: Boolean,
    default: true,
  },
  /**
   * Modo decorativo: opacidade reduzida + flutuação contínua,
   * sem animação de entrada. Usado como elemento de fundo (painel hero).
   */
  decorative: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <img
    :src="logoUrl"
    alt="ARCCO"
    draggable="false"
    :class="[
      'arcco-mark',
      { 'arcco-mark--animated': animated && !decorative, 'arcco-mark--decorative': decorative },
    ]"
  />
</template>

<style scoped>
.arcco-mark {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.arcco-mark--animated {
  animation: arcco-rise 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-origin: center bottom;
}

.arcco-mark--decorative {
  opacity: 0.55;
  animation: arcco-float 9s ease-in-out infinite;
}

@keyframes arcco-rise {
  0% {
    opacity: 0;
    transform: translateY(8%) scale(0.92);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes arcco-float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-6px) scale(1.015);
  }
}

@media (prefers-reduced-motion: reduce) {
  .arcco-mark--animated,
  .arcco-mark--decorative {
    animation: none;
  }
}
</style>
