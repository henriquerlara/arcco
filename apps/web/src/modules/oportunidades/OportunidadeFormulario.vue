<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import {
  NaturezaPessoa,
  OrigemNegocio,
  PermissaoComercial,
  PersonalizacaoComercial,
  PrioridadeOportunidade,
} from '@arcco/contratos';
import type { Contato, Oportunidade } from '@/types';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import SeletorContato from '@/components/formularios/SeletorContato.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import SeletorCategoria from '@/components/formularios/SeletorCategoria.vue';
import { servicoContatos, servicoOportunidades } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { ROTULO_PRIORIDADE, opcoesDe } from '@/composables/rotulos';
import { parsearMoeda } from '@/composables/formatadores';

const props = defineProps<{
  modelValue: boolean;
  contatoId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: boolean): void;
  (e: 'salvo', oportunidade: Oportunidade): void;
}>();

const router = useRouter();
const queryClient = useQueryClient();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);
const clienteNome = ref('');

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);
const podeVerComissoes = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.VER_COMISSOES),
);

const opcoesPrioridade = opcoesDe(ROTULO_PRIORIDADE);
const opcoesOrigem = [
  { valor: OrigemNegocio.CLIENTE_DIRETO, rotulo: 'Cliente direto' },
  { valor: OrigemNegocio.VIA_PARCEIRO, rotulo: 'Via parceiro' },
];

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const form = reactive({
  titulo: '',
  contatoId: null as string | null,
  clienteRapido: false,
  clienteNome: '',
  clienteTelefone: '',
  clienteNatureza: NaturezaPessoa.PF as string,
  responsavelId: null as string | null,
  categoriaId: null as string | null,
  origem: '',
  origemNegocio: OrigemNegocio.CLIENTE_DIRETO as string,
  parceiroId: null as string | null,
  rtNegocio: '',
  prioridade: PrioridadeOportunidade.MEDIA as string,
  valorEstimado: '',
  descricao: '',
  obraCep: '',
  obraLogradouro: '',
  obraNumero: '',
  obraComplemento: '',
  obraBairro: '',
  obraCidade: '',
  obraUf: '',
});
const erros = reactive<Record<string, string>>({});

watch(
  () => props.modelValue,
  (ab) => {
    if (!ab) return;
    form.titulo = '';
    form.contatoId = props.contatoId ?? null;
    form.clienteRapido = false;
    form.clienteNome = '';
    form.clienteTelefone = '';
    form.clienteNatureza = NaturezaPessoa.PF;
    form.responsavelId = auth.usuario?.id ?? null;
    form.categoriaId = null;
    form.origem = '';
    form.origemNegocio = OrigemNegocio.CLIENTE_DIRETO;
    form.parceiroId = null;
    form.rtNegocio = '';
    form.prioridade = PrioridadeOportunidade.MEDIA;
    form.valorEstimado = '';
    form.descricao = '';
    form.obraCep = '';
    form.obraLogradouro = '';
    form.obraNumero = '';
    form.obraComplemento = '';
    form.obraBairro = '';
    form.obraCidade = '';
    form.obraUf = '';
    clienteNome.value = '';
    Object.keys(erros).forEach((k) => delete erros[k]);
  },
);

watch(
  () => form.contatoId,
  async (id) => {
    if (!ecolume.value || !id) return;
    try {
      const c = await servicoContatos.obter(id);
      clienteNome.value = c.nome;
      if (!form.titulo.trim()) form.titulo = `${c.nome} — Projeto`;
    } catch {
      /* ignore */
    }
  },
);

async function onParceiro(contato: { id: string; nome: string }) {
  if (!podeVerComissoes.value) return;
  try {
    const p = await servicoContatos.obter(contato.id);
    if (p.rtPadrao != null && !form.rtNegocio) form.rtNegocio = String(p.rtPadrao);
  } catch {
    /* ignore */
  }
}

async function copiarEnderecoCliente() {
  if (!form.contatoId) return;
  try {
    const c: Contato = await servicoContatos.obter(form.contatoId);
    form.obraCep = c.cep ?? '';
    form.obraLogradouro = c.logradouro ?? '';
    form.obraNumero = c.numero ?? '';
    form.obraComplemento = c.complemento ?? '';
    form.obraBairro = c.bairro ?? '';
    form.obraCidade = c.cidade ?? '';
    form.obraUf = c.uf ?? '';
  } catch (e) {
    notificarErro(e);
  }
}

