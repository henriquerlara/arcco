<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Bell } from 'lucide-vue-next';
import { PersonalizacaoComercial } from '@arcco/contratos';
import { servicoAtividades } from '@/services';
import { formatarDataHora } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { cn } from '@/composables/cn';

const auth = useAutenticacaoStore();
const router = useRouter();
const queryClient = useQueryClient();
const aberto = ref(false);

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);

const { data, refetch } = useQuery({
  queryKey: ['resumo-agenda'],
  queryFn: () => servicoAtividades.resumoAgenda(),
  enabled: ecolume,
  refetchInterval: 60_000,
});

const total = computed(() => data.value?.total ?? 0);
const itens = computed(() => data.value?.itens ?? []);

watch(aberto, (v) => {
  if (v) void refetch();
});

function ir(item: {
  id: string;
  oportunidadeId?: string | null;
  atrasada: boolean;
}) {
  aberto.value = false;
  if (item.oportunidadeId) {
    void router.push({
      name: 'oportunidade-detalhe',
      params: { id: item.oportunidadeId },
      query: { atividadeId: item.id },
    });
    return;
  }
  void router.push({
    path: '/app/agenda',
    query: item.atrasada ? { atrasadas: '1' } : undefined,
  });
}

function invalidar() {
  void queryClient.invalidateQueries({ queryKey: ['resumo-agenda'] });
}

defineExpose({ invalidar });
</script>

<template>
  <div v-if="ecolume" class="relative">
    <button
      type="button"
      class="relative rounded-md border border-borda/80 p-2 text-carvao hover:bg-marfim"
      aria-label="Notificações da agenda"
      @click="aberto = !aberto"
    >
      <Bell class="size-5" />
      <span
        v-if="total > 0"
        class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-erro px-1 text-[10px] font-bold text-branco"
      >
        {{ total > 99 ? '99+' : total }}
      </span>
    </button>

    <div
      v-if="aberto"
      class="absolute right-0 z-50 mt-2 w-80 rounded-md border border-borda bg-branco shadow-lg"
    >
      <div class="border-b border-borda px-3 py-2 text-xs font-semibold text-texto">
        Hoje {{ data?.doDia ?? 0 }} · Atrasadas {{ data?.atrasadas ?? 0 }}
      </div>
      <ul v-if="itens.length" class="max-h-72 overflow-y-auto py-1">
        <li v-for="item in itens" :key="item.id">
          <button
            type="button"
            class="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-marfim/80"
            @click="ir(item)"
          >
            <span class="truncate text-sm font-medium text-texto">{{ item.titulo }}</span>
            <span
              :class="
                cn(
                  'text-[11px] text-texto-secundario',
                  item.atrasada && 'font-medium text-erro',
                )
              "
            >
              {{ formatarDataHora(item.vencimento) }}
              <template v-if="item.negocioCodigo"> · {{ item.negocioCodigo }}</template>
              <template v-else-if="item.contatoNome"> · {{ item.contatoNome }}</template>
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="px-3 py-4 text-xs text-texto-secundario">Nenhum compromisso pendente.</p>
      <button
        type="button"
        class="block w-full border-t border-borda px-3 py-2 text-center text-xs font-medium text-dourado-hover hover:bg-marfim"
        @click="aberto = false; $router.push('/app/agenda')"
      >
        Abrir agenda
      </button>
    </div>
  </div>
</template>
