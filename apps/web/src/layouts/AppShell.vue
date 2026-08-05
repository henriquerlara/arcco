<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Menu } from 'lucide-vue-next';
import BarraLateral from '@/components/layout/BarraLateral.vue';
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
        class="flex h-14 items-center gap-3 border-b border-borda bg-branco px-4 md:hidden"
      >
        <button
          class="rounded-md p-2 text-texto-secundario hover:bg-marfim"
          @click="interfaceStore.abrirSidebarMobile()"
        >
          <Menu class="size-5" />
        </button>
        <MarcaArcco tema="escuro" tamanho="sm" />
      </div>

      <main
        :class="[
          'flex-1 overflow-y-auto',
          semPadding ? 'p-0' : 'px-5 py-6 md:px-8 md:py-8',
        ]"
      >
        <div :class="semPadding ? 'h-full' : 'mx-auto w-full max-w-[1400px]'">
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
