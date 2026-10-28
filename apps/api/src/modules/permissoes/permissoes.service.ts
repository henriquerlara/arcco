import { Injectable } from '@nestjs/common';
import {
  camposFinanceirosProibidos,
  chavesVisiveis,
  escopoAgendaEfetivo,
  lerPersonalizacaoComercial,
  normalizarChavesPermissao,
  PerfilUsuario,
  PersonalizacaoComercial,
  permissaoConhecida,
  publicarResposta,
  resolverPermissoes,
  TipoAuditoria,
  veTodosNegocios,
  type ContextoPermissao,
  type EscopoAgendaEfetivo,
  type PermissaoComercial,
} from '@arcco/contratos';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { Erros } from '../../common/erros/erros';
import { AuditoriaService } from '../auditoria/auditoria.service';

export interface AtorPermissao {
  id: string;
  empresaId: string;
  perfil: string;
}

@Injectable()
export class PermissoesService {
  constructor(
    private readonly platform: PlatformPrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async resolver(ator: AtorPermissao): Promise<ContextoPermissao> {
    const empresa = await this.platform.empresa.findUnique({
      where: { id: ator.empresaId },
      select: { configuracoes: true },
    });
    const concessoes = await this.platform.concessaoPermissao.findMany({
      where: { empresaId: ator.empresaId, usuarioId: ator.id },
      select: { chave: true },
    });
    return resolverPermissoes({
      configuracoes: empresa?.configuracoes,
      perfil: ator.perfil,
      concedidas: concessoes.map((item) => item.chave),
    });
  }

  /** null no modo legado. Com a flag, só chaves resolvidas no servidor. */
  async chavesDaSessao(ator: AtorPermissao): Promise<string[] | null> {
    return chavesVisiveis(await this.resolver(ator));
  }

  async empresaEcolume(empresaId: string): Promise<boolean> {
    const empresa = await this.platform.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    });
    return lerPersonalizacaoComercial(empresa?.configuracoes) === PersonalizacaoComercial.ECOLUME;
  }

  async filtrar<T>(ator: AtorPermissao, dados: T | Promise<T>): Promise<T> {
    const valor = await dados;
    return publicarResposta(await this.resolver(ator), valor);
  }

  async afirmarEntrada(ator: AtorPermissao, corpo: unknown, consulta: unknown): Promise<void> {
    const ctx = await this.resolver(ator);
    const proibidos = [
      ...camposFinanceirosProibidos(ctx, corpo),
      ...camposFinanceirosProibidos(ctx, consulta),
    ];
    if (proibidos.length > 0) throw Erros.semPermissao();
  }

  async afirmar(ator: AtorPermissao, chave: PermissaoComercial): Promise<void> {
    const ctx = await this.resolver(ator);
    if (ctx.modo === 'legado') return;
    if (!ctx.chaves.has(chave)) throw Erros.semPermissao();
  }

  async escopoAgenda(ator: AtorPermissao): Promise<EscopoAgendaEfetivo> {
    return escopoAgendaEfetivo(await this.resolver(ator));
  }

  async veTodosNegocios(ator: AtorPermissao): Promise<boolean> {
    return veTodosNegocios(await this.resolver(ator));
  }

  /**
   * Só administrador (PROPRIETARIO) gerencia permissões/conjuntos na ECOLUME.
   * Legado: PROPRIETARIO ou GESTOR (comportamento anterior de equipe).
   */
  async assertAdministraPermissoes(ator: AtorPermissao): Promise<void> {
    const ecolume = await this.empresaEcolume(ator.empresaId);
    if (ecolume) {
      if (ator.perfil !== PerfilUsuario.PROPRIETARIO) {
        throw Erros.semPermissao('Apenas o administrador define permissoes');
      }
      return;
    }
    if (
      ator.perfil !== PerfilUsuario.PROPRIETARIO &&
      ator.perfil !== PerfilUsuario.GESTOR
    ) {
      throw Erros.semPermissao();
    }
  }

  async listarDoUsuario(empresaId: string, usuarioId: string) {
    const usuario = await this.platform.usuario.findFirst({
      where: { id: usuarioId, empresaId },
      select: { id: true, perfil: true, nome: true, email: true, ativo: true },
    });
    if (!usuario) throw Erros.naoEncontrado('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado');
    const empresa = await this.platform.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    });
    const concessoes = await this.platform.concessaoPermissao.findMany({
      where: { empresaId, usuarioId },
      select: { chave: true, conjuntoId: true },
      orderBy: { chave: 'asc' },
    });
    const ctx = resolverPermissoes({
      configuracoes: empresa?.configuracoes,
      perfil: usuario.perfil,
      concedidas: concessoes.map((c) => c.chave),
    });
    return {
      usuario,
      concedidas: concessoes.map((c) => c.chave),
      efetivas: chavesVisiveis(ctx),
      administrador: usuario.perfil === PerfilUsuario.PROPRIETARIO,
      escopoAgenda: escopoAgendaEfetivo(ctx),
      veTodosNegocios: veTodosNegocios(ctx),
      ultimoConjuntoId: concessoes.find((c) => c.conjuntoId)?.conjuntoId ?? null,
    };
  }

  /**
   * Substitui o conjunto de chaves do usuário (exceto administrador, que ignora concessões).
   * Não altera silenciosamente outros usuários ligados ao mesmo template.
   */
  async definir(
    empresaId: string,
    usuarioId: string,
    chaves: readonly string[],
    ator: AtorPermissao,
    opcoes: { conjuntoId?: string | null } = {},
  ) {
    await this.assertAdministraPermissoes(ator);
    if (usuarioId === ator.id && ator.perfil !== PerfilUsuario.PROPRIETARIO) {
      throw Erros.invalido('AUTOELEVACAO', 'Nao e permitido alterar as proprias permissoes');
    }

    const usuario = await this.platform.usuario.findFirst({
      where: { id: usuarioId, empresaId },
      select: { id: true, perfil: true },
    });
    if (!usuario) {
      throw Erros.naoEncontrado('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado');
    }
    if (usuario.perfil === PerfilUsuario.PROPRIETARIO) {
      throw Erros.invalido(
        'ADMIN_IMUTAVEL',
        'Administrador tem acesso total; permissoes individuais nao se aplicam',
      );
    }

    const normalizadas = normalizarChavesPermissao(chaves);
    for (const chave of chaves) {
      if (!permissaoConhecida(chave)) {
        throw Erros.invalido('PERMISSAO_DESCONHECIDA', `Permissao desconhecida: ${chave}`);
      }
    }

    await this.platform.$transaction(async (tx) => {
      const atuais = await tx.concessaoPermissao.findMany({
        where: { empresaId, usuarioId },
        select: { chave: true },
      });
      const antes = atuais.map((a) => a.chave).sort();
      const depois = [...normalizadas].sort();

      await tx.concessaoPermissao.deleteMany({ where: { empresaId, usuarioId } });
      for (const chave of normalizadas) {
        await tx.concessaoPermissao.create({
          data: {
            empresaId,
            usuarioId,
            chave,
            conjuntoId: opcoes.conjuntoId ?? null,
          },
        });
      }

      if (antes.join() !== depois.join()) {
        await this.auditoria.registrarPermissao(tx, {
          empresaId,
          usuarioId: ator.id,
          tipo: TipoAuditoria.ALTERACAO_PERMISSAO,
          entidade: 'usuario',
          entidadeId: usuarioId,
          anterior: { chaves: antes },
          posterior: { chaves: depois, conjuntoId: opcoes.conjuntoId ?? null },
        });
      }
    });

    return this.listarDoUsuario(empresaId, usuarioId);
  }

  /** Acrescenta chaves (compat 26a / testes). Preferir `definir` na UI. */
  async conceder(
    empresaId: string,
    usuarioId: string,
    chaves: readonly PermissaoComercial[],
    atorId?: string | null,
  ): Promise<void> {
    const usuario = await this.platform.usuario.findFirst({
      where: { id: usuarioId, empresaId },
      select: { id: true },
    });
    if (!usuario) {
      throw Erros.naoEncontrado('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado');
    }
    for (const chave of chaves) {
      if (!permissaoConhecida(chave)) throw Erros.invalido('PERMISSAO_DESCONHECIDA', 'Permissao desconhecida');
    }

    await this.platform.$transaction(async (tx) => {
      const atuais = await tx.concessaoPermissao.findMany({
        where: { empresaId, usuarioId },
        select: { chave: true },
      });
      const presentes = new Set(atuais.map((item) => item.chave));
      const incluir = chaves.filter((chave) => !presentes.has(chave));
      if (incluir.length === 0) return;

      for (const chave of incluir) {
        await tx.concessaoPermissao.create({
          data: { empresaId, usuarioId, chave },
        });
      }
      await this.auditoria.registrarPermissao(tx, {
        empresaId,
        usuarioId: atorId || usuarioId,
        tipo: TipoAuditoria.ALTERACAO_PERMISSAO,
        entidade: 'usuario',
        entidadeId: usuarioId,
        anterior: { chaves: [...presentes] },
        posterior: { chaves: [...presentes, ...incluir] },
      });
    });
  }

  // —— Conjuntos (templates) ——

  listarConjuntos(empresaId: string) {
    return this.platform.conjuntoPermissao.findMany({
      where: { empresaId },
      orderBy: { nome: 'asc' },
    });
  }

  async criarConjunto(
    empresaId: string,
    entrada: { nome: string; chaves: readonly string[] },
    ator: AtorPermissao,
  ) {
    await this.assertAdministraPermissoes(ator);
    const nome = entrada.nome.trim();
    if (nome.length < 2) throw Erros.invalido('NOME_INVALIDO', 'Informe o nome do perfil');
    const chaves = normalizarChavesPermissao(entrada.chaves);
    for (const c of entrada.chaves) {
      if (!permissaoConhecida(c)) throw Erros.invalido('PERMISSAO_DESCONHECIDA', `Permissao desconhecida: ${c}`);
    }
    try {
      return await this.platform.conjuntoPermissao.create({
        data: { empresaId, nome, chaves },
      });
    } catch {
      throw Erros.conflito('CONJUNTO_DUPLICADO', 'Ja existe um perfil com este nome');
    }
  }

  async atualizarConjunto(
    empresaId: string,
    id: string,
    entrada: { nome?: string; chaves?: readonly string[] },
    ator: AtorPermissao,
  ) {
    await this.assertAdministraPermissoes(ator);
    const atual = await this.platform.conjuntoPermissao.findFirst({
      where: { id, empresaId },
    });
    if (!atual) throw Erros.naoEncontrado('CONJUNTO_NAO_ENCONTRADO', 'Perfil nao encontrado');
    const data: { nome?: string; chaves?: string[] } = {};
    if (entrada.nome !== undefined) {
      const nome = entrada.nome.trim();
      if (nome.length < 2) throw Erros.invalido('NOME_INVALIDO', 'Informe o nome do perfil');
      data.nome = nome;
    }
    if (entrada.chaves !== undefined) {
      for (const c of entrada.chaves) {
        if (!permissaoConhecida(c)) {
          throw Erros.invalido('PERMISSAO_DESCONHECIDA', `Permissao desconhecida: ${c}`);
        }
      }
      data.chaves = normalizarChavesPermissao(entrada.chaves);
    }
    // Atualizar o template NÃO altera usuários já cadastrados.
    return this.platform.conjuntoPermissao.update({ where: { id }, data });
  }

  async excluirConjunto(empresaId: string, id: string, ator: AtorPermissao) {
    await this.assertAdministraPermissoes(ator);
    const atual = await this.platform.conjuntoPermissao.findFirst({
      where: { id, empresaId },
    });
    if (!atual) throw Erros.naoEncontrado('CONJUNTO_NAO_ENCONTRADO', 'Perfil nao encontrado');
    await this.platform.conjuntoPermissao.delete({ where: { id } });
    return { ok: true };
  }

  /** Copia chaves do template para o usuário (snapshot). */
  async aplicarConjunto(
    empresaId: string,
    conjuntoId: string,
    usuarioId: string,
    ator: AtorPermissao,
  ) {
    await this.assertAdministraPermissoes(ator);
    const conjunto = await this.platform.conjuntoPermissao.findFirst({
      where: { id: conjuntoId, empresaId },
    });
    if (!conjunto) throw Erros.naoEncontrado('CONJUNTO_NAO_ENCONTRADO', 'Perfil nao encontrado');
    return this.definir(empresaId, usuarioId, conjunto.chaves, ator, { conjuntoId: conjunto.id });
  }
}
