<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Plus, KeyRound, UserX, Shield } from 'lucide-vue-next';
import { PERFIL_ROTULOS, PerfilUsuario, PersonalizacaoComercial } from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import TabelaDados, { type ColunaTabela } from '@/components/compartilhados/TabelaDados.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import { servicoEquipe } from '@/services';
import type { Usuario } from '@/types';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';
import { iniciais } from '@/composables/formatadores';

const auth = useAutenticacaoStore();
const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const formAberto = ref(false);
const permAberto = ref(false);
const salvando = ref(false);
const usuarioPerm = ref<Usuario | null>(null);
const chavesSel = ref<string[]>([]);
const nomeConjunto = ref('');
const conjuntoAplicar = ref('');

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);
const ehAdmin = computed(() => auth.temPerfil(PerfilUsuario.PROPRIETARIO));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['equipe'],
  queryFn: () => servicoEquipe.listar(),
});

const { data: catalogo } = useQuery({
  queryKey: ['permissoes-catalogo'],
  queryFn: () => servicoEquipe.catalogoPermissoes(),
  enabled: ecolume,
});

const { data: conjuntos, refetch: refetchConjuntos } = useQuery({
  queryKey: ['permissoes-conjuntos'],
  queryFn: () => servicoEquipe.listarConjuntos(),
  enabled: computed(() => ecolume.value && ehAdmin.value),
});

const opcoesPerfil = [
  { valor: PerfilUsuario.GESTOR, rotulo: PERFIL_ROTULOS.GESTOR },
  { valor: PerfilUsuario.VENDEDOR, rotulo: PERFIL_ROTULOS.VENDEDOR },
  { valor: PerfilUsuario.ATENDENTE, rotulo: PERFIL_ROTULOS.ATENDENTE },
];

const colunas = computed<ColunaTabela[]>(() => {
  const base: ColunaTabela[] = [
    { chave: 'nome', rotulo: 'Nome' },
    { chave: 'perfil', rotulo: 'Perfil' },
    { chave: 'situacao', rotulo: 'Situação' },
  ];
  if (ecolume.value) base.push({ chave: 'permissoes', rotulo: 'Permissões' });
  base.push({ chave: 'acoes', rotulo: '', alinhamento: 'direita' });
  return base;
});

const form = reactive({
  nome: '',
  email: '',
  senhaTemporaria: '',
  perfil: PerfilUsuario.VENDEDOR as string,
});
const erros = reactive<Record<string, string>>({});

const linhas = computed(() => data.value ?? []);

const opcoesConjuntos = computed(() =>
  (conjuntos.value ?? []).map((c) => ({ valor: c.id, rotulo: c.nome })),
);

function abrirNovo() {
  form.nome = '';
  form.email = '';
  form.senhaTemporaria = '';
  form.perfil = PerfilUsuario.VENDEDOR;
  Object.keys(erros).forEach((k) => delete erros[k]);
  formAberto.value = true;
}

