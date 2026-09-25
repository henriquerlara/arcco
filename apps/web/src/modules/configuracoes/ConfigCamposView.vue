<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Plus, Pencil, Trash2, Bot } from 'lucide-vue-next';
import {
  EntidadeCampoPersonalizado,
  TipoCampoPersonalizado,
} from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import ModalConfirmacao from '@/components/compartilhados/ModalConfirmacao.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Switch from '@/components/ui/Switch.vue';
import Tabs from '@/components/ui/Tabs.vue';
import type { CampoPersonalizado } from '@/types';
import { servicoCamposPersonalizados } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import {
  ROTULO_TIPO_CAMPO,
  ROTULO_ENTIDADE_CAMPO,
  opcoesDe,
} from '@/composables/rotulos';

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const entidade = ref<string>(EntidadeCampoPersonalizado.CONTATO);
const abas = opcoesDe(ROTULO_ENTIDADE_CAMPO).map((o) => ({ valor: o.valor, rotulo: o.rotulo }));
const opcoesTipo = opcoesDe(ROTULO_TIPO_CAMPO);

const formAberto = ref(false);
const salvando = ref(false);
const editando = ref<CampoPersonalizado | null>(null);
const confirmar = ref(false);
const alvo = ref<CampoPersonalizado | null>(null);
const excluindo = ref(false);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['campos-personalizados', entidade.value]),
  queryFn: () => servicoCamposPersonalizados.listar(entidade.value),
});
const campos = computed(() => data.value ?? []);

const form = reactive({
  chave: '',
  rotulo: '',
  descricao: '',
  tipo: TipoCampoPersonalizado.TEXTO as string,
  obrigatorio: false,
  opcoesTexto: '',
  usarNoChatbot: false,
  textoPergunta: '',
});
const erros = reactive<Record<string, string>>({});

const usaOpcoes = computed(
  () =>
    form.tipo === TipoCampoPersonalizado.SELECAO ||
    form.tipo === TipoCampoPersonalizado.MULTISSELECAO,
);

function abrirNovo() {
  editando.value = null;
  Object.assign(form, {
    chave: '',
    rotulo: '',
    descricao: '',
    tipo: TipoCampoPersonalizado.TEXTO,
    obrigatorio: false,
    opcoesTexto: '',
    usarNoChatbot: false,
    textoPergunta: '',
  });
  Object.keys(erros).forEach((k) => delete erros[k]);
  formAberto.value = true;
}

function abrirEdicao(campo: CampoPersonalizado) {
  editando.value = campo;
  Object.assign(form, {
    chave: campo.chave,
    rotulo: campo.rotulo,
    descricao: campo.descricao ?? '',
    tipo: campo.tipo,
    obrigatorio: campo.obrigatorio,
    opcoesTexto: (campo.opcoes ?? []).join(', '),
    usarNoChatbot: campo.usarNoChatbot,
    textoPergunta: campo.textoPergunta ?? '',
  });
  Object.keys(erros).forEach((k) => delete erros[k]);
  formAberto.value = true;
}

