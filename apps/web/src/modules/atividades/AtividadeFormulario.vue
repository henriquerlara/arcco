<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { TipoAtividade } from '@arcco/contratos';
import type { Atividade } from '@/types';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import SeletorContato from '@/components/formularios/SeletorContato.vue';
import { servicoAtividades } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { ROTULO_TIPO_ATIVIDADE, opcoesDe } from '@/composables/rotulos';

const props = defineProps<{
  modelValue: boolean;
  atividade?: Atividade | null;
  oportunidadeId?: string | null;
  contatoId?: string | null;
  obraId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: boolean): void;
  (e: 'salvo', atividade: Atividade): void;
}>();

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);

const opcoesTipo = opcoesDe(ROTULO_TIPO_ATIVIDADE);

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
const ehEdicao = computed(() => !!props.atividade);
const semRelacaoFixa = computed(
  () => !props.oportunidadeId && !props.contatoId && !props.obraId,
);

const form = reactive({
  tipo: TipoAtividade.FOLLOW_UP as string,
  titulo: '',
  descricao: '',
  vencimento: '',
  responsavelId: null as string | null,
  contatoId: null as string | null,
});
const erros = reactive<Record<string, string>>({});

watch(
  () => props.modelValue,
  (ab) => {
    if (!ab) return;
    const a = props.atividade;
    form.tipo = a?.tipo ?? TipoAtividade.FOLLOW_UP;
    form.titulo = a?.titulo ?? '';
    form.descricao = a?.descricao ?? '';
    form.vencimento = a?.vencimento ? a.vencimento.slice(0, 16) : '';
    form.responsavelId = a?.responsavelId ?? null;
    form.contatoId = props.contatoId ?? a?.contatoId ?? null;
    Object.keys(erros).forEach((k) => delete erros[k]);
  },
);

async function salvar() {
  Object.keys(erros).forEach((k) => delete erros[k]);
  if (form.titulo.trim().length < 2) erros.titulo = 'Informe um título';
  if (!form.vencimento) erros.vencimento = 'Informe o vencimento';
  if (Object.keys(erros).length) return;

  salvando.value = true;
  try {
    const payload = {
      tipo: form.tipo as TipoAtividade,
      titulo: form.titulo,
      descricao: form.descricao || undefined,
      vencimento: new Date(form.vencimento) as unknown as string,
      responsavelId: form.responsavelId ?? undefined,
      oportunidadeId: props.oportunidadeId ?? undefined,
      obraId: props.obraId ?? undefined,
      contatoId: props.contatoId ?? form.contatoId ?? undefined,
    };
    const salvo = ehEdicao.value
      ? await servicoAtividades.atualizar(props.atividade!.id, payload)
      : await servicoAtividades.criar(payload);
    sucesso(ehEdicao.value ? 'Atividade atualizada.' : 'Atividade criada.');
    await queryClient.invalidateQueries({ queryKey: ['atividades'] });
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
    :titulo="ehEdicao ? 'Editar atividade' : 'Nova atividade'"
    descricao="Registre uma tarefa ou follow-up com prazo."
    tamanho="md"
  >
    <form class="space-y-4" @submit.prevent="salvar">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label>Tipo</Label>
          <Select v-model="form.tipo" :opcoes="opcoesTipo" />
        </div>
        <div class="space-y-1.5">
          <Label obrigatorio>Vencimento</Label>
          <Input v-model="form.vencimento" type="datetime-local" :invalido="!!erros.vencimento" />
          <p v-if="erros.vencimento" class="text-xs text-erro">{{ erros.vencimento }}</p>
        </div>
      </div>
      <div class="space-y-1.5">
        <Label obrigatorio>Título</Label>
        <Input v-model="form.titulo" :invalido="!!erros.titulo" />
        <p v-if="erros.titulo" class="text-xs text-erro">{{ erros.titulo }}</p>
      </div>
      <div class="space-y-1.5">
        <Label>Descrição</Label>
        <Textarea v-model="form.descricao" />
      </div>
      <div v-if="semRelacaoFixa" class="space-y-1.5">
        <Label>Contato relacionado</Label>
        <SeletorContato v-model="form.contatoId" />
      </div>
      <div class="space-y-1.5">
        <Label>Responsável</Label>
        <SeletorUsuario v-model="form.responsavelId" incluir-vazio rotulo-vazio="Sem responsável" />
      </div>
    </form>

    <template #rodape>
      <Button variante="secundario" @click="aberto = false">Cancelar</Button>
      <Button :carregando="salvando" @click="salvar">Salvar</Button>
    </template>
  </Dialog>
</template>
