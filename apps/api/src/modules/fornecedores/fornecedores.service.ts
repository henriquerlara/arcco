import { Injectable } from '@nestjs/common';
import type { atualizarFornecedorSchema, criarFornecedorSchema } from '@arcco/contratos';
import { cnpjValido, digitosCnpj, TipoAuditoria } from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';

type CriarInput = z.infer<typeof criarFornecedorSchema>;
type AtualizarInput = z.infer<typeof atualizarFornecedorSchema>;

@Injectable()
export class FornecedoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissoes: PermissoesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async exigirEcolume(empresaId: string) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.naoEncontrado(
        'FORNECEDOR_INDISPONIVEL',
        'O cadastro de fornecedores nao esta disponivel para esta empresa',
      );
    }
  }

  private exigirCnpj(valor: string): string {
    const cnpj = digitosCnpj(valor);
    if (!cnpjValido(cnpj)) {
      throw Erros.invalido('CNPJ_INVALIDO', 'CNPJ invalido');
    }
    return cnpj;
  }

  private normalizar(registro: {
    aliquotaSt: Prisma.Decimal | number;
    [chave: string]: unknown;
  }) {
    return {
      ...registro,
      aliquotaSt: Number(registro.aliquotaSt),
    };
  }

  async listar(empresaId: string, busca?: string) {
    await this.exigirEcolume(empresaId);
    const where: Prisma.FornecedorWhereInput = { empresaId };
    const termo = busca?.trim();
    if (termo) {
      const digitos = digitosCnpj(termo);
      where.OR = [
        { nome: { contains: termo, mode: 'insensitive' } },
        { nomeCurto: { contains: termo, mode: 'insensitive' } },
        ...(digitos ? [{ cnpj: { contains: digitos } }] : []),
      ];
    }
    const lista = await this.prisma.fornecedor.findMany({
      where,
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
    return lista.map((item) => this.normalizar(item));
  }

  async obter(empresaId: string, id: string) {
    await this.exigirEcolume(empresaId);
    const fornecedor = await this.prisma.fornecedor.findFirst({ where: { id, empresaId } });
    if (!fornecedor) {
      throw Erros.naoEncontrado('FORNECEDOR_NAO_ENCONTRADO', 'Fornecedor nao encontrado');
    }
    return this.normalizar(fornecedor);
  }

  async criar(empresaId: string, dto: CriarInput) {
    await this.exigirEcolume(empresaId);
    const cnpj = this.exigirCnpj(dto.cnpj);
    const existente = await this.prisma.fornecedor.findFirst({ where: { empresaId, cnpj } });
    if (existente) {
      throw Erros.conflito('CNPJ_DUPLICADO', 'Ja existe fornecedor com este CNPJ nesta empresa');
    }
    const criado = await this.prisma.fornecedor.create({
      data: {
        empresaId,
        nome: dto.nome.trim(),
        nomeCurto: dto.nomeCurto?.trim() || null,
        cnpj,
        aliquotaSt: new Prisma.Decimal(dto.aliquotaSt.toFixed(4)),
        contatoNome: dto.contatoNome?.trim() || null,
        telefone: dto.telefone?.replace(/\D/g, '') || null,
        email: dto.email?.trim() || null,
        observacoes: dto.observacoes?.trim() || null,
        ativo: dto.ativo ?? true,
      },
    });
    return this.normalizar(criado);
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarInput, usuarioId?: string) {
    const atual = await this.obter(empresaId, id);
    if (dto.cnpj !== undefined) {
      const cnpj = this.exigirCnpj(dto.cnpj);
      const outro = await this.prisma.fornecedor.findFirst({
        where: { empresaId, cnpj, NOT: { id } },
      });
      if (outro) {
        throw Erros.conflito('CNPJ_DUPLICADO', 'Ja existe fornecedor com este CNPJ nesta empresa');
      }
    }

    const stNova =
      dto.aliquotaSt === undefined ? undefined : Number(dto.aliquotaSt.toFixed(4));
    const stMudou = stNova !== undefined && stNova !== Number(atual.aliquotaSt);

    // ST% e demais campos na mesma TX do log (§16.3 / ECOL-27b).
    const atualizado = await this.prisma.$transaction(async (tx) => {
      const gravado = await tx.fornecedor.update({
        where: { id },
        data: {
          nome: dto.nome?.trim(),
          nomeCurto:
            dto.nomeCurto === undefined ? undefined : dto.nomeCurto?.trim() || null,
          cnpj: dto.cnpj === undefined ? undefined : this.exigirCnpj(dto.cnpj),
          aliquotaSt:
            stNova === undefined ? undefined : new Prisma.Decimal(stNova.toFixed(4)),
          contatoNome:
            dto.contatoNome === undefined ? undefined : dto.contatoNome?.trim() || null,
          telefone:
            dto.telefone === undefined ? undefined : dto.telefone?.replace(/\D/g, '') || null,
          email: dto.email === undefined ? undefined : dto.email?.trim() || null,
          observacoes:
            dto.observacoes === undefined ? undefined : dto.observacoes?.trim() || null,
          ativo: dto.ativo,
        },
      });
      if (stMudou) {
        await this.auditoria.registrar(tx, {
          empresaId,
          usuarioId: usuarioId ?? null,
          tipo: TipoAuditoria.ALTERACAO_ST_FORNECEDOR,
          entidade: 'fornecedor',
          entidadeId: id,
          anterior: { aliquotaSt: Number(atual.aliquotaSt) },
          posterior: { aliquotaSt: stNova },
        });
      }
      return gravado;
    });
    // ST% alterado não recalcula precoVenda nem orçamentos (ECOL-08/13).
    return this.normalizar(atualizado);
  }

  async remover(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    const vinculados = await this.prisma.produto.count({ where: { empresaId, fornecedorId: id } });
    if (vinculados > 0) {
      throw Erros.conflito(
        'FORNECEDOR_EM_USO',
        'Nao e possivel excluir fornecedor vinculado a produtos',
      );
    }
    await this.prisma.fornecedor.delete({ where: { id } });
    return { id, excluido: true };
  }

  /** Vínculo opcional sem apagar codigoFornecedor textual. */
  async vincularProduto(empresaId: string, produtoId: string, fornecedorId: string | null) {
    await this.exigirEcolume(empresaId);
    const produto = await this.prisma.produto.findFirst({ where: { id: produtoId, empresaId } });
    if (!produto) throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
    if (fornecedorId) {
      const fornecedor = await this.prisma.fornecedor.findFirst({
        where: { id: fornecedorId, empresaId },
      });
      if (!fornecedor) {
        throw Erros.naoEncontrado('FORNECEDOR_NAO_ENCONTRADO', 'Fornecedor nao encontrado');
      }
    }
    const atualizado = await this.prisma.produto.update({
      where: { id: produtoId },
      data: { fornecedorId },
    });
    return {
      id: atualizado.id,
      fornecedorId: atualizado.fornecedorId,
      codigoFornecedor: atualizado.codigoFornecedor,
      precoVenda: atualizado.precoVenda,
      estoqueAtual: atualizado.estoqueAtual,
    };
  }
}
