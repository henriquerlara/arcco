<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { FileSpreadsheet } from 'lucide-vue-next';
import { PermissaoComercial, PersonalizacaoComercial } from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import NotasEntradaView from './NotasEntradaView.vue';
import AcoesNfeEventos from './AcoesNfeEventos.vue';
import {
  servicoArquivos,
  servicoNotasFiscais,
  type NotaEmitidaFiscal,
} from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarMoeda, formatarData } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const auth = useAutenticacaoStore();
const rota = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const { notificarErro } = useNotificacao();

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);
const podeEmitir = computed(() => auth.temPermissaoComercial(PermissaoComercial.EMITIR_NF));
const podeImportar = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.IMPORTAR_XML),
);

const abas = [
  { valor: 'emitidas', rotulo: 'Notas emitidas' },
  { valor: 'entrada', rotulo: 'Notas de entrada' },
  { valor: 'pendentes', rotulo: 'Pendentes de emissão' },
];

function abaDaRota(): string {
  const q = rota.query.aba;
  return typeof q === 'string' && abas.some((a) => a.valor === q) ? q : 'emitidas';
}

const aba = ref(abaDaRota());

function selecionarAba(v: string) {
  if (!abas.some((a) => a.valor === v)) return;
  if (aba.value !== v) aba.value = v;
  if (rota.query.aba === v) return;
  void router.replace({ path: rota.path, query: { ...rota.query, aba: v } });
}

watch(
  () => rota.query.aba,
  () => {
    const desejada = abaDaRota();
    if (aba.value !== desejada) aba.value = desejada;
  },
);

const {
  data: emitidas,
  isLoading: loadEmit,
  isError: errEmit,
  error: erroEmit,
  refetch: refEmit,
} = useQuery({
  queryKey: ['fiscal', 'emitidas'],
  queryFn: () => servicoNotasFiscais.listarEmitidas(),
  enabled: computed(() => ecolume.value && aba.value === 'emitidas'),
});

const {
  data: pendentes,
  isLoading: loadPend,
  isError: errPend,
  error: erroPend,
  refetch: refPend,
} = useQuery({
  queryKey: ['fiscal', 'pendentes'],
  queryFn: () => servicoNotasFiscais.listarPendentesEmissao(),
  enabled: computed(() => ecolume.value && aba.value === 'pendentes'),
});

const listaEmitidas = computed(() => emitidas.value ?? []);
const listaPendentes = computed(() => pendentes.value?.pedidos ?? []);

const detalhe = ref<NotaEmitidaFiscal | null>(null);
const modalDetalhe = computed({
  get: () => detalhe.value != null,
  set: (v: boolean) => {
    if (!v) detalhe.value = null;
  },
});

function rotuloStatus(status: string, simulacao: boolean) {
  const mapa: Record<string, string> = {
    RASCUNHO: 'Rascunho',
    PROCESSANDO: 'Processando',
    AUTORIZADA: 'Autorizada',
    REJEITADA: 'Rejeitada',
    CANCELADA: 'Cancelada',
  };
  const base = mapa[status] ?? status;
  return simulacao ? `${base} (simulação)` : base;
}

function varianteStatus(status: string) {
  if (status === 'AUTORIZADA') return 'sucesso';
  if (status === 'REJEITADA' || status === 'CANCELADA') return 'erro';
  if (status === 'PROCESSANDO') return 'alerta';
  return 'neutro';
}

async function baixar(id: string, nome: string) {
  try {
    await servicoArquivos.baixar(id, nome);
  } catch (e) {
    notificarErro(e);
  }
}

function irEmitir(oportunidadeId: string, pedidoId: string) {
  void router.push({
    name: 'oportunidade-detalhe',
    params: { id: oportunidadeId },
    query: { emitirNf: pedidoId },
  });
}

async function aoAtualizarEventos() {
  const id = detalhe.value?.id;
  const r = await refEmit();
  if (id) detalhe.value = r.data?.find((n) => n.id === id) ?? detalhe.value;
}

