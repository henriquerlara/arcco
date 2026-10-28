<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { TipoAtividade } from '@arcco/contratos';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import { servicoAtividades, type SugestaoEntrega } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';

const props = defineProps<{
  modelValue: boolean;
  pedidoId: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: boolean): void;
  (e: 'salvo'): void;
}>();

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);
const carregando = ref(false);
const sugestao = ref<SugestaoEntrega | null>(null);

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const form = reactive({
  titulo: '',
  vencimento: '',
  diaInteiro: false,
  periodoDia: '' as string,
  responsavelId: null as string | null,
  descricao: '',
  entregaCep: '',
  entregaLogradouro: '',
  entregaNumero: '',
  entregaComplemento: '',
  entregaBairro: '',
  entregaCidade: '',
  entregaUf: '',
  contatoLocalNome: '',
  contatoLocalTelefone: '',
});

const opcoesPeriodo = [
  { valor: '', rotulo: 'Horário informado' },
  { valor: 'MANHA', rotulo: 'Manhã' },
  { valor: 'TARDE', rotulo: 'Tarde' },
];

watch(
  () => [props.modelValue, props.pedidoId] as const,
  async ([ab, pedidoId]) => {
    if (!ab || !pedidoId) return;
    carregando.value = true;
    try {
      const s = await servicoAtividades.sugerirEntrega(pedidoId);
      sugestao.value = s;
      form.titulo = s.tituloSugerido;
      form.responsavelId = s.responsavelIdSugerido;
      form.contatoLocalNome = s.contatoLocalNome;
      form.contatoLocalTelefone = s.contatoLocalTelefone;
      form.entregaCep = s.endereco.cep ?? '';
      form.entregaLogradouro = s.endereco.logradouro ?? '';
      form.entregaNumero = s.endereco.numero ?? '';
      form.entregaComplemento = s.endereco.complemento ?? '';
      form.entregaBairro = s.endereco.bairro ?? '';
      form.entregaCidade = s.endereco.cidade ?? '';
      form.entregaUf = s.endereco.uf ?? '';
      const agora = new Date();
      agora.setMinutes(0, 0, 0);
      agora.setHours(agora.getHours() + 1);
      form.vencimento = agora.toISOString().slice(0, 16);
      form.periodoDia = '';
      form.diaInteiro = false;
      form.descricao = '';
    } catch (e) {
      notificarErro(e);
      aberto.value = false;
    } finally {
      carregando.value = false;
    }
  },
);

async function salvar() {
  if (!props.pedidoId || !sugestao.value) return;
  if (!form.titulo.trim() || !form.vencimento) return;
  salvando.value = true;
  try {
    await servicoAtividades.criar({
      tipo: TipoAtividade.ENTREGA,
      titulo: form.titulo,
      descricao: form.descricao || undefined,
      vencimento: new Date(form.vencimento),
      responsavelId: form.responsavelId ?? undefined,
      pedidoId: props.pedidoId,
      oportunidadeId: sugestao.value.oportunidadeId,
      contatoId: sugestao.value.contatoId,
      diaInteiro: form.diaInteiro,
      periodoDia: form.periodoDia || null,
      entregaCep: form.entregaCep || null,
      entregaLogradouro: form.entregaLogradouro || null,
      entregaNumero: form.entregaNumero || null,
      entregaComplemento: form.entregaComplemento || null,
      entregaBairro: form.entregaBairro || null,
      entregaCidade: form.entregaCidade || null,
      entregaUf: form.entregaUf || null,
      contatoLocalNome: form.contatoLocalNome || null,
      contatoLocalTelefone: form.contatoLocalTelefone || null,
    });
    sucesso('Entrega agendada.');
    await queryClient.invalidateQueries({ queryKey: ['atividades'] });
    await queryClient.invalidateQueries({ queryKey: ['pipeline-ecolume'] });
    emit('salvo');
    aberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <Dialog v-model="aberto" titulo="Agendar entrega">
    <div v-if="carregando" class="py-8 text-sm text-texto-secundario">Carregando sugestões…</div>
    <div v-else class="space-y-3">
      <p v-if="sugestao" class="text-xs text-texto-secundario">
        {{ sugestao.numero }} · {{ sugestao.negocioCodigo }}
        · endereço sugerido da {{ sugestao.endereco.origem === 'OBRA' ? 'obra' : 'cliente' }}
      </p>
      <div>
        <Label>Título</Label>
        <Input v-model="form.titulo" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Data / horário</Label>
          <Input v-model="form.vencimento" type="datetime-local" />
        </div>
        <div>
          <Label>Período</Label>
          <Select v-model="form.periodoDia" :opcoes="opcoesPeriodo" />
        </div>
      </div>
      <div>
        <Label>Responsável pela entrega</Label>
        <SeletorUsuario v-model="form.responsavelId" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Contato no local</Label>
          <Input v-model="form.contatoLocalNome" />
        </div>
        <div>
          <Label>Telefone no local</Label>
          <Input v-model="form.contatoLocalTelefone" mascara="telefone" placeholder="(11) 90000-0000" />
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="sm:col-span-2">
          <Label>Logradouro</Label>
          <Input v-model="form.entregaLogradouro" />
        </div>
        <div>
          <Label>Número</Label>
          <Input v-model="form.entregaNumero" />
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Bairro</Label>
          <Input v-model="form.entregaBairro" />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input v-model="form.entregaCidade" />
        </div>
        <div>
          <Label>UF</Label>
          <Input v-model="form.entregaUf" mascara="uf" placeholder="UF" />
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>CEP</Label>
          <Input v-model="form.entregaCep" mascara="cep" placeholder="00000-000" />
        </div>
        <div>
          <Label>Complemento</Label>
          <Input v-model="form.entregaComplemento" />
        </div>
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea v-model="form.descricao"  :rows="2" />
      </div>
      <div v-if="sugestao?.itensConferencia?.length" class="rounded-md border border-borda p-3">
        <p class="mb-2 text-xs font-semibold text-texto-secundario">Itens para conferência</p>
        <ul class="space-y-1 text-xs">
          <li v-for="item in sugestao.itensConferencia" :key="item.id">
            {{ item.descricaoComercial }}
            <span class="text-texto-secundario">
              (fiscal: {{ item.nomeFiscal }}) · {{ item.quantidade }} {{ item.unidade }}
            </span>
          </li>
        </ul>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <Button variante="secundario" @click="aberto = false">Cancelar</Button>
        <Button :disabled="salvando" @click="salvar">Agendar</Button>
      </div>
    </div>
  </Dialog>
</template>
