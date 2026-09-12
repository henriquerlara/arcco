<script setup lang="ts">
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'radix-vue';
import { Check, ChevronDown } from 'lucide-vue-next';
import { computed } from 'vue';
import { cn } from '@/composables/cn';

export interface OpcaoSelect {
  valor: string;
  rotulo: string;
}

/** Radix Select não aceita value="" nos itens — usamos sentinela interna. */
const SENTINELA_VAZIO = '__arcco_vazio__';

const props = defineProps<{
  modelValue?: string | null;
  opcoes: OpcaoSelect[];
  placeholder?: string;
  disabled?: boolean;
  invalido?: boolean;
  id?: string;
  class?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', valor: string): void }>();

const opcoesInternas = computed(() =>
  props.opcoes.map((opcao) => ({
    ...opcao,
    valor: opcao.valor === '' ? SENTINELA_VAZIO : opcao.valor,
  })),
);

const valorInterno = computed({
  get: () => {
    const atual = props.modelValue;
    if (atual === '' || atual === null || atual === undefined) {
      return props.opcoes.some((o) => o.valor === '') ? SENTINELA_VAZIO : undefined;
    }
    return atual;
  },
  set: (v) => emit('update:modelValue', v === SENTINELA_VAZIO || v == null ? '' : v),
});

const triggerClasses = computed(() =>
  cn(
    'flex h-10 w-full items-center justify-between rounded-md border bg-branco px-3 py-2 text-sm text-texto transition-[border-color,background-color] data-[placeholder]:text-texto-secundario/60 focus:border-carvao focus:bg-white focus:outline-none focus:ring-2 focus:ring-carvao/10 disabled:cursor-not-allowed disabled:bg-marfim/60 disabled:opacity-60',
    props.invalido ? 'border-erro' : 'border-borda',
    props.class,
  ),
);
</script>

<template>
  <SelectRoot v-model="valorInterno" :disabled="disabled">
    <SelectTrigger :id="id" :class="triggerClasses" :aria-invalid="invalido || undefined">
      <SelectValue :placeholder="placeholder ?? 'Selecione…'" />
      <SelectIcon as-child>
        <ChevronDown class="size-4 text-texto-secundario" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        class="z-50 max-h-72 min-w-[--radix-select-trigger-width] overflow-hidden rounded-md border border-borda bg-branco shadow-flutuante animate-fade-in"
      >
        <SelectViewport class="p-1">
          <SelectItem
            v-for="opcao in opcoesInternas"
            :key="opcao.valor"
            :value="opcao.valor"
            class="relative flex cursor-pointer select-none items-center rounded-sm py-2.5 pl-8 pr-3 text-sm text-texto outline-none data-[highlighted]:bg-marfim data-[state=checked]:font-semibold"
          >
            <span class="absolute left-2 flex size-4 items-center justify-center">
              <SelectItemIndicator>
                <Check class="size-4 text-carvao" />
              </SelectItemIndicator>
            </span>
            <SelectItemText>{{ opcao.rotulo }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
