<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { RouterLink } from 'vue-router';
import {
  Package,
  PackagePlus,
  SlidersHorizontal,
  Search,
  AlertTriangle,
  ChevronRight,
} from 'lucide-vue-next';
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
import type { Produto } from '@/types';
import { servicoProdutos } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarNumero } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { PerfilUsuario, PersonalizacaoComercial } from '@arcco/contratos';
import EstoqueEcolumePainel from './EstoqueEcolumePainel.vue';

const queryClient = useQueryClient();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();
const rota = useRoute();

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);

const podeEditar = computed(() =>
  auth.temPerfil(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR),
);

const busca = ref('');
const soCriticos = ref(rota.query.criticos === '1' || rota.query.criticos === 'true');
const buscaDebounced = ref('');

let timer: ReturnType<typeof setTimeout> | undefined;
watch(busca, (v) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    buscaDebounced.value = v.trim();
  }, 250);
});

const filtros = computed(() => ({
  busca: buscaDebounced.value || undefined,
  criticos: soCriticos.value,
}));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['estoque', filtros.value]),
  queryFn: () => servicoProdutos.listarEstoque(filtros.value),
});

const { data: resumo } = useQuery({
  queryKey: ['estoque', 'resumo'],
  queryFn: () => servicoProdutos.resumoEstoque(),
});

const linhas = computed(() => data.value ?? []);

const modalEntrada = ref(false);
const modalAjuste = ref(false);
const alvo = ref<Produto | null>(null);
const qtdEntrada = ref(1);
const obsEntrada = ref('');
const saldoContado = ref(0);
const obsAjuste = ref('');
const salvando = ref(false);

function abrirEntrada(p: Produto) {
  alvo.value = p;
  qtdEntrada.value = 1;
  obsEntrada.value = '';
  modalEntrada.value = true;
}

function abrirAjuste(p: Produto) {
  alvo.value = p;
  saldoContado.value = p.estoqueAtual;
  obsAjuste.value = '';
  modalAjuste.value = true;
}

