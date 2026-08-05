<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'radix-vue';
import { X } from 'lucide-vue-next';
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    lado?: 'direita' | 'esquerda';
    titulo?: string;
    descricao?: string;
    largura?: string;
    class?: string;
  }>(),
  { lado: 'direita', largura: 'max-w-md' },
);

const emit = defineEmits<{ (e: 'update:modelValue', valor: boolean): void }>();

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const posicao = computed(() =>
  props.lado === 'direita'
    ? 'right-0 border-l data-[state=open]:slide-in-from-right'
    : 'left-0 border-r data-[state=open]:slide-in-from-left',
);
</script>

<template>
  <DialogRoot v-model:open="aberto">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-preto/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogContent
        :class="
          cn(
            'fixed inset-y-0 z-50 flex h-full w-full flex-col gap-0 bg-superficie shadow-flutuante focus:outline-none data-[state=open]:animate-fade-in',
            largura,
            posicao,
            props.class,
          )
        "
      >
        <header class="flex items-start justify-between gap-4 border-b border-borda bg-branco px-6 py-4">
          <div class="flex flex-col gap-0.5">
            <DialogTitle v-if="titulo" class="text-base font-semibold text-texto">
              {{ titulo }}
            </DialogTitle>
            <DialogDescription v-if="descricao" class="text-sm text-texto-secundario">
              {{ descricao }}
            </DialogDescription>
            <slot name="cabecalho" />
          </div>
          <DialogClose
            class="rounded-sm p-1 text-texto-secundario transition-colors hover:bg-marfim hover:text-texto focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Fechar"
          >
            <X class="size-5" />
          </DialogClose>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-5">
          <slot />
        </div>

        <footer v-if="$slots.rodape" class="border-t border-borda bg-branco px-6 py-4">
          <slot name="rodape" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
