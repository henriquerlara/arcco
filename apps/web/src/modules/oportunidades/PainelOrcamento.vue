<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { FileText, Plus, Send, AlertTriangle, List } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import Textarea from '@/components/ui/Textarea.vue';
import type { Orcamento, Produto } from '@/types';
import { servicoArquivos, servicoOrcamentos, servicoProdutos } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarMoeda, parsearMoeda } from '@/composables/formatadores';

const props = defineProps<{
  oportunidadeId: string;
  codigoPedido: string;
  podeEnviar: boolean;
}>();

const emit = defineEmits<{ (e: 'atualizado'): void }>();

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const { data: orcamentos, refetch } = useQuery({
  queryKey: computed(() => ['orcamentos', props.oportunidadeId]),
  queryFn: () => servicoOrcamentos.listar(props.oportunidadeId),
});

const { data: produtos } = useQuery({
  queryKey: ['produtos', 'ativos'],
  queryFn: () => servicoProdutos.listar(true),
});

const lista = computed(() => orcamentos.value ?? []);
const vigente = computed(() => lista.value.find((o) => o.vigente) ?? lista.value[0] ?? null);

const editorAberto = ref(false);
const enviando = ref(false);
const salvando = ref(false);
const editandoId = ref<string | null>(null);
const textoEnvio = ref('');
const modalEnvio = ref(false);
const orcamentoParaEnvio = ref<Orcamento | null>(null);
const modalDetalhes = ref(false);
const orcamentoDetalhes = ref<Orcamento | null>(null);

const linhas = ref<
  Array<{
    produtoId: string;
    nome: string;
    unidade: string;
    quantidade: number;
    precoUnitario: number;
  }>
>([{ produtoId: '', nome: '', unidade: 'un', quantidade: 1, precoUnitario: 0 }]);
const descontoValor = ref(0);
const observacoes = ref('');

const opcoesProduto = computed(() =>
  (produtos.value ?? []).map((p) => ({
    valor: p.id,
    rotulo: `${p.nome} · estoque ${p.estoqueAtual} ${p.unidade}`,
  })),
);

const avisos = computed(() => {
  const mapa = new Map((produtos.value ?? []).map((p) => [p.id, p]));
  return linhas.value
    .filter((l) => l.produtoId)
    .map((l) => {
      const p = mapa.get(l.produtoId);
      if (!p || !p.controlaEstoque) return null;
      if (l.quantidade <= p.estoqueAtual) return null;
      return {
        nome: p.nome,
        solicitado: l.quantidade,
        disponivel: p.estoqueAtual,
      };
    })
    .filter(Boolean) as Array<{ nome: string; solicitado: number; disponivel: number }>;
});

const totalPreview = computed(() => {
  const sub = linhas.value.reduce((acc, l) => acc + l.quantidade * l.precoUnitario, 0);
  return Math.max(0, sub - (descontoValor.value || 0));
});

function produtoPorId(id: string): Produto | undefined {
  return (produtos.value ?? []).find((p) => p.id === id);
}

function aoEscolherProduto(idx: number, produtoId: string) {
  const p = produtoPorId(produtoId);
  if (!p) return;
  linhas.value[idx] = {
    produtoId: p.id,
    nome: p.nome,
    unidade: p.unidade,
    quantidade: linhas.value[idx]?.quantidade || 1,
    precoUnitario: p.precoVenda,
  };
}

function adicionarLinha() {
  linhas.value.push({
    produtoId: '',
    nome: '',
    unidade: 'un',
    quantidade: 1,
    precoUnitario: 0,
  });
}

function abrirNovo() {
  editandoId.value = null;
  linhas.value = [{ produtoId: '', nome: '', unidade: 'un', quantidade: 1, precoUnitario: 0 }];
  descontoValor.value = 0;
  observacoes.value = '';
  editorAberto.value = true;
}

function abrirEdicao(o: Orcamento) {
  if (o.status !== 'RASCUNHO') return;
  editandoId.value = o.id;
  linhas.value = o.itens.map((i) => ({
    produtoId: i.produtoId ?? '',
    nome: i.nome,
    unidade: i.unidade,
    quantidade: i.quantidade,
    precoUnitario: i.precoUnitario,
  }));
  descontoValor.value = o.descontoValor;
  observacoes.value = o.observacoes ?? '';
  editorAberto.value = true;
}

