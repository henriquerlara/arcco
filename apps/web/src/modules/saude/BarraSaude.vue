<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  Stethoscope,
  Pill,
  Building2,
  LogOut,
} from 'lucide-vue-next';
import MarcaArcco from '@/components/marca/MarcaArcco.vue';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { iniciais } from '@/composables/formatadores';
import { cn } from '@/composables/cn';

const auth = useAutenticacaoStore();
const rota = useRoute();
const router = useRouter();

const itens = [
  { rotulo: 'Início', icone: LayoutDashboard, to: '/saude' },
  { rotulo: 'Agenda', icone: CalendarDays, to: '/saude/agenda' },
  { rotulo: 'Consultas', icone: ClipboardList, to: '/saude/consultas' },
  { rotulo: 'Pacientes', icone: Users, to: '/saude/pacientes' },
  { rotulo: 'Profissionais', icone: Stethoscope, to: '/saude/profissionais' },
  { rotulo: 'Medicamentos', icone: Pill, to: '/saude/medicamentos' },
  { rotulo: 'Clínica', icone: Building2, to: '/saude/clinica' },
];

function ativo(to: string): boolean {
  if (to === '/saude') return rota.path === '/saude';
  return rota.path === to || rota.path.startsWith(to + '/');
}

async function sair() {
  await auth.sair();
  await router.push({ name: 'saude-entrar' });
}
</script>

<template>
  <aside class="flex h-full w-[272px] flex-col border-r border-white/10 bg-carvao text-marfim">
    <div class="flex h-[88px] flex-col justify-center border-b border-white/10 px-4">
      <RouterLink to="/saude" class="block">
        <MarcaArcco tema="claro" tamanho="md" class="items-start" />
      </RouterLink>
      <p class="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-dourado-claro/70">
        Clínica
      </p>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-6">
      <p class="rotulo-editorial mb-3 px-3 text-marfim/40">Operação clínica</p>
      <ul class="space-y-1">
        <li v-for="item in itens" :key="item.to">
          <RouterLink
            :to="item.to"
            :class="
              cn(
                'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                ativo(item.to)
                  ? 'bg-marfim text-carvao'
                  : 'text-marfim/65 hover:bg-white/[0.07] hover:text-marfim',
              )
            "
          >
            <span v-if="ativo(item.to)" class="absolute -left-3 h-5 w-0.5 bg-dourado-claro" />
            <component :is="item.icone" class="size-[18px] shrink-0" />
            {{ item.rotulo }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <div class="border-t border-white/10 p-3">
      <div class="flex items-center gap-3">
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-md border border-dourado-claro/20 bg-white/[0.06] text-sm font-semibold text-dourado-claro"
        >
          {{ iniciais(auth.usuario?.nome) }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-marfim">{{ auth.usuario?.nome }}</p>
          <p class="truncate text-xs text-marfim/50">{{ auth.empresa?.nomeFantasia || auth.empresa?.nome }}</p>
        </div>
        <button
          class="rounded-md p-2 text-marfim/60 transition-colors hover:bg-white/5 hover:text-erro"
          title="Sair"
          @click="sair"
        >
          <LogOut class="size-4" />
        </button>
      </div>
    </div>
  </aside>
</template>
