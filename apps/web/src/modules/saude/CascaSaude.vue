<script setup lang="ts">
import { useRoute } from 'vue-router';
import BarraSaude from './BarraSaude.vue';

const rota = useRoute();

function ativo(to: string): boolean {
  if (to === '/saude') return rota.path === '/saude';
  return rota.path === to || rota.path.startsWith(`${to}/`);
}

const atalhos = [
  { rotulo: 'Início', to: '/saude' },
  { rotulo: 'Agenda', to: '/saude/agenda' },
  { rotulo: 'Consultas', to: '/saude/consultas' },
  { rotulo: 'Pacientes', to: '/saude/pacientes' },
  { rotulo: 'Profissionais', to: '/saude/profissionais' },
  { rotulo: 'Medicamentos', to: '/saude/medicamentos' },
  { rotulo: 'Clínica', to: '/saude/clinica' },
];
</script>

<template>
  <div class="clinica flex h-screen w-full overflow-hidden bg-superficie">
    <BarraSaude class="hidden md:flex" />
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="border-b border-borda/80 bg-branco/90 px-5 py-5 md:px-8">
        <p class="rotulo-editorial text-dourado-hover">Clínica</p>
        <h1 class="fonte-marca mt-1 text-2xl text-carvao">{{ rota.meta.titulo }}</h1>
        <nav class="mt-4 flex gap-2 overflow-x-auto md:hidden" aria-label="Operação clínica">
          <RouterLink
            v-for="item in atalhos"
            :key="item.to"
            :to="item.to"
            class="shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold"
            :class="ativo(item.to) ? 'border-carvao bg-marfim text-carvao' : 'border-borda text-texto-secundario'"
          >
            {{ item.rotulo }}
          </RouterLink>
        </nav>
      </header>
      <main class="relative flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
        <div
          class="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(28,155,138,0.12),transparent_65%)]"
          aria-hidden="true"
        />
        <div class="relative mx-auto w-full max-w-[1200px]">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
