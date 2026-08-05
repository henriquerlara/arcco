import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { CadastrarInput, EntrarInput, PerfilUsuario } from '@arcco/contratos';
import type { Empresa, Sessao, Usuario } from '@/types';
import { servicoAutenticacao } from '@/services';

export const useAutenticacaoStore = defineStore('autenticacao', () => {
  const usuario = ref<Usuario | null>(null);
  const empresa = ref<Empresa | null>(null);
  const carregandoSessao = ref(true);
  const sessaoResolvida = ref(false);

  const autenticado = computed(() => usuario.value !== null);
  const onboardingConcluido = computed(
    () =>
      empresa.value?.onboardingConcluido ??
      empresa.value?.configuracoes?.onboardingConcluido ??
      false,
  );
  const precisaTrocarSenha = computed(
    () => usuario.value?.deveTrocarSenha ?? usuario.value?.precisaTrocarSenha ?? false,
  );

  function definirSessao(sessao: Sessao) {
    usuario.value = sessao.usuario;
    empresa.value = sessao.empresa;
  }

  function limpar() {
    usuario.value = null;
    empresa.value = null;
  }

  function temPerfil(...perfis: PerfilUsuario[]): boolean {
    return usuario.value ? perfis.includes(usuario.value.perfil) : false;
  }

  async function carregarSessao(): Promise<boolean> {
    carregandoSessao.value = true;
    try {
      const sessao = await servicoAutenticacao.sessao();
      definirSessao(sessao);
      return true;
    } catch {
      limpar();
      return false;
    } finally {
      carregandoSessao.value = false;
      sessaoResolvida.value = true;
    }
  }

  /** Garante que a sessão tenha empresa; busca via `/autenticacao/eu` quando ausente. */
  async function garantirEmpresa(sessao: Sessao): Promise<Sessao> {
    if (sessao.empresa) return sessao;
    const completa = await servicoAutenticacao.sessao();
    definirSessao(completa);
    return completa;
  }

  async function entrar(dados: EntrarInput): Promise<Sessao> {
    const sessao = await servicoAutenticacao.entrar(dados);
    definirSessao(sessao);
    const completa = await garantirEmpresa(sessao);
    sessaoResolvida.value = true;
    return completa;
  }

  async function cadastrar(dados: CadastrarInput): Promise<Sessao> {
    const sessao = await servicoAutenticacao.cadastrar(dados);
    definirSessao(sessao);
    const completa = await garantirEmpresa(sessao);
    sessaoResolvida.value = true;
    return completa;
  }

  async function sair(): Promise<void> {
    try {
      await servicoAutenticacao.sair();
    } finally {
      limpar();
    }
  }

  function marcarOnboardingConcluido() {
    if (empresa.value) empresa.value = { ...empresa.value, onboardingConcluido: true };
  }

  function marcarSenhaTrocada() {
    if (usuario.value) {
      usuario.value = { ...usuario.value, deveTrocarSenha: false, precisaTrocarSenha: false };
    }
  }

  return {
    usuario,
    empresa,
    carregandoSessao,
    sessaoResolvida,
    autenticado,
    onboardingConcluido,
    precisaTrocarSenha,
    definirSessao,
    limpar,
    temPerfil,
    carregarSessao,
    entrar,
    cadastrar,
    sair,
    marcarOnboardingConcluido,
    marcarSenhaTrocada,
  };
});
