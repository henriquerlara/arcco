import type {
  CadastrarInput,
  EntrarInput,
  TrocarSenhaInput,
} from '@arcco/contratos';
import type { Empresa, Sessao, Usuario } from '@/types';
import { desembrulhar, http } from './http';

/** Resposta bruta das rotas de autenticação (usuário usa `deveTrocarSenha`). */
interface SessaoBruta {
  usuario: Usuario & { deveTrocarSenha?: boolean };
  empresa?: Empresa | null;
  permissoesComerciais?: string[] | null;
}

function mapearUsuario(usuario: SessaoBruta['usuario']): Usuario {
  return {
    ...usuario,
    deveTrocarSenha: usuario.deveTrocarSenha,
    precisaTrocarSenha: usuario.deveTrocarSenha ?? usuario.precisaTrocarSenha ?? false,
  };
}

function mapearSessao(bruta: SessaoBruta): Sessao {
  return {
    usuario: mapearUsuario(bruta.usuario),
    empresa: (bruta.empresa ?? null) as Empresa,
    permissoesComerciais: bruta.permissoesComerciais ?? null,
  };
}

export const servicoAutenticacao = {
  async entrar(dados: EntrarInput): Promise<Sessao> {
    return mapearSessao(desembrulhar<SessaoBruta>(await http.post('/autenticacao/entrar', dados)));
  },
  async cadastrar(dados: CadastrarInput): Promise<Sessao> {
    return mapearSessao(
      desembrulhar<SessaoBruta>(await http.post('/autenticacao/cadastrar', dados)),
    );
  },
  async sessao(): Promise<Sessao> {
    return mapearSessao(desembrulhar<SessaoBruta>(await http.get('/autenticacao/eu')));
  },
  async sair(): Promise<void> {
    await http.post('/autenticacao/sair');
  },
  async trocarSenha(dados: TrocarSenhaInput): Promise<void> {
    await http.post('/autenticacao/trocar-senha', dados);
  },
};
