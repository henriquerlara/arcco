<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ModeloPagamentoPedido, PermissaoComercial } from '@arcco/contratos';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import { servicoPedidos, type PreviewConversao } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarMoeda } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const props = defineProps<{
  aberto: boolean;
  orcamentoId: string | null;
}>();

const emit = defineEmits<{
  (e: 'fechar'): void;
  (e: 'convertido', pedido: { id: string; numero: string }): void;
}>();

const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();
const podeConverter = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.CONVERTER_PEDIDO),
);

const passo = ref(1);
const carregando = ref(false);
const confirmando = ref(false);
const preview = ref<PreviewConversao | null>(null);
const modelo = ref<string>(ModeloPagamentoPedido.PIX_AVISTA);
const parcelas = ref(2);
const percentualSinal = ref(50);
const substituirIds = ref<string[]>([]);
const linhasPersonalizadas = ref([{ forma: 'Pix', valor: 0, recebido: true }]);

const modelos = [
  { valor: ModeloPagamentoPedido.PIX_AVISTA, rotulo: 'Pix à vista' },
  { valor: ModeloPagamentoPedido.CARTAO_CREDITO, rotulo: 'Cartão de crédito' },
  { valor: ModeloPagamentoPedido.CARTAO_DEBITO, rotulo: 'Cartão de débito' },
  { valor: ModeloPagamentoPedido.SINAL_RESTANTE_ENTREGA, rotulo: 'Sinal + restante na entrega' },
  { valor: ModeloPagamentoPedido.SINAL_BOLETOS, rotulo: 'Sinal + boletos' },
  { valor: ModeloPagamentoPedido.PERSONALIZADO, rotulo: 'Personalizado' },
];

watch(
  () => [props.aberto, props.orcamentoId] as const,
  async ([aberto, id]) => {
    if (!aberto || !id) return;
    passo.value = 1;
    substituirIds.value = [];
    modelo.value = ModeloPagamentoPedido.PIX_AVISTA;
    carregando.value = true;
    try {
      preview.value = await servicoPedidos.previsualizarConversao(id);
      linhasPersonalizadas.value = [
        { forma: 'Pix', valor: preview.value.orcamento.total, recebido: true },
      ];
    } catch (e) {
      notificarErro(e);
      emit('fechar');
    } finally {
      carregando.value = false;
    }
  },
);

function toggleSubstituir(id: string) {
  if (substituirIds.value.includes(id)) {
    substituirIds.value = substituirIds.value.filter((x) => x !== id);
  } else {
    substituirIds.value = [...substituirIds.value, id];
  }
}

async function confirmar() {
  if (!props.orcamentoId || !podeConverter.value) return;
  confirmando.value = true;
  try {
    const ped = await servicoPedidos.converter({
      orcamentoId: props.orcamentoId,
      modeloPagamento: modelo.value,
      orcamentosSubstituirIds: substituirIds.value,
      ...(modelo.value === ModeloPagamentoPedido.CARTAO_CREDITO ||
      modelo.value === ModeloPagamentoPedido.SINAL_BOLETOS
        ? { parcelas: Number(parcelas.value) || 1 }
        : {}),
      ...(modelo.value === ModeloPagamentoPedido.SINAL_RESTANTE_ENTREGA ||
      modelo.value === ModeloPagamentoPedido.SINAL_BOLETOS
        ? { percentualSinal: Number(percentualSinal.value) || 50 }
        : {}),
      ...(modelo.value === ModeloPagamentoPedido.PERSONALIZADO
        ? { linhasPersonalizadas: linhasPersonalizadas.value }
        : {}),
    });
    if (ped.avisoPagamento) {
      sucesso(
        `Pedido ${ped.numero} criado. Soma dos pagamentos difere do total em ${formatarMoeda(Math.abs(ped.avisoPagamento.diferenca))}.`,
      );
    } else {
      sucesso(`Pedido ${ped.numero} criado`);
    }
    emit('convertido', { id: ped.id, numero: ped.numero });
    emit('fechar');
  } catch (e) {
    notificarErro(e);
  } finally {
    confirmando.value = false;
  }
}
</script>

