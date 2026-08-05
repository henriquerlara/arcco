<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { TipoContato } from '@arcco/contratos';
import type { Contato } from '@/types';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import FormularioCamposPersonalizados from '@/components/formularios/FormularioCamposPersonalizados.vue';
import { servicoContatos } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { ROTULO_TIPO_CONTATO, opcoesDe } from '@/composables/rotulos';

const props = defineProps<{
  modelValue: boolean;
  contato?: Contato | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: boolean): void;
  (e: 'salvo', contato: Contato): void;
}>();

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);

const opcoesTipo = opcoesDe(ROTULO_TIPO_CONTATO).map((o) => ({
  valor: o.valor,
  rotulo: o.rotulo,
}));

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const ehEdicao = computed(() => !!props.contato);

const form = reactive({
  nome: '',
  telefone: '',
  email: '',
  tipo: TipoContato.OUTRO as string,
  empresaNome: '',
  origem: '',
  observacoes: '',
  responsavelId: null as string | null,
  dadosPersonalizados: {} as Record<string, unknown>,
});

const erros = reactive<Record<string, string>>({});

watch(
  () => props.modelValue,
  (aberto) => {
    if (!aberto) return;
    const c = props.contato;
    form.nome = c?.nome ?? '';
    form.telefone = c?.telefone ?? '';
    form.email = c?.email ?? '';
    form.tipo = c?.tipo ?? TipoContato.OUTRO;
    form.empresaNome = c?.empresaNome ?? '';
    form.origem = c?.origem ?? '';
    form.observacoes = c?.observacoes ?? '';
    form.responsavelId = c?.responsavelId ?? null;
    form.dadosPersonalizados = { ...(c?.dadosPersonalizados ?? {}) };
    Object.keys(erros).forEach((k) => delete erros[k]);
  },
);

function validar(): boolean {
  Object.keys(erros).forEach((k) => delete erros[k]);
  if (form.nome.trim().length < 2) erros.nome = 'Informe o nome';
  if (form.telefone.replace(/\D/g, '').length < 8) erros.telefone = 'Informe um telefone válido';
  return Object.keys(erros).length === 0;
}

async function salvar() {
  if (!validar()) return;
  salvando.value = true;
  try {
    const payload = {
      nome: form.nome,
      telefone: form.telefone,
      email: form.email || undefined,
      tipo: form.tipo as TipoContato,
      empresaNome: form.empresaNome || undefined,
      origem: form.origem || undefined,
      observacoes: form.observacoes || undefined,
      responsavelId: form.responsavelId,
      dadosPersonalizados: form.dadosPersonalizados,
    };
    const salvo = ehEdicao.value
      ? await servicoContatos.atualizar(props.contato!.id, payload)
      : await servicoContatos.criar(payload);
    sucesso(ehEdicao.value ? 'Contato atualizado.' : 'Contato criado.');
    await queryClient.invalidateQueries({ queryKey: ['contatos'] });
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
    :titulo="ehEdicao ? 'Editar contato' : 'Novo contato'"
    descricao="Dados de quem participa das negociações e obras."
    tamanho="lg"
  >
    <form class="space-y-4" @submit.prevent="salvar">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label obrigatorio>Nome</Label>
          <Input v-model="form.nome" :invalido="!!erros.nome" />
          <p v-if="erros.nome" class="text-xs text-erro">{{ erros.nome }}</p>
        </div>
        <div class="space-y-1.5">
          <Label obrigatorio>Telefone</Label>
          <Input v-model="form.telefone" placeholder="(11) 90000-0000" :invalido="!!erros.telefone" />
          <p v-if="erros.telefone" class="text-xs text-erro">{{ erros.telefone }}</p>
        </div>
        <div class="space-y-1.5">
          <Label>E-mail</Label>
          <Input v-model="form.email" type="email" />
        </div>
        <div class="space-y-1.5">
          <Label>Tipo</Label>
          <Select v-model="form.tipo" :opcoes="opcoesTipo" />
        </div>
        <div class="space-y-1.5">
          <Label>Empresa</Label>
          <Input v-model="form.empresaNome" />
        </div>
        <div class="space-y-1.5">
          <Label>Origem</Label>
          <Input v-model="form.origem" placeholder="WhatsApp, indicação…" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label>Responsável</Label>
          <SeletorUsuario v-model="form.responsavelId" incluir-vazio rotulo-vazio="Sem responsável" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label>Observações</Label>
          <Textarea v-model="form.observacoes" />
        </div>
      </div>

      <div class="border-t border-borda pt-4">
        <FormularioCamposPersonalizados
          entidade="CONTATO"
          v-model="form.dadosPersonalizados"
        />
      </div>
    </form>

    <template #rodape>
      <Button variante="secundario" @click="aberto = false">Cancelar</Button>
      <Button :carregando="salvando" @click="salvar">Salvar</Button>
    </template>
  </Dialog>
</template>
