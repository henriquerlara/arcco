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
    titulo?: string;
    descricao?: string;
    tamanho?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    class?: string;
  }>(),
  { tamanho: 'md' },
);

const emit = defineEmits<{ (e: 'update:modelValue', valor: boolean): void }>();

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const larguras = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
} as const;
</script>

<template>
  <DialogRoot v-model:open="aberto">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-preto/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in"
      />
      <DialogContent
        :class="
          cn(
            'fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-lg border border-borda bg-branco p-6 shadow-flutuante focus:outline-none data-[state=open]:animate-fade-in',
            larguras[tamanho],
            props.class,
          )
        "
      >
        <div
          v-if="titulo || descricao || $slots.cabecalho"
          class="flex shrink-0 flex-col gap-1 pr-6"
        >
          <slot name="cabecalho">
            <DialogTitle v-if="titulo" class="text-lg font-semibold text-texto">
              {{ titulo }}
            </DialogTitle>
            <DialogDescription v-if="descricao" class="text-sm text-texto-secundario">
              {{ descricao }}
            </DialogDescription>
          </slot>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <slot />
        </div>

        <div v-if="$slots.rodape" class="flex shrink-0 justify-end gap-2 pt-2">
          <slot name="rodape" />
        </div>

        <DialogClose
          class="absolute right-4 top-4 rounded-sm p-1 text-texto-secundario transition-colors hover:bg-marfim hover:text-texto focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Fechar"
        >
          <X class="size-4" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
