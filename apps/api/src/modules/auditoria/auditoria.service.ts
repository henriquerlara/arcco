import { Injectable, Optional } from '@nestjs/common';
import {
  criarRespostaPaginada,
  lerPersonalizacaoComercial,
  OrigemAuditoria,
  PersonalizacaoComercial,
  PerfilUsuario,
  redigirSegredos,
  tipoAuditoriaConhecido,
  type ConsultarAuditoriaQuery,
  type OrigemAuditoria as OrigemAuditoriaTipo,
  type TipoAuditoria,
} from '@arcco/contratos';
import { Prisma } from '@prisma/client';
import { Prisma as PrismaPlataforma } from '../../database/generated/platform';
import { Erros } from '../../common/erros/erros';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';

export interface RegistroAuditoria {
  empresaId: string;
  usuarioId?: string | null;
  tipo: TipoAuditoria;
  entidade: string;
  entidadeId: string;
  anterior?: unknown;
  posterior?: unknown;
}

type ClienteLog = Pick<Prisma.TransactionClient, 'logAuditoria'>;
type ClientePermissao = PrismaPlataforma.TransactionClient;

type LinhaLista = {
  id: string;
  empresaId: string;
  usuarioId: string | null;
  tipo: string;
  entidade: string;
  entidadeId: string;
  criadoEm: Date;
  origem: OrigemAuditoriaTipo;
};

/**
 * Grava a trilha só para empresa com a flag. Sem a flag, não escreve.
 * Preço, estoque e nota usam o banco operacional, na transação da operação.
 * Permissão usa o banco da plataforma, na mesma transação da concessão.
 * Não há alteração nem exclusão. A leitura mescla os dois bancos (ECOL-27b).
 */
@Injectable()
export class AuditoriaService {
  constructor(
    private readonly platform: PlatformPrismaService,
    @Optional() private readonly operacional?: PrismaService,
  ) {}

  async registrar(tx: ClienteLog, entrada: RegistroAuditoria): Promise<void> {
    const empresa = await this.platform.empresa.findUnique({
      where: { id: entrada.empresaId },
      select: { configuracoes: true },
    });
    if (lerPersonalizacaoComercial(empresa?.configuracoes) !== PersonalizacaoComercial.ECOLUME) {
      return;
    }
    if (!tipoAuditoriaConhecido(entrada.tipo)) {
      throw Erros.invalido('AUDITORIA_DESCONHECIDA', 'Tipo de auditoria desconhecido');
    }

    await tx.logAuditoria.create({
      data: this.dados(entrada, (valor) => this.jsonOperacional(valor)) as Prisma.LogAuditoriaCreateInput,
    });
  }

  /**
   * Mesma transação da concessão. O cliente precisa ser o `tx` de `platform.$transaction`.
   */
  async registrarPermissao(tx: ClientePermissao, entrada: RegistroAuditoria): Promise<void> {
    const empresa = await tx.empresa.findUnique({
      where: { id: entrada.empresaId },
      select: { configuracoes: true },
    });
    if (lerPersonalizacaoComercial(empresa?.configuracoes) !== PersonalizacaoComercial.ECOLUME) {
      return;
    }
    if (!tipoAuditoriaConhecido(entrada.tipo)) {
      throw Erros.invalido('AUDITORIA_DESCONHECIDA', 'Tipo de auditoria desconhecido');
    }
    await tx.logAuditoria.create({
      data: this.dados(entrada, (valor) => this.jsonPlataforma(valor)) as PrismaPlataforma.LogAuditoriaCreateInput,
    });
  }

  /**
   * Consulta administrativa: une operacional + plataforma sem TX distribuída.
   * Ordenação estável: mais recente primeiro (`criadoEm` desc, `id` desc).
   */
  async listar(
    empresaId: string,
    ator: { id: string; perfil: string },
    query: ConsultarAuditoriaQuery,
  ) {
    await this.exigirConsulta(empresaId, ator);
    const op = this.exigirOperacional();
    const where = this.whereConsulta(empresaId, query);
    const selectLista = {
      id: true,
      empresaId: true,
      usuarioId: true,
      tipo: true,
      entidade: true,
      entidadeId: true,
      criadoEm: true,
    } as const;

    const [linhasOp, linhasPlat] = await Promise.all([
      op.logAuditoria.findMany({ where, select: selectLista }),
      this.platform.logAuditoria.findMany({ where, select: selectLista }),
    ]);

    const mesclado: LinhaLista[] = [
      ...linhasOp.map((l) => ({ ...l, origem: OrigemAuditoria.OPERACIONAL as OrigemAuditoriaTipo })),
      ...linhasPlat.map((l) => ({ ...l, origem: OrigemAuditoria.PLATAFORMA as OrigemAuditoriaTipo })),
    ].sort((a, b) => {
      const delta = b.criadoEm.getTime() - a.criadoEm.getTime();
      if (delta !== 0) return delta;
      return b.id.localeCompare(a.id);
    });

    const total = mesclado.length;
    const inicio = (query.pagina - 1) * query.porPagina;
    const pagina = mesclado.slice(inicio, inicio + query.porPagina);
    const nomes = await this.nomesUsuarios(
      empresaId,
      pagina.map((l) => l.usuarioId).filter((id): id is string => !!id),
    );

    return criarRespostaPaginada(
      pagina.map((l) => ({
        id: l.id,
        origem: l.origem,
        empresaId: l.empresaId,
        usuarioId: l.usuarioId,
        usuarioNome: l.usuarioId ? (nomes.get(l.usuarioId) ?? null) : null,
        tipo: l.tipo,
        entidade: l.entidade,
        entidadeId: l.entidadeId,
        criadoEm: l.criadoEm.toISOString(),
      })),
      total,
      query.pagina,
      query.porPagina,
    );
  }

