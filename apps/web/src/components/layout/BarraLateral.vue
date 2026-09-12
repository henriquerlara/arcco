<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  MessagesSquare,
  KanbanSquare,
  Users,
  Building2,
  Package,
  Boxes,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
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
  { nome: 'dashboard', rotulo: 'Visão geral', icone: LayoutDashboard, to: '/app/dashboard' },
  { nome: 'conversas', rotulo: 'Conversas', icone: MessagesSquare, to: '/app/conversas' },
  { nome: 'pipeline', rotulo: 'Negócios', icone: KanbanSquare, to: '/app/pipeline' },
  { nome: 'produtos', rotulo: 'Produtos', icone: Boxes, to: '/app/produtos' },
  { nome: 'estoque', rotulo: 'Estoque', icone: Package, to: '/app/estoque' },
  { nome: 'contatos', rotulo: 'Pessoas', icone: Users, to: '/app/contatos' },
  { nome: 'obras', rotulo: 'Projetos', icone: Building2, to: '/app/obras' },
  { nome: 'configuracoes', rotulo: 'Configurações', icone: Settings, to: '/app/configuracoes/empresa' },
];

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
        'relative flex h-full flex-col overflow-hidden border-r border-white/10 bg-carvao text-marfim transition-[width] duration-200 scroll-escuro',
        recolhida ? 'w-[76px]' : 'w-[272px]',
      )
    "
  >
    <!-- Marca -->
    <div class="flex h-[88px] items-center border-b border-white/10 px-4">
      <RouterLink
        to="/app/dashboard"
        :class="cn('flex items-center overflow-hidden', recolhida ? 'h-10 w-11 justify-center' : 'h-12 w-full')"
      >
        <MarcaArcco v-if="!recolhida" tema="claro" tamanho="md" class="items-start" />
        <MarcaArcco v-else tema="claro" tamanho="sm" somente-simbolo />
      </RouterLink>
    </div>

    <!-- Navegação principal -->
    <nav class="flex-1 overflow-y-auto px-3 py-6 scroll-escuro">
      <p v-if="!recolhida" class="rotulo-editorial mb-3 px-3 text-marfim/40">Operação comercial</p>
      <ul class="space-y-1">
        <li v-for="item in principais" :key="item.nome">
          <RouterLink
            :to="item.to"
            :class="
              cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                ativo(item.to)
                  ? 'bg-marfim text-carvao'
                  : 'text-marfim/65 hover:bg-white/[0.07] hover:text-marfim',
                recolhida && 'justify-center px-0',
              )
            "
            :title="recolhida ? item.rotulo : undefined"
          >
            <span v-if="ativo(item.to) && !recolhida" class="absolute -left-3 h-5 w-0.5 bg-dourado-claro" />
            <component :is="item.icone" class="size-[18px] shrink-0" />
            <span v-if="!recolhida">{{ item.rotulo }}</span>
          </RouterLink>
        </li>
      </ul>

    </nav>

    <!-- Usuário + ações -->
    <div class="border-t border-white/10 p-3">
      <div
        :class="cn('flex items-center gap-3', recolhida && 'flex-col gap-2')"
      >
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-md border border-dourado-claro/20 bg-white/[0.06] text-sm font-semibold text-dourado-claro"
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
        class="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-white/10 py-2 text-xs text-marfim/50 transition-colors hover:bg-white/[0.06] hover:text-marfim"
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