async function criar() {
  Object.keys(erros).forEach((k) => delete erros[k]);
  if (form.nome.trim().length < 2) erros.nome = 'Informe o nome';
  if (!/^\S+@\S+\.\S+$/.test(form.email)) erros.email = 'E-mail inválido';
  if (form.senhaTemporaria.length < 8) erros.senhaTemporaria = 'Mínimo de 8 caracteres';
  if (Object.keys(erros).length) return;

  salvando.value = true;
  try {
    await servicoEquipe.criar({ ...form });
    sucesso('Usuário adicionado.', 'Ele deverá trocar a senha no primeiro acesso.');
    await queryClient.invalidateQueries({ queryKey: ['equipe'] });
    formAberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

async function redefinir(usuario: Usuario) {
  const senha = `Arcco@${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    await servicoEquipe.redefinirSenha(usuario.id, senha);
    sucesso('Senha temporária definida.', `Nova senha: ${senha}`);
  } catch (e) {
    notificarErro(e);
  }
}

async function desativar(usuario: Usuario) {
  try {
    await servicoEquipe.desativar(usuario.id);
    sucesso('Usuário desativado.');
    await queryClient.invalidateQueries({ queryKey: ['equipe'] });
  } catch (e) {
    notificarErro(e);
  }
}

async function abrirPermissoes(usuario: Usuario) {
  if (usuario.perfil === PerfilUsuario.PROPRIETARIO) {
    sucesso('Administrador', 'Acesso total automático — permissões individuais não se aplicam.');
    return;
  }
  try {
    const det = await servicoEquipe.permissoesUsuario(usuario.id);
    usuarioPerm.value = usuario;
    chavesSel.value = [...det.concedidas];
    conjuntoAplicar.value = det.ultimoConjuntoId ?? '';
    nomeConjunto.value = '';
    permAberto.value = true;
  } catch (e) {
    notificarErro(e);
  }
}

function toggleChave(chave: string) {
  const i = chavesSel.value.indexOf(chave);
  if (i >= 0) chavesSel.value.splice(i, 1);
  else chavesSel.value.push(chave);
}

async function salvarPermissoes() {
  if (!usuarioPerm.value) return;
  salvando.value = true;
  try {
    await servicoEquipe.definirPermissoes(usuarioPerm.value.id, chavesSel.value);
    sucesso('Permissões atualizadas.');
    await queryClient.invalidateQueries({ queryKey: ['equipe'] });
    permAberto.value = false;
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

async function salvarComoConjunto() {
  if (!nomeConjunto.value.trim()) {
    notificarErro(new Error('Informe o nome do perfil reutilizável.'));
    return;
  }
  try {
    await servicoEquipe.criarConjunto(nomeConjunto.value.trim(), chavesSel.value);
    sucesso('Perfil salvo.', 'Aplicar a outro usuário não altera quem já recebeu uma cópia.');
    nomeConjunto.value = '';
    await refetchConjuntos();
  } catch (e) {
    notificarErro(e);
  }
}

async function aplicarConjuntoSalvo() {
  if (!usuarioPerm.value || !conjuntoAplicar.value) return;
  salvando.value = true;
  try {
    const det = await servicoEquipe.aplicarConjunto(conjuntoAplicar.value, usuarioPerm.value.id);
    chavesSel.value = [...det.concedidas];
    sucesso('Perfil aplicado (cópia).');
    await queryClient.invalidateQueries({ queryKey: ['equipe'] });
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

function rotuloPerm(u: Usuario): string {
  if (u.perfil === PerfilUsuario.PROPRIETARIO) return 'Acesso total';
  const n = u.permissoesConcedidas?.length ?? 0;
  return n === 0 ? 'Nenhuma' : `${n} chave(s)`;
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Equipe" descricao="Quem acessa a conta e o que cada pessoa pode fazer.">
      <template #acoes>
        <Button @click="abrirNovo"><Plus class="size-4" /> Convidar usuário</Button>
      </template>
    </CabecalhoPagina>
    <NavConfiguracoes />

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />

    <TabelaDados v-else :colunas="colunas" :linhas="linhas" :carregando="isLoading">
      <template #celula-nome="{ linha }">
        <div class="flex items-center gap-3">
          <span class="flex size-8 items-center justify-center rounded-full bg-marfim text-xs font-semibold text-texto-secundario">
            {{ iniciais((linha as Usuario).nome) }}
          </span>
          <div>
            <p class="font-medium text-texto">{{ (linha as Usuario).nome }}</p>
            <p class="text-xs text-texto-secundario">{{ (linha as Usuario).email }}</p>
          </div>
        </div>
      </template>
      <template #celula-perfil="{ linha }">
        <Badge variante="dourado">{{ PERFIL_ROTULOS[(linha as Usuario).perfil] }}</Badge>
      </template>
      <template #celula-situacao="{ linha }">
        <Badge :variante="(linha as Usuario).ativo ? 'sucesso' : 'neutro'">
          {{ (linha as Usuario).ativo ? 'Ativo' : 'Inativo' }}
        </Badge>
      </template>
      <template #celula-permissoes="{ linha }">
        <span class="text-sm text-texto-secundario">{{ rotuloPerm(linha as Usuario) }}</span>
      </template>
      <template #celula-acoes="{ linha }">
        <div class="flex justify-end gap-1">
          <Button
            v-if="ecolume && ehAdmin"
            variante="fantasma"
            tamanho="icone-sm"
            title="Permissões"
            @click="abrirPermissoes(linha as Usuario)"
          >
            <Shield class="size-4" />
          </Button>
          <Button variante="fantasma" tamanho="icone-sm" title="Redefinir senha" @click="redefinir(linha as Usuario)">
            <KeyRound class="size-4" />
          </Button>
          <Button
            v-if="(linha as Usuario).perfil !== 'PROPRIETARIO'"
            variante="fantasma"
            tamanho="icone-sm"
            title="Desativar"
            @click="desativar(linha as Usuario)"
          >
            <UserX class="size-4 text-erro" />
          </Button>
        </div>
      </template>
    </TabelaDados>

    <Dialog v-model="formAberto" titulo="Convidar usuário" descricao="Defina uma senha temporária para o primeiro acesso." tamanho="md">
      <form class="space-y-4" @submit.prevent="criar">
        <div class="space-y-1.5">
          <Label obrigatorio>Nome</Label>
          <Input v-model="form.nome" :invalido="!!erros.nome" />
          <p v-if="erros.nome" class="text-xs text-erro">{{ erros.nome }}</p>
        </div>
        <div class="space-y-1.5">
          <Label obrigatorio>E-mail</Label>
          <Input v-model="form.email" type="email" :invalido="!!erros.email" />
          <p v-if="erros.email" class="text-xs text-erro">{{ erros.email }}</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label obrigatorio>Senha temporária</Label>
            <Input v-model="form.senhaTemporaria" :invalido="!!erros.senhaTemporaria" />
            <p v-if="erros.senhaTemporaria" class="text-xs text-erro">{{ erros.senhaTemporaria }}</p>
          </div>
          <div class="space-y-1.5">
            <Label>Perfil</Label>
            <Select v-model="form.perfil" :opcoes="opcoesPerfil" />
          </div>
        </div>
      </form>
      <template #rodape>
        <Button variante="secundario" @click="formAberto = false">Cancelar</Button>
        <Button :carregando="salvando" @click="criar">Adicionar</Button>
      </template>
    </Dialog>

    <Dialog
      v-model="permAberto"
      :titulo="`Permissões · ${usuarioPerm?.nome ?? ''}`"
      descricao="Negadas por padrão. Administrador tem acesso total. Perfis salvos são templates (não sincronizam)."
      tamanho="lg"
    >
      <div class="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <div v-for="grupo in catalogo?.grupos ?? []" :key="grupo.id" class="space-y-2">
          <p class="text-sm font-medium text-texto">{{ grupo.rotulo }}</p>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="chave in grupo.chaves"
              :key="chave"
              class="flex items-center gap-1.5 rounded-md border border-borda px-2 py-1 text-xs"
            >
              <input
                type="checkbox"
                :checked="chavesSel.includes(chave)"
                @change="toggleChave(chave)"
              />
              {{ chave }}
            </label>
          </div>
        </div>
        <div class="grid gap-3 border-t border-borda pt-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label>Salvar como perfil</Label>
            <div class="flex gap-2">
              <Input v-model="nomeConjunto" placeholder="Nome do perfil" />
              <Button variante="secundario" @click="salvarComoConjunto">Salvar</Button>
            </div>
          </div>
          <div class="space-y-1.5">
            <Label>Aplicar perfil existente</Label>
            <div class="flex gap-2">
              <Select v-model="conjuntoAplicar" :opcoes="opcoesConjuntos" />
              <Button variante="secundario" @click="aplicarConjuntoSalvo">Aplicar</Button>
            </div>
          </div>
        </div>
      </div>
      <template #rodape>
        <Button variante="secundario" @click="permAberto = false">Cancelar</Button>
        <Button :carregando="salvando" @click="salvarPermissoes">Salvar permissões</Button>
      </template>
    </Dialog>
  </div>
</template>
