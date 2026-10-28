<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { ModeloPagamentoPedido, PersonalizacaoComercial } from '@arcco/contratos';
import { Save } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Button from '@/components/ui/Button.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import { servicoEmpresa } from '@/services';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';

const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);

const { data, isLoading, refetch, isError, error } = useQuery({
  queryKey: ['parametros-comerciais'],
  queryFn: () => servicoEmpresa.parametrosComerciais(),
  enabled: ecolume,
  retry: false,
});

const form = reactive({
  diasOrcamentoSemMovimentacao: 7,
  diasChecklistPendente: 7,
  rtPadraoParceiro: 10,
  margemPadraoGlobal: '' as string,
  validadeOrcamentoDias: '' as string,
  descontoMaximoPercentual: '' as string,
  regimeTributario: '',
  naturezaOperacao: '',
  cfopPadrao: '',
  csosnPadrao: '',
  cstPadrao: '',
  tratamentoSt: '',
  informacoesComplementaresNfe: '',
  motivosPerda: [] as Array<{ codigo: string; rotulo: string; exigeDescricao: boolean }>,
  modelosPagamentoHabilitados: [] as string[],
});

const modelosTodos = Object.values(ModeloPagamentoPedido);

watch(
  data,
  (p) => {
    if (!p) return;
    form.diasOrcamentoSemMovimentacao = p.diasOrcamentoSemMovimentacao;
    form.diasChecklistPendente = p.diasChecklistPendente;
    form.rtPadraoParceiro = p.rtPadraoParceiro;
    form.margemPadraoGlobal =
      p.margemPadraoGlobal != null ? String(p.margemPadraoGlobal) : '';
    form.validadeOrcamentoDias =
      p.validadeOrcamentoDias != null ? String(p.validadeOrcamentoDias) : '';
    form.descontoMaximoPercentual =
      p.descontoMaximoPercentual != null ? String(p.descontoMaximoPercentual) : '';
    form.regimeTributario = p.fiscal?.regimeTributario ?? '';
    form.naturezaOperacao = p.fiscal?.naturezaOperacao ?? '';
    form.cfopPadrao = p.fiscal?.cfopPadrao ?? '';
    form.csosnPadrao = p.fiscal?.csosnPadrao ?? '';
    form.cstPadrao = p.fiscal?.cstPadrao ?? '';
    form.tratamentoSt = p.fiscal?.tratamentoSt ?? '';
    form.informacoesComplementaresNfe = p.fiscal?.informacoesComplementaresNfe ?? '';
    form.motivosPerda = (p.motivosPerda ?? []).map((m) => ({ ...m }));
    form.modelosPagamentoHabilitados = [...(p.modelosPagamentoHabilitados ?? modelosTodos)];
  },
  { immediate: true },
);

function toggleModelo(codigo: string) {
  const i = form.modelosPagamentoHabilitados.indexOf(codigo);
  if (i >= 0) form.modelosPagamentoHabilitados.splice(i, 1);
  else form.modelosPagamentoHabilitados.push(codigo);
}

function numOuNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function salvar() {
  if (!form.modelosPagamentoHabilitados.length) {
    notificarErro(new Error('Selecione ao menos um modelo de pagamento.'));
    return;
  }
  if (!form.motivosPerda.length) {
    notificarErro(new Error('Mantenha ao menos um motivo de perda.'));
    return;
  }
  salvando.value = true;
  try {
    await servicoEmpresa.atualizarParametrosComerciais({
      diasOrcamentoSemMovimentacao: form.diasOrcamentoSemMovimentacao,
      diasChecklistPendente: form.diasChecklistPendente,
      rtPadraoParceiro: form.rtPadraoParceiro,
      baseRtComissao: 'TOTAL_PEDIDO',
      margemPadraoGlobal: numOuNull(form.margemPadraoGlobal),
      validadeOrcamentoDias: numOuNull(form.validadeOrcamentoDias),
      descontoMaximoPercentual: numOuNull(form.descontoMaximoPercentual),
      modelosPagamentoHabilitados: form.modelosPagamentoHabilitados,
      motivosPerda: form.motivosPerda,
      regimeTributario: form.regimeTributario.trim() || null,
      naturezaOperacao: form.naturezaOperacao.trim() || null,
      cfopPadrao: form.cfopPadrao.trim() || null,
      csosnPadrao: form.csosnPadrao.trim() || null,
      cstPadrao: form.cstPadrao.trim() || null,
      tratamentoSt: form.tratamentoSt.trim() || null,
      informacoesComplementaresNfe: form.informacoesComplementaresNfe.trim() || null,
    });
    sucesso('Parâmetros comerciais atualizados.');
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
    <CabecalhoPagina
      titulo="Parâmetros comerciais"
      descricao="Prazos, RT, descontos, motivos de perda e estrutura fiscal (ECOLUME)."
    />
    <NavConfiguracoes />

    <Card v-if="!ecolume" class="max-w-2xl">
      <CardContent class="py-6 text-sm text-texto-secundario">
        Parâmetros comerciais exclusivos da personalização ECOLUME.
      </CardContent>
    </Card>

    <template v-else>
      <Card v-if="isLoading" class="max-w-3xl">
        <CardContent class="space-y-3 py-6">
          <Skeleton v-for="n in 5" :key="n" class="h-10 w-full" />
        </CardContent>
      </Card>
      <Card v-else-if="isError" class="max-w-3xl">
        <CardContent class="py-6 text-sm text-erro">
          {{ (error as Error)?.message || 'Não foi possível carregar os parâmetros.' }}
        </CardContent>
      </Card>
      <form v-else class="grid max-w-3xl gap-5" @submit.prevent="salvar">
        <Card>
          <CardHeader><CardTitle>Prazos e RT</CardTitle></CardHeader>
          <CardContent class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label>Orçamento parado (dias)</Label>
              <Input v-model.number="form.diasOrcamentoSemMovimentacao" type="number" min="1" max="90" />
            </div>
            <div class="space-y-1.5">
              <Label>Pendência de pedido (dias)</Label>
              <Input v-model.number="form.diasChecklistPendente" type="number" min="1" max="90" />
            </div>
            <div class="space-y-1.5">
              <Label>RT padrão novos parceiros (%)</Label>
              <Input v-model.number="form.rtPadraoParceiro" type="number" min="0" max="100" step="0.01" />
            </div>
            <div class="space-y-1.5">
              <Label>Base da comissão</Label>
              <Input :model-value="'TOTAL_PEDIDO'" disabled />
              <p class="text-xs text-texto-secundario">P1: líquido aguarda definição do contador.</p>
            </div>
            <div class="space-y-1.5">
              <Label>Desconto máximo sobre sugerido (%)</Label>
              <Input v-model="form.descontoMaximoPercentual" type="text" placeholder="vazio = bloqueado" />
              <p class="text-xs text-texto-secundario">
                Sem valor, quem não tem VER_CUSTOS não altera preço/desconto.
              </p>
            </div>
            <div class="space-y-1.5">
              <Label>Margem padrão global (P6)</Label>
              <Input
                v-model="form.margemPadraoGlobal"
                type="text"
                :placeholder="data?.sugestoesP6?.margemPadraoGlobal ? String(data.sugestoesP6.margemPadraoGlobal) : '1,6'"
              />
            </div>
            <div class="space-y-1.5">
              <Label>Validade orçamento (dias, P6)</Label>
              <Input
                v-model="form.validadeOrcamentoDias"
                type="text"
                :placeholder="data?.sugestoesP6?.validadeOrcamentoDias ? String(data.sugestoesP6.validadeOrcamentoDias) : '15'"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Modelos de pagamento</CardTitle></CardHeader>
          <CardContent class="flex flex-wrap gap-3">
            <label
              v-for="m in modelosTodos"
              :key="m"
              class="flex items-center gap-2 text-sm text-texto"
            >
              <input
                type="checkbox"
                :checked="form.modelosPagamentoHabilitados.includes(m)"
                @change="toggleModelo(m)"
              />
              {{ m }}
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Motivos de perda</CardTitle></CardHeader>
          <CardContent class="space-y-3">
            <div
              v-for="(mot, idx) in form.motivosPerda"
              :key="mot.codigo + idx"
              class="grid gap-2 sm:grid-cols-[7rem_1fr_auto] sm:items-end"
            >
              <div class="space-y-1">
                <Label>Código</Label>
                <Input v-model="mot.codigo" />
              </div>
              <div class="space-y-1">
                <Label>Rótulo</Label>
                <Input v-model="mot.rotulo" />
              </div>
              <label class="flex items-center gap-2 pb-2 text-sm">
                <input v-model="mot.exigeDescricao" type="checkbox" />
                Exige texto
              </label>
            </div>
            <p class="text-xs text-texto-secundario">
              Históricos de negócios já perdidos preservam o texto/código gravado.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fiscal (estrutura P3)</CardTitle></CardHeader>
          <CardContent class="grid gap-4 sm:grid-cols-2">
            <p class="sm:col-span-2 text-xs text-texto-secundario">
              {{ data?.certificado?.pendenciaP3 }}
              Certificado/token:
              {{ data?.certificado?.armazenamentoSegredo }}
              Token Focus:
              {{ data?.certificado?.tokenFocusConfigurado ? 'configurado no servidor' : 'ausente' }}.
            </p>
            <div class="space-y-1.5">
              <Label>Regime tributário</Label>
              <Input v-model="form.regimeTributario" placeholder="ex.: simples" />
            </div>
            <div class="space-y-1.5">
              <Label>Natureza da operação</Label>
              <Input v-model="form.naturezaOperacao" />
            </div>
            <div class="space-y-1.5">
              <Label>CFOP</Label>
              <Input v-model="form.cfopPadrao" />
            </div>
            <div class="space-y-1.5">
              <Label>CSOSN</Label>
              <Input v-model="form.csosnPadrao" />
            </div>
            <div class="space-y-1.5">
              <Label>CST</Label>
              <Input v-model="form.cstPadrao" />
            </div>
            <div class="space-y-1.5">
              <Label>Tratamento ST</Label>
              <Input v-model="form.tratamentoSt" />
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label>Informações complementares NF-e</Label>
              <Input v-model="form.informacoesComplementaresNfe" />
            </div>
          </CardContent>
        </Card>

        <div>
          <Button :carregando="salvando" type="submit">
            <Save class="size-4" /> Salvar parâmetros
          </Button>
        </div>
      </form>
    </template>
  </div>
</template>
