<script setup lang="ts" generic="T extends { id: string }">
import Skeleton from './Skeleton.vue';

export interface ColunaTabela {
  chave: string;
  rotulo: string;
  class?: string;
  alinhamento?: 'esquerda' | 'centro' | 'direita';
}

defineProps<{
  colunas: ColunaTabela[];
  linhas: T[];
  carregando?: boolean;
  linhasEsqueleto?: number;
  clicavel?: boolean;
}>();

const emit = defineEmits<{ (e: 'linha-clique', linha: T): void }>();

function alinhar(col: ColunaTabela): string {
  if (col.alinhamento === 'direita') return 'text-right';
  if (col.alinhamento === 'centro') return 'text-center';
  return 'text-left';
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-borda bg-card shadow-cartao">
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-borda bg-marfim/60">
            <th
              v-for="col in colunas"
              :key="col.chave"
              :class="[
                'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-texto-secundario',
                alinhar(col),
                col.class,
              ]"
              scope="col"
            >
              {{ col.rotulo }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="carregando">
            <tr
              v-for="n in linhasEsqueleto ?? 6"
              :key="`sk-${n}`"
              class="border-b border-borda last:border-0"
            >
              <td v-for="col in colunas" :key="col.chave" class="px-4 py-3.5">
                <Skeleton class="h-4 w-full max-w-[160px]" />
              </td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="linha in linhas"
              :key="linha.id"
              :class="[
                'border-b border-borda transition-colors last:border-0',
                clicavel ? 'cursor-pointer hover:bg-marfim/50' : 'hover:bg-marfim/30',
              ]"
              @click="clicavel && emit('linha-clique', linha)"
            >
              <td
                v-for="col in colunas"
                :key="col.chave"
                :class="['px-4 py-3.5 text-texto', alinhar(col), col.class]"
              >
                <slot :name="`celula-${col.chave}`" :linha="linha" :valor="(linha as Record<string, unknown>)[col.chave]">
                  {{ (linha as Record<string, unknown>)[col.chave] ?? '—' }}
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <slot name="rodape" />
  </div>
</template>
