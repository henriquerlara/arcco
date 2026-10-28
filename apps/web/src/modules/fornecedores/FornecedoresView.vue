<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Plus, Pencil, Trash2 } from 'lucide-vue-next';
import { PerfilUsuario, PermissaoComercial } from '@arcco/contratos';
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
import type { Fornecedor } from '@/types';
import { servicoFornecedores } from '@/services/fornecedores';
import { aplicarMascara } from '@/composables/formatadores';
import { useNotificacao } from '@/composables/useNotificacao';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const props = withDefaults(defineProps<{ embutido?: boolean }>(), { embutido: false });

const queryClient = useQueryClient();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();

const podeEditar = computed(() =>
  auth.temPerfil(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR),
);
const podeExcluir = computed(() =>
  auth.temPerfil(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR),
);
const podeVerSt = computed(() => auth.temPermissaoComercial(PermissaoComercial.VER_CUSTOS));

const busca = ref('');
const formAberto = ref(false);
const salvando = ref(false);
const excluindo = ref(false);
const editando = ref<Fornecedor | null>(null);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['fornecedores', busca.value.trim()]),
  queryFn: () => servicoFornecedores.listar(busca.value.trim() || undefined),
});
const linhas = computed(() => data.value ?? []);

const form = reactive({
  nome: '',
  nomeCurto: '',
  cnpj: '',
  aliquotaSt: 0,
  contatoNome: '',
  telefone: '',
  email: '',
  observacoes: '',
  ativo: true,
});

function abrirNovo() {
  editando.value = null;
  Object.assign(form, {
    nome: '',
    nomeCurto: '',
    cnpj: '',
    aliquotaSt: 0,
    contatoNome: '',
    telefone: '',
    email: '',
    observacoes: '',
    ativo: true,
  });
  formAberto.value = true;
}

function abrirEdicao(f: Fornecedor) {
  editando.value = f;
  Object.assign(form, {
    nome: f.nome,
    nomeCurto: f.nomeCurto ?? '',
    cnpj: f.cnpj,
    aliquotaSt: f.aliquotaSt ?? 0,
    contatoNome: f.contatoNome ?? '',
    telefone: f.telefone ?? '',
    email: f.email ?? '',
    observacoes: f.observacoes ?? '',
    ativo: f.ativo,
  });
  formAberto.value = true;
}

function formatarCnpj(valor: string): string {
  return aplicarMascara('cnpj', valor);
}

