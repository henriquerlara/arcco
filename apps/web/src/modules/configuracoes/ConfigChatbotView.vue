<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { Save, Bot, Clock } from 'lucide-vue-next';
import {
  configuracoesEmpresaPadrao,
  type HorarioAtendimento,
} from '@arcco/contratos';
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

const DIAS = [
  { chave: 'segunda', rotulo: 'Segunda' },
  { chave: 'terca', rotulo: 'Terça' },
  { chave: 'quarta', rotulo: 'Quarta' },
  { chave: 'quinta', rotulo: 'Quinta' },
  { chave: 'sexta', rotulo: 'Sexta' },
  { chave: 'sabado', rotulo: 'Sábado' },
  { chave: 'domingo', rotulo: 'Domingo' },
] as const;

type ChaveDia = (typeof DIAS)[number]['chave'];

interface LinhaHorario {
  ativo: boolean;
  inicio: string;
  fim: string;
}

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

const horario = reactive<Record<ChaveDia, LinhaHorario>>({
  segunda: { ativo: true, inicio: '08:00', fim: '18:00' },
  terca: { ativo: true, inicio: '08:00', fim: '18:00' },
  quarta: { ativo: true, inicio: '08:00', fim: '18:00' },
  quinta: { ativo: true, inicio: '08:00', fim: '18:00' },
  sexta: { ativo: true, inicio: '08:00', fim: '18:00' },
  sabado: { ativo: false, inicio: '08:00', fim: '12:00' },
  domingo: { ativo: false, inicio: '08:00', fim: '12:00' },
});

function carregarHorario(fonte: HorarioAtendimento) {
  for (const { chave } of DIAS) {
    const intervalos = fonte[chave] ?? [];
    const primeiro = intervalos[0];
    if (primeiro) {
      horario[chave] = {
        ativo: true,
        inicio: primeiro.inicio,
        fim: primeiro.fim,
      };
    } else {
      horario[chave] = {
        ativo: false,
        inicio: horario[chave].inicio || '08:00',
        fim: horario[chave].fim || '18:00',
      };
    }
  }
}

function montarHorario(): HorarioAtendimento {
  const saida = {} as HorarioAtendimento;
  for (const { chave } of DIAS) {
    const linha = horario[chave];
    saida[chave] =
      linha.ativo && linha.inicio && linha.fim
        ? [{ inicio: linha.inicio, fim: linha.fim }]
        : [];
  }
  return saida;
}

watch(
  data,
  (config) => {
    if (!config) return;
    if (config.chatbot) Object.assign(form, config.chatbot);
    carregarHorario(config.horarioAtendimento ?? configuracoesEmpresaPadrao().horarioAtendimento);
  },
  { immediate: true },
);

const campos = [
  { chave: 'mensagemInicial', rotulo: 'Mensagem de saudação', ajuda: 'Primeira mensagem enviada ao cliente.' },
  { chave: 'mensagemForaHorario', rotulo: 'Fora do horário', ajuda: 'Enviada no início do atendimento quando a equipe está fechada.' },
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
    await servicoEmpresa.salvarConfiguracoes({
      chatbot: { ...form },
      horarioAtendimento: montarHorario(),
    });
    sucesso('Chatbot e horário atualizados.');
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
    <CabecalhoPagina titulo="Automação" descricao="Como o assistente responde no WhatsApp." />
    <NavConfiguracoes />

    <Card class="max-w-3xl">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Bot class="size-5 text-dourado-hover" /> Assistente virtual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="isLoading" class="space-y-3">
          <Skeleton v-for="n in 5" :key="n" class="h-16 w-full" />
        </div>
        <form v-else class="space-y-5" @submit.prevent="salvar">
          <div class="flex items-center justify-between rounded-md border border-borda bg-marfim/40 p-3">
            <div>
              <p class="text-sm font-medium text-texto">Chatbot ativo</p>
              <p class="text-xs text-texto-secundario">
                Quando desativado, todas as conversas vão direto para a equipe.
              </p>
            </div>
            <Switch v-model="form.ativo" />
          </div>

          <div class="space-y-1.5">
            <Label>Nome do assistente</Label>
            <Input v-model="form.nome" class="max-w-sm" />
          </div>

          <div class="space-y-3 rounded-md border border-borda p-4">
            <div class="flex items-start gap-2">
              <Clock class="mt-0.5 size-4 text-dourado-hover" />
              <div>
                <p class="text-sm font-medium text-texto">Horário de atendimento</p>
                <p class="text-xs text-texto-secundario">
                  Fora desses horários o bot envia a mensagem “Fora do horário” (fuso América/São Paulo).
                </p>
              </div>
            </div>
            <div class="space-y-2">
              <div
                v-for="dia in DIAS"
                :key="dia.chave"
                class="grid grid-cols-[7rem_auto_1fr_auto_1fr] items-center gap-2"
              >
                <span class="text-sm text-texto">{{ dia.rotulo }}</span>
                <Switch v-model="horario[dia.chave].ativo" />
                <Input
                  v-model="horario[dia.chave].inicio"
                  type="time"
                  :disabled="!horario[dia.chave].ativo"
                />
                <span class="text-xs text-texto-secundario">até</span>
                <Input
                  v-model="horario[dia.chave].fim"
                  type="time"
                  :disabled="!horario[dia.chave].ativo"
                />
              </div>
            </div>
          </div>

          <div v-for="campo in campos" :key="campo.chave" class="space-y-1.5">
            <Label>{{ campo.rotulo }}</Label>
            <Textarea v-model="form[campo.chave]" :rows="2" />
            <p class="text-xs text-texto-secundario">{{ campo.ajuda }}</p>
          </div>

          <Button :carregando="salvando" @click="salvar">
            <Save class="size-4" /> Salvar chatbot
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