async function salvar() {
  Object.keys(erros).forEach((k) => delete erros[k]);
  if (form.rotulo.trim().length < 2) erros.rotulo = 'Informe o rótulo';
  if (!/^[a-z0-9_]{2,}$/.test(form.chave)) erros.chave = 'Use letras minúsculas, números e _';
  if (Object.keys(erros).length) return;

  salvando.value = true;
  try {
    const opcoes = usaOpcoes.value
      ? form.opcoesTexto
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      : null;
    const payload = {
      entidade: entidade.value as EntidadeCampoPersonalizado,
      chave: form.chave,
      rotulo: form.rotulo,
      descricao: form.descricao || undefined,
      tipo: form.tipo as TipoCampoPersonalizado,
      obrigatorio: form.obrigatorio,
      opcoes,
      usarNoChatbot: form.usarNoChatbot,
      textoPergunta: form.textoPergunta || null,
    };
    if (editando.value) await servicoCamposPersonalizados.atualizar(editando.value.id, payload);
    else await servicoCamposPersonalizados.criar(payload);
    sucesso('Campo salvo.');
    await queryClient.invalidateQueries({ queryKey: ['campos-personalizados'] });
    formAberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

function pedirExclusao(campo: CampoPersonalizado) {
  alvo.value = campo;
  confirmar.value = true;
}
async function excluir() {
  if (!alvo.value) return;
  excluindo.value = true;
  try {
    await servicoCamposPersonalizados.excluir(alvo.value.id);
    sucesso('Campo excluído.');
    await queryClient.invalidateQueries({ queryKey: ['campos-personalizados'] });
    confirmar.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    excluindo.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Campos" descricao="Informações extras em pessoas, projetos e negócios.">
      <template #acoes>
        <Button @click="abrirNovo"><Plus class="size-4" /> Novo campo</Button>
      </template>
    </CabecalhoPagina>
    <NavConfiguracoes />

    <Tabs v-model="entidade" :itens="abas">
      <template v-for="aba in abas" :key="aba.valor" #[aba.valor]>
        <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
        <div v-else-if="isLoading" class="space-y-2">
          <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
        </div>
        <EstadoVazio
          v-else-if="campos.length === 0"
          titulo="Nenhum campo personalizado"
          :descricao="`Crie campos extras para ${aba.rotulo.toLowerCase()}s conforme sua operação.`"
        >
          <template #acao><Button @click="abrirNovo"><Plus class="size-4" /> Novo campo</Button></template>
        </EstadoVazio>
        <div v-else class="space-y-2">
          <Card v-for="campo in campos" :key="campo.id" class="flex items-center gap-3 p-4">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium text-texto">{{ campo.rotulo }}</p>
                <Badge variante="neutro">{{ ROTULO_TIPO_CAMPO[campo.tipo] }}</Badge>
                <Badge v-if="campo.obrigatorio" variante="alerta">Obrigatório</Badge>
                <Badge v-if="campo.usarNoChatbot" variante="info">
                  <Bot class="size-3" /> Chatbot
                </Badge>
              </div>
              <p class="mt-0.5 font-mono text-xs text-texto-secundario">{{ campo.chave }}</p>
            </div>
            <div class="flex gap-1">
              <Button variante="fantasma" tamanho="icone-sm" @click="abrirEdicao(campo)"><Pencil class="size-4" /></Button>
              <Button variante="fantasma" tamanho="icone-sm" @click="pedirExclusao(campo)">
                <Trash2 class="size-4 text-erro" />
              </Button>
            </div>
          </Card>
        </div>
      </template>
    </Tabs>

    <Dialog v-model="formAberto" :titulo="editando ? 'Editar campo' : 'Novo campo'" tamanho="lg">
      <form class="space-y-4" @submit.prevent="salvar">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label obrigatorio>Rótulo</Label>
            <Input v-model="form.rotulo" :invalido="!!erros.rotulo" />
            <p v-if="erros.rotulo" class="text-xs text-erro">{{ erros.rotulo }}</p>
          </div>
          <div class="space-y-1.5">
            <Label obrigatorio>Chave (interna)</Label>
            <Input v-model="form.chave" placeholder="ex.: metragem_m2" :invalido="!!erros.chave" />
            <p v-if="erros.chave" class="text-xs text-erro">{{ erros.chave }}</p>
          </div>
          <div class="space-y-1.5">
            <Label>Tipo</Label>
            <Select v-model="form.tipo" :opcoes="opcoesTipo" />
          </div>
          <div class="flex items-center gap-2 pt-6">
            <Switch v-model="form.obrigatorio" /> <Label>Obrigatório</Label>
          </div>
          <div v-if="usaOpcoes" class="space-y-1.5 sm:col-span-2">
            <Label>Opções (separadas por vírgula)</Label>
            <Input v-model="form.opcoesTexto" placeholder="Opção 1, Opção 2, Opção 3" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label>Descrição / ajuda</Label>
            <Textarea v-model="form.descricao" :rows="2" />
          </div>
        </div>

        <div class="rounded-md border border-borda bg-marfim/40 p-3">
          <div class="flex items-center gap-2">
            <Switch v-model="form.usarNoChatbot" />
            <Label class="flex items-center gap-1.5"><Bot class="size-4" /> Coletar via chatbot</Label>
          </div>
          <div v-if="form.usarNoChatbot" class="mt-3 space-y-1.5">
            <Label>Pergunta do chatbot</Label>
            <Input v-model="form.textoPergunta" placeholder="Como o assistente deve perguntar isso?" />
          </div>
        </div>
      </form>
      <template #rodape>
        <Button variante="secundario" @click="formAberto = false">Cancelar</Button>
        <Button :carregando="salvando" @click="salvar">Salvar</Button>
      </template>
    </Dialog>

    <ModalConfirmacao
      v-model="confirmar"
      titulo="Excluir campo?"
      descricao="Os valores já preenchidos deixarão de ser exibidos."
      texto-confirmar="Excluir"
      perigo
      :carregando="excluindo"
      @confirmar="excluir"
    />
  </div>
</template>
