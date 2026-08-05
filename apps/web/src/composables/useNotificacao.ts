import { toast } from 'vue-sonner';
import { ErroRequisicao } from '@/services';

export function useNotificacao() {
  function sucesso(mensagem: string, descricao?: string) {
    toast.success(mensagem, { description: descricao });
  }

  function erro(mensagem: string, descricao?: string) {
    toast.error(mensagem, { description: descricao });
  }

  function info(mensagem: string, descricao?: string) {
    toast.info(mensagem, { description: descricao });
  }

  function notificarErro(causa: unknown, fallback = 'Não foi possível concluir a ação.') {
    if (causa instanceof ErroRequisicao) {
      toast.error(causa.message || fallback, { description: descricaoErro(causa) });
      return;
    }
    if (causa instanceof Error) {
      toast.error(fallback, { description: causa.message });
      return;
    }
    toast.error(fallback);
  }

  return { sucesso, erro, info, notificarErro };
}

function descricaoErro(causa: ErroRequisicao): string | undefined {
  if (Array.isArray(causa.detalhes) && causa.detalhes.length) {
    return causa.detalhes
      .map((d) => {
        if (d && typeof d === 'object' && 'mensagem' in d) {
          return String((d as { mensagem: unknown }).mensagem);
        }
        return String(d);
      })
      .join(' · ');
  }
  return undefined;
}
