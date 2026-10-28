<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  ArrowLeft,
  PackagePlus,
  SlidersHorizontal,
} from 'lucide-vue-next';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import type { MovimentacaoEstoque, TipoMovimentacaoEstoque } from '@/types';
import { servicoProdutos } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarNumero, formatarDataHora, formatarMoeda } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import {
  MotivoAjusteEstoque,
  MOTIVO_AJUSTE_ESTOQUE_ROTULOS,
  PerfilUsuario,
  PermissaoComercial,
  PersonalizacaoComercial,
} from '@arcco/contratos';
import Select from '@/components/ui/Select.vue';

const rota = useRoute();
const id = computed(() => String(rota.params.id));
const queryClient = useQueryClient();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();

const podeEditar = computed(() =>
  auth.temPerfil(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR),
);
const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);
const podeAjustar = computed(
  () => podeEditar.value && (!ecolume.value || auth.temPermissaoComercial(PermissaoComercial.AJUSTAR_ESTOQUE)),
);
const podeInformarCusto = computed(
  () => ecolume.value && auth.temPermissaoComercial(PermissaoComercial.VER_CUSTOS),
);
const opcoesMotivo = Object.values(MotivoAjusteEstoque).map((valor) => ({
  valor,
  rotulo: MOTIVO_AJUSTE_ESTOQUE_ROTULOS[valor],
}));

const { data: produto, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['estoque', 'produto', id.value]),
  queryFn: () => servicoProdutos.obter(id.value),
});

const { data: movs, refetch: refetchMovs } = useQuery({
  queryKey: computed(() => ['estoque', 'movimentacoes', id.value]),
  queryFn: () => servicoProdutos.movimentacoes(id.value),
});

const movimentacoes = computed(() => movs.value ?? []);

const ROTULO_TIPO: Record<TipoMovimentacaoEstoque, string> = {
  ENTRADA: 'Entrada',
  BAIXA: 'Baixa',
  AJUSTE: 'Ajuste',
};

function varianteTipo(tipo: TipoMovimentacaoEstoque) {
  if (tipo === 'ENTRADA') return 'sucesso' as const;
  if (tipo === 'BAIXA') return 'erro' as const;
  return 'alerta' as const;
}

function sinalQtd(m: MovimentacaoEstoque) {
  if (m.tipo === 'BAIXA') return `−${formatarNumero(Math.abs(m.quantidade))}`;
  if (m.tipo === 'AJUSTE') {
    return m.quantidade >= 0
      ? `+${formatarNumero(m.quantidade)}`
      : formatarNumero(m.quantidade);
  }
  return `+${formatarNumero(m.quantidade)}`;
}

const modalEntrada = ref(false);
const modalAjuste = ref(false);
const qtdEntrada = ref(1);
const obsEntrada = ref('');
const modoAjuste = ref<'final' | 'diferenca'>('final');
const saldoContado = ref(0);
const diferencaAjuste = ref(0);
const motivoAjuste = ref<string>(MotivoAjusteEstoque.INVENTARIO);
const obsAjuste = ref('');
const custoAjuste = ref<number | null>(null);
const custoReferenciaAjuste = ref<number | null>(null);
const salvando = ref(false);

const saldoAnteriorAjuste = computed(() => produto.value?.estoqueAtual ?? 0);
const saldoResultanteAjuste = computed(() => {
  if (modoAjuste.value === 'diferenca') return saldoAnteriorAjuste.value + Number(diferencaAjuste.value || 0);
  return Number(saldoContado.value);
});
const diferencaCalculada = computed(
  () => saldoResultanteAjuste.value - saldoAnteriorAjuste.value,
);

function abrirEntrada() {
  qtdEntrada.value = 1;
  obsEntrada.value = '';
  modalEntrada.value = true;
}

function abrirAjuste() {
  modoAjuste.value = 'final';
  saldoContado.value = produto.value?.estoqueAtual ?? 0;
  diferencaAjuste.value = 0;
  motivoAjuste.value = MotivoAjusteEstoque.INVENTARIO;
  obsAjuste.value = '';
  custoAjuste.value = null;
  custoReferenciaAjuste.value = null;
  modalAjuste.value = true;
}

