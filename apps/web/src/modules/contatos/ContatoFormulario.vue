<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import {
  NaturezaPessoa,
  PersonalizacaoComercial,
  PermissaoComercial,
  RT_PADRAO_PARCEIRO,
  TipoContato,
  TipoParceiro,
  cpfValido,
  cnpjValido,
} from '@arcco/contratos';
import type { Contato, PessoaEmpresaContato } from '@/types';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import FormularioCamposPersonalizados from '@/components/formularios/FormularioCamposPersonalizados.vue';
import { servicoContatos } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { ROTULO_TIPO_CONTATO, opcoesDe } from '@/composables/rotulos';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { ErroRequisicao } from '@/services/http';

const props = defineProps<{
  modelValue: boolean;
  contato?: Contato | null;
  /** Abre o formulário já marcado como parceiro (aba Parceiros). */
  marcarParceiro?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: boolean): void;
  (e: 'salvo', contato: Contato): void;
}>();

const queryClient = useQueryClient();
const router = useRouter();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);
const buscandoCep = ref(false);
const duplicidade = ref<{ id: string; nome: string; motivo: string } | null>(null);

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);

const opcoesTipo = opcoesDe(ROTULO_TIPO_CONTATO).map((o) => ({
  valor: o.valor,
  rotulo: o.rotulo,
}));

const opcoesNatureza = [
  { valor: NaturezaPessoa.PF, rotulo: 'Pessoa física' },
  { valor: NaturezaPessoa.PJ, rotulo: 'Pessoa jurídica' },
];

const opcoesTipoParceiro = [
  { valor: TipoParceiro.ARQUITETO_DESIGNER, rotulo: 'Arquiteto/Designer' },
  { valor: TipoParceiro.INSTALADOR_ELETRICISTA, rotulo: 'Instalador/Eletricista' },
  { valor: TipoParceiro.CONSTRUTORA, rotulo: 'Construtora' },
];

const podeVerPagamentos = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.VER_PAGAMENTOS),
);
const podeVerComissoes = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.VER_COMISSOES),
);

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const ehEdicao = computed(() => !!props.contato);

const form = reactive({
  nome: '',
  telefone: '',
  email: '',
  tipo: TipoContato.OUTRO as string,
  empresaNome: '',
  documento: '',
  origem: '',
  observacoes: '',
  responsavelId: null as string | null,
  dadosPersonalizados: {} as Record<string, unknown>,
  natureza: NaturezaPessoa.PF as string,
  nomeFantasia: '',
  inscricaoEstadual: '',
  ieIsento: false,
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  telefonesExtras: [] as string[],
  pessoasEmpresa: [] as PessoaEmpresaContato[],
  ehParceiro: false,
  tipoParceiro: '' as string,
  rtPadrao: String(RT_PADRAO_PARCEIRO),
  chavePix: '',
  banco: '',
  agencia: '',
  conta: '',
  titularNome: '',
  titularDocumento: '',
  observacoesParceria: '',
});

const erros = reactive<Record<string, string>>({});

watch(
  () => props.modelValue,
  (abertoAgora) => {
    if (!abertoAgora) return;
    const c = props.contato;
    form.nome = c?.nome ?? '';
    form.telefone = c?.telefone ?? '';
    form.email = c?.email ?? '';
    form.tipo = c?.tipo ?? TipoContato.OUTRO;
    form.empresaNome = c?.empresaNome ?? '';
    form.documento = c?.documento ?? '';
    form.origem = c?.origem ?? '';
    form.observacoes = c?.observacoes ?? '';
    form.responsavelId = c?.responsavelId ?? null;
    form.dadosPersonalizados = { ...(c?.dadosPersonalizados ?? {}) };
    form.natureza = c?.natureza ?? NaturezaPessoa.PF;
    form.nomeFantasia = c?.nomeFantasia ?? c?.empresaNome ?? '';
    form.inscricaoEstadual = c?.inscricaoEstadual ?? '';
    form.ieIsento = Boolean(c?.ieIsento);
    form.cep = c?.cep ?? '';
    form.logradouro = c?.logradouro ?? '';
    form.numero = c?.numero ?? '';
    form.complemento = c?.complemento ?? '';
    form.bairro = c?.bairro ?? '';
    form.cidade = c?.cidade ?? '';
    form.uf = c?.uf ?? '';
    form.telefonesExtras = (c?.telefonesExtras ?? []).map((t) => t.numero);
    form.pessoasEmpresa = (c?.pessoasEmpresa ?? []).map((p) => ({ ...p }));
    form.ehParceiro = Boolean(c?.ehParceiro) || Boolean(props.marcarParceiro && !c);
    form.tipoParceiro = c?.tipoParceiro ?? '';
    form.rtPadrao =
      c?.rtPadrao != null ? String(c.rtPadrao) : String(RT_PADRAO_PARCEIRO);
    form.chavePix = c?.chavePix ?? '';
    form.banco = c?.banco ?? '';
    form.agencia = c?.agencia ?? '';
    form.conta = c?.conta ?? '';
    form.titularNome = c?.titularNome ?? '';
    form.titularDocumento = c?.titularDocumento ?? '';
    form.observacoesParceria = c?.observacoesParceria ?? '';
    duplicidade.value = null;
    Object.keys(erros).forEach((k) => delete erros[k]);
  },
);

