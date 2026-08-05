import { QueryClient, VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query';
import { ErroRequisicao } from '@/services';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (falhas, erro) => {
        if (erro instanceof ErroRequisicao) {
          // Não repetir para erros de autenticação/permissão/validação
          if ([400, 401, 403, 404, 422].includes(erro.status)) return false;
        }
        return falhas < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export const vueQueryOptions: VueQueryPluginOptions = {
  queryClient,
};

export { VueQueryPlugin };