<template>
  <Dialog
    :model-value="aberto"
    titulo="Converter em pedido"
    tamanho="lg"
    @update:model-value="(v: boolean) => !v && emit('fechar')"
  >
    <div v-if="carregando" class="py-8 text-center text-texto-secundario">Carregando…</div>
    <div v-else-if="preview" class="space-y-4">
      <p class="text-sm text-texto-secundario">
        Passo {{ passo }} de 4 · {{ preview.orcamento.numero }} ·
        {{ formatarMoeda(preview.orcamento.total) }}
      </p>

      <div v-if="passo === 1" class="space-y-3">
        <p class="text-sm font-medium text-texto">Confirme itens e estoque</p>
        <ul class="max-h-56 space-y-2 overflow-auto text-sm">
          <li
            v-for="item in preview.orcamento.itens"
            :key="item.id"
            class="rounded border border-borda px-2 py-1.5"
          >
            <div class="flex justify-between gap-2">
              <span>{{ item.nome }} × {{ item.quantidade }}</span>
              <span>{{ formatarMoeda(item.totalLinha) }}</span>
            </div>
            <p
              v-if="item.controlaEstoque && item.negativoPrevisto"
              class="mt-0.5 text-xs text-alerta"
            >
              Saldo previsto {{ item.saldoPrevisto }} (negativo permitido)
            </p>
            <p v-else-if="!item.produtoId" class="mt-0.5 text-xs text-texto-secundario">
              Item avulso — sem baixa
            </p>
            <p v-else-if="!item.controlaEstoque" class="mt-0.5 text-xs text-texto-secundario">
              Sem controle de estoque — sem baixa
            </p>
          </li>
        </ul>
      </div>

      <div v-else-if="passo === 2" class="space-y-3">
        <p class="text-sm font-medium text-texto">Modelo de pagamento</p>
        <div>
          <Label>Modelo</Label>
          <Select v-model="modelo" :opcoes="modelos" />
        </div>
        <div
          v-if="
            modelo === ModeloPagamentoPedido.CARTAO_CREDITO ||
            modelo === ModeloPagamentoPedido.SINAL_BOLETOS
          "
        >
          <Label>{{
            modelo === ModeloPagamentoPedido.SINAL_BOLETOS ? 'Qtd. boletos' : 'Parcelas'
          }}</Label>
          <Input v-model.number="parcelas" type="number" min="1" max="48" />
        </div>
        <div
          v-if="
            modelo === ModeloPagamentoPedido.SINAL_RESTANTE_ENTREGA ||
            modelo === ModeloPagamentoPedido.SINAL_BOLETOS
          "
        >
          <Label>Sinal (%)</Label>
          <Input v-model.number="percentualSinal" type="number" min="1" max="99" />
        </div>
        <div v-if="modelo === ModeloPagamentoPedido.PERSONALIZADO" class="space-y-2">
          <div
            v-for="(l, i) in linhasPersonalizadas"
            :key="i"
            class="grid grid-cols-2 gap-2"
          >
            <Input v-model="l.forma" placeholder="Forma" />
            <Input v-model.number="l.valor" type="number" min="0" step="0.01" />
          </div>
          <Button
            variante="contorno"
            tamanho="sm"
            type="button"
            @click="linhasPersonalizadas.push({ forma: '', valor: 0, recebido: false })"
          >
            + Linha
          </Button>
          <p class="text-xs text-texto-secundario">
            Soma diferente do total apenas avisa — não bloqueia.
          </p>
        </div>
        <div v-if="preview.comissao" class="rounded border border-borda p-2 text-sm">
          Comissão prevista (RT {{ preview.comissao.rtPercentual }}% sobre total):
          {{ formatarMoeda(preview.comissao.valorComissao) }}
        </div>
      </div>

      <div v-else-if="passo === 3" class="space-y-3">
        <p class="text-sm font-medium text-texto">Outros orçamentos abertos</p>
        <p class="text-xs text-texto-secundario">
          Marque os que devem ficar como Substituído. Nenhum selecionado por padrão.
        </p>
        <ul v-if="preview.outrosOrcamentosAbertos.length" class="space-y-2">
          <li
            v-for="o in preview.outrosOrcamentosAbertos"
            :key="o.id"
            class="flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              :checked="substituirIds.includes(o.id)"
              @change="toggleSubstituir(o.id)"
            />
            <span>{{ o.numero }} · {{ formatarMoeda(o.total) }} · {{ o.status }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-texto-secundario">Não há outros orçamentos abertos.</p>
      </div>

      <div v-else class="space-y-2 text-sm">
        <p class="font-medium text-texto">Confirmar conversão</p>
        <p>
          Será criado o pedido a partir de {{ preview.orcamento.numero }}, com baixa de estoque
          (quando aplicável), pagamentos, checklist
          <template v-if="preview.comissao"> e comissão</template>.
        </p>
        <p v-if="substituirIds.length" class="text-texto-secundario">
          {{ substituirIds.length }} orçamento(s) marcado(s) como Substituído.
        </p>
      </div>

      <div class="flex flex-wrap justify-between gap-2 pt-2">
        <Button
          variante="contorno"
          type="button"
          :disabled="passo === 1 || confirmando"
          @click="passo -= 1"
        >
          Voltar
        </Button>
        <div class="flex gap-2">
          <Button variante="contorno" type="button" :disabled="confirmando" @click="emit('fechar')">
            Cancelar
          </Button>
          <Button
            v-if="passo < 4"
            type="button"
            @click="passo += 1"
          >
            Continuar
          </Button>
          <Button
            v-else
            type="button"
            :carregando="confirmando"
            :disabled="!podeConverter"
            @click="confirmar"
          >
            Converter
          </Button>
        </div>
      </div>
    </div>
  </Dialog>
</template>
