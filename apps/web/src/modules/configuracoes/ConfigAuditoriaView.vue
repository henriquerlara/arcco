<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  PerfilUsuario,
  PersonalizacaoComercial,
  ROTULO_TIPO_AUDITORIA,
  TIPOS_AUDITORIA,
} from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import TabelaDados, { type ColunaTabela } from '@/components/compartilhados/TabelaDados.vue';
import Paginacao from '@/components/compartilhados/Paginacao.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import {
  servicoAuditoria,
  servicoEquipe,
  type RegistroAuditoriaLista,
} from '@/services';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const auth = useAutenticacaoStore();
const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);
const ehAdmin = computed(() => auth.temPerfil(PerfilUsuario.PROPRIETARIO));

const pagina = ref(1);
const usuarioId = ref('');
const tipo = ref('');
const de = ref('');
const ate = ref('');
const detalheAberto = ref(false);
const detalheId = ref<string | null>(null);
const detalheOrigem = ref<'OPERACIONAL' | 'PLATAFORMA' | undefined>(undefined);

const filtros = computed(() => ({
  pagina: pagina.value,
  porPagina: 20,
  usuarioId: usuarioId.value || undefined,
  tipo: tipo.value || undefined,
  de: de.value || undefined,
  ate: ate.value || undefined,
}));

watch([usuarioId, tipo, de, ate], () => {
  pagina.value = 1;
});

const { data: equipe } = useQuery({
  queryKey: ['equipe'],
  queryFn: () => servicoEquipe.listar(),
  enabled: computed(() => ecolume.value && ehAdmin.value),
});

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['auditoria', filtros.value]),
  queryFn: () => servicoAuditoria.listar(filtros.value),
  enabled: computed(() => ecolume.value && ehAdmin.value),
  retry: false,
});

const { data: detalhe, isLoading: carregandoDetalhe } = useQuery({
  queryKey: computed(() => ['auditoria-detalhe', detalheId.value, detalheOrigem.value]),
  queryFn: () =>
    servicoAuditoria.obter(detalheId.value!, { origem: detalheOrigem.value }),
  enabled: computed(() => !!detalheId.value && detalheAberto.value),
  retry: false,
});

const opcoesUsuario = computed(() => [
  { valor: '', rotulo: 'Todos os usuários' },
  ...(equipe.value ?? []).map((u) => ({ valor: u.id, rotulo: u.nome })),
]);

const opcoesTipo = computed(() => [
  { valor: '', rotulo: 'Todas as ações' },
  ...TIPOS_AUDITORIA.map((t) => ({
    valor: t,
    rotulo: ROTULO_TIPO_AUDITORIA[t] ?? t,
  })),
]);

const colunas: ColunaTabela[] = [
  { chave: 'quando', rotulo: 'Data/hora' },
  { chave: 'responsavel', rotulo: 'Responsável' },
  { chave: 'acao', rotulo: 'Ação' },
  { chave: 'entidade', rotulo: 'Entidade' },
];

function formatarQuando(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function rotuloTipo(tipoValor: string) {
  return (ROTULO_TIPO_AUDITORIA as Record<string, string>)[tipoValor] ?? tipoValor;
}

function abrirDetalhe(linha: RegistroAuditoriaLista) {
  detalheId.value = linha.id;
  detalheOrigem.value = linha.origem;
  detalheAberto.value = true;
}

function jsonSeguro(valor: unknown) {
  if (valor == null) return '—';
  try {
    return JSON.stringify(valor, null, 2);
  } catch {
    return String(valor);
  }
}
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina
      titulo="Histórico de auditoria"
      descricao="Registros de ações sensíveis da operação ECOLUME."
    />
    <NavConfiguracoes />

    <div
      v-if="!ecolume || !ehAdmin"
      class="rounded-lg border border-borda bg-marfim px-4 py-6 text-sm text-texto-secundario"
    >
      Disponível apenas para administradores em empresas com personalização ECOLUME.
    </div>

    <template v-else>
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-44 space-y-1.5">
          <Label>Usuário</Label>
          <Select v-model="usuarioId" :opcoes="opcoesUsuario" />
        </div>
        <div class="min-w-52 space-y-1.5">
          <Label>Tipo de ação</Label>
          <Select v-model="tipo" :opcoes="opcoesTipo" />
        </div>
        <div class="space-y-1.5">
          <Label>De</Label>
          <Input v-model="de" type="date" />
        </div>
        <div class="space-y-1.5">
          <Label>Até</Label>
          <Input v-model="ate" type="date" />
        </div>
        <Button variante="contorno" type="button" @click="() => refetch()">Atualizar</Button>
      </div>

      <Skeleton v-if="isLoading" class="h-48" />
      <EstadoErro v-else-if="isError" :erro="error" @tentar="refetch" />
      <EstadoVazio
        v-else-if="!data?.dados?.length"
        titulo="Nenhum registro"
        descricao="Ainda não há eventos de auditoria para estes filtros."
      />
      <template v-else>
        <TabelaDados :colunas="colunas" :linhas="data.dados" clicavel @linha-clique="abrirDetalhe">
          <template #celula-quando="{ linha }">
            {{ formatarQuando((linha as RegistroAuditoriaLista).criadoEm) }}
          </template>
          <template #celula-responsavel="{ linha }">
            {{
              (linha as RegistroAuditoriaLista).usuarioNome ||
              (linha as RegistroAuditoriaLista).usuarioId ||
              '—'
            }}
          </template>
          <template #celula-acao="{ linha }">
            {{ rotuloTipo((linha as RegistroAuditoriaLista).tipo) }}
          </template>
          <template #celula-entidade="{ linha }">
            {{ (linha as RegistroAuditoriaLista).entidade }}
            ·
            {{ (linha as RegistroAuditoriaLista).entidadeId.slice(0, 8) }}…
          </template>
        </TabelaDados>
        <Paginacao
          v-if="data.paginacao"
          :paginacao="data.paginacao"
          @mudar="(p) => (pagina = p)"
        />
      </template>
    </template>

    <Dialog v-model="detalheAberto" titulo="Detalhe da alteração" tamanho="lg">
      <Skeleton v-if="carregandoDetalhe" class="h-32" />
      <div v-else-if="detalhe" class="space-y-4 text-sm">
        <dl class="grid gap-2 sm:grid-cols-2">
          <div>
            <dt class="text-texto-secundario">Quando</dt>
            <dd>{{ formatarQuando(detalhe.criadoEm) }}</dd>
          </div>
          <div>
            <dt class="text-texto-secundario">Responsável</dt>
            <dd>{{ detalhe.usuarioNome || detalhe.usuarioId || '—' }}</dd>
          </div>
          <div>
            <dt class="text-texto-secundario">Ação</dt>
            <dd>{{ rotuloTipo(detalhe.tipo) }}</dd>
          </div>
          <div>
            <dt class="text-texto-secundario">Entidade</dt>
            <dd>{{ detalhe.entidade }} / {{ detalhe.entidadeId }}</dd>
          </div>
        </dl>
        <div>
          <p class="mb-1 font-medium text-texto">Anterior</p>
          <pre class="overflow-auto rounded-md bg-marfim p-3 text-xs">{{
            jsonSeguro(detalhe.anterior)
          }}</pre>
        </div>
        <div>
          <p class="mb-1 font-medium text-texto">Posterior</p>
          <pre class="overflow-auto rounded-md bg-marfim p-3 text-xs">{{
            jsonSeguro(detalhe.posterior)
          }}</pre>
        </div>
      </div>
    </Dialog>
  </div>
</template>