function validar(): boolean {
  Object.keys(erros).forEach((k) => delete erros[k]);
  if (form.nome.trim().length < 2) {
    erros.nome = ecolume.value && form.natureza === NaturezaPessoa.PJ
      ? 'Informe a razão social'
      : 'Informe o nome';
  }
  if (form.telefone.replace(/\D/g, '').length < 8) erros.telefone = 'Informe um telefone válido';
  const digitos = form.documento.replace(/\D/g, '');
  if (digitos) {
    if (digitos.length === 11 && !cpfValido(digitos)) erros.documento = 'CPF inválido';
    else if (digitos.length === 14 && !cnpjValido(digitos)) erros.documento = 'CNPJ inválido';
    else if (digitos.length !== 11 && digitos.length !== 14) erros.documento = 'CPF ou CNPJ inválido';
    else if (ecolume.value && form.natureza === NaturezaPessoa.PF && digitos.length !== 11) {
      erros.documento = 'PF deve usar CPF';
    } else if (ecolume.value && form.natureza === NaturezaPessoa.PJ && digitos.length !== 14) {
      erros.documento = 'PJ deve usar CNPJ';
    }
  }
  if (ecolume.value && form.ehParceiro) {
    if (!form.tipoParceiro) erros.tipoParceiro = 'Informe o tipo de parceiro';
    const rt = Number(String(form.rtPadrao).replace(',', '.'));
    if (Number.isNaN(rt) || rt < 0 || rt > 100) erros.rtPadrao = 'RT inválida (0 a 100)';
    const digTitular = form.titularDocumento.replace(/\D/g, '');
    if (digTitular) {
      if (digTitular.length === 11 && !cpfValido(digTitular)) {
        erros.titularDocumento = 'CPF do titular inválido';
      } else if (digTitular.length === 14 && !cnpjValido(digTitular)) {
        erros.titularDocumento = 'CNPJ do titular inválido';
      } else if (digTitular.length !== 11 && digTitular.length !== 14) {
        erros.titularDocumento = 'Documento do titular inválido';
      }
    }
  }
  return Object.keys(erros).length === 0;
}

async function buscarCep() {
  const cep = form.cep.replace(/\D/g, '');
  if (cep.length !== 8) return;
  buscandoCep.value = true;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!resp.ok) return;
    const dados = (await resp.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (dados.erro) return;
    if (dados.logradouro) form.logradouro = dados.logradouro;
    if (dados.bairro) form.bairro = dados.bairro;
    if (dados.localidade) form.cidade = dados.localidade;
    if (dados.uf) form.uf = dados.uf;
  } catch {
    /* CEP manual permanece editável */
  } finally {
    buscandoCep.value = false;
  }
}

function adicionarTelefoneExtra() {
  form.telefonesExtras.push('');
}

function removerTelefoneExtra(i: number) {
  form.telefonesExtras.splice(i, 1);
}

function adicionarPessoa() {
  form.pessoasEmpresa.push({ nome: '', cargo: '', telefone: '', email: '' });
}

function removerPessoa(i: number) {
  form.pessoasEmpresa.splice(i, 1);
}

