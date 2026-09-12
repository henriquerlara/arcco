<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Plus, Pencil } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Switch from '@/components/ui/Switch.vue';
import type { Produto } from '@/types';
import { servicoProdutos } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarMoeda } from '@/composables/formatadores';

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const formAberto = ref(false);
const salvando = ref(false);
const editando = ref<Produto | null>(null);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['produtos'],
  queryFn: () => servicoProdutos.listar(false),
});
const linhas = computed(() => data.value ?? []);

const form = reactive({
  sku: '',
  nome: '',
  descricao: '',
  unidade: 'un',
  precoVenda: 0,
  saldoInicial: 0,
  estoqueMinimo: 0,
  controlaEstoque: true,
  ativo: true,
});

function abrirNovo() {
  editando.value = null;
  Object.assign(form, {
    sku: '',
    nome: '',
    descricao: '',
    unidade: 'un',
    precoVenda: 0,
    saldoInicial: 0,
    estoqueMinimo: 0,
    controlaEstoque: true,
    ativo: true,
  });
  formAberto.value = true;
}

function abrirEdicao(p: Produto) {
  editando.value = p;
  Object.assign(form, {
    sku: p.sku ?? '',
    nome: p.nome,
    descricao: p.descricao ?? '',
    unidade: p.unidade,
    precoVenda: p.precoVenda,
    saldoInicial: 0,
    estoqueMinimo: p.estoqueMinimo,
    controlaEstoque: p.controlaEstoque,
    ativo: p.ativo,
  });
  formAberto.value = true;
}

async function salvar() {
  if (form.nome.trim().length < 2) return;
  salvando.value = true;
  try {
    if (editando.value) {
      await servicoProdutos.atualizar(editando.value.id, {
        sku: form.sku || null,
        nome: form.nome,
        descricao: form.descricao || null,
        unidade: form.unidade || 'un',
        precoVenda: Number(form.precoVenda) || 0,
        estoqueMinimo: Number(form.estoqueMinimo) || 0,
        controlaEstoque: form.controlaEstoque,
        ativo: form.ativo,
      });
    } else {
      await servicoProdutos.criar({
        sku: form.sku || null,
        nome: form.nome,
        descricao: form.descricao || null,
        unidade: form.unidade || 'un',
        precoVenda: Number(form.precoVenda) || 0,
        saldoInicial: Number(form.saldoInicial) || 0,
        estoqueMinimo: Number(form.estoqueMinimo) || 0,
        controlaEstoque: form.controlaEstoque,
        ativo: form.ativo,
      });
    }
    sucesso('Produto salvo.');
    await queryClient.invalidateQueries({ queryKey: ['produtos'] });
    await queryClient.invalidateQueries({ queryKey: ['estoque'] });
    formAberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina
      titulo="Produtos"
      descricao="Catálogo do que você vende. Saldo e movimentações ficam em Estoque."
    >
      <template #acoes>
        <Button @click="abrirNovo"><Plus class="size-4" /> Novo produto</Button>
      </template>
    </CabecalhoPagina>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
    <div v-else-if="isLoading" class="grid gap-3 sm:grid-cols-2">
      <Skeleton v-for="n in 4" :key="n" class="h-24" />
    </div>
    <EstadoVazio
      v-else-if="linhas.length === 0"
      titulo="Nenhum produto"
      descricao="Cadastre o catálogo aqui. Depois opere o saldo em Estoque."
    >
      <template #acao><Button @click="abrirNovo"><Plus class="size-4" /> Novo produto</Button></template>
    </EstadoVazio>
    <div v-else class="grid gap-3 sm:grid-cols-2">
      <Card v-for="p in linhas" :key="p.id" class="p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-texto">{{ p.nome }}</p>
              <Badge v-if="!p.ativo" variante="neutro">Inativo</Badge>
              <Badge v-if="!p.controlaEstoque" variante="contorno">Sem estoque</Badge>
            </div>
            <p class="mt-1 text-sm text-texto-secundario">
              {{ p.sku ? `SKU ${p.sku} · ` : '' }}{{ formatarMoeda(p.precoVenda) }} / {{ p.unidade }}
            </p>
            <p v-if="p.controlaEstoque" class="mt-1 text-xs text-texto-secundario">
              Mínimo alerta: {{ p.estoqueMinimo }} {{ p.unidade }}
            </p>
          </div>
          <Button variante="fantasma" tamanho="icone-sm" @click="abrirEdicao(p)">
            <Pencil class="size-4" />
          </Button>
        </div>
      </Card>
    </div>

    <Dialog v-model="formAberto" :titulo="editando ? 'Editar produto' : 'Novo produto'">
      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="salvar">
        <div class="space-y-1.5 sm:col-span-2">
          <Label obrigatorio>Nome</Label>
          <Input v-model="form.nome" />
        </div>
        <div class="space-y-1.5">
          <Label>SKU</Label>
          <Input v-model="form.sku" />
        </div>
        <div class="space-y-1.5">
          <Label>Unidade</Label>
          <Input v-model="form.unidade" />
        </div>
        <div class="space-y-1.5">
          <Label>Preço de venda</Label>
          <Input v-model.number="form.precoVenda" type="number" min="0" step="0.01" />
        </div>
        <div class="space-y-1.5">
          <Label>Estoque mínimo (alerta)</Label>
          <Input v-model.number="form.estoqueMinimo" type="number" min="0" step="0.01" />
        </div>
        <div v-if="!editando" class="space-y-1.5 sm:col-span-2">
          <Label>Saldo inicial</Label>
          <Input v-model.number="form.saldoInicial" type="number" min="0" step="0.01" />
          <p class="text-xs text-texto-secundario">
            Vira a primeira entrada no extrato. Depois só altera em Estoque.
          </p>
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label>Descrição</Label>
          <Textarea v-model="form.descricao" :rows="2" />
        </div>
        <div class="flex items-center gap-2">
          <Switch v-model="form.controlaEstoque" />
          <span class="text-sm">Controla estoque</span>
        </div>
        <div class="flex items-center gap-2">
          <Switch v-model="form.ativo" />
          <span class="text-sm">Ativo</span>
        </div>
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
          <Button variante="secundario" type="button" @click="formAberto = false">Cancelar</Button>
          <Button :carregando="salvando" type="submit">Salvar</Button>
        </div>
      </form>
    </Dialog>
  </div>
</template>
