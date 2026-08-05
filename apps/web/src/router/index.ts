import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const rotas: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/app/dashboard',
  },
  {
    path: '/entrar',
    name: 'entrar',
    component: () => import('@/modules/autenticacao/EntrarView.vue'),
    meta: { publico: true, layout: 'auth' },
  },
  {
    path: '/cadastro',
    name: 'cadastro',
    component: () => import('@/modules/autenticacao/CadastroView.vue'),
    meta: { publico: true, layout: 'auth' },
  },
  {
    path: '/trocar-senha',
    name: 'trocar-senha',
    component: () => import('@/modules/autenticacao/TrocarSenhaView.vue'),
    meta: { requerAuth: true, layout: 'auth' },
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/modules/configuracoes/OnboardingView.vue'),
    meta: { requerAuth: true, layout: 'auth' },
  },
  {
    path: '/app',
    component: () => import('@/layouts/AppShell.vue'),
    meta: { requerAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/modules/dashboard/DashboardView.vue'),
        meta: { titulo: 'Painel' },
      },
      {
        path: 'conversas',
        name: 'conversas',
        component: () => import('@/modules/conversas/ConversasView.vue'),
        meta: { titulo: 'Conversas', semPadding: true },
      },
      {
        path: 'pipeline',
        name: 'pipeline',
        component: () => import('@/modules/pipeline/PipelineView.vue'),
        meta: { titulo: 'Pipeline' },
      },
      {
        path: 'contatos',
        name: 'contatos',
        component: () => import('@/modules/contatos/ContatosView.vue'),
        meta: { titulo: 'Contatos' },
      },
      {
        path: 'contatos/:id',
        name: 'contato-detalhe',
        component: () => import('@/modules/contatos/ContatoDetalheView.vue'),
        meta: { titulo: 'Contato' },
      },
      {
        path: 'obras',
        name: 'obras',
        component: () => import('@/modules/obras/ObrasView.vue'),
        meta: { titulo: 'Obras' },
      },
      {
        path: 'obras/:id',
        name: 'obra-detalhe',
        component: () => import('@/modules/obras/ObraDetalheView.vue'),
        meta: { titulo: 'Obra' },
      },
      {
        path: 'oportunidades/:id',
        name: 'oportunidade-detalhe',
        component: () => import('@/modules/oportunidades/OportunidadeDetalheView.vue'),
        meta: { titulo: 'Oportunidade' },
      },
      {
        path: 'configuracoes',
        redirect: { name: 'config-empresa' },
      },
      {
        path: 'configuracoes/empresa',
        name: 'config-empresa',
        component: () => import('@/modules/configuracoes/ConfigEmpresaView.vue'),
        meta: { titulo: 'Configurações · Empresa' },
      },
      {
        path: 'configuracoes/equipe',
        name: 'config-equipe',
        component: () => import('@/modules/configuracoes/ConfigEquipeView.vue'),
        meta: { titulo: 'Configurações · Equipe' },
      },
      {
        path: 'configuracoes/categorias',
        name: 'config-categorias',
        component: () => import('@/modules/configuracoes/ConfigCategoriasView.vue'),
        meta: { titulo: 'Configurações · Categorias' },
      },
      {
        path: 'configuracoes/funil',
        name: 'config-funil',
        component: () => import('@/modules/configuracoes/ConfigFunilView.vue'),
        meta: { titulo: 'Configurações · Funil' },
      },
      {
        path: 'configuracoes/campos',
        name: 'config-campos',
        component: () => import('@/modules/configuracoes/ConfigCamposView.vue'),
        meta: { titulo: 'Configurações · Campos personalizados' },
      },
      {
        path: 'configuracoes/chatbot',
        name: 'config-chatbot',
        component: () => import('@/modules/configuracoes/ConfigChatbotView.vue'),
        meta: { titulo: 'Configurações · Chatbot' },
      },
      {
        path: 'configuracoes/whatsapp',
        name: 'config-whatsapp',
        component: () => import('@/modules/configuracoes/ConfigWhatsAppView.vue'),
        meta: { titulo: 'Configurações · WhatsApp' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'nao-encontrado',
    component: () => import('@/views/NaoEncontradoView.vue'),
    meta: { publico: true, layout: 'auth' },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes: rotas,
  scrollBehavior(_to, _from, salvo) {
    return salvo ?? { top: 0 };
  },
});

router.beforeEach(async (para) => {
  const auth = useAutenticacaoStore();

  if (!auth.sessaoResolvida) {
    await auth.carregarSessao();
  }

  const requerAuth = para.matched.some((r) => r.meta.requerAuth);
  const publico = para.meta.publico === true;

  if (requerAuth && !auth.autenticado) {
    return { name: 'entrar', query: { redirecionar: para.fullPath } };
  }

  if (auth.autenticado) {
    // Bloqueia navegação enquanto senha temporária não for trocada
    if (auth.precisaTrocarSenha && para.name !== 'trocar-senha') {
      return { name: 'trocar-senha' };
    }

    // Força onboarding quando ainda não concluído
    if (
      !auth.precisaTrocarSenha &&
      !auth.onboardingConcluido &&
      requerAuth &&
      para.name !== 'onboarding'
    ) {
      return { name: 'onboarding' };
    }

    // Usuário autenticado não deve ver telas públicas de entrada
    if (publico && (para.name === 'entrar' || para.name === 'cadastro')) {
      return { name: 'dashboard' };
    }
  }

  return true;
});

export default router;
