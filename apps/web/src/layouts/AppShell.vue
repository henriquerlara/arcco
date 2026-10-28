<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Menu } from 'lucide-vue-next';
import BarraLateral from '@/components/layout/BarraLateral.vue';
import SinoAgenda from '@/components/layout/SinoAgenda.vue';
import MarcaArcco from '@/components/marca/MarcaArcco.vue';
import { useInterfaceStore } from '@/stores/interface';

const interfaceStore = useInterfaceStore();
const rota = useRoute();

const semPadding = computed(() => rota.meta.semPadding === true);

watch(
  () => rota.fullPath,
  () => interfaceStore.fecharSidebarMobile(),
);
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-superficie">
    <!-- Sidebar desktop -->
    <div class="hidden md:block">
      <BarraLateral />
    </div>

    <!-- Sidebar mobile (overlay) -->
    <Transition name="fade">
      <div
        v-if="interfaceStore.sidebarMobileAberta"
        class="fixed inset-0 z-40 md:hidden"
        @click="interfaceStore.fecharSidebarMobile()"
      >
        <div class="absolute inset-0 bg-preto/45" />
        <div class="absolute inset-y-0 left-0" @click.stop>
          <BarraLateral />
        </div>
      </div>
    </Transition>

    <!-- Área principal -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Barra mobile -->
      <div
        class="flex h-16 items-center gap-3 border-b border-borda/80 bg-branco/95 px-4 backdrop-blur md:hidden"
      >
        <button
          class="rounded-md border border-borda/80 p-2 text-carvao hover:bg-marfim"
          @click="interfaceStore.abrirSidebarMobile()"
        >
          <Menu class="size-5" />
        </button>
        <MarcaArcco tema="escuro" tamanho="sm" />
        <div class="ml-auto">
          <SinoAgenda />
        </div>
      </div>

      <div
        class="hidden h-14 items-center justify-end border-b border-borda/60 bg-branco/80 px-8 backdrop-blur md:flex xl:px-10"
      >
        <SinoAgenda />
      </div>

      <main
        :class="[
          'relative flex-1 overflow-y-auto',
          semPadding ? 'p-0' : 'px-5 py-6 md:px-8 md:py-9 xl:px-10',
        ]"
      >
        <div
          v-if="!semPadding"
          class="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(184,170,151,0.12),transparent_65%)]"
          aria-hidden="true"
        />
        <div :class="semPadding ? 'h-full' : 'relative mx-auto w-full max-w-[1440px]'">
          <RouterView v-slot="{ Component, route: rotaAtual }">
            <Transition name="fade" mode="out-in">
              <component :is="Component" :key="rotaAtual.fullPath" />
            </Transition>
          </RouterView>
        </div>
      </main>
    </div>
  </div>
</template>
