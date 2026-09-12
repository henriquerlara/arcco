<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  Plus,
  CheckCircle2,
  Circle,
  CalendarClock,
  User,
  Target,
} from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Select from '@/components/ui/Select.vue';
import Card from '@/components/ui/Card.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import AtividadeFormulario from './AtividadeFormulario.vue';
import type { Atividade } from '@/types';
import { servicoAtividades } from '@/services';
import { ROTULO_TIPO_ATIVIDADE, opcoesDe } from '@/composables/rotulos';
import { formatarDataHora, estaAtrasada } from '@/composables/formatadores';
import { useNotificacao } from '@/composables/useNotificacao';
import { cn } from '@/composables/cn';

const queryClient = useQueryClient();
const { notificarErro } = useNotificacao();

const situacao = ref<'pendentes' | 'concluidas' | 'todas'>('pendentes');
const tipo = ref('');
const responsavelId = ref<string | null>(null);
const formAberto = ref(false);
const atividadeEmEdicao = ref<Atividade | null>(null);

const opcoesTipo = [{ valor: '', rotulo: 'Todos os tipos' }, ...opcoesDe(ROTULO_TIPO_ATIVIDADE)];
const opcoesSituacao = [
  { valor: 'pendentes', rotulo: 'Pendentes' },
  { valor: 'concluidas', rotulo: 'Concluídas' },
  { valor: 'todas', rotulo: 'Todas' },
];

const filtros = computed(() => ({
  tipo: tipo.value || undefined,
  responsavelId: responsavelId.value ?? undefined,
  concluida:
    situacao.value === 'todas' ? undefined : situacao.value === 'concluidas',
  porPagina: 50,
}));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['atividades', filtros.value]),
  queryFn: () => servicoAtividades.listar(filtros.value),
});

const linhas = computed(() => data.value?.dados ?? []);

async function alternar(ativ: Atividade) {
  try {
    await servicoAtividades.concluir(ativ.id, !ativ.concluida);
    await queryClient.invalidateQueries({ queryKey: ['atividades'] });
  } catch (e) {
    notificarErro(e);
  }
}

function editar(ativ: Atividade) {
  atividadeEmEdicao.value = ativ;
  formAberto.value = true;
}

function novaAtividade() {
  atividadeEmEdicao.value = null;
  formAberto.value = true;
}

function contatoDaAtividade(ativ: Atividade) {
  return ativ.contato ?? ativ.oportunidade?.contato ?? null;
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Atividades" descricao="Tarefas, follow-ups e compromissos da equipe.">
      <template #acoes>
        <Button @click="novaAtividade"><Plus class="size-4" /> Nova atividade</Button>
      </template>
    </CabecalhoPagina>

    <div class="grid gap-3 sm:grid-cols-3">
      <Select v-model="situacao" :opcoes="opcoesSituacao" />
      <Select v-model="tipo" :opcoes="opcoesTipo" />
      <SeletorUsuario v-model="responsavelId" incluir-vazio rotulo-vazio="Todos os responsáveis" />
    </div>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />

    <div v-else-if="isLoading" class="space-y-2">
      <Skeleton v-for="n in 5" :key="n" class="h-16 w-full" />
    </div>

    <EstadoVazio
      v-else-if="linhas.length === 0"
      titulo="Nenhuma atividade"
      descricao="Você está em dia! Crie uma atividade para acompanhar próximos passos."
      :icone="CalendarClock"
    >
      <template #acao>
        <Button @click="novaAtividade"><Plus class="size-4" /> Nova atividade</Button>
      </template>
    </EstadoVazio>

    <div v-else class="space-y-2">
      <Card
        v-for="ativ in linhas"
        :key="ativ.id"
        class="flex items-center gap-4 p-4"
      >
        <button class="shrink-0" @click="alternar(ativ)">
          <CheckCircle2 v-if="ativ.concluida" class="size-6 text-sucesso" />
          <Circle v-else class="size-6 text-texto-secundario hover:text-dourado" />
        </button>

        <button class="min-w-0 flex-1 text-left" @click="editar(ativ)">
          <div class="flex items-center gap-2">
            <p
              :class="
                cn(
                  'truncate text-sm font-medium',
                  ativ.concluida ? 'text-texto-secundario line-through' : 'text-texto',
                )
              "
            >
              {{ ativ.titulo }}
            </p>
            <Badge variante="neutro">{{ ROTULO_TIPO_ATIVIDADE[ativ.tipo] }}</Badge>
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-texto-secundario">
            <span
              class="flex items-center gap-1"
              :class="!ativ.concluida && estaAtrasada(ativ.vencimento) ? 'font-medium text-erro' : ''"
            >
              <CalendarClock class="size-3.5" /> {{ formatarDataHora(ativ.vencimento) }}
            </span>
            <RouterLink
              v-if="contatoDaAtividade(ativ)"
              :to="`/app/contatos/${contatoDaAtividade(ativ)!.id}`"
              class="flex items-center gap-1 hover:text-dourado-hover"
              @click.stop
            >
              <User class="size-3.5" /> {{ contatoDaAtividade(ativ)!.nome }}
            </RouterLink>
            <span v-if="ativ.oportunidade" class="flex items-center gap-1">
              <Target class="size-3.5" /> {{ ativ.oportunidade.codigo }}
            </span>
          </div>
        </button>

        <RouterLink
          v-if="ativ.oportunidadeId"
          :to="`/app/oportunidades/${ativ.oportunidadeId}`"
          class="shrink-0 rounded-md p-2 text-texto-secundario hover:bg-marfim hover:text-dourado-hover"
          title="Ver oportunidade"
        >
          <Target class="size-4" />
        </RouterLink>
      </Card>
    </div>

    <AtividadeFormulario v-model="formAberto" :atividade="atividadeEmEdicao" @salvo="refetch()" />
  </div>
</template>
