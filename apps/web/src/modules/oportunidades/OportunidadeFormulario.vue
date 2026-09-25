<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { PrioridadeOportunidade } from '@arcco/contratos';
import type { Oportunidade } from '@/types';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import SeletorContato from '@/components/formularios/SeletorContato.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import SeletorCategoria from '@/components/formularios/SeletorCategoria.vue';
import { servicoOportunidades } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { ROTULO_PRIORIDADE, opcoesDe } from '@/composables/rotulos';
import { parsearMoeda } from '@/composables/formatadores';

const props = defineProps<{
  modelValue: boolean;
  contatoId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: boolean): void;
  (e: 'salvo', oportunidade: Oportunidade): void;
}>();

const router = useRouter();
const queryClient = useQueryClient();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);

const opcoesPrioridade = opcoesDe(ROTULO_PRIORIDADE);

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const form = reactive({
  contatoId: null as string | null,
  responsavelId: null as string | null,
  categoriaId: null as string | null,
  origem: '',
  prioridade: PrioridadeOportunidade.MEDIA as string,
  valorEstimado: '',
  descricao: '',
});
const erros = reactive<Record<string, string>>({});

watch(
  () => props.modelValue,
  (ab) => {
    if (!ab) return;
    form.contatoId = props.contatoId ?? null;
    form.responsavelId = auth.usuario?.id ?? null;
    form.categoriaId = null;
    form.origem = '';
    form.prioridade = PrioridadeOportunidade.MEDIA;
    form.valorEstimado = '';
    form.descricao = '';
    Object.keys(erros).forEach((k) => delete erros[k]);
  },
);

async function salvar() {
  Object.keys(erros).forEach((k) => delete erros[k]);
  if (!form.contatoId) erros.contatoId = 'Selecione a pessoa';
  if (Object.keys(erros).length) return;

  salvando.value = true;
  try {
    const valor = parsearMoeda(form.valorEstimado) ?? undefined;
    const criado = await servicoOportunidades.criar({
      contatoId: form.contatoId!,
      responsavelId: form.responsavelId,
      categoriaId: form.categoriaId,
      origem: form.origem.trim() || 'manual',
      prioridade: form.prioridade as PrioridadeOportunidade,
      valorEstimado: Number.isFinite(valor) ? valor : undefined,
      descricao: form.descricao.trim() || undefined,
    });
    sucesso('Negócio criado no funil.');
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    await queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
    await queryClient.invalidateQueries({ queryKey: ['contato'] });
    emit('salvo', criado);
    aberto.value = false;
    await router.push({ name: 'oportunidade-detalhe', params: { id: criado.id } });
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
    titulo="Novo negócio"
    descricao="Entra na primeira etapa do funil. Use para leads de telefone, visita ou indicação."
    tamanho="md"
  >
    <form class="space-y-4" @submit.prevent="salvar">
      <div class="space-y-1.5">
        <Label obrigatorio>Pessoa</Label>
        <SeletorContato v-model="form.contatoId" />
        <p v-if="contatoId" class="text-xs text-texto-secundario">
          Pessoa pré-selecionada a partir do cadastro.
        </p>
        <p v-if="erros.contatoId" class="text-xs text-erro">{{ erros.contatoId }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label>Responsável</Label>
          <SeletorUsuario v-model="form.responsavelId" />
        </div>
        <div class="space-y-1.5">
          <Label>Prioridade</Label>
          <Select v-model="form.prioridade" :opcoes="opcoesPrioridade" />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label>Categoria</Label>
          <SeletorCategoria v-model="form.categoriaId" incluir-vazio rotulo-vazio="Sem categoria" />
        </div>
        <div class="space-y-1.5">
          <Label>Origem</Label>
          <Input v-model="form.origem" placeholder="Ex.: telefone, indicação…" />
        </div>
      </div>

      <div class="space-y-1.5">
        <Label>Valor estimado</Label>
        <Input v-model="form.valorEstimado" mascara="moeda" placeholder="0,00" />
      </div>

      <div class="space-y-1.5">
        <Label>Observações</Label>
        <Textarea v-model="form.descricao" :rows="3" placeholder="Contexto do negócio…" />
      </div>
    </form>

    <template #rodape>
      <Button variante="secundario" @click="aberto = false">Cancelar</Button>
      <Button :carregando="salvando" @click="salvar">Criar negócio</Button>
    </template>
  </Dialog>
</template>
