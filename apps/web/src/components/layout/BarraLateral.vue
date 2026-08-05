<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  MessagesSquare,
  KanbanSquare,
  Users,
  Building2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ChevronRight,
} from 'lucide-vue-next';
import MarcaArcco from '@/components/marca/MarcaArcco.vue';
import { useInterfaceStore } from '@/stores/interface';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';
import { iniciais } from '@/composables/formatadores';
import { PERFIL_ROTULOS } from '@arcco/contratos';
import { cn } from '@/composables/cn';


const interfaceStore = useInterfaceStore();
const auth = useAutenticacaoStore();
const rota = useRoute();
const router = useRouter();
const { notificarErro } = useNotificacao();

const recolhida = computed(() => interfaceStore.sidebarRecolhida);

const principais = [
  { nome: 'dashboard', rotulo: 'Painel', icone: LayoutDashboard, to: '/app/dashboard' },
  { nome: 'conversas', rotulo: 'Conversas', icone: MessagesSquare, to: '/app/conversas' },
  { nome: 'pipeline', rotulo: 'Pipeline', icone: KanbanSquare, to: '/app/pipeline' },
  { nome: 'contatos', rotulo: 'Contatos', icone: Users, to: '/app/contatos' },
  { nome: 'obras', rotulo: 'Obras', icone: Building2, to: '/app/obras' },
];

const configItens = [
  { rotulo: 'Empresa', to: '/app/configuracoes/empresa' },
  { rotulo: 'Equipe', to: '/app/configuracoes/equipe' },
  { rotulo: 'Categorias', to: '/app/configuracoes/categorias' },
  { rotulo: 'Funil', to: '/app/configuracoes/funil' },
  { rotulo: 'Campos personalizados', to: '/app/configuracoes/campos' },
  { rotulo: 'Chatbot', to: '/app/configuracoes/chatbot' },
  { rotulo: 'WhatsApp', to: '/app/configuracoes/whatsapp' },
];

const emConfiguracoes = computed(() => rota.path.startsWith('/app/configuracoes'));

function ativo(to: string): boolean {
  return rota.path === to || rota.path.startsWith(to + '/');
}

async function sair() {
  try {
    await auth.sair();
    await router.push({ name: 'entrar' });
  } catch (e) {
    notificarErro(e);
  }
}
</script>

<template>
  <aside
    :class="
      cn(
        'flex h-full flex-col bg-carvao text-marfim transition-[width] duration-200 scroll-escuro',
        recolhida ? 'w-[72px]' : 'w-64',
      )
    "
  >
    <!-- Marca -->
    <div class="flex h-16 items-center gap-2 border-b border-white/5 px-4">
      <RouterLink to="/app/dashboard" class="flex items-center overflow-hidden">
        <MarcaArcco v-if="!recolhida" tema="claro" tamanho="md" />
        <MarcaArcco v-else tema="claro" tamanho="md" somente-simbolo />
      </RouterLink>
    </div>

    <!-- Navegação principal -->
    <nav class="flex-1 overflow-y-auto px-3 py-4 scroll-escuro">
      <ul class="space-y-1">
        <li v-for="item in principais" :key="item.nome">
          <RouterLink
            :to="item.to"
            :class="
              cn(
                'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                ativo(item.to)
                  ? 'bg-dourado text-preto shadow-suave'
                  : 'text-marfim/75 hover:bg-white/5 hover:text-marfim',
                recolhida && 'justify-center px-0',
              )
            "
            :title="recolhida ? item.rotulo : undefined"
          >
            <component :is="item.icone" class="size-5 shrink-0" />
            <span v-if="!recolhida">{{ item.rotulo }}</span>
          </RouterLink>
        </li>
      </ul>

      <!-- Configurações -->
      <div class="mt-6">
        <p
          v-if="!recolhida"
          class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-marfim/40"
        >
          Configurações
        </p>
        <RouterLink
          v-if="recolhida"
          to="/app/configuracoes/empresa"
          :class="
            cn(
              'flex items-center justify-center rounded-md py-2.5 transition-colors',
              emConfiguracoes ? 'bg-white/10 text-dourado-claro' : 'text-marfim/75 hover:bg-white/5',
            )
          "
          title="Configurações"
        >
          <Settings class="size-5" />
        </RouterLink>
        <ul v-else class="space-y-0.5">
          <li v-for="item in configItens" :key="item.to">
            <RouterLink
              :to="item.to"
              :class="
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  ativo(item.to)
                    ? 'bg-white/10 text-dourado-claro'
                    : 'text-marfim/65 hover:bg-white/5 hover:text-marfim',
                )
              "
            >
              <ChevronRight class="size-3.5 opacity-60" />
              {{ item.rotulo }}
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Usuário + ações -->
    <div class="border-t border-white/5 p-3">
      <div
        :class="cn('flex items-center gap-3', recolhida && 'flex-col gap-2')"
      >
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-dourado/20 text-sm font-semibold text-dourado-claro"
        >
          {{ iniciais(auth.usuario?.nome) }}
        </div>
        <div v-if="!recolhida" class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-marfim">{{ auth.usuario?.nome }}</p>
          <p class="truncate text-xs text-marfim/50">
            {{ auth.usuario ? PERFIL_ROTULOS[auth.usuario.perfil] : '' }}
          </p>
        </div>
        <button
          class="rounded-md p-2 text-marfim/60 transition-colors hover:bg-white/5 hover:text-erro"
          title="Sair"
          @click="sair"
        >
          <LogOut class="size-4" />
        </button>
      </div>

      <button
        class="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-white/5 py-2 text-xs text-marfim/60 transition-colors hover:bg-white/5"
        @click="interfaceStore.alternarSidebar()"
      >
        <PanelLeftOpen v-if="recolhida" class="size-4" />
        <template v-else>
          <PanelLeftClose class="size-4" />
          Recolher
        </template>
      </button>
    </div>
  </aside>
</template>