async function confirmarEntrada() {
  salvando.value = true;
  try {
    await servicoProdutos.entrada(id.value, Number(qtdEntrada.value), obsEntrada.value || undefined);
    sucesso('Entrada registrada.');
    modalEntrada.value = false;
    await Promise.all([refetch(), refetchMovs(), queryClient.invalidateQueries({ queryKey: ['estoque'] })]);
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

async function confirmarAjuste() {
  if (ecolume.value) {
    if (!motivoAjuste.value) return;
  } else if (!obsAjuste.value.trim()) {
    return;
  }
  salvando.value = true;
  try {
    if (ecolume.value) {
      const corpo: {
        saldoContado?: number;
        diferenca?: number;
        saldoAnteriorEsperado?: number;
        motivo: string;
        observacao?: string;
        precoUnitarioCusto?: number;
        custoReferenciaSaldo?: number;
      } = {
        motivo: motivoAjuste.value,
        observacao: obsAjuste.value.trim() || undefined,
        saldoAnteriorEsperado: saldoAnteriorAjuste.value,
      };
      if (modoAjuste.value === 'diferenca') corpo.diferenca = Number(diferencaAjuste.value);
      else corpo.saldoContado = Number(saldoContado.value);
      if (podeInformarCusto.value && custoAjuste.value != null && diferencaCalculada.value > 0) {
        corpo.precoUnitarioCusto = Number(custoAjuste.value);
        if (custoReferenciaAjuste.value != null) {
          corpo.custoReferenciaSaldo = Number(custoReferenciaAjuste.value);
        }
      }
      await servicoProdutos.ajuste(id.value, corpo);
    } else {
      await servicoProdutos.ajuste(id.value, {
        saldoContado: Number(saldoContado.value),
        observacao: obsAjuste.value.trim(),
      });
    }
    sucesso('Ajuste registrado.');
    modalAjuste.value = false;
    await Promise.all([refetch(), refetchMovs(), queryClient.invalidateQueries({ queryKey: ['estoque'] })]);
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-3">
      <RouterLink
        to="/app/estoque"
        class="inline-flex size-8 items-center justify-center rounded-sm text-texto hover:bg-marfim"
      >
        <ArrowLeft class="size-4" />
      </RouterLink>
      <div class="min-w-0">
        <p class="text-xs text-texto-secundario">Estoque · extrato</p>
        <h1 class="truncate text-xl font-semibold text-texto">
          {{ produto?.nome ?? '…' }}
        </h1>
      </div>
    </div>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
    <Skeleton v-else-if="isLoading" class="h-40 w-full" />

    <template v-else-if="produto">
      <div class="grid gap-4 lg:grid-cols-3">
        <Card class="p-5 lg:col-span-1">
          <p class="text-xs uppercase tracking-wide text-texto-secundario">Saldo atual</p>
          <p class="mt-2 text-3xl font-semibold text-texto">
            {{ formatarNumero(produto.estoqueAtual) }}
            <span class="text-base font-normal text-texto-secundario">{{ produto.unidade }}</span>
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <Badge v-if="produto.zerado" variante="erro">Zerado</Badge>
            <Badge v-else-if="produto.critico" variante="alerta">Abaixo do mínimo</Badge>
            <Badge v-else variante="sucesso">Ok</Badge>
          </div>
          <dl class="mt-4 space-y-2 text-sm">
            <div class="flex justify-between gap-2">
              <dt class="text-texto-secundario">Mínimo</dt>
              <dd>{{ formatarNumero(produto.estoqueMinimo) }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-texto-secundario">SKU</dt>
              <dd>{{ produto.sku || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-texto-secundario">Preço</dt>
              <dd>{{ formatarMoeda(produto.precoVenda) }}</dd>
            </div>
          </dl>
          <div v-if="produto.controlaEstoque && podeEditar" class="mt-4 flex flex-wrap gap-2">
            <Button tamanho="sm" @click="abrirEntrada">
              <PackagePlus class="size-4" /> Entrada
            </Button>
            <Button v-if="podeAjustar" tamanho="sm" variante="contorno" @click="abrirAjuste">
              <SlidersHorizontal class="size-4" /> Ajustar estoque
            </Button>
          </div>
          <p v-else class="mt-4 text-sm text-texto-secundario">
            Este item não controla estoque (serviço/avulso).
          </p>
        </Card>

        <Card class="lg:col-span-2">
          <CardHeader>
            <CardTitle>Histórico de movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <p v-if="movimentacoes.length === 0" class="text-sm text-texto-secundario">
              Nenhuma movimentação ainda.
            </p>
            <ul v-else class="divide-y divide-borda">
              <li
                v-for="m in movimentacoes"
                :key="m.id"
                class="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <Badge :variante="varianteTipo(m.tipo)">{{ ROTULO_TIPO[m.tipo] }}</Badge>
                    <span class="text-xs text-texto-secundario">{{ formatarDataHora(m.criadoEm) }}</span>
                  </div>
                  <p v-if="m.motivo" class="mt-1 text-xs text-texto-secundario">
                    {{ MOTIVO_AJUSTE_ESTOQUE_ROTULOS[m.motivo as keyof typeof MOTIVO_AJUSTE_ESTOQUE_ROTULOS] ?? m.motivo }}
                  </p>
                  <p v-if="m.observacao" class="mt-1 text-sm text-texto">{{ m.observacao }}</p>
                  <RouterLink
                    v-if="m.oportunidadeId"
                    :to="`/app/oportunidades/${m.oportunidadeId}`"
                    class="mt-1 inline-block text-xs text-carvao underline-offset-2 hover:underline"
                  >
                    Ver negócio
                  </RouterLink>
                </div>
                <div class="text-right text-sm">
                  <p
                    class="font-semibold"
                    :class="m.tipo === 'BAIXA' || (m.tipo === 'AJUSTE' && m.quantidade < 0) ? 'text-erro' : 'text-sucesso'"
                  >
                    {{ sinalQtd(m) }} {{ produto.unidade }}
                  </p>
                  <p class="text-xs text-texto-secundario">
                    Saldo {{ formatarNumero(m.saldoApos) }}
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </template>

    <Dialog v-model="modalEntrada" titulo="Entrada de estoque">
      <div class="space-y-3">
        <div class="space-y-1.5">
          <Label obrigatorio>Quantidade</Label>
          <Input v-model.number="qtdEntrada" type="number" min="0.01" step="0.01" />
        </div>
        <div class="space-y-1.5">
          <Label>Observação</Label>
          <Textarea v-model="obsEntrada" :rows="2" />
        </div>
        <div class="flex justify-end gap-2">
          <Button variante="secundario" @click="modalEntrada = false">Cancelar</Button>
          <Button :carregando="salvando" @click="confirmarEntrada">Registrar</Button>
        </div>
      </div>
    </Dialog>

    <Dialog v-model="modalAjuste" :titulo="ecolume ? 'Ajustar estoque' : 'Ajuste de inventário'">
      <div class="space-y-3">
        <template v-if="ecolume">
          <dl class="grid grid-cols-3 gap-2 rounded-sm border border-borda p-3 text-sm">
            <div>
              <dt class="text-texto-secundario">Anterior</dt>
              <dd class="font-medium">{{ formatarNumero(saldoAnteriorAjuste) }}</dd>
            </div>
            <div>
              <dt class="text-texto-secundario">Diferença</dt>
              <dd class="font-medium">{{ formatarNumero(diferencaCalculada) }}</dd>
            </div>
            <div>
              <dt class="text-texto-secundario">Resultante</dt>
              <dd class="font-medium">{{ formatarNumero(saldoResultanteAjuste) }}</dd>
            </div>
          </dl>
          <div class="flex gap-2 text-sm">
            <Button
              tamanho="sm"
              :variante="modoAjuste === 'final' ? 'primario' : 'contorno'"
              @click="modoAjuste = 'final'"
            >
              Saldo final
            </Button>
            <Button
              tamanho="sm"
              :variante="modoAjuste === 'diferenca' ? 'primario' : 'contorno'"
              @click="modoAjuste = 'diferenca'"
            >
              Diferença
            </Button>
          </div>
          <div v-if="modoAjuste === 'final'" class="space-y-1.5">
            <Label obrigatorio>Saldo final</Label>
            <Input v-model.number="saldoContado" type="number" step="0.01" />
          </div>
          <div v-else class="space-y-1.5">
            <Label obrigatorio>Diferença</Label>
            <Input v-model.number="diferencaAjuste" type="number" step="0.01" />
          </div>
          <div class="space-y-1.5">
            <Label obrigatorio>Motivo</Label>
            <Select v-model="motivoAjuste" :opcoes="opcoesMotivo" />
          </div>
          <div class="space-y-1.5">
            <Label>Observação</Label>
            <Textarea v-model="obsAjuste" :rows="2" />
          </div>
          <template v-if="podeInformarCusto && diferencaCalculada > 0">
            <div class="space-y-1.5">
              <Label>Custo unitário</Label>
              <Input v-model.number="custoAjuste" type="number" min="0" step="0.0001" />
            </div>
            <div class="space-y-1.5">
              <Label>Custo de referência do saldo</Label>
              <Input v-model.number="custoReferenciaAjuste" type="number" min="0" step="0.0001" />
              <p class="text-xs text-texto-secundario">
                Obrigatório se o produto já tem saldo e ainda não tem custo médio.
              </p>
            </div>
          </template>
        </template>
        <template v-else>
          <div class="space-y-1.5">
            <Label obrigatorio>Saldo contado</Label>
            <Input v-model.number="saldoContado" type="number" step="0.01" />
          </div>
          <div class="space-y-1.5">
            <Label obrigatorio>Motivo</Label>
            <Textarea v-model="obsAjuste" :rows="2" />
          </div>
        </template>
        <div class="flex justify-end gap-2">
          <Button variante="secundario" @click="modalAjuste = false">Cancelar</Button>
          <Button :carregando="salvando" @click="confirmarAjuste">Registrar</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>
