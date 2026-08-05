import { defineStore } from 'pinia';
import { ref } from 'vue';

const CHAVE_SIDEBAR = 'arcco:sidebar-recolhida';

export const useInterfaceStore = defineStore('interface', () => {
  const sidebarRecolhida = ref<boolean>(
    typeof localStorage !== 'undefined' && localStorage.getItem(CHAVE_SIDEBAR) === '1',
  );
  const sidebarMobileAberta = ref(false);

  function alternarSidebar() {
    sidebarRecolhida.value = !sidebarRecolhida.value;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CHAVE_SIDEBAR, sidebarRecolhida.value ? '1' : '0');
    }
  }

  function abrirSidebarMobile() {
    sidebarMobileAberta.value = true;
  }

  function fecharSidebarMobile() {
    sidebarMobileAberta.value = false;
  }

  return {
    sidebarRecolhida,
    sidebarMobileAberta,
    alternarSidebar,
    abrirSidebarMobile,
    fecharSidebarMobile,
  };
});
