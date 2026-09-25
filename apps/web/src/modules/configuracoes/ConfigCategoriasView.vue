<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Plus, Pencil, Trash2 } from 'lucide-vue-next';
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
import Switch from '@/components/ui/Switch.vue';
import type { Categoria } from '@/types';
import { servicoCategorias } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const formAberto = ref(false);
const salvando = ref(false);
const editando = ref<Categoria | null>(null);
const confirmar = ref(false);
const alvoExclusao = ref<Categoria | null>(null);
const excluindo = ref(false);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['categorias'],
  queryFn: () => servicoCategorias.listar(),
});
const linhas = computed(() => data.value ?? []);

const form = reactive({ nome: '', descricao: '', ativo: true });
const erros = reactive<Record<string, string>>({});

function abrirNovo() {
  editando.value = null;
  form.nome = '';
  form.descricao = '';
  form.ativo = true;
  Object.keys(erros).forEach((k) => delete erros[k]);
  formAberto.value = true;
}

function abrirEdicao(cat: Categoria) {
  editando.value = cat;
  form.nome = cat.nome;
  form.descricao = cat.descricao ?? '';
  form.ativo = cat.ativo;
  Object.keys(erros).forEach((k) => delete erros[k]);
  formAberto.value = true;
}

async function salvar() {
  Object.keys(erros).forEach((k) => delete erros[k]);
  if (form.nome.trim().length < 2) {
    erros.nome = 'Informe o nome';
    return;
  }
  salvando.value = true;
  try {
    const payload = { nome: form.nome, descricao: form.descricao || undefined, ativo: form.ativo };
    if (editando.value) await servicoCategorias.atualizar(editando.value.id, payload);
    else await servicoCategorias.criar(payload);
    sucesso('Categoria salva.');
    await queryClient.invalidateQueries({ queryKey: ['categorias'] });
    formAberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

function pedirExclusao(cat: Categoria) {
  alvoExclusao.value = cat;
  confirmar.value = true;
}

async function excluir() {
  if (!alvoExclusao.value) return;
  excluindo.value = true;
  try {
    await servicoCategorias.excluir(alvoExclusao.value.id);
    sucesso('Categoria excluída.');
    await queryClient.invalidateQueries({ queryKey: ['categorias'] });
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
    <CabecalhoPagina titulo="Categorias" descricao="Linhas de atuação usadas para organizar os negócios.">
      <template #acoes>
        <Button @click="abrirNovo"><Plus class="size-4" /> Nova categoria</Button>
      </template>
    </CabecalhoPagina>
    <NavConfiguracoes />

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
    <div v-else-if="isLoading" class="grid gap-3 sm:grid-cols-2">
      <Skeleton v-for="n in 4" :key="n" class="h-20" />
    </div>
    <EstadoVazio
      v-else-if="linhas.length === 0"
      titulo="Nenhuma categoria"
      descricao="Categorias organizam os negócios por linha de atuação."
    >
      <template #acao><Button @click="abrirNovo"><Plus class="size-4" /> Nova categoria</Button></template>
    </EstadoVazio>

    <div v-else class="grid gap-3 sm:grid-cols-2">
      <Card v-for="cat in linhas" :key="cat.id" class="flex items-start justify-between gap-3 p-4">
        <div>
          <div class="flex items-center gap-2">
            <p class="font-medium text-texto">{{ cat.nome }}</p>
            <Badge :variante="cat.ativo ? 'sucesso' : 'neutro'">
              {{ cat.ativo ? 'Ativa' : 'Inativa' }}
            </Badge>
          </div>
          <p v-if="cat.descricao" class="mt-1 text-sm text-texto-secundario">{{ cat.descricao }}</p>
        </div>
        <div class="flex gap-1">
          <Button variante="fantasma" tamanho="icone-sm" @click="abrirEdicao(cat)"><Pencil class="size-4" /></Button>
          <Button variante="fantasma" tamanho="icone-sm" @click="pedirExclusao(cat)">
            <Trash2 class="size-4 text-erro" />
          </Button>
        </div>
      </Card>
    </div>

    <Dialog v-model="formAberto" :titulo="editando ? 'Editar categoria' : 'Nova categoria'" tamanho="md">
      <form class="space-y-4" @submit.prevent="salvar">
        <div class="space-y-1.5">
          <Label obrigatorio>Nome</Label>
          <Input v-model="form.nome" :invalido="!!erros.nome" />
          <p v-if="erros.nome" class="text-xs text-erro">{{ erros.nome }}</p>
        </div>
        <div class="space-y-1.5">
          <Label>Descrição</Label>
          <Textarea v-model="form.descricao" />
        </div>
        <div class="flex items-center gap-2">
          <Switch v-model="form.ativo" /> <Label>Categoria ativa</Label>
        </div>
      </form>
      <template #rodape>
        <Button variante="secundario" @click="formAberto = false">Cancelar</Button>
        <Button :carregando="salvando" @click="salvar">Salvar</Button>
      </template>
    </Dialog>

    <ModalConfirmacao
      v-model="confirmar"
      titulo="Excluir categoria?"
      descricao="Negócios associados ficarão sem categoria."
      texto-confirmar="Excluir"
      perigo
      :carregando="excluindo"
      @confirmar="excluir"
    />
  </div>
</template>