  async obter(
    empresaId: string,
    ator: { id: string; perfil: string },
    id: string,
    origem?: OrigemAuditoriaTipo,
  ) {
    await this.exigirConsulta(empresaId, ator);
    const op = this.exigirOperacional();

    const buscarOp = async () =>
      op.logAuditoria.findFirst({ where: { id, empresaId } });
    const buscarPlat = async () =>
      this.platform.logAuditoria.findFirst({ where: { id, empresaId } });

    let linha:
      | (Awaited<ReturnType<typeof buscarOp>> & { origem: OrigemAuditoriaTipo })
      | null = null;

    if (origem === OrigemAuditoria.OPERACIONAL) {
      const encontrada = await buscarOp();
      if (encontrada) linha = { ...encontrada, origem: OrigemAuditoria.OPERACIONAL };
    } else if (origem === OrigemAuditoria.PLATAFORMA) {
      const encontrada = await buscarPlat();
      if (encontrada) linha = { ...encontrada, origem: OrigemAuditoria.PLATAFORMA };
    } else {
      const [a, b] = await Promise.all([buscarOp(), buscarPlat()]);
      if (a) linha = { ...a, origem: OrigemAuditoria.OPERACIONAL };
      else if (b) linha = { ...b, origem: OrigemAuditoria.PLATAFORMA };
    }

    if (!linha) {
      throw Erros.naoEncontrado('AUDITORIA_NAO_ENCONTRADA', 'Registro de auditoria nao encontrado');
    }

    const nomes = await this.nomesUsuarios(
      empresaId,
      linha.usuarioId ? [linha.usuarioId] : [],
    );

    return {
      id: linha.id,
      origem: linha.origem,
      empresaId: linha.empresaId,
      usuarioId: linha.usuarioId,
      usuarioNome: linha.usuarioId ? (nomes.get(linha.usuarioId) ?? null) : null,
      tipo: linha.tipo,
      entidade: linha.entidade,
      entidadeId: linha.entidadeId,
      anterior: redigirSegredos(linha.anterior),
      posterior: redigirSegredos(linha.posterior),
      criadoEm: linha.criadoEm.toISOString(),
    };
  }

  alterar(): never {
    throw Erros.semPermissao('Registro de auditoria nao pode ser alterado');
  }

  excluir(): never {
    throw Erros.semPermissao('Registro de auditoria nao pode ser excluido');
  }

  private async exigirConsulta(empresaId: string, ator: { id: string; perfil: string }) {
    if (ator.perfil !== PerfilUsuario.PROPRIETARIO) {
      throw Erros.semPermissao('Apenas o administrador consulta o historico de auditoria');
    }
    const empresa = await this.platform.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    });
    if (lerPersonalizacaoComercial(empresa?.configuracoes) !== PersonalizacaoComercial.ECOLUME) {
      throw Erros.naoEncontrado(
        'AUDITORIA_INDISPONIVEL',
        'Historico de auditoria so na personalizacao ECOLUME',
      );
    }
  }

  private exigirOperacional(): PrismaService {
    if (!this.operacional) {
      throw Erros.invalido('AUDITORIA_SEM_OPERACIONAL', 'Leitura operacional indisponivel');
    }
    return this.operacional;
  }

  private whereConsulta(empresaId: string, query: ConsultarAuditoriaQuery) {
    const criadoEm: { gte?: Date; lte?: Date } = {};
    if (query.de) {
      const inicio = new Date(query.de);
      inicio.setHours(0, 0, 0, 0);
      criadoEm.gte = inicio;
    }
    if (query.ate) {
      const fim = new Date(query.ate);
      fim.setHours(23, 59, 59, 999);
      criadoEm.lte = fim;
    }
    return {
      empresaId,
      ...(query.usuarioId ? { usuarioId: query.usuarioId } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(Object.keys(criadoEm).length > 0 ? { criadoEm } : {}),
    };
  }

  private async nomesUsuarios(empresaId: string, ids: string[]) {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return new Map<string, string>();
    const usuarios = await this.platform.usuario.findMany({
      where: { empresaId, id: { in: unicos } },
      select: { id: true, nome: true },
    });
    return new Map(usuarios.map((u) => [u.id, u.nome]));
  }

  private dados(entrada: RegistroAuditoria, json: (valor: unknown) => unknown) {
    return {
      empresaId: entrada.empresaId,
      usuarioId: entrada.usuarioId || null,
      tipo: entrada.tipo,
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId,
      anterior: json(redigirSegredos(entrada.anterior)),
      posterior: json(redigirSegredos(entrada.posterior)),
    };
  }

  private jsonOperacional(valor: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (valor === undefined || valor === null) return Prisma.JsonNull;
    return valor as Prisma.InputJsonValue;
  }

  private jsonPlataforma(
    valor: unknown,
  ): PrismaPlataforma.InputJsonValue | typeof PrismaPlataforma.JsonNull {
    if (valor === undefined || valor === null) return PrismaPlataforma.JsonNull;
    return valor as PrismaPlataforma.InputJsonValue;
  }
}