function abrirDuplicado() {
  if (!duplicidade.value) return;
  aberto.value = false;
  const rota = ecolume.value ? 'cliente-detalhe' : 'contato-detalhe';
  void router.push({ name: rota, params: { id: duplicidade.value.id } });
}

async function salvar() {
  if (!validar()) return;
  salvando.value = true;
  duplicidade.value = null;
  try {
    const payload: Record<string, unknown> = {
      nome: form.nome,
      telefone: form.telefone,
      email: form.email || undefined,
      documento: form.documento || null,
      origem: form.origem || undefined,
      observacoes: form.observacoes || undefined,
      responsavelId: form.responsavelId,
      dadosPersonalizados: form.dadosPersonalizados,
    };

    if (ecolume.value) {
      payload.natureza = form.natureza;
      payload.nomeFantasia = form.nomeFantasia || null;
      payload.empresaNome = form.nomeFantasia || undefined;
      payload.inscricaoEstadual = form.ieIsento ? null : form.inscricaoEstadual || null;
      payload.ieIsento = form.ieIsento;
      payload.cep = form.cep || null;
      payload.logradouro = form.logradouro || null;
      payload.numero = form.numero || null;
      payload.complemento = form.complemento || null;
      payload.bairro = form.bairro || null;
      payload.cidade = form.cidade || null;
      payload.uf = form.uf || null;
      payload.telefonesExtras = form.telefonesExtras
        .filter((t) => t.replace(/\D/g, '').length >= 8)
        .map((numero) => ({ numero }));
      if (form.natureza === NaturezaPessoa.PJ) {
        payload.pessoasEmpresa = form.pessoasEmpresa
          .filter((p) => p.nome.trim().length >= 2)
          .map((p) => ({
            nome: p.nome,
            cargo: p.cargo || null,
            telefone: p.telefone || null,
            email: p.email || null,
          }));
      } else {
        payload.pessoasEmpresa = [];
      }
      payload.tipo =
        form.natureza === NaturezaPessoa.PJ ? TipoContato.EMPRESA : TipoContato.OUTRO;
      payload.ehParceiro = form.ehParceiro;
      if (form.ehParceiro) {
        payload.tipoParceiro = form.tipoParceiro;
        payload.observacoesParceria = form.observacoesParceria || null;
        if (podeVerComissoes.value) {
          payload.rtPadrao = Number(String(form.rtPadrao).replace(',', '.'));
        } else if (!ehEdicao.value) {
          payload.rtPadrao = RT_PADRAO_PARCEIRO;
        }
        if (podeVerPagamentos.value) {
          payload.chavePix = form.chavePix || null;
          payload.banco = form.banco || null;
          payload.agencia = form.agencia || null;
          payload.conta = form.conta || null;
          payload.titularNome = form.titularNome || null;
          payload.titularDocumento = form.titularDocumento || null;
        }
      }
    } else {
      payload.tipo = form.tipo as TipoContato;
      payload.empresaNome = form.empresaNome || undefined;
    }

    const salvo = ehEdicao.value
      ? await servicoContatos.atualizar(props.contato!.id, payload)
      : await servicoContatos.criar(payload);
    sucesso(
      ehEdicao.value
        ? ecolume.value
          ? 'Cliente atualizado.'
          : 'Pessoa atualizada.'
        : ecolume.value
          ? 'Cliente criado.'
          : 'Pessoa criada.',
    );
    await queryClient.invalidateQueries({ queryKey: ['contatos'] });
    emit('salvo', salvo);
    aberto.value = false;
  } catch (e) {
    if (e instanceof ErroRequisicao && e.codigo === 'CONTATO_DUPLICADO') {
      const detalhes = e.detalhes as
        | { motivo?: string; contato?: { id: string; nome: string } }
        | undefined;
      if (detalhes?.contato?.id) {
        duplicidade.value = {
          id: detalhes.contato.id,
          nome: detalhes.contato.nome,
          motivo: detalhes.motivo === 'documento' ? 'CPF/CNPJ' : 'telefone',
        };
        return;
      }
    }
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <Dialog
    v-model="aberto"
    :titulo="
      ehEdicao
        ? ecolume
          ? 'Editar cliente'
          : 'Editar pessoa'
        : ecolume
          ? 'Novo cliente'
          : 'Nova pessoa'
    "
    :descricao="
      ecolume
        ? 'Cadastro de cliente pessoa física ou jurídica.'
        : 'Dados de quem participa dos negócios e projetos.'
    "
    tamanho="lg"
  >
    <form class="space-y-4" @submit.prevent="salvar">
      <div
        v-if="duplicidade"
        class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        <p>
          Já existe um cadastro com este {{ duplicidade.motivo }}:
          <strong>{{ duplicidade.nome }}</strong>.
        </p>
        <Button type="button" variante="secundario" class="mt-2" @click="abrirDuplicado">
          Abrir cadastro existente
        </Button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <template v-if="ecolume">
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="contato-natureza" obrigatorio>Tipo</Label>
            <Select id="contato-natureza" v-model="form.natureza" :opcoes="opcoesNatureza" />
          </div>
          <div class="space-y-1.5">
            <Label for="contato-nome" obrigatorio>
              {{ form.natureza === 'PJ' ? 'Razão social' : 'Nome' }}
            </Label>
            <Input id="contato-nome" v-model="form.nome" :invalido="!!erros.nome" autocomplete="name" />
            <p v-if="erros.nome" class="text-xs text-erro">{{ erros.nome }}</p>
          </div>
          <div class="space-y-1.5">
            <Label for="contato-telefone" obrigatorio>Telefone</Label>
            <Input
              id="contato-telefone"
              v-model="form.telefone"
              mascara="telefone"
              placeholder="(11) 90000-0000"
              :invalido="!!erros.telefone"
              autocomplete="tel"
            />
            <p v-if="erros.telefone" class="text-xs text-erro">{{ erros.telefone }}</p>
          </div>
          <div v-if="form.natureza === 'PJ'" class="space-y-1.5">
            <Label for="contato-fantasia">Nome fantasia</Label>
            <Input id="contato-fantasia" v-model="form.nomeFantasia" autocomplete="organization" />
          </div>
          <div class="space-y-1.5">
            <Label for="contato-documento">{{ form.natureza === 'PJ' ? 'CNPJ' : 'CPF' }}</Label>
            <Input
              id="contato-documento"
              v-model="form.documento"
              :mascara="form.natureza === 'PJ' ? 'cnpj' : 'cpf'"
              :placeholder="form.natureza === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'"
              :invalido="!!erros.documento"
              autocomplete="off"
            />
            <p v-if="erros.documento" class="text-xs text-erro">{{ erros.documento }}</p>
            <p class="text-xs text-texto-secundario">Opcional no cadastro; obrigatório só na emissão de NF.</p>
          </div>
          <div class="space-y-1.5">
            <Label for="contato-email">E-mail</Label>
            <Input id="contato-email" v-model="form.email" type="email" autocomplete="email" />
          </div>
          <div v-if="form.natureza === 'PJ'" class="space-y-1.5 sm:col-span-2">
            <div class="flex items-center gap-3">
              <Label for="contato-ie">Inscrição estadual</Label>
              <label class="flex items-center gap-2 text-sm text-texto-secundario">
                <input id="contato-ie-isento" v-model="form.ieIsento" type="checkbox" class="rounded border-borda" />
                Isento
              </label>
            </div>
            <Input
              id="contato-ie"
              v-model="form.inscricaoEstadual"
              mascara="ie"
              :disabled="form.ieIsento"
              placeholder="Número da IE"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="contato-origem">Chegou por</Label>
            <Input id="contato-origem" v-model="form.origem" placeholder="Indicação, site…" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label>Responsável</Label>
            <SeletorUsuario v-model="form.responsavelId" incluir-vazio rotulo-vazio="Sem responsável" />
          </div>
        </template>

        <template v-else>
          <div class="space-y-1.5">
            <Label for="contato-nome" obrigatorio>Nome</Label>
            <Input id="contato-nome" v-model="form.nome" :invalido="!!erros.nome" autocomplete="name" />
            <p v-if="erros.nome" class="text-xs text-erro">{{ erros.nome }}</p>
          </div>
          <div class="space-y-1.5">
            <Label for="contato-telefone" obrigatorio>Telefone</Label>
            <Input
              id="contato-telefone"
              v-model="form.telefone"
              mascara="telefone"
              placeholder="(11) 90000-0000"
              :invalido="!!erros.telefone"
              autocomplete="tel"
            />
            <p v-if="erros.telefone" class="text-xs text-erro">{{ erros.telefone }}</p>
          </div>
          <div class="space-y-1.5">
            <Label for="contato-email">E-mail</Label>
            <Input id="contato-email" v-model="form.email" type="email" autocomplete="email" />
          </div>
          <div class="space-y-1.5">
            <Label for="contato-tipo">Tipo</Label>
            <Select id="contato-tipo" v-model="form.tipo" :opcoes="opcoesTipo" />
          </div>
          <div class="space-y-1.5">
            <Label for="contato-empresa">Empresa</Label>
            <Input id="contato-empresa" v-model="form.empresaNome" autocomplete="organization" />
          </div>
          <div class="space-y-1.5">
            <Label for="contato-documento">CPF/CNPJ</Label>
            <Input
              id="contato-documento"
              v-model="form.documento"
              mascara="documento"
              placeholder="000.000.000-00"
              :invalido="!!erros.documento"
              autocomplete="off"
            />
            <p v-if="erros.documento" class="text-xs text-erro">{{ erros.documento }}</p>
          </div>
          <div class="space-y-1.5">
            <Label for="contato-origem">Origem</Label>
            <Input id="contato-origem" v-model="form.origem" placeholder="WhatsApp, indicação…" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label>Responsável</Label>
            <SeletorUsuario v-model="form.responsavelId" incluir-vazio rotulo-vazio="Sem responsável" />
          </div>
        </template>

        <div class="space-y-1.5 sm:col-span-2">
          <Label for="contato-observacoes">Observações</Label>
          <Textarea id="contato-observacoes" v-model="form.observacoes" />
        </div>
      </div>

      <template v-if="ecolume">
        <div class="space-y-3 border-t border-borda pt-4">
          <label class="flex items-center gap-2 text-sm font-medium text-texto">
            <input v-model="form.ehParceiro" type="checkbox" class="rounded border-borda" />
            É parceiro
          </label>
          <template v-if="form.ehParceiro">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="contato-tipo-parceiro" obrigatorio>Tipo de parceiro</Label>
                <Select
                  id="contato-tipo-parceiro"
                  v-model="form.tipoParceiro"
                  :opcoes="[{ valor: '', rotulo: 'Selecione' }, ...opcoesTipoParceiro]"
                />
                <p v-if="erros.tipoParceiro" class="text-xs text-erro">{{ erros.tipoParceiro }}</p>
              </div>
              <div v-if="podeVerComissoes" class="space-y-1.5">
                <Label for="contato-rt" obrigatorio>RT padrão (%)</Label>
                <Input id="contato-rt" v-model="form.rtPadrao" :invalido="!!erros.rtPadrao" />
                <p v-if="erros.rtPadrao" class="text-xs text-erro">{{ erros.rtPadrao }}</p>
                <p class="text-xs text-texto-secundario">
                  Padrão inicial {{ RT_PADRAO_PARCEIRO }}% (parâmetro geral: ECOL-02).
                </p>
              </div>
              <div v-if="podeVerPagamentos" class="space-y-1.5 sm:col-span-2">
                <Label for="contato-pix">Chave Pix</Label>
                <Input id="contato-pix" v-model="form.chavePix" autocomplete="off" />
              </div>
              <template v-if="podeVerPagamentos">
                <div class="space-y-1.5">
                  <Label for="contato-banco">Banco</Label>
                  <Input id="contato-banco" v-model="form.banco" />
                </div>
                <div class="space-y-1.5">
                  <Label for="contato-agencia">Agência</Label>
                  <Input id="contato-agencia" v-model="form.agencia" mascara="ie" maxlength="6" />
                </div>
                <div class="space-y-1.5">
                  <Label for="contato-conta">Conta</Label>
                  <Input id="contato-conta" v-model="form.conta" mascara="ie" maxlength="20" />
                </div>
                <div class="space-y-1.5">
                  <Label for="contato-titular">Nome do titular</Label>
                  <Input id="contato-titular" v-model="form.titularNome" />
                </div>
                <div class="space-y-1.5 sm:col-span-2">
                  <Label for="contato-titular-doc">CPF/CNPJ do titular</Label>
                  <Input
                    id="contato-titular-doc"
                    v-model="form.titularDocumento"
                    mascara="documento"
                    :invalido="!!erros.titularDocumento"
                    autocomplete="off"
                  />
                  <p v-if="erros.titularDocumento" class="text-xs text-erro">
                    {{ erros.titularDocumento }}
                  </p>
                </div>
              </template>
              <div class="space-y-1.5 sm:col-span-2">
                <Label for="contato-obs-parceria">Observações da parceria</Label>
                <Textarea id="contato-obs-parceria" v-model="form.observacoesParceria" />
              </div>
            </div>
          </template>
        </div>

        <div class="space-y-3 border-t border-borda pt-4">
          <p class="text-sm font-medium text-texto">Endereço do cliente</p>
          <p class="text-xs text-texto-secundario">Independente do endereço da obra.</p>
          <div class="grid gap-4 sm:grid-cols-6">
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="contato-cep">CEP</Label>
              <div class="flex gap-2">
                <Input id="contato-cep" v-model="form.cep" mascara="cep" placeholder="00000-000" />
                <Button type="button" variante="secundario" :carregando="buscandoCep" @click="buscarCep">
                  Buscar
                </Button>
              </div>
            </div>
            <div class="space-y-1.5 sm:col-span-4">
              <Label for="contato-logradouro">Rua</Label>
              <Input id="contato-logradouro" v-model="form.logradouro" />
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="contato-numero">Número</Label>
              <Input id="contato-numero" v-model="form.numero" />
            </div>
            <div class="space-y-1.5 sm:col-span-4">
              <Label for="contato-complemento">Complemento</Label>
              <Input id="contato-complemento" v-model="form.complemento" />
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="contato-bairro">Bairro</Label>
              <Input id="contato-bairro" v-model="form.bairro" />
            </div>
            <div class="space-y-1.5 sm:col-span-3">
              <Label for="contato-cidade">Cidade</Label>
              <Input id="contato-cidade" v-model="form.cidade" />
            </div>
            <div class="space-y-1.5 sm:col-span-1">
              <Label for="contato-uf">UF</Label>
              <Input id="contato-uf" v-model="form.uf" mascara="uf" placeholder="UF" />
            </div>
          </div>
        </div>

        <div class="space-y-3 border-t border-borda pt-4">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-texto">Telefones adicionais</p>
            <Button type="button" variante="secundario" @click="adicionarTelefoneExtra">Adicionar</Button>
          </div>
          <div v-for="(_, i) in form.telefonesExtras" :key="i" class="flex gap-2">
            <Input v-model="form.telefonesExtras[i]" mascara="telefone" placeholder="(11) 90000-0000" />
            <Button type="button" variante="secundario" @click="removerTelefoneExtra(i)">Remover</Button>
          </div>
        </div>

        <div v-if="form.natureza === 'PJ'" class="space-y-3 border-t border-borda pt-4">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-texto">Contatos da empresa</p>
            <Button type="button" variante="secundario" @click="adicionarPessoa">Adicionar</Button>
          </div>
          <div
            v-for="(pessoa, i) in form.pessoasEmpresa"
            :key="i"
            class="grid gap-2 rounded-md border border-borda p-3 sm:grid-cols-2"
          >
            <Input v-model="pessoa.nome" placeholder="Nome" />
            <Input v-model="pessoa.cargo" placeholder="Cargo" />
            <Input v-model="pessoa.telefone" mascara="telefone" placeholder="Telefone" />
            <div class="flex gap-2">
              <Input v-model="pessoa.email" type="email" placeholder="E-mail" class="flex-1" />
              <Button type="button" variante="secundario" @click="removerPessoa(i)">Remover</Button>
            </div>
          </div>
        </div>
      </template>

      <div class="border-t border-borda pt-4">
        <FormularioCamposPersonalizados
          entidade="CONTATO"
          v-model="form.dadosPersonalizados"
        />
      </div>
    </form>

    <template #rodape>
      <Button variante="secundario" @click="aberto = false">Cancelar</Button>
      <Button :carregando="salvando" @click="salvar">Salvar</Button>
    </template>
  </Dialog>
</template>
