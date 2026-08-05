<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'radix-vue';
import { computed, type Component } from 'vue';

export interface ItemMenu {
  rotulo: string;
  acao: () => void;
  icone?: Component;
  perigo?: boolean;
  separadorAntes?: boolean;
  desabilitado?: boolean;
}

defineProps<{
  itens: ItemMenu[];
  alinhamento?: 'start' | 'center' | 'end';
}>();

const itemClasse = (perigo?: boolean) =>
  computed(() =>
    [
      'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-marfim',
      perigo ? 'text-erro data-[highlighted]:bg-erro/10' : 'text-texto',
    ].join(' '),
  ).value;
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot name="gatilho" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :align="alinhamento ?? 'end'"
        :side-offset="6"
        class="z-50 min-w-[11rem] rounded-md border border-borda bg-branco p-1 shadow-flutuante animate-fade-in"
      >
        <template v-for="(item, i) in itens" :key="i">
          <DropdownMenuSeparator
            v-if="item.separadorAntes"
            class="my-1 h-px bg-borda"
          />
          <DropdownMenuItem
            :disabled="item.desabilitado"
            :class="itemClasse(item.perigo)"
            @select="item.acao()"
          >
            <component :is="item.icone" v-if="item.icone" class="size-4" />
            {{ item.rotulo }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