async function confirmarEntrada() {
  if (!alvo.value || qtdEntrada.value <= 0) return;
  salvando.value = true;
  try {
    await servicoProdutos.entrada(
      alvo.value.id,
      Number(qtdEntrada.value),
      obsEntrada.value || undefined,
    );
    sucesso('Entrada registrada.');
    modalEntrada.value = false;
    await queryClient.invalidateQueries({ queryKey: ['estoque'] });
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

async function confirmarAjuste() {
  if (!alvo.value || !obsAjuste.value.trim()) return;
  salvando.value = true;
  try {
    await servicoProdutos.ajuste(alvo.value.id, {
      saldoContado: Number(saldoContado.value),
      observacao: obsAjuste.value.trim(),
    });
    sucesso('Ajuste de inventário registrado.');
    modalAjuste.value = false;
    await queryClient.invalidateQueries({ queryKey: ['estoque'] });
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <EstoqueEcolumePainel v-if="ecolume" />
  <div v-else class="space-y-5">
    <CabecalhoPagina
      titulo="Estoque"
      descricao="Saldo, entradas, inventário e histórico. O saldo só muda por movimentação."
    >
      <template #acoes>
        <RouterLink
          to="/app/produtos"
          class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-borda bg-transparent px-4 text-sm font-semibold text-carvao hover:border-dourado hover:bg-marfim"
        >
          Produtos
        </RouterLink>
      </template>
    </CabecalhoPagina>

    <div class="grid gap-3 sm:grid-cols-3">
      <Card class="p-4">
        <p class="text-xs text-texto-secundario">Com controle</p>
        <p class="mt-1 text-2xl font-semibold text-texto">
          {{ formatarNumero(resumo?.totalComControle) }}
        </p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-texto-secundario">Abaixo do mínimo</p>
        <p class="mt-1 text-2xl font-semibold text-alerta">
          {{ formatarNumero(resumo?.criticos) }}
        </p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-texto-secundario">Zerados</p>
        <p class="mt-1 text-2xl font-semibold text-erro">
          {{ formatarNumero(resumo?.zerados) }}
        </p>
      </Card>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative min-w-0 flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-secundario" />
        <Input v-model="busca" class="pl-9" placeholder="Buscar por nome ou SKU" />
      </div>
      <Button
        :variante="soCriticos ? 'primario' : 'contorno'"
        @click="soCriticos = !soCriticos"
      >
        <AlertTriangle class="size-4" />
        Só críticos
      </Button>
    </div>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
    <div v-else-if="isLoading" class="space-y-2">
      <Skeleton v-for="n in 5" :key="n" class="h-16 w-full" />
    </div>
    <EstadoVazio
      v-else-if="linhas.length === 0"
      titulo="Nada no estoque"
      descricao="Cadastre produtos com controle de estoque no catálogo, ou limpe o filtro de críticos."
    >
      <template #acao>
        <RouterLink
          to="/app/produtos"
          class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-carvao bg-carvao px-4 text-sm font-semibold text-marfim hover:bg-carvao-claro"
        >
          Ir a produtos
        </RouterLink>
      </template>
    </EstadoVazio>

    <div v-else class="overflow-hidden rounded-md border border-borda">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-borda bg-marfim/60 text-xs uppercase tracking-wide text-texto-secundario">
          <tr>
            <th class="px-4 py-3 font-medium">Produto</th>
            <th class="px-4 py-3 font-medium">Saldo</th>
            <th class="hidden px-4 py-3 font-medium sm:table-cell">Mínimo</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in linhas"
            :key="p.id"
            class="border-b border-borda/70 last:border-0 transition-colors hover:bg-marfim/50"
          >
            <td class="px-4 py-3">
              <RouterLink
                :to="`/app/estoque/${p.id}`"
                class="font-medium text-texto hover:underline"
              >
                {{ p.nome }}
              </RouterLink>
              <p v-if="p.sku" class="text-xs text-texto-secundario">SKU {{ p.sku }}</p>
            </td>
            <td class="px-4 py-3 font-medium text-texto">
              {{ formatarNumero(p.estoqueAtual) }}
              <span class="text-texto-secundario">{{ p.unidade }}</span>
            </td>
            <td class="hidden px-4 py-3 text-texto-secundario sm:table-cell">
              {{ formatarNumero(p.estoqueMinimo) }}
            </td>
            <td class="px-4 py-3">
              <Badge v-if="p.zerado" variante="erro">Zerado</Badge>
              <Badge v-else-if="p.critico" variante="alerta">Baixo</Badge>
              <Badge v-else variante="sucesso">Ok</Badge>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1">
                <Button
                  v-if="podeEditar"
                  variante="fantasma"
                  tamanho="icone-sm"
                  title="Entrada"
                  @click="abrirEntrada(p)"
                >
                  <PackagePlus class="size-4" />
                </Button>
                <Button
                  v-if="podeEditar"
                  variante="fantasma"
                  tamanho="icone-sm"
                  title="Ajuste de inventário"
                  @click="abrirAjuste(p)"
                >
                  <SlidersHorizontal class="size-4" />
                </Button>
                <RouterLink
                  :to="`/app/estoque/${p.id}`"
                  class="inline-flex size-8 items-center justify-center rounded-sm text-texto hover:bg-marfim"
                  title="Extrato"
                >
                  <ChevronRight class="size-4" />
                </RouterLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Dialog v-model="modalEntrada" titulo="Entrada de estoque">
      <div class="space-y-3">
        <p class="flex items-center gap-2 text-sm text-texto-secundario">
          <Package class="size-4" /> {{ alvo?.nome }}
        </p>
        <div class="space-y-1.5">
          <Label obrigatorio>Quantidade</Label>
          <Input v-model.number="qtdEntrada" type="number" min="0.01" step="0.01" />
        </div>
        <div class="space-y-1.5">
          <Label>Observação</Label>
          <Textarea v-model="obsEntrada" :rows="2" placeholder="Compra, devolução…" />
        </div>
        <div class="flex justify-end gap-2">
          <Button variante="secundario" @click="modalEntrada = false">Cancelar</Button>
          <Button :carregando="salvando" @click="confirmarEntrada">Registrar entrada</Button>
        </div>
      </div>
    </Dialog>

    <Dialog v-model="modalAjuste" titulo="Ajuste de inventário">
      <div class="space-y-3">
        <p class="text-sm text-texto-secundario">
          {{ alvo?.nome }} — saldo atual:
          <strong>{{ formatarNumero(alvo?.estoqueAtual) }} {{ alvo?.unidade }}</strong>
        </p>
        <div class="space-y-1.5">
          <Label obrigatorio>Saldo contado</Label>
          <Input v-model.number="saldoContado" type="number" step="0.01" />
        </div>
        <div class="space-y-1.5">
          <Label obrigatorio>Motivo</Label>
          <Textarea v-model="obsAjuste" :rows="2" placeholder="Ex.: inventário mensal, perda, avaria…" />
        </div>
        <div class="flex justify-end gap-2">
          <Button variante="secundario" @click="modalAjuste = false">Cancelar</Button>
          <Button :carregando="salvando" @click="confirmarAjuste">Registrar ajuste</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

