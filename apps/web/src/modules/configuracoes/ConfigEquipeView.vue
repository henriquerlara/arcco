<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Plus, KeyRound, UserX } from 'lucide-vue-next';
import { PERFIL_ROTULOS, PerfilUsuario } from '@arcco/contratos';
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
import { useNotificacao } from '@/composables/useNotificacao';
import { iniciais } from '@/composables/formatadores';

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const formAberto = ref(false);
const salvando = ref(false);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['equipe'],
  queryFn: () => servicoEquipe.listar(),
});

const opcoesPerfil = [
  { valor: PerfilUsuario.GESTOR, rotulo: PERFIL_ROTULOS.GESTOR },
  { valor: PerfilUsuario.VENDEDOR, rotulo: PERFIL_ROTULOS.VENDEDOR },
  { valor: PerfilUsuario.ATENDENTE, rotulo: PERFIL_ROTULOS.ATENDENTE },
];

const colunas: ColunaTabela[] = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'perfil', rotulo: 'Perfil' },
  { chave: 'situacao', rotulo: 'Situação' },
  { chave: 'acoes', rotulo: '', alinhamento: 'direita' },
];

const form = reactive({
  nome: '',
  email: '',
  senhaTemporaria: '',
  perfil: PerfilUsuario.VENDEDOR as string,
});
const erros = reactive<Record<string, string>>({});

const linhas = computed(() => data.value ?? []);

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
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Configurações" descricao="Gerencie os dados e o funcionamento da sua conta.">
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
      <template #celula-acoes="{ linha }">
        <div class="flex justify-end gap-1">
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
  </div>
</template>
