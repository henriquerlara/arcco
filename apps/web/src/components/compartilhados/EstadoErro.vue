<script setup lang="ts">
import { AlertTriangle, RefreshCw } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import { ErroRequisicao } from '@/services';

const props = defineProps<{
  erro?: unknown;
  titulo?: string;
}>();

const emit = defineEmits<{ (e: 'tentar-novamente'): void }>();

function mensagem(): string {
  if (props.erro instanceof ErroRequisicao) return props.erro.message;
  if (props.erro instanceof Error) return props.erro.message;
  return 'Não foi possível carregar os dados.';
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-lg border border-erro/25 bg-erro/5 px-6 py-12 text-center"
  >
    <div class="mb-4 flex size-14 items-center justify-center rounded-full bg-erro/10 text-erro">
      <AlertTriangle class="size-7" />
    </div>
    <h3 class="text-base font-semibold text-texto">
      {{ titulo ?? 'Algo deu errado' }}
    </h3>
    <p class="mt-1 max-w-sm text-sm text-texto-secundario">{{ mensagem() }}</p>
    <Button variante="secundario" class="mt-5" @click="emit('tentar-novamente')">
      <RefreshCw class="size-4" />
      Tentar novamente
    </Button>
  </div>
</template>