async function salvar() {
  const itens = linhas.value
    .filter((l) => l.nome || l.produtoId)
    .map((l) => ({
      produtoId: l.produtoId || null,
      nome: l.nome || produtoPorId(l.produtoId)?.nome || 'Item',
      unidade: l.unidade || 'un',
      quantidade: Number(l.quantidade) || 1,
      precoUnitario: Number(l.precoUnitario) || 0,
      desconto: 0,
    }));
  if (itens.length === 0) return;
  salvando.value = true;
  try {
    if (editandoId.value) {
      await servicoOrcamentos.atualizar(editandoId.value, {
        itens,
        descontoValor: Number(descontoValor.value) || 0,
        observacoes: observacoes.value || null,
      });
    } else {
      await servicoOrcamentos.criar({
        oportunidadeId: props.oportunidadeId,
        itens,
        descontoValor: Number(descontoValor.value) || 0,
        observacoes: observacoes.value || null,
      });
    }
    sucesso('Orçamento salvo.');
    editorAberto.value = false;
    await refetch();
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

async function gerarPdf(o: Orcamento) {
  try {
    const atualizado = await servicoOrcamentos.gerarPdf(o.id);
    sucesso('PDF gerado.');
    await refetch();
    if (atualizado.arquivoId) await servicoArquivos.abrir(atualizado.arquivoId);
  } catch (e) {
    notificarErro(e);
  }
}

function prepararEnvio(o: Orcamento) {
  orcamentoParaEnvio.value = o;
  textoEnvio.value =
    `Olá! Segue o orçamento *${o.numero}* do pedido *${props.codigoPedido}* no valor de *${formatarMoeda(o.total)}*.\n\nQualquer dúvida, estou à disposição.`;
  modalEnvio.value = true;
}

function abrirDetalhes(o: Orcamento) {
  orcamentoDetalhes.value = o;
  modalDetalhes.value = true;
}

async function confirmarEnvio() {
  if (!orcamentoParaEnvio.value || !textoEnvio.value.trim()) return;
  enviando.value = true;
  try {
    await servicoOrcamentos.enviar(orcamentoParaEnvio.value.id, textoEnvio.value.trim());
    sucesso('Orçamento enviado. Este passa a ser o vigente.');
    modalEnvio.value = false;
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['oportunidade', props.oportunidadeId] });
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    enviando.value = false;
  }
}