async function salvar() {
  Object.keys(erros).forEach((k) => delete erros[k]);
  if (ecolume.value) {
    if (form.clienteRapido) {
      if (form.clienteNome.trim().length < 2) erros.clienteNome = 'Informe o nome';
      if (form.clienteTelefone.replace(/\D/g, '').length < 8) erros.clienteTelefone = 'Telefone inválido';
    } else if (!form.contatoId) {
      erros.contatoId = 'Selecione o cliente';
    }
    if (!form.titulo.trim()) erros.titulo = 'Informe o nome do negócio';
    if (!form.origemNegocio) erros.origemNegocio = 'Informe a origem';
    if (form.origemNegocio === OrigemNegocio.VIA_PARCEIRO && !form.parceiroId) {
      erros.parceiroId = 'Selecione o parceiro';
    }
    if (!form.responsavelId) erros.responsavelId = 'Informe o responsável';
  } else if (!form.contatoId) {
    erros.contatoId = 'Selecione a pessoa';
  }
  if (Object.keys(erros).length) return;

  salvando.value = true;
  try {
    const valor = parsearMoeda(form.valorEstimado) ?? undefined;
    const payload: Record<string, unknown> = {
      responsavelId: form.responsavelId,
      categoriaId: form.categoriaId,
      prioridade: form.prioridade as PrioridadeOportunidade,
      valorEstimado: Number.isFinite(valor) ? valor : undefined,
      descricao: form.descricao.trim() || undefined,
    };

    if (ecolume.value) {
      payload.titulo = form.titulo.trim();
      payload.origemNegocio = form.origemNegocio;
      if (form.origemNegocio === OrigemNegocio.VIA_PARCEIRO) {
        payload.parceiroId = form.parceiroId;
        if (podeVerComissoes.value && form.rtNegocio !== '') {
          payload.rtNegocio = Number(String(form.rtNegocio).replace(',', '.'));
        }
      } else {
        payload.parceiroId = null;
      }
      payload.obraCep = form.obraCep || null;
      payload.obraLogradouro = form.obraLogradouro || null;
      payload.obraNumero = form.obraNumero || null;
      payload.obraComplemento = form.obraComplemento || null;
      payload.obraBairro = form.obraBairro || null;
      payload.obraCidade = form.obraCidade || null;
      payload.obraUf = form.obraUf || null;
      if (form.clienteRapido) {
        payload.clienteMinimo = {
          nome: form.clienteNome,
          telefone: form.clienteTelefone,
          natureza: form.clienteNatureza,
        };
      } else {
        payload.contatoId = form.contatoId;
      }
    } else {
      payload.contatoId = form.contatoId;
      payload.origem = form.origem.trim() || 'manual';
    }

    const criado = await servicoOportunidades.criar(payload);
    sucesso(ecolume.value ? 'Negócio criado.' : 'Negócio criado no funil.');
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    await queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
    await queryClient.invalidateQueries({ queryKey: ['contato'] });
    emit('salvo', criado);
    aberto.value = false;
    await router.push({ name: 'oportunidade-detalhe', params: { id: criado.id } });
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model="aberto"
    titulo="Novo negócio"
    :descricao="
      ecolume
        ? 'Código NEG gerado automaticamente. Sem orçamento, inicia em Novo contato.'
        : 'Entra na primeira etapa do funil.'
    "
    tamanho="lg"
  >
    <form class="space-y-4" @submit.prevent="salvar">
      <template v-if="ecolume">
        <div class="space-y-1.5">
          <Label obrigatorio>Nome do negócio</Label>
          <Input v-model="form.titulo" :invalido="!!erros.titulo" placeholder="Cliente — Projeto" />
          <p v-if="erros.titulo" class="text-xs text-erro">{{ erros.titulo }}</p>
        </div>

        <label class="flex items-center gap-2 text-sm text-texto">
          <input v-model="form.clienteRapido" type="checkbox" class="rounded border-borda" />
          Cadastro mínimo de cliente agora
        </label>

        <div v-if="form.clienteRapido" class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label obrigatorio>Nome</Label>
            <Input v-model="form.clienteNome" :invalido="!!erros.clienteNome" />
            <p v-if="erros.clienteNome" class="text-xs text-erro">{{ erros.clienteNome }}</p>
          </div>
          <div class="space-y-1.5">
            <Label obrigatorio>Telefone</Label>
            <Input
              v-model="form.clienteTelefone"
              mascara="telefone"
              :invalido="!!erros.clienteTelefone"
            />
            <p v-if="erros.clienteTelefone" class="text-xs text-erro">{{ erros.clienteTelefone }}</p>
          </div>
          <div class="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              v-model="form.clienteNatureza"
              :opcoes="[
                { valor: 'PF', rotulo: 'Pessoa física' },
                { valor: 'PJ', rotulo: 'Pessoa jurídica' },
              ]"
            />
          </div>
        </div>
        <div v-else class="space-y-1.5">
          <Label obrigatorio>Cliente</Label>
          <SeletorContato v-model="form.contatoId" />
          <p v-if="erros.contatoId" class="text-xs text-erro">{{ erros.contatoId }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label obrigatorio>Origem</Label>
            <Select v-model="form.origemNegocio" :opcoes="opcoesOrigem" />
          </div>
          <div v-if="form.origemNegocio === 'VIA_PARCEIRO'" class="space-y-1.5">
            <Label obrigatorio>Parceiro</Label>
            <SeletorContato
              v-model="form.parceiroId"
              somente-parceiros
              @selecionado="onParceiro"
            />
            <p v-if="erros.parceiroId" class="text-xs text-erro">{{ erros.parceiroId }}</p>
          </div>
          <div
            v-if="form.origemNegocio === 'VIA_PARCEIRO' && podeVerComissoes"
            class="space-y-1.5"
          >
            <Label>RT do negócio (%)</Label>
            <Input v-model="form.rtNegocio" placeholder="10" />
          </div>
          <div class="space-y-1.5">
            <Label obrigatorio>Responsável</Label>
            <SeletorUsuario v-model="form.responsavelId" />
            <p v-if="erros.responsavelId" class="text-xs text-erro">{{ erros.responsavelId }}</p>
          </div>
        </div>

        <div class="space-y-3 border-t border-borda pt-4">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium text-texto">Endereço da obra</p>
            <Button
              type="button"
              variante="secundario"
              :disabled="!form.contatoId"
              @click="copiarEnderecoCliente"
            >
              Copiar do cliente
            </Button>
          </div>
          <div class="grid gap-3 sm:grid-cols-6">
            <div class="space-y-1 sm:col-span-2">
              <Label>CEP</Label>
              <Input v-model="form.obraCep" mascara="cep" />
            </div>
            <div class="space-y-1 sm:col-span-4">
              <Label>Rua</Label>
              <Input v-model="form.obraLogradouro" />
            </div>
            <div class="space-y-1 sm:col-span-2">
              <Label>Número</Label>
              <Input v-model="form.obraNumero" />
            </div>
            <div class="space-y-1 sm:col-span-4">
              <Label>Complemento</Label>
              <Input v-model="form.obraComplemento" />
            </div>
            <div class="space-y-1 sm:col-span-2">
              <Label>Bairro</Label>
              <Input v-model="form.obraBairro" />
            </div>
            <div class="space-y-1 sm:col-span-3">
              <Label>Cidade</Label>
              <Input v-model="form.obraCidade" />
            </div>
            <div class="space-y-1 sm:col-span-1">
              <Label>UF</Label>
              <Input v-model="form.obraUf" mascara="uf" placeholder="UF" />
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="space-y-1.5">
          <Label obrigatorio>Pessoa</Label>
          <SeletorContato v-model="form.contatoId" />
          <p v-if="erros.contatoId" class="text-xs text-erro">{{ erros.contatoId }}</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label>Responsável</Label>
            <SeletorUsuario v-model="form.responsavelId" />
          </div>
          <div class="space-y-1.5">
            <Label>Prioridade</Label>
            <Select v-model="form.prioridade" :opcoes="opcoesPrioridade" />
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label>Categoria</Label>
            <SeletorCategoria v-model="form.categoriaId" incluir-vazio rotulo-vazio="Sem categoria" />
          </div>
          <div class="space-y-1.5">
            <Label>Origem</Label>
            <Input v-model="form.origem" placeholder="Ex.: telefone, indicação…" />
          </div>
        </div>
      </template>

      <div class="space-y-1.5">
        <Label>Valor estimado</Label>
        <Input v-model="form.valorEstimado" mascara="moeda" placeholder="0,00" />
      </div>
      <div class="space-y-1.5">
        <Label>Observações</Label>
        <Textarea v-model="form.descricao" :rows="3" placeholder="Contexto do negócio…" />
      </div>
    </form>

    <template #rodape>
      <Button variante="secundario" @click="aberto = false">Cancelar</Button>
      <Button :carregando="salvando" @click="salvar">Criar negócio</Button>
    </template>
  </Dialog>
</template>