async function salvar() {
  if (form.nome.trim().length < 2) return;
  if (form.cnpj.replace(/\D/g, '').length < 14) return;
  if (podeVerSt.value && (form.aliquotaSt < 0 || form.aliquotaSt > 100)) return;
  salvando.value = true;
  try {
    const payload = {
      nome: form.nome.trim(),
      nomeCurto: form.nomeCurto.trim() || null,
      cnpj: form.cnpj,
      aliquotaSt: Number(form.aliquotaSt) || 0,
      contatoNome: form.contatoNome.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      observacoes: form.observacoes.trim() || null,
      ativo: form.ativo,
    };
    if (editando.value) {
      const corpo: Partial<typeof payload> = { ...payload };
      if (!podeVerSt.value) delete corpo.aliquotaSt;
      await servicoFornecedores.atualizar(editando.value.id, corpo);
    } else {
      await servicoFornecedores.criar(payload);
    }
    sucesso('Fornecedor salvo.');
    await queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    formAberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

async function excluir(f: Fornecedor) {
  if (!podeExcluir.value) return;
  if (!confirm(`Excluir o fornecedor ${f.nome}?`)) return;
  excluindo.value = true;
  try {
    await servicoFornecedores.remover(f.id);
    sucesso('Fornecedor excluído.');
    await queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
  } catch (e) {
    notificarErro(e);
  } finally {
    excluindo.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina
      v-if="!props.embutido"
      titulo="Fornecedores"
      descricao="Cadastro com CNPJ e ST% para compras e XML futuros."
    >
      <template #acoes>
        <Button v-if="podeEditar" @click="abrirNovo"><Plus class="size-4" /> Novo fornecedor</Button>
      </template>
    </CabecalhoPagina>
    <div v-else class="flex justify-end">
      <Button v-if="podeEditar" @click="abrirNovo"><Plus class="size-4" /> Novo fornecedor</Button>
    </div>

    <div class="max-w-sm">
      <Input v-model="busca" placeholder="Buscar por nome ou CNPJ" />
    </div>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
    <div v-else-if="isLoading" class="grid gap-3 sm:grid-cols-2">
      <Skeleton v-for="n in 4" :key="n" class="h-24" />
    </div>
    <EstadoVazio
      v-else-if="linhas.length === 0"
      titulo="Nenhum fornecedor"
      descricao="Cadastre o emitente da nota com ST% para usar nas compras."
    >
      <template v-if="podeEditar" #acao>
        <Button @click="abrirNovo"><Plus class="size-4" /> Novo fornecedor</Button>
      </template>
    </EstadoVazio>
    <div v-else class="grid gap-3 sm:grid-cols-2">
      <Card v-for="f in linhas" :key="f.id" class="p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-texto">{{ f.nomeCurto || f.nome }}</p>
              <Badge v-if="!f.ativo" variante="neutro">Inativo</Badge>
            </div>
            <p v-if="f.nomeCurto" class="mt-0.5 text-sm text-texto-secundario">{{ f.nome }}</p>
            <p class="mt-1 text-sm text-texto-secundario">{{ formatarCnpj(f.cnpj) }}</p>
            <p v-if="podeVerSt && f.aliquotaSt != null" class="mt-1 text-xs text-texto-secundario">
              ST {{ f.aliquotaSt }}%
            </p>
            <p v-if="f.contatoNome || f.telefone || f.email" class="mt-1 text-xs text-texto-secundario">
              {{ [f.contatoNome, f.telefone, f.email].filter(Boolean).join(' · ') }}
            </p>
          </div>
          <div class="flex shrink-0 gap-1">
            <Button
              v-if="podeEditar"
              variante="fantasma"
              tamanho="icone-sm"
              @click="abrirEdicao(f)"
            >
              <Pencil class="size-4" />
            </Button>
            <Button
              v-if="podeExcluir"
              variante="fantasma"
              tamanho="icone-sm"
              :disabled="excluindo"
              @click="excluir(f)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <Dialog v-model="formAberto" :titulo="editando ? 'Editar fornecedor' : 'Novo fornecedor'">
      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="salvar">
        <div class="space-y-1.5 sm:col-span-2">
          <Label obrigatorio>Nome / razão social</Label>
          <Input v-model="form.nome" />
        </div>
        <div class="space-y-1.5">
          <Label>Nome curto</Label>
          <Input v-model="form.nomeCurto" maxlength="60" />
        </div>
        <div class="space-y-1.5">
          <Label obrigatorio>CNPJ</Label>
          <Input v-model="form.cnpj" mascara="cnpj" placeholder="00.000.000/0000-00" />
        </div>
        <div v-if="podeVerSt || !editando" class="space-y-1.5">
          <Label obrigatorio>ST %</Label>
          <Input v-model.number="form.aliquotaSt" type="number" min="0" max="100" step="0.0001" />
          <p class="text-xs text-texto-secundario">Obrigatório; zero permitido. Não altera preço de venda.</p>
        </div>
        <div class="space-y-1.5">
          <Label>Contato</Label>
          <Input v-model="form.contatoNome" />
        </div>
        <div class="space-y-1.5">
          <Label>Telefone</Label>
          <Input v-model="form.telefone" mascara="telefone" placeholder="(11) 90000-0000" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label>E-mail</Label>
          <Input v-model="form.email" type="email" />
        </div>
        <div class="space-y-1.5 sm:col-span-2">
          <Label>Observações</Label>
          <Textarea v-model="form.observacoes" :rows="2" />
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