watch(
  () => props.oportunidadeId,
  () => refetch(),
);
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between gap-3">
      <CardTitle>Orçamento</CardTitle>
      <Button tamanho="sm" @click="abrirNovo"><Plus class="size-4" /> Montar</Button>
    </CardHeader>
    <CardContent class="space-y-4">
      <p v-if="lista.length === 0" class="text-sm text-texto-secundario">
        Monte o orçamento com produtos do catálogo. O PDF é gerado pela ARCCO e a baixa de estoque
        só acontece ao marcar o negócio como Fechado.
      </p>

      <div v-for="o in lista" :key="o.id" class="rounded-md border border-borda p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-texto">{{ o.numero }}</p>
              <Badge :variante="o.vigente ? 'sucesso' : 'neutro'">
                {{ o.vigente ? 'Vigente' : o.status }}
              </Badge>
            </div>
            <p class="mt-1 text-sm text-texto-secundario">
              Pedido {{ codigoPedido }} · v{{ o.versao }} · {{ o.itens.length }} item(ns) ·
              {{ formatarMoeda(o.total) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-1">
            <Button variante="contorno" tamanho="sm" @click="abrirDetalhes(o)">
              <List class="size-4" /> Ver detalhes
            </Button>
            <Button
              v-if="o.status === 'RASCUNHO'"
              variante="contorno"
              tamanho="sm"
              @click="abrirEdicao(o)"
            >
              Editar
            </Button>
            <Button variante="contorno" tamanho="sm" @click="gerarPdf(o)">
              <FileText class="size-4" /> PDF
            </Button>
            <Button
              v-if="podeEnviar && (o.status === 'RASCUNHO' || o.status === 'ENVIADO')"
              tamanho="sm"
              @click="prepararEnvio(o)"
            >
              <Send class="size-4" /> Enviar
            </Button>
          </div>
        </div>

        <ul v-if="o.avisosEstoque?.length" class="mt-2 space-y-1">
          <li
            v-for="a in o.avisosEstoque"
            :key="a.produtoId"
            class="flex items-start gap-1.5 text-xs text-alerta"
          >
            <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
            {{ a.nome }}: pediu {{ a.solicitado }}, estoque {{ a.disponivel }}
          </li>
        </ul>
      </div>

      <p v-if="vigente" class="text-xs text-texto-secundario">
        No Fechado, o último orçamento montado vira o final (WhatsApp opcional) e baixa o estoque.
      </p>
    </CardContent>
  </Card>

  <Dialog v-model="editorAberto" :titulo="editandoId ? 'Editar orçamento' : 'Novo orçamento'" tamanho="lg">
    <div class="space-y-4">
      <div
        v-if="avisos.length"
        class="rounded-md border border-alerta/30 bg-alerta/10 p-3 text-sm text-alerta"
      >
        <p class="font-medium">Atenção de estoque (pode orçar mesmo assim):</p>
        <ul class="mt-1 list-disc pl-4">
          <li v-for="(a, i) in avisos" :key="i">
            {{ a.nome }} — pediu {{ a.solicitado }}, disponível {{ a.disponivel }}
          </li>
        </ul>
      </div>

      <div v-for="(linha, idx) in linhas" :key="idx" class="grid gap-2 sm:grid-cols-12">
        <div class="sm:col-span-5 space-y-1">
          <Label>Produto</Label>
          <Select
            :model-value="linha.produtoId"
            :opcoes="opcoesProduto"
            placeholder="Selecione…"
            @update:model-value="(v) => aoEscolherProduto(idx, v)"
          />
        </div>
        <div class="sm:col-span-2 space-y-1">
          <Label>Qtd</Label>
          <Input v-model.number="linha.quantidade" type="number" min="0.01" step="0.01" />
        </div>
        <div class="sm:col-span-3 space-y-1">
          <Label>Preço unit.</Label>
          <Input
            :model-value="linha.precoUnitario"
            mascara="moeda"
            placeholder="0,00"
            @update:model-value="(v) => (linha.precoUnitario = parsearMoeda(String(v)) ?? 0)"
          />
        </div>
        <div class="sm:col-span-2 flex items-end text-sm text-texto">
          {{ formatarMoeda(linha.quantidade * linha.precoUnitario) }}
        </div>
      </div>

      <Button variante="contorno" tamanho="sm" @click="adicionarLinha">
        <Plus class="size-4" /> Item
      </Button>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label>Desconto (R$)</Label>
          <Input
            :model-value="descontoValor"
            mascara="moeda"
            placeholder="0,00"
            @update:model-value="(v) => (descontoValor = parsearMoeda(String(v)) ?? 0)"
          />
        </div>
        <div class="flex items-end justify-end text-lg font-semibold text-texto">
          Total {{ formatarMoeda(totalPreview) }}
        </div>
      </div>

      <div class="space-y-1.5">
        <Label>Nota interna</Label>
        <Textarea
          v-model="observacoes"
          :rows="2"
          placeholder="Só para a equipe — não entra no PDF enviado ao cliente"
        />
      </div>

      <div class="flex justify-end gap-2">
        <Button variante="secundario" @click="editorAberto = false">Cancelar</Button>
        <Button :carregando="salvando" @click="salvar">Salvar orçamento</Button>
      </div>
    </div>
  </Dialog>

  <Dialog
    v-model="modalDetalhes"
    :titulo="orcamentoDetalhes ? `Orçamento ${orcamentoDetalhes.numero}` : 'Detalhes do orçamento'"
    tamanho="lg"
  >
    <div v-if="orcamentoDetalhes" class="space-y-4">
      <p class="text-sm text-texto-secundario">
        Pedido {{ codigoPedido }} · v{{ orcamentoDetalhes.versao }} ·
        {{ orcamentoDetalhes.status }}
        <template v-if="orcamentoDetalhes.vigente"> · vigente</template>
      </p>

      <div class="overflow-x-auto rounded-md border border-borda">
        <table class="w-full min-w-[28rem] text-left text-sm">
          <thead class="bg-marfim/50 text-xs uppercase tracking-wide text-texto-secundario">
            <tr>
              <th class="px-3 py-2 font-medium">Produto</th>
              <th class="px-3 py-2 font-medium">Qtd</th>
              <th class="px-3 py-2 font-medium">Unit.</th>
              <th class="px-3 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in orcamentoDetalhes.itens"
              :key="item.id"
              class="border-t border-borda/60"
            >
              <td class="px-3 py-2 text-texto">{{ item.nome }}</td>
              <td class="px-3 py-2 text-texto-secundario">
                {{ item.quantidade }} {{ item.unidade }}
              </td>
              <td class="px-3 py-2 text-texto-secundario">
                {{ formatarMoeda(item.precoUnitario) }}
              </td>
              <td class="px-3 py-2 text-right font-medium text-texto">
                {{ formatarMoeda(item.totalLinha) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-borda bg-marfim/30">
              <td colspan="3" class="px-3 py-2 text-right text-texto-secundario">
                <span v-if="orcamentoDetalhes.descontoValor > 0">
                  Subtotal {{ formatarMoeda(orcamentoDetalhes.subtotal) }} · Desconto
                  {{ formatarMoeda(orcamentoDetalhes.descontoValor) }} ·
                </span>
                Total
              </td>
              <td class="px-3 py-2 text-right font-semibold text-texto">
                {{ formatarMoeda(orcamentoDetalhes.total) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        v-if="orcamentoDetalhes.observacoes"
        class="rounded-md border border-borda/70 bg-marfim/40 px-3 py-2 text-sm"
      >
        <p class="text-xs font-medium uppercase tracking-wide text-texto-secundario">
          Nota interna
        </p>
        <p class="mt-1 text-texto-secundario">{{ orcamentoDetalhes.observacoes }}</p>
      </div>

      <div class="flex justify-end">
        <Button variante="secundario" @click="modalDetalhes = false">Fechar</Button>
      </div>
    </div>
  </Dialog>

  <Dialog v-model="modalEnvio" titulo="Enviar orçamento no WhatsApp">
    <div class="space-y-3">
      <p class="text-sm text-texto-secundario">
        O PDF gerado pela ARCCO será anexado. Este orçamento passa a ser o vigente.
      </p>
      <div class="space-y-1.5">
        <Label obrigatorio>Mensagem</Label>
        <Textarea v-model="textoEnvio" :rows="5" />
      </div>
      <div class="flex justify-end gap-2">
        <Button variante="secundario" @click="modalEnvio = false">Cancelar</Button>
        <Button :carregando="enviando" @click="confirmarEnvio">
          <Send class="size-4" /> Enviar
        </Button>
      </div>
    </div>
  </Dialog>
</template>
