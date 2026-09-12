<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { Save, Bot } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Switch from '@/components/ui/Switch.vue';
import Button from '@/components/ui/Button.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import { servicoEmpresa } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';

const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);

const { data, isLoading, refetch } = useQuery({
  queryKey: ['empresa-configuracoes'],
  queryFn: () => servicoEmpresa.configuracoes(),
});

const form = reactive({
  ativo: true,
  nome: 'Assistente ARCCO',
  mensagemInicial: '',
  mensagemForaHorario: '',
  mensagemTransferencia: '',
  mensagemFinal: '',
  textoPerguntaProjeto: 'a lista de materiais',
});

watch(
  data,
  (config) => {
    if (!config?.chatbot) return;
    Object.assign(form, config.chatbot);
  },
  { immediate: true },
);

const campos = [
  { chave: 'mensagemInicial', rotulo: 'Mensagem de saudação', ajuda: 'Primeira mensagem enviada ao cliente.' },
  { chave: 'mensagemForaHorario', rotulo: 'Fora do horário', ajuda: 'Enviada quando o atendimento humano está fechado.' },
  { chave: 'mensagemTransferencia', rotulo: 'Transferência para humano', ajuda: 'Enviada ao passar a conversa para a equipe.' },
  { chave: 'mensagemFinal', rotulo: 'Encerramento', ajuda: 'Enviada ao concluir o atendimento.' },
  {
    chave: 'textoPerguntaProjeto',
    rotulo: 'Pergunta de materiais/projeto no orçamento',
    ajuda:
      'Trecho usado em: “você já possui …?”. Padrão: a lista de materiais. Ex.: o projeto luminotécnico ou a lista de materiais.',
  },
] as const;

async function salvar() {
  salvando.value = true;
  try {
    await servicoEmpresa.salvarConfiguracoes({ chatbot: { ...form } });
    sucesso('Chatbot atualizado.');
    await refetch();
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Configurações" descricao="Gerencie os dados e o funcionamento da sua conta." />
    <NavConfiguracoes />

    <Card class="max-w-3xl">
      <CardHeader>
        <CardTitle class="flex items-center gap-2"><Bot class="size-5 text-dourado-hover" /> Assistente virtual</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="isLoading" class="space-y-3">
          <Skeleton v-for="n in 5" :key="n" class="h-16 w-full" />
        </div>
        <form v-else class="space-y-5" @submit.prevent="salvar">
          <div class="flex items-center justify-between rounded-md border border-borda bg-marfim/40 p-3">
            <div>
              <p class="text-sm font-medium text-texto">Chatbot ativo</p>
              <p class="text-xs text-texto-secundario">Quando desativado, todas as conversas vão direto para a equipe.</p>
            </div>
            <Switch v-model="form.ativo" />
          </div>

          <div class="space-y-1.5">
            <Label>Nome do assistente</Label>
            <Input v-model="form.nome" class="max-w-sm" />
          </div>

          <div v-for="campo in campos" :key="campo.chave" class="space-y-1.5">
            <Label>{{ campo.rotulo }}</Label>
            <Textarea v-model="form[campo.chave]" :rows="2" />
            <p class="text-xs text-texto-secundario">{{ campo.ajuda }}</p>
          </div>

          <Button :carregando="salvando" @click="salvar"><Save class="size-4" /> Salvar chatbot</Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
