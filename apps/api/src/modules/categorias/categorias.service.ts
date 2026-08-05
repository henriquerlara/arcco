import { Injectable } from '@nestjs/common';
import type { criarCategoriaSchema } from '@arcco/contratos';
import type { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';

type CriarCategoriaInput = z.infer<typeof criarCategoriaSchema>;
type AtualizarCategoriaInput = Partial<CriarCategoriaInput>;

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  listar(empresaId: string) {
    return this.prisma.categoria.findMany({
      where: { empresaId },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
  }

  async obter(empresaId: string, id: string) {
    const cat = await this.prisma.categoria.findFirst({ where: { id, empresaId } });
    if (!cat) throw Erros.naoEncontrado('CATEGORIA_NAO_ENCONTRADA', 'Categoria nao encontrada');
    return cat;
  }

  async criar(empresaId: string, dto: CriarCategoriaInput) {
    return this.prisma.categoria.create({
      data: {
        empresaId,
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        ordem: dto.ordem ?? 0,
        ativo: dto.ativo ?? true,
      },
    });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarCategoriaInput) {
    await this.obter(empresaId, id);
    return this.prisma.categoria.update({
      where: { id },
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        ordem: dto.ordem,
        ativo: dto.ativo,
      },
    });
  }

  async remover(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    const emUso = await this.prisma.oportunidade.count({ where: { empresaId, categoriaId: id } });
    if (emUso > 0) {
      // Nao apaga: apenas desativa para preservar historico.
      return this.prisma.categoria.update({ where: { id }, data: { ativo: false } });
    }
    await this.prisma.categoria.delete({ where: { id } });
    return { ok: true };
  }
}
