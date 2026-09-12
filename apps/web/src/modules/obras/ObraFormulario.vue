<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { StatusObra } from '@arcco/contratos';
import type { Obra } from '@/types';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import FormularioCamposPersonalizados from '@/components/formularios/FormularioCamposPersonalizados.vue';
import { servicoObras } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { ROTULO_STATUS_OBRA, opcoesDe } from '@/composables/rotulos';

const props = defineProps<{ modelValue: boolean; obra?: Obra | null }>();
const emit = defineEmits<{
  (e: 'update:modelValue', valor: boolean): void;
  (e: 'salvo', obra: Obra): void;
}>();

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);

const opcoesStatus = opcoesDe(ROTULO_STATUS_OBRA);

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
const ehEdicao = computed(() => !!props.obra);

const form = reactive({
  nome: '',
  identificacao: '',
  tipo: '',
  status: StatusObra.PLANEJAMENTO as string,
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  observacoes: '',
  dadosPersonalizados: {} as Record<string, unknown>,
});
const erros = reactive<Record<string, string>>({});

watch(
  () => props.modelValue,
  (ab) => {
    if (!ab) return;
    const o = props.obra;
    form.nome = o?.nome ?? '';
    form.identificacao = o?.identificacao ?? '';
    form.tipo = o?.tipo ?? '';
    form.status = o?.status ?? StatusObra.PLANEJAMENTO;
    form.endereco = o?.endereco ?? '';
    form.bairro = o?.bairro ?? '';
    form.cidade = o?.cidade ?? '';
    form.estado = o?.estado ?? '';
    form.cep = o?.cep ?? '';
    form.observacoes = o?.observacoes ?? '';
    form.dadosPersonalizados = { ...(o?.dadosPersonalizados ?? {}) };
    Object.keys(erros).forEach((k) => delete erros[k]);
  },
);

async function salvar() {
  Object.keys(erros).forEach((k) => delete erros[k]);
  salvando.value = true;
  try {
    const payload = {
      nome: form.nome.trim() || undefined,
      identificacao: form.identificacao || undefined,
      tipo: form.tipo || undefined,
      status: form.status as StatusObra,
      endereco: form.endereco || undefined,
      bairro: form.bairro || undefined,
      cidade: form.cidade || undefined,
      estado: form.estado || undefined,
      cep: form.cep || undefined,
      observacoes: form.observacoes || undefined,
      dadosPersonalizados: form.dadosPersonalizados,
    };
    const salvo = ehEdicao.value
      ? await servicoObras.atualizar(props.obra!.id, payload)
      : await servicoObras.criar(payload);
    sucesso(ehEdicao.value ? 'Obra atualizada.' : 'Obra criada.');
    await queryClient.invalidateQueries({ queryKey: ['obras'] });
    emit('salvo', salvo);
    aberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model="aberto"
    :titulo="ehEdicao ? 'Editar projeto' : 'Novo projeto'"
    descricao="Informe o essencial. O nome será criado automaticamente se ficar vazio."
    tamanho="lg"
  >
    <form class="space-y-4" @submit.prevent="salvar">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5 sm:col-span-2">
          <Label>Nome do projeto <span class="font-normal text-texto-secundario">(opcional)</span></Label>
          <Input v-model="form.nome" :invalido="!!erros.nome" placeholder="Inferido pela identificação ou endereço" />
          <p v-if="erros.nome" class="text-xs text-erro">{{ erros.nome }}</p>
        </div>
        <div class="space-y-1.5">
          <Label>Identificação</Label>
          <Input v-model="form.identificacao" placeholder="Código interno" />
        </div>
        <div class="space-y-1.5">
          <Label>Tipo</Label>
          <Input v-model="form.tipo" placeholder="Residencial, comercial…" />
        </div>
        <div class="space-y-1.5">
          <Label>Status</Label>
          <Select v-model="form.status" :opcoes="opcoesStatus" />
        </div>
        <div class="space-y-1.5">
          <Label>CEP</Label>
          <Input v-model="form.cep" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label>Endereço</Label>
          <Input v-model="form.endereco" />
        </div>
        <div class="space-y-1.5">
          <Label>Bairro</Label>
          <Input v-model="form.bairro" />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div class="col-span-2 space-y-1.5">
            <Label>Cidade</Label>
            <Input v-model="form.cidade" />
          </div>
          <div class="space-y-1.5">
            <Label>UF</Label>
            <Input v-model="form.estado" />
          </div>
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label>Observações</Label>
          <Textarea v-model="form.observacoes" />
        </div>
      </div>

      <div class="border-t border-borda pt-4">
        <FormularioCamposPersonalizados entidade="OBRA" v-model="form.dadosPersonalizados" />
      </div>
    </form>

    <template #rodape>
      <Button variante="secundario" @click="aberto = false">Cancelar</Button>
      <Button :carregando="salvando" @click="salvar">Salvar</Button>
    </template>
  </Dialog>
</template>