function aoImportado() {
  void queryClient.invalidateQueries({ queryKey: ['notas-entrada'] });
  void queryClient.invalidateQueries({ queryKey: ['fiscal'] });
}
</script>

<template>
  <div v-if="!ecolume" class="p-6">
    <EstadoVazio
      titulo="Fiscal indisponível"
      descricao="A tela Fiscal completa é exclusiva da personalização ECOLUME."
    />
  </div>
  <div v-else class="space-y-6 p-6">
    <CabecalhoPagina
      titulo="Fiscal"
      descricao="Notas emitidas, notas de entrada e pedidos pendentes de faturamento."
    />

    <div class="flex flex-col gap-4">
      <div
        role="tablist"
        class="inline-flex w-fit items-center gap-0 border-b border-borda"
      >
        <button
          v-for="item in abas"
          :key="item.valor"
          type="button"
          role="tab"
          :aria-selected="aba === item.valor"
          :data-state="aba === item.valor ? 'active' : 'inactive'"
          class="-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-texto-secundario transition-colors data-[state=active]:border-carvao data-[state=active]:text-carvao focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carvao/20"
          @click="selecionarAba(item.valor)"
        >
          {{ item.rotulo }}
        </button>
      </div>

      <div v-if="aba === 'emitidas'" role="tabpanel">
        <EstadoErro v-if="errEmit" :erro="erroEmit" @tentar-novamente="refEmit()" />
        <div v-else-if="loadEmit" class="space-y-2">
          <Skeleton v-for="n in 4" :key="n" class="h-16" />
        </div>
        <EstadoVazio
          v-else-if="!listaEmitidas.length"
          titulo="Nenhuma NF-e emitida"
          descricao="Emita a partir do pedido (aba Pendentes ou detalhe do negócio)."
        />
        <div v-else class="space-y-2">
          <Card
            v-for="nf in listaEmitidas"
            :key="nf.id"
            class="flex flex-wrap items-start justify-between gap-3 p-4"
          >
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium text-texto">
                  <template v-if="nf.numero">Nº {{ nf.numero }}/{{ nf.serie || '—' }}</template>
                  <template v-else>Sem número</template>
                </p>
                <Badge :variante="varianteStatus(nf.status)">
                  {{ rotuloStatus(nf.status, nf.simulacao) }}
                </Badge>
              </div>
              <p class="text-sm text-texto-secundario">
                {{ nf.clienteNome || 'Cliente' }}
                <template v-if="nf.pedidoNumero"> · {{ nf.pedidoNumero }}</template>
                · {{ formatarMoeda(nf.valorTotal) }}
                · {{ formatarData(nf.autorizadoEm || nf.criadoEm) }}
              </p>
              <p
                v-if="nf.mensagemErro && (nf.status === 'REJEITADA' || nf.simulacao)"
                class="text-xs"
                :class="nf.status === 'REJEITADA' ? 'text-erro' : 'text-texto-secundario'"
              >
                {{ nf.mensagemErro }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button variante="contorno" tamanho="sm" @click="detalhe = nf">Detalhes</Button>
              <RouterLink
                v-if="nf.oportunidadeId"
                :to="{ name: 'oportunidade-detalhe', params: { id: nf.oportunidadeId } }"
              >
                <Button variante="fantasma" tamanho="sm">Pedido / negócio</Button>
              </RouterLink>
              <Button
                v-if="nf.arquivoPdfId"
                variante="fantasma"
                tamanho="sm"
                @click="baixar(nf.arquivoPdfId!, `danfe-${nf.numero || nf.id}.pdf`)"
              >
                DANFE
              </Button>
              <Button
                v-if="nf.arquivoXmlId"
                variante="fantasma"
                tamanho="sm"
                @click="baixar(nf.arquivoXmlId!, `nfe-${nf.numero || nf.id}.xml`)"
              >
                XML
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div v-if="aba === 'entrada'" role="tabpanel">
        <p v-if="!podeImportar" class="mb-3 text-xs text-texto-secundario">
          Sem permissão IMPORTAR_XML — é possível consultar notas já conferidas, mas não importar.
        </p>
        <NotasEntradaView embutido @importado="aoImportado" />
      </div>

      <div v-if="aba === 'pendentes'" role="tabpanel">
        <p
          v-if="pendentes && !pendentes.emissaoRealHabilitada"
          class="mb-3 rounded border border-alerta/40 bg-alerta/10 px-3 py-2 text-xs text-alerta"
        >
          Emissão real bloqueada (P3 e/ou token Focus). Consulta liberada; envio usa mock local se
          houver EMITIR_NF — não é homologação Sefaz. O certificado A1 é gerenciado no painel da
          Focus (o ARCCO não recebe arquivo nem senha).
        </p>
        <EstadoErro v-if="errPend" :erro="erroPend" @tentar-novamente="refPend()" />
        <div v-else-if="loadPend" class="space-y-2">
          <Skeleton v-for="n in 4" :key="n" class="h-16" />
        </div>
        <EstadoVazio
          v-else-if="!listaPendentes.length"
          titulo="Nenhum pedido pendente"
          descricao="Pedidos 100% faturados (AUTORIZADA) ou cancelados não aparecem aqui."
        />
        <div v-else class="space-y-2">
          <Card
            v-for="p in listaPendentes"
            :key="p.pedidoId"
            class="flex flex-wrap items-start justify-between gap-3 p-4"
          >
            <div class="space-y-1">
              <p class="font-medium text-texto">
                {{ p.numero }} · {{ p.clienteNome || 'Cliente' }}
              </p>
              <p class="text-sm text-texto-secundario">
                Pedido {{ formatarMoeda(p.totalPedido) }} · pendente
                {{ formatarMoeda(p.valorPendente) }} · {{ formatarData(p.criadoEm) }}
              </p>
              <ul class="text-xs text-texto-secundario">
                <li v-for="i in p.itensPendentes" :key="i.itemPedidoId">
                  {{ i.nome }}: {{ i.quantidadePendente }}/{{ i.quantidadeVendida }}
                  {{ i.unidade }}
                </li>
              </ul>
            </div>
            <Button
              v-if="podeEmitir"
              tamanho="sm"
              @click="irEmitir(p.oportunidadeId, p.pedidoId)"
            >
              <FileSpreadsheet class="size-4" /> Emitir NF-e
            </Button>
            <p v-else class="text-xs text-texto-secundario">Sem permissão EMITIR_NF</p>
          </Card>
        </div>
      </div>
    </div>

    <Dialog v-model="modalDetalhe" titulo="Detalhe da NF-e" tamanho="md">
      <div v-if="detalhe" class="space-y-3 text-sm">
        <Badge :variante="varianteStatus(detalhe.status)">
          {{ rotuloStatus(detalhe.status, detalhe.simulacao) }}
        </Badge>
        <p>
          Nº {{ detalhe.numero || '—' }}/{{ detalhe.serie || '—' }} ·
          {{ formatarMoeda(detalhe.valorTotal) }}
        </p>
        <p class="text-texto-secundario">
          {{ detalhe.clienteNome }} · {{ detalhe.pedidoNumero }}
        </p>
        <p v-if="detalhe.chaveAcesso" class="break-all text-xs text-texto-secundario">
          Chave: {{ detalhe.chaveAcesso }}
        </p>
        <p v-if="detalhe.mensagemErro" class="text-xs text-texto-secundario">
          {{ detalhe.mensagemErro }}
        </p>
        <ul class="space-y-1 border-t border-borda pt-2">
          <li v-for="i in detalhe.itens" :key="i.id">
            {{ i.descricao }} · {{ i.quantidade }} × {{ formatarMoeda(i.precoUnitario) }}
          </li>
        </ul>
        <AcoesNfeEventos
          :nota-id="detalhe.id"
          :status="detalhe.status"
          :email-padrao="detalhe.clienteEmail"
          :eventos="detalhe.eventos"
          :simulado="detalhe.simulacao"
          @atualizado="aoAtualizarEventos"
        />
        <div class="flex justify-end gap-2">
          <Button variante="secundario" @click="modalDetalhe = false">Fechar</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>
