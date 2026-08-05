<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { VueDraggable } from 'vue-draggable-plus';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-vue-next';
import { TipoEtapaFunil } from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import type { EtapaFunil } from '@/types';
import { servicoFunil } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { ROTULO_TIPO_ETAPA, opcoesDe } from '@/composables/rotulos';

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const formAberto = ref(false);
const excluirAberto = ref(false);
const salvando = ref(false);
const excluindo = ref(false);
const editando = ref<EtapaFunil | null>(null);
const alvoExclusao = ref<EtapaFunil | null>(null);
const etapaDestino = ref('');

const opcoesTipo = opcoesDe(ROTULO_TIPO_ETAPA);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['etapas-funil'],
  queryFn: () => servicoFunil.listar(),
});

const etapas = ref<EtapaFunil[]>([]);
watch(
  data,
  (v) => {
    if (v) etapas.value = [...v].sort((a, b) => a.ordem - b.ordem);
  },
  { immediate: true },
);

const opcoesDestino = computed(() =>
  etapas.value
    .filter((e) => e.id !== alvoExclusao.value?.id)
    .map((e) => ({ valor: e.id, rotulo: e.nome })),
);

const form = reactive({ nome: '', tipo: TipoEtapaFunil.ABERTA as string });

async function reordenar() {
  try {
    await servicoFunil.reordenar(etapas.value.map((e, i) => ({ id: e.id, ordem: i })));
    await queryClient.invalidateQueries({ queryKey: ['etapas-funil'] });
  } catch (e) {
    notificarErro(e);
    await refetch();
  }
}

function abrirNovo() {
  editando.value = null;
  form.nome = '';
  form.tipo = TipoEtapaFunil.ABERTA;
  formAberto.value = true;
}
function abrirEdicao(etapa: EtapaFunil) {
  editando.value = etapa;
  form.nome = etapa.nome;
  form.tipo = etapa.tipo;
  formAberto.value = true;
}

async function salvar() {
  if (form.nome.trim().length < 2) return;
  salvando.value = true;
  try {
    if (editando.value) {
      await servicoFunil.atualizar(editando.value.id, { nome: form.nome, tipo: form.tipo as TipoEtapaFunil });
    } else {
      await servicoFunil.criar({
        nome: form.nome,
        tipo: form.tipo as TipoEtapaFunil,
        ordem: etapas.value.length,
      });
    }
    sucesso('Etapa salva.');
    await queryClient.invalidateQueries({ queryKey: ['etapas-funil'] });
    formAberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

function pedirExclusao(etapa: EtapaFunil) {
  alvoExclusao.value = etapa;
  etapaDestino.value = etapas.value.find((e) => e.id !== etapa.id)?.id ?? '';
  excluirAberto.value = true;
}

async function excluir() {
  if (!alvoExclusao.value || !etapaDestino.value) return;
  excluindo.value = true;
  try {
    await servicoFunil.excluir(alvoExclusao.value.id, etapaDestino.value);
    sucesso('Etapa excluída.', 'Oportunidades foram movidas para a etapa de destino.');
    await queryClient.invalidateQueries({ queryKey: ['etapas-funil'] });
    excluirAberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    excluindo.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Configurações" descricao="Gerencie os dados e o funcionamento da sua conta.">
      <template #acoes>
        <Button @click="abrirNovo"><Plus class="size-4" /> Nova etapa</Button>
      </template>
    </CabecalhoPagina>
    <NavConfiguracoes />

    <p class="text-sm text-texto-secundario">
      Arraste para reordenar. As etapas do tipo <strong>Ganha</strong> e <strong>Perdida</strong>
      encerram a oportunidade.
    </p>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
    <div v-else-if="isLoading" class="space-y-2">
      <Skeleton v-for="n in 5" :key="n" class="h-14 w-full" />
    </div>

    <VueDraggable
      v-else
      v-model="etapas"
      :animation="160"
      handle=".arrastar"
      class="max-w-2xl space-y-2"
      @update="reordenar"
    >
      <Card
        v-for="etapa in etapas"
        :key="etapa.id"
        class="flex items-center gap-3 p-3"
      >
        <button class="arrastar cursor-grab text-texto-secundario active:cursor-grabbing">
          <GripVertical class="size-5" />
        </button>
        <div class="flex-1">
          <p class="font-medium text-texto">{{ etapa.nome }}</p>
        </div>
        <BadgeStatus familia="tipoEtapa" :valor="etapa.tipo" />
        <div class="flex gap-1">
          <Button variante="fantasma" tamanho="icone-sm" @click="abrirEdicao(etapa)"><Pencil class="size-4" /></Button>
          <Button variante="fantasma" tamanho="icone-sm" @click="pedirExclusao(etapa)">
            <Trash2 class="size-4 text-erro" />
          </Button>
        </div>
      </Card>
    </VueDraggable>

    <Dialog v-model="formAberto" :titulo="editando ? 'Editar etapa' : 'Nova etapa'" tamanho="md">
      <form class="space-y-4" @submit.prevent="salvar">
        <div class="space-y-1.5">
          <Label obrigatorio>Nome da etapa</Label>
          <Input v-model="form.nome" />
        </div>
        <div class="space-y-1.5">
          <Label>Tipo</Label>
          <Select v-model="form.tipo" :opcoes="opcoesTipo" />
        </div>
      </form>
      <template #rodape>
        <Button variante="secundario" @click="formAberto = false">Cancelar</Button>
        <Button :carregando="salvando" @click="salvar">Salvar</Button>
      </template>
    </Dialog>

    <Dialog
      v-model="excluirAberto"
      titulo="Excluir etapa"
      descricao="Escolha para qual etapa mover as oportunidades existentes."
      tamanho="md"
    >
      <div class="space-y-1.5">
        <Label obrigatorio>Mover oportunidades para</Label>
        <Select v-model="etapaDestino" :opcoes="opcoesDestino" />
      </div>
      <template #rodape>
        <Button variante="secundario" @click="excluirAberto = false">Cancelar</Button>
        <Button variante="perigo" :carregando="excluindo" :disabled="!etapaDestino" @click="excluir">
          Excluir etapa
        </Button>
      </template>
    </Dialog>
  </div>
</template>
