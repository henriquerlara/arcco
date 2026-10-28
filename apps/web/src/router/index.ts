import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { PersonalizacaoComercial, rotaOcultaNaPersonalizacao } from '@arcco/contratos';
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
        meta: { titulo: 'Visão geral' },
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
        meta: { titulo: 'Negócios' },
      },
      {
        path: 'agenda',
        name: 'agenda',
        component: () => import('@/modules/atividades/AtividadesView.vue'),
        meta: { titulo: 'Agenda' },
      },
      {
        path: 'contatos',
        name: 'contatos',
        component: () => import('@/modules/contatos/ContatosView.vue'),
        meta: { titulo: 'Pessoas' },
      },
      {
        path: 'contatos/:id',
        name: 'contato-detalhe',
        component: () => import('@/modules/contatos/ContatoDetalheView.vue'),
        meta: { titulo: 'Pessoa' },
      },
      {
        path: 'clientes',
        name: 'clientes',
        component: () => import('@/modules/contatos/ContatosView.vue'),
        meta: { titulo: 'Clientes' },
      },
      {
        path: 'clientes/:id',
        name: 'cliente-detalhe',
        component: () => import('@/modules/contatos/ContatoDetalheView.vue'),
        meta: { titulo: 'Cliente' },
      },
      {
        path: 'parceiros',
        name: 'parceiros',
        component: () => import('@/modules/contatos/ContatosView.vue'),
        meta: { titulo: 'Parceiros' },
      },
      {
        path: 'parceiros/:id',
        name: 'parceiro-detalhe',
        component: () => import('@/modules/contatos/ContatoDetalheView.vue'),
        meta: { titulo: 'Parceiro' },
      },
      {
        path: 'obras',
        name: 'obras',
        component: () => import('@/modules/obras/ObrasView.vue'),
        meta: { titulo: 'Projetos' },
      },
      {
        path: 'obras/:id',
        name: 'obra-detalhe',
        component: () => import('@/modules/obras/ObraDetalheView.vue'),
        meta: { titulo: 'Projeto' },
      },
      {
        path: 'produtos',
        name: 'produtos',
        component: () => import('@/modules/produtos/ProdutosView.vue'),
        meta: { titulo: 'Produtos' },
      },
      {
        path: 'estoque',
        name: 'estoque',
        component: () => import('@/modules/estoque/EstoqueView.vue'),
        meta: { titulo: 'Estoque' },
      },
      {
        path: 'estoque/:id',
        name: 'estoque-detalhe',
        component: () => import('@/modules/estoque/EstoqueDetalheView.vue'),
        meta: { titulo: 'Extrato de estoque' },
      },
      {
        path: 'fornecedores',
        name: 'fornecedores',
        component: () => import('@/modules/fornecedores/FornecedoresView.vue'),
        meta: { titulo: 'Fornecedores' },
      },
      {
        path: 'fiscal',
        name: 'fiscal',
        component: () => import('@/modules/fiscal/FiscalView.vue'),
        meta: { titulo: 'Fiscal' },
      },
      {
        path: 'fiscal/notas-entrada',
        name: 'fiscal-notas-entrada',
        redirect: { name: 'fiscal', query: { aba: 'entrada' } },
      },
      {
        path: 'oportunidades/:id',
        name: 'oportunidade-detalhe',
        component: () => import('@/modules/oportunidades/OportunidadeDetalheView.vue'),
        meta: { titulo: 'Negócio' },
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
        path: 'configuracoes/parametros',
        name: 'config-parametros',
        component: () => import('@/modules/configuracoes/ConfigParametrosView.vue'),
        meta: { titulo: 'Configurações · Parâmetros' },
      },
      {
        path: 'configuracoes/produtos',
        redirect: { name: 'produtos' },
      },
      {
        path: 'configuracoes/equipe',
        name: 'config-equipe',
        component: () => import('@/modules/configuracoes/ConfigEquipeView.vue'),
        meta: { titulo: 'Configurações · Equipe' },
      },
      {
        path: 'configuracoes/auditoria',
        name: 'config-auditoria',
        component: () => import('@/modules/configuracoes/ConfigAuditoriaView.vue'),
        meta: { titulo: 'Configurações · Auditoria' },
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
        meta: { titulo: 'Configurações · Campos' },
      },
      {
        path: 'configuracoes/chatbot',
        name: 'config-chatbot',
        component: () => import('@/modules/configuracoes/ConfigChatbotView.vue'),
        meta: { titulo: 'Configurações · Automação' },
      },
      {
        path: 'configuracoes/whatsapp',
        name: 'config-whatsapp',
        component: () => import('@/modules/configuracoes/ConfigWhatsAppView.vue'),
        meta: { titulo: 'Configurações · WhatsApp' },
      },
      {
        path: 'configuracoes/fiscal',
        name: 'config-fiscal',
        component: () => import('@/modules/configuracoes/ConfigFiscalView.vue'),
        meta: { titulo: 'Configurações · Nota fiscal' },
      },
    ],
  },
  {
    path: '/saude/entrar',
    name: 'saude-entrar',
    component: () => import('@/modules/saude/EntrarSaudeView.vue'),
    meta: { publico: true, ramo: 'SAUDE' },
  },
  {
    path: '/saude',
    component: () => import('@/modules/saude/CascaSaude.vue'),
    meta: { requerAuth: true, ramo: 'SAUDE' },
    children: [
      {
        path: '',
        name: 'saude-inicio',
        component: () => import('@/modules/saude/InicioSaudeView.vue'),
        meta: { titulo: 'Início', ramo: 'SAUDE', requerAuth: true },
      },
      {
        path: 'agenda',
        name: 'saude-agenda',
        component: () => import('@/modules/saude/AgendaSaudeView.vue'),
        meta: { titulo: 'Agenda', ramo: 'SAUDE', requerAuth: true },
      },
      {
        path: 'consultas',
        name: 'saude-consultas',
        component: () => import('@/modules/saude/ConsultasSaudeView.vue'),
        meta: { titulo: 'Consultas', ramo: 'SAUDE', requerAuth: true },
      },
      {
        path: 'pacientes',
        name: 'saude-pacientes',
        component: () => import('@/modules/saude/PacientesSaudeView.vue'),
        meta: { titulo: 'Pacientes', ramo: 'SAUDE', requerAuth: true },
      },
      {
        path: 'profissionais',
        name: 'saude-profissionais',
        component: () => import('@/modules/saude/ProfissionaisSaudeView.vue'),
        meta: { titulo: 'Profissionais', ramo: 'SAUDE', requerAuth: true },
      },
      {
        path: 'medicamentos',
        name: 'saude-medicamentos',
        component: () => import('@/modules/saude/MedicamentosSaudeView.vue'),
        meta: { titulo: 'Medicamentos', ramo: 'SAUDE', requerAuth: true },
      },
      {
        path: 'clinica',
        name: 'saude-clinica',
        component: () => import('@/modules/saude/ClinicaSaudeView.vue'),
        meta: { titulo: 'Clínica', ramo: 'SAUDE', requerAuth: true },
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
  const rotaSaude = para.matched.some((r) => r.meta.ramo === 'SAUDE');
  const contaSaude = auth.empresa?.ramo === 'SAUDE';

  if (requerAuth && !auth.autenticado) {
    return {
      name: rotaSaude ? 'saude-entrar' : 'entrar',
      query: { redirecionar: para.fullPath },
    };
  }

  if (auth.autenticado) {
    if (auth.precisaTrocarSenha && para.name !== 'trocar-senha') {
      return { name: 'trocar-senha' };
    }

    if (contaSaude && requerAuth && !rotaSaude && para.name !== 'trocar-senha') {
      return { name: 'saude-inicio' };
    }

    if (!contaSaude && rotaSaude && requerAuth) {
      return { name: 'dashboard' };
    }

    if (!contaSaude) {
      const nomeRota = typeof para.name === 'string' ? para.name : '';
      const personalizacao = auth.empresa?.personalizacaoComercial;
      if (rotaOcultaNaPersonalizacao(nomeRota, personalizacao)) {
        return { name: 'dashboard' };
      }
      if (personalizacao === PersonalizacaoComercial.ECOLUME && nomeRota === 'contatos') {
        return { name: 'clientes', query: para.query };
      }
      if (personalizacao === PersonalizacaoComercial.ECOLUME && nomeRota === 'contato-detalhe') {
        return { name: 'cliente-detalhe', params: para.params, query: para.query };
      }
      if (
        personalizacao !== PersonalizacaoComercial.ECOLUME &&
        (nomeRota === 'parceiros' || nomeRota === 'parceiro-detalhe')
      ) {
        return { name: 'dashboard' };
      }
    }

    if (
      !contaSaude &&
      !auth.precisaTrocarSenha &&
      !auth.onboardingConcluido &&
      requerAuth &&
      para.name !== 'onboarding'
    ) {
      return { name: 'onboarding' };
    }

    if (publico && (para.name === 'entrar' || para.name === 'cadastro' || para.name === 'saude-entrar')) {
      return { name: contaSaude ? 'saude-inicio' : 'dashboard' };
    }
  }

  return true;
});

export default router;
