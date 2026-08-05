import { onMounted, onUnmounted, ref } from 'vue';

/** Reativo ao estado de visibilidade do documento (para pausar polling em abas ocultas). */
export function useVisibilidade() {
  const visivel = ref(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  );

  function aoMudar() {
    visivel.value = document.visibilityState === 'visible';
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', aoMudar);
  });

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', aoMudar);
  });

  return { visivel };
}
