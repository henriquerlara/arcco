import { Injectable } from '@nestjs/common';
import type {
  criarEtapaFunilSchema,
  reordenarEtapasSchema,
  excluirEtapaSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';

type CriarEtapaInput = z.infer<typeof criarEtapaFunilSchema>;
type AtualizarEtapaInput = Partial<CriarEtapaInput>;
type ReordenarInput = z.infer<typeof reordenarEtapasSchema>;
type ExcluirInput = z.infer<typeof excluirEtapaSchema>;

@Injectable()
export class FunilService {
  constructor(private readonly prisma: PrismaService) {}

  listar(empresaId: string) {
    return this.prisma.etapaFunil.findMany({
      where: { empresaId },
      orderBy: { ordem: 'asc' },
    });
  }

  async obter(empresaId: string, id: string) {
    const etapa = await this.prisma.etapaFunil.findFirst({ where: { id, empresaId } });
    if (!etapa) throw Erros.naoEncontrado('ETAPA_NAO_ENCONTRADA', 'Etapa nao encontrada');
    return etapa;
  }

  async criar(empresaId: string, dto: CriarEtapaInput) {
    return this.prisma.etapaFunil.create({
      data: {
        empresaId,
        nome: dto.nome,
        ordem: dto.ordem,
        tipo: dto.tipo,
        ativo: dto.ativo ?? true,
      },
    });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarEtapaInput) {
    await this.obter(empresaId, id);
    return this.prisma.etapaFunil.update({
      where: { id },
      data: { nome: dto.nome, ordem: dto.ordem, tipo: dto.tipo, ativo: dto.ativo },
    });
  }

  async reordenar(empresaId: string, dto: ReordenarInput) {
    const ids = dto.etapas.map((e) => e.id);
    const existentes = await this.prisma.etapaFunil.findMany({
      where: { empresaId, id: { in: ids } },
      select: { id: true },
    });
    if (existentes.length !== ids.length) {
      throw Erros.invalido('ETAPAS_INVALIDAS', 'Uma ou mais etapas nao pertencem a empresa');
    }

    await this.prisma.$transaction(
      dto.etapas.map((e) =>
        this.prisma.etapaFunil.update({ where: { id: e.id }, data: { ordem: e.ordem } }),
      ),
    );
    return this.listar(empresaId);
  }

  async excluir(empresaId: string, id: string, dto: ExcluirInput) {
    await this.obter(empresaId, id);
    if (id === dto.etapaDestinoId) {
      throw Erros.invalido('ETAPA_DESTINO_INVALIDA', 'A etapa de destino deve ser diferente');
    }
    await this.obter(empresaId, dto.etapaDestinoId);

    await this.prisma.$transaction([
      this.prisma.oportunidade.updateMany({
        where: { empresaId, etapaId: id },
        data: { etapaId: dto.etapaDestinoId },
      }),
      this.prisma.etapaFunil.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
