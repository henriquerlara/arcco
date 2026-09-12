import { Injectable } from '@nestjs/common';
import { Prisma, type EventoOportunidade } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type ClienteDados = PrismaService | Prisma.TransactionClient;

export const TipoEvento = {
  OPORTUNIDADE_CRIADA: 'OPORTUNIDADE_CRIADA',
  ETAPA_ALTERADA: 'ETAPA_ALTERADA',
  ATIVIDADE_CRIADA: 'ATIVIDADE_CRIADA',
  ATIVIDADE_CONCLUIDA: 'ATIVIDADE_CONCLUIDA',
  ORCAMENTO_ENVIADO: 'ORCAMENTO_ENVIADO',
  ESTOQUE_BAIXADO: 'ESTOQUE_BAIXADO',
  AJUSTE_CORRIGIDO: 'AJUSTE_CORRIGIDO',
} as const;

export interface NovoEvento {
  empresaId: string;
  oportunidadeId: string;
  tipo: (typeof TipoEvento)[keyof typeof TipoEvento];
  titulo: string;
  descricao?: string | null;
  origem?: string;
  usuarioId?: string | null;
  dados?: Prisma.InputJsonValue;
  criadoEm?: Date;
}

/** Centraliza o histórico imutável e a próxima ação derivada do trabalho real. */
@Injectable()
export class EventosService {
  constructor(private readonly prisma: PrismaService) {}

  registrar(cliente: ClienteDados, evento: NovoEvento): Promise<EventoOportunidade> {
    return cliente.eventoOportunidade.create({
      data: {
        empresaId: evento.empresaId,
        oportunidadeId: evento.oportunidadeId,
        tipo: evento.tipo,
        titulo: evento.titulo,
        descricao: evento.descricao ?? null,
        origem: evento.origem ?? 'SISTEMA',
        usuarioId: evento.usuarioId ?? null,
        dados: evento.dados ?? {},
        criadoEm: evento.criadoEm,
      },
    });
  }

  async sincronizarProximaAcao(empresaId: string, oportunidadeId: string): Promise<void> {
    const proxima = await this.prisma.atividade.findFirst({
      where: { empresaId, oportunidadeId, concluida: false },
      orderBy: { vencimento: 'asc' },
      select: { titulo: true, vencimento: true },
    });
    await this.prisma.oportunidade.updateMany({
      where: { id: oportunidadeId, empresaId },
      data: {
        proximaAcao: proxima?.titulo ?? null,
        dataProximaAcao: proxima?.vencimento ?? null,
      },
    });
  }
}
