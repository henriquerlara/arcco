import { Injectable } from '@nestjs/common';
import {
  PermissaoComercial,
  possuiPermissao,
  TipoAuditoria,
  TipoMovimentacaoEstoque,
  cnpjValido,
  digitosCnpj,
  type confirmarNotaEntradaSchema,
  type salvarPendenteNotaEntradaSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { ArquivosService } from '../arquivos/arquivos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import {
  calcularCustoAposEntrada,
  precisaCustoReferenciaSaldo,
} from '../produtos/custo-medio';
import { parsearNfeXml, type NfeXmlParseado } from './nfe-xml.parser';

type ConfirmarInput = z.infer<typeof confirmarNotaEntradaSchema>;
type SalvarPendenteInput = z.infer<typeof salvarPendenteNotaEntradaSchema>;

const STATUS_PENDENTE = 'PENDENTE';
const STATUS_CONFERIDA = 'CONFERIDA';
type DecisaoItem = ConfirmarInput['itens'][number];
type Ator = { id: string; perfil: string };

function numeroOuNulo(valor: Prisma.Decimal | number | null | undefined): number | null {
  if (valor == null) return null;
  return Number(valor);
}

@Injectable()
export class NotasEntradaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissoes: PermissoesService,
    private readonly auditoria: AuditoriaService,
    private readonly arquivos: ArquivosService,
  ) {}

  private async exigirEcolume(empresaId: string) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.naoEncontrado(
        'NOTA_ENTRADA_INDISPONIVEL',
        'Importacao de XML nao esta disponivel para esta empresa',
      );
    }
  }

  private async exigirImportar(empresaId: string, ator: Ator) {
    await this.exigirEcolume(empresaId);
    const ctx = await this.permissoes.resolver({
      id: ator.id,
      empresaId,
      perfil: ator.perfil,
    });
    if (!possuiPermissao(ctx, PermissaoComercial.IMPORTAR_XML)) {
      throw Erros.semPermissao();
    }
  }

  private async chaveJaImportada(empresaId: string, chave: string): Promise<boolean> {
    const existente = await this.prisma.notaEntrada.findFirst({
      where: { empresaId, chaveAcesso: chave },
      select: { id: true },
    });
    return Boolean(existente);
  }

  /** ECOL-25 — leitura da aba Fiscal. Mutação exige IMPORTAR_XML. */
  async listar(empresaId: string, ator: Ator) {
    void ator;
    await this.exigirEcolume(empresaId);
    const notas = await this.prisma.notaEntrada.findMany({
      where: { empresaId },
      orderBy: [{ emitidoEm: 'desc' }, { criadoEm: 'desc' }],
      include: {
        fornecedor: { select: { id: true, nome: true, nomeCurto: true, cnpj: true } },
        _count: { select: { itens: true } },
      },
      take: 100,
    });
    return notas.map((n) => ({
      id: n.id,
      chaveAcesso: n.chaveAcesso,
      numero: n.numero,
      serie: n.serie,
      emitidoEm: n.emitidoEm,
      valorTotal: Number(n.valorTotal),
      status: n.status,
      arquivoXmlId: n.arquivoXmlId,
      fornecedor: n.fornecedor,
      qtdItens: n._count.itens,
      criadoEm: n.criadoEm,
    }));
  }

  async obter(empresaId: string, id: string, ator: Ator) {
    void ator;
    await this.exigirEcolume(empresaId);
    const nota = await this.prisma.notaEntrada.findFirst({
      where: { id, empresaId },
      include: {
        fornecedor: true,
        itens: { orderBy: { numeroItem: 'asc' } },
      },
    });
    if (!nota) throw Erros.naoEncontrado('NOTA_ENTRADA_NAO_ENCONTRADA', 'Nota de entrada nao encontrada');
    return {
      ...nota,
      valorTotal: Number(nota.valorTotal),
      fornecedor: {
        ...nota.fornecedor,
        aliquotaSt: Number(nota.fornecedor.aliquotaSt),
      },
      itens: nota.itens.map((i) => ({
        ...i,
        valorUnitario: Number(i.valorUnitario),
        valorTotal: Number(i.valorTotal),
      })),
    };
  }

  /** Pré-visualização: não grava. */
  async previsualizar(empresaId: string, xml: string, ator: Ator) {
    await this.exigirImportar(empresaId, ator);
    const nfe = parsearNfeXml(xml);
    if (await this.chaveJaImportada(empresaId, nfe.chaveAcesso)) {
      throw Erros.conflito('CHAVE_DUPLICADA', 'Esta NF-e ja foi importada nesta empresa');
    }
    return this.montarConferencia(empresaId, nfe);
  }

  private async montarConferencia(empresaId: string, nfe: NfeXmlParseado) {
    const fornecedor = await this.prisma.fornecedor.findFirst({
      where: { empresaId, cnpj: nfe.emitenteCnpj },
    });
    const itens = [];
    for (const item of nfe.itens) {
      let produto = null as null | {
        id: string;
        nome: string;
        codigoFornecedor: string | null;
        controlaEstoque: boolean;
        estoqueAtual: number;
        custoMedio: number | null;
        ncm: string | null;
        unidade: string;
      };
      if (fornecedor && item.codigoProduto) {
        const achado = await this.prisma.produto.findFirst({
          where: {
            empresaId,
            fornecedorId: fornecedor.id,
            codigoFornecedor: item.codigoProduto,
          },
        });
        if (achado) {
          produto = {
            id: achado.id,
            nome: achado.nome,
            codigoFornecedor: achado.codigoFornecedor,
            controlaEstoque: achado.controlaEstoque,
            estoqueAtual: achado.estoqueAtual,
            custoMedio: numeroOuNulo(achado.custoMedio),
            ncm: achado.ncm,
            unidade: achado.unidade,
          };
        }
      }
      const precisaRef =
        produto != null &&
        produto.controlaEstoque &&
        precisaCustoReferenciaSaldo(produto.estoqueAtual, produto.custoMedio);

      itens.push({
        numeroItem: item.numeroItem,
        codigoFornecedor: item.codigoProduto,
        descricaoFiscal: item.descricao,
        descricaoComercialSugerida: item.descricao,
        ncm: item.ncm,
        cest: item.cest,
        origemFiscal: item.origemFiscal,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
        ipi: item.ipi,
        produtoReconhecido: produto,
        acaoSugerida: produto ? ('reconhecido' as const) : ('criar' as const),
        controlaEstoqueSugerido: produto?.controlaEstoque ?? true,
        precisaCustoReferenciaSaldo: precisaRef,
      });
    }

    return {
      chaveAcesso: nfe.chaveAcesso,
      numero: nfe.numero,
      serie: nfe.serie,
      emitidoEm: nfe.emitidoEm,
      valorTotal: nfe.valorTotal,
      emitente: { cnpj: nfe.emitenteCnpj, nome: nfe.emitenteNome },
      fornecedor: fornecedor
        ? {
            id: fornecedor.id,
            nome: fornecedor.nome,
            cnpj: fornecedor.cnpj,
            aliquotaSt: Number(fornecedor.aliquotaSt),
            novo: false as const,
          }
        : {
            id: null,
            nome: nfe.emitenteNome,
            cnpj: nfe.emitenteCnpj,
            aliquotaSt: null,
            novo: true as const,
          },
      itens,
    };
  }

  /**
   * Salva a nota como PENDENTE: guarda XML, fornecedor e itens, sem movimentar estoque,
   * custo, saldo nem criar/alterar produtos. Decisões parciais são gravadas quando já resolvem produto.
   */
  async salvarPendente(empresaId: string, dto: SalvarPendenteInput, ator: Ator) {
    await this.exigirImportar(empresaId, ator);
    const nfe = parsearNfeXml(dto.xml);
    if (await this.chaveJaImportada(empresaId, nfe.chaveAcesso)) {
      throw Erros.conflito('CHAVE_DUPLICADA', 'Esta NF-e ja foi importada nesta empresa');
    }
    const decisoes = new Map((dto.itens ?? []).map((d) => [d.numeroItem, d]));

    const arquivo = await this.arquivos.enviar(empresaId, ator.id, {
      nome: `nfe-${nfe.chaveAcesso}.xml`,
      tipoMime: 'application/xml',
      conteudo: Buffer.from(dto.xml, 'utf8'),
      entidade: 'nota_entrada',
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${`nfe:${empresaId}:${nfe.chaveAcesso}`})
          )
        `;
        const duplicada = await tx.notaEntrada.findFirst({
          where: { empresaId, chaveAcesso: nfe.chaveAcesso },
          select: { id: true },
        });
        if (duplicada) {
          throw Erros.conflito('CHAVE_DUPLICADA', 'Esta NF-e ja foi importada nesta empresa');
        }

        const fornecedor = await this.resolverFornecedor(
          tx,
          empresaId,
          nfe,
          dto.aliquotaStFornecedor,
        );

        const itensData = [];
        for (const itemXml of nfe.itens) {
          const decisao = decisoes.get(itemXml.numeroItem);
          const produtoId = await this.localizarProdutoSemEfeito(
            tx,
            empresaId,
            fornecedor.id,
            itemXml,
            decisao,
          );
          itensData.push({
            empresaId,
            produtoId,
            numeroItem: itemXml.numeroItem,
            codigoFornecedor: itemXml.codigoProduto || null,
            descricao: decisao?.descricaoComercial?.trim() || itemXml.descricao,
            quantidade: itemXml.quantidade,
            unidade: itemXml.unidade,
            valorUnitario: new Prisma.Decimal(itemXml.valorUnitario.toFixed(4)),
            valorTotal: new Prisma.Decimal(itemXml.valorTotal.toFixed(4)),
            ipi: itemXml.ipi,
            ncm: itemXml.ncm,
            cest: itemXml.cest,
            origemFiscal: itemXml.origemFiscal,
            controlaEstoque: decisao?.controlaEstoque ?? true,
          });
        }

        const nota = await tx.notaEntrada.create({
          data: {
            empresaId,
            fornecedorId: fornecedor.id,
            chaveAcesso: nfe.chaveAcesso,
            numero: nfe.numero,
            serie: nfe.serie,
            emitidoEm: nfe.emitidoEm,
            valorTotal: new Prisma.Decimal(nfe.valorTotal.toFixed(4)),
            arquivoXmlId: arquivo.id,
            status: STATUS_PENDENTE,
            criadoPorId: ator.id,
            itens: { create: itensData },
          },
          include: { itens: true },
        });

        await this.arquivosVincularEntidade(tx, arquivo.id, nota.id);

        await this.auditoria.registrar(tx, {
          empresaId,
          usuarioId: ator.id,
          tipo: TipoAuditoria.IMPORTACAO_XML,
          entidade: 'nota_entrada',
          entidadeId: nota.id,
          anterior: null,
          posterior: {
            status: STATUS_PENDENTE,
            chaveAcesso: nfe.chaveAcesso,
            fornecedorId: fornecedor.id,
            valorTotal: nfe.valorTotal,
            qtdItens: nfe.itens.length,
            arquivoXmlId: arquivo.id,
          },
        });

        return {
          id: nota.id,
          chaveAcesso: nota.chaveAcesso,
          status: nota.status,
          valorTotal: Number(nota.valorTotal),
          qtdItens: nota.itens.length,
          arquivoXmlId: nota.arquivoXmlId,
        };
      });
    } catch (erro) {
      await this.arquivos.remover(empresaId, arquivo.id).catch(() => undefined);
      throw erro;
    }
  }

  /** Reabre a conferência de uma nota PENDENTE a partir do XML guardado. */
  async obterConferencia(empresaId: string, id: string, ator: Ator) {
    await this.exigirImportar(empresaId, ator);
    const nota = await this.prisma.notaEntrada.findFirst({
      where: { id, empresaId },
      include: { itens: { orderBy: { numeroItem: 'asc' } } },
    });
    if (!nota) {
      throw Erros.naoEncontrado('NOTA_ENTRADA_NAO_ENCONTRADA', 'Nota de entrada nao encontrada');
    }
    if (nota.status !== STATUS_PENDENTE) {
      throw Erros.conflito('NOTA_JA_CONFERIDA', 'Esta nota ja foi conferida');
    }
    const nfe = await this.lerXmlGuardado(empresaId, nota.arquivoXmlId);
    const conferencia = await this.montarConferencia(empresaId, nfe);
    return {
      ...conferencia,
      notaId: nota.id,
      status: nota.status,
      decisoes: nota.itens.map((i) => ({
        numeroItem: i.numeroItem,
        acao: i.produtoId ? ('vincular' as const) : ('criar' as const),
        produtoId: i.produtoId,
        descricaoComercial: i.descricao,
        controlaEstoque: i.controlaEstoque,
      })),
    };
  }

  private async lerXmlGuardado(empresaId: string, arquivoXmlId: string | null) {
    if (!arquivoXmlId) {
      throw Erros.naoEncontrado('XML_NAO_ENCONTRADO', 'XML desta nota nao esta disponivel');
    }
    const { buffer } = await this.arquivos.conteudo(empresaId, arquivoXmlId);
    return parsearNfeXml(buffer.toString('utf8'));
  }

  /** Só lê: vínculo explícito ou reconhecimento por código do fornecedor. Nunca cria/altera produto. */
  private async localizarProdutoSemEfeito(
    tx: Prisma.TransactionClient,
    empresaId: string,
    fornecedorId: string,
    item: NfeXmlParseado['itens'][number],
    decisao: DecisaoItem | undefined,
  ): Promise<string | null> {
    if (decisao?.acao === 'vincular' && decisao.produtoId) {
      const produto = await tx.produto.findFirst({
        where: { id: decisao.produtoId, empresaId },
        select: { id: true },
      });
      if (!produto) {
        throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
      }
      return produto.id;
    }
    if (decisao?.acao === 'reconhecido' && item.codigoProduto) {
      const porCodigo = await tx.produto.findFirst({
        where: { empresaId, fornecedorId, codigoFornecedor: item.codigoProduto },
        select: { id: true },
      });
      return porCodigo?.id ?? null;
    }
    return null;
  }

  /** Conclui uma nota PENDENTE: aplica estoque/custo como na importação direta. */
  private async confirmarPendente(empresaId: string, dto: ConfirmarInput, ator: Ator) {
    const existente = await this.prisma.notaEntrada.findFirst({
      where: { id: dto.notaEntradaId, empresaId },
      select: { id: true, status: true, arquivoXmlId: true },
    });
    if (!existente) {
      throw Erros.naoEncontrado('NOTA_ENTRADA_NAO_ENCONTRADA', 'Nota de entrada nao encontrada');
    }
    if (existente.status !== STATUS_PENDENTE) {
      throw Erros.conflito('NOTA_JA_CONFERIDA', 'Esta nota ja foi conferida');
    }
    const nfe = await this.lerXmlGuardado(empresaId, existente.arquivoXmlId);

    const decisoes = new Map(dto.itens.map((d) => [d.numeroItem, d]));
    for (const item of nfe.itens) {
      if (!decisoes.has(item.numeroItem)) {
        throw Erros.invalido('ITEM_SEM_DECISAO', `Falta decisao para o item ${item.numeroItem}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`nfe:${empresaId}:${nfe.chaveAcesso}`})
        )
      `;
      const nota = await tx.notaEntrada.findFirst({
        where: { id: existente.id, empresaId },
        include: { itens: true },
      });
      if (!nota) {
        throw Erros.naoEncontrado('NOTA_ENTRADA_NAO_ENCONTRADA', 'Nota de entrada nao encontrada');
      }
      if (nota.status !== STATUS_PENDENTE) {
        throw Erros.conflito('NOTA_JA_CONFERIDA', 'Esta nota ja foi conferida');
      }

      const fornecedor = await tx.fornecedor.findFirstOrThrow({
        where: { id: nota.fornecedorId, empresaId },
      });

      for (const itemXml of nfe.itens) {
        const decisao = decisoes.get(itemXml.numeroItem)!;
        const produtoId = await this.resolverProduto(
          tx,
          empresaId,
          fornecedor.id,
          itemXml,
          decisao,
          ator.id,
        );
        const produto = await tx.produto.findFirstOrThrow({ where: { id: produtoId, empresaId } });

        if (produto.controlaEstoque) {
          await this.aplicarEntrada(
            tx,
            empresaId,
            produto,
            itemXml,
            decisao.custoReferenciaSaldo ?? null,
            ator.id,
            nfe.chaveAcesso,
          );
        } else {
          await this.atualizarCamposFiscaisSemEstoque(tx, produto, itemXml, decisao);
        }

        const itemNota = nota.itens.find((i) => i.numeroItem === itemXml.numeroItem);
        const dadosItem = {
          produtoId,
          descricao: decisao.descricaoComercial?.trim() || itemXml.descricao,
          controlaEstoque: decisao.controlaEstoque ?? true,
        };
        if (itemNota) {
          await tx.itemNotaEntrada.update({ where: { id: itemNota.id }, data: dadosItem });
        } else {
          await tx.itemNotaEntrada.create({
            data: {
              empresaId,
              notaEntradaId: nota.id,
              numeroItem: itemXml.numeroItem,
              codigoFornecedor: itemXml.codigoProduto || null,
              quantidade: itemXml.quantidade,
              unidade: itemXml.unidade,
              valorUnitario: new Prisma.Decimal(itemXml.valorUnitario.toFixed(4)),
              valorTotal: new Prisma.Decimal(itemXml.valorTotal.toFixed(4)),
              ipi: itemXml.ipi,
              ncm: itemXml.ncm,
              cest: itemXml.cest,
              origemFiscal: itemXml.origemFiscal,
              ...dadosItem,
            },
          });
        }
      }

      const atualizada = await tx.notaEntrada.update({
        where: { id: nota.id },
        data: { status: STATUS_CONFERIDA },
        include: { itens: true },
      });

      await this.auditoria.registrar(tx, {
        empresaId,
        usuarioId: ator.id,
        tipo: TipoAuditoria.IMPORTACAO_XML,
        entidade: 'nota_entrada',
        entidadeId: nota.id,
        anterior: { status: STATUS_PENDENTE },
        posterior: {
          status: STATUS_CONFERIDA,
          chaveAcesso: nfe.chaveAcesso,
          fornecedorId: fornecedor.id,
          valorTotal: nfe.valorTotal,
          qtdItens: nfe.itens.length,
          arquivoXmlId: nota.arquivoXmlId,
        },
      });

      return {
        id: atualizada.id,
        chaveAcesso: atualizada.chaveAcesso,
        valorTotal: Number(atualizada.valorTotal),
        qtdItens: atualizada.itens.length,
        arquivoXmlId: atualizada.arquivoXmlId,
      };
    });
  }

  async confirmar(empresaId: string, dto: ConfirmarInput, ator: Ator) {
    await this.exigirImportar(empresaId, ator);
    if (dto.notaEntradaId) return this.confirmarPendente(empresaId, dto, ator);
    if (!dto.xml) {
      throw Erros.invalido('XML_AUSENTE', 'Informe o xml ou a notaEntradaId');
    }
    const xml = dto.xml;
    const nfe = parsearNfeXml(xml);
    if (await this.chaveJaImportada(empresaId, nfe.chaveAcesso)) {
      throw Erros.conflito('CHAVE_DUPLICADA', 'Esta NF-e ja foi importada nesta empresa');
    }

    const decisoes = new Map(dto.itens.map((d) => [d.numeroItem, d]));
    for (const item of nfe.itens) {
      if (!decisoes.has(item.numeroItem)) {
        throw Erros.invalido('ITEM_SEM_DECISAO', `Falta decisao para o item ${item.numeroItem}`);
      }
    }

    const arquivo = await this.arquivos.enviar(empresaId, ator.id, {
      nome: `nfe-${nfe.chaveAcesso}.xml`,
      tipoMime: 'application/xml',
      conteudo: Buffer.from(xml, 'utf8'),
      entidade: 'nota_entrada',
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${`nfe:${empresaId}:${nfe.chaveAcesso}`})
          )
        `;
        const duplicada = await tx.notaEntrada.findFirst({
          where: { empresaId, chaveAcesso: nfe.chaveAcesso },
          select: { id: true },
        });
        if (duplicada) {
          throw Erros.conflito('CHAVE_DUPLICADA', 'Esta NF-e ja foi importada nesta empresa');
        }

        const fornecedor = await this.resolverFornecedor(tx, empresaId, nfe, dto.aliquotaStFornecedor);

        const itensCriados: Array<{ produtoId: string; numeroItem: number }> = [];
        for (const itemXml of nfe.itens) {
          const decisao = decisoes.get(itemXml.numeroItem)!;
          const produtoId = await this.resolverProduto(
            tx,
            empresaId,
            fornecedor.id,
            itemXml,
            decisao,
            ator.id,
          );
          itensCriados.push({ produtoId, numeroItem: itemXml.numeroItem });

          const produto = await tx.produto.findFirstOrThrow({
            where: { id: produtoId, empresaId },
          });

          if (produto.controlaEstoque) {
            await this.aplicarEntrada(
              tx,
              empresaId,
              produto,
              itemXml,
              decisao.custoReferenciaSaldo ?? null,
              ator.id,
              nfe.chaveAcesso,
            );
          } else {
            await this.atualizarCamposFiscaisSemEstoque(tx, produto, itemXml, decisao);
          }
        }

        const nota = await tx.notaEntrada.create({
          data: {
            empresaId,
            fornecedorId: fornecedor.id,
            chaveAcesso: nfe.chaveAcesso,
            numero: nfe.numero,
            serie: nfe.serie,
            emitidoEm: nfe.emitidoEm,
            valorTotal: new Prisma.Decimal(nfe.valorTotal.toFixed(4)),
            arquivoXmlId: arquivo.id,
            status: 'CONFERIDA',
            criadoPorId: ator.id,
            itens: {
              create: nfe.itens.map((itemXml) => {
                const decisao = decisoes.get(itemXml.numeroItem)!;
                const produtoId = itensCriados.find((i) => i.numeroItem === itemXml.numeroItem)!
                  .produtoId;
                return {
                  empresaId,
                  produtoId,
                  numeroItem: itemXml.numeroItem,
                  codigoFornecedor: itemXml.codigoProduto || null,
                  descricao: decisao.descricaoComercial?.trim() || itemXml.descricao,
                  quantidade: itemXml.quantidade,
                  unidade: itemXml.unidade,
                  valorUnitario: new Prisma.Decimal(itemXml.valorUnitario.toFixed(4)),
                  valorTotal: new Prisma.Decimal(itemXml.valorTotal.toFixed(4)),
                  ipi: itemXml.ipi,
                  ncm: itemXml.ncm,
                  cest: itemXml.cest,
                  origemFiscal: itemXml.origemFiscal,
                  controlaEstoque: decisao.controlaEstoque ?? true,
                };
              }),
            },
          },
          include: { itens: true, fornecedor: true },
        });

        await this.arquivosVincularEntidade(tx, arquivo.id, nota.id);

        await this.auditoria.registrar(tx, {
          empresaId,
          usuarioId: ator.id,
          tipo: TipoAuditoria.IMPORTACAO_XML,
          entidade: 'nota_entrada',
          entidadeId: nota.id,
          anterior: null,
          posterior: {
            chaveAcesso: nfe.chaveAcesso,
            fornecedorId: fornecedor.id,
            valorTotal: nfe.valorTotal,
            qtdItens: nfe.itens.length,
            arquivoXmlId: arquivo.id,
          },
        });

        return {
          id: nota.id,
          chaveAcesso: nota.chaveAcesso,
          valorTotal: Number(nota.valorTotal),
          qtdItens: nota.itens.length,
          arquivoXmlId: nota.arquivoXmlId,
        };
      });
    } catch (erro) {
      await this.arquivos.remover(empresaId, arquivo.id).catch(() => undefined);
      throw erro;
    }
  }

  /** Lote: cada XML é independente; falha de um não impede os demais. */
  async confirmarLote(
    empresaId: string,
    lotes: ConfirmarInput[],
    ator: Ator,
  ): Promise<Array<{ ok: true; nota: Awaited<ReturnType<NotasEntradaService['confirmar']>> } | { ok: false; codigo: string; mensagem: string; chaveAcesso?: string }>> {
    const resultados = [];
    for (const dto of lotes) {
      try {
        const nota = await this.confirmar(empresaId, dto, ator);
        resultados.push({ ok: true as const, nota });
      } catch (e) {
        const err = e as { codigo?: string; message?: string };
        let chaveAcesso: string | undefined;
        try {
          if (dto.xml) chaveAcesso = parsearNfeXml(dto.xml).chaveAcesso;
        } catch {
          /* */
        }
        resultados.push({
          ok: false as const,
          codigo: err.codigo ?? 'ERRO_IMPORTACAO',
          mensagem: err.message ?? 'Falha na importacao',
          chaveAcesso,
        });
      }
    }
    return resultados;
  }

  private async arquivosVincularEntidade(
    tx: Prisma.TransactionClient,
    arquivoId: string,
    notaId: string,
  ) {
    await tx.arquivo.update({
      where: { id: arquivoId },
      data: { entidade: 'nota_entrada', entidadeId: notaId },
    });
  }

  private async resolverFornecedor(
    tx: Prisma.TransactionClient,
    empresaId: string,
    nfe: NfeXmlParseado,
    aliquotaSt: number | null | undefined,
  ) {
    const cnpj = digitosCnpj(nfe.emitenteCnpj);
    if (!cnpjValido(cnpj)) {
      throw Erros.invalido('CNPJ_INVALIDO', 'CNPJ do emitente invalido');
    }
    const existente = await tx.fornecedor.findFirst({ where: { empresaId, cnpj } });
    if (existente) return existente;
    if (aliquotaSt == null || Number.isNaN(Number(aliquotaSt))) {
      throw Erros.invalido(
        'ST_OBRIGATORIO',
        'Informe o ST% para cadastrar o fornecedor desta NF-e',
      );
    }
    return tx.fornecedor.create({
      data: {
        empresaId,
        nome: nfe.emitenteNome.trim() || 'Fornecedor',
        nomeCurto: nfe.emitenteNome.trim().slice(0, 60) || null,
        cnpj,
        aliquotaSt: new Prisma.Decimal(Number(aliquotaSt).toFixed(4)),
        ativo: true,
      },
    });
  }

  private async resolverProduto(
    tx: Prisma.TransactionClient,
    empresaId: string,
    fornecedorId: string,
    item: NfeXmlParseado['itens'][number],
    decisao: DecisaoItem,
    _usuarioId: string,
  ): Promise<string> {
    if (decisao.acao === 'reconhecido' || (decisao.acao === 'vincular' && !decisao.produtoId)) {
      if (item.codigoProduto) {
        const porCodigo = await tx.produto.findFirst({
          where: { empresaId, fornecedorId, codigoFornecedor: item.codigoProduto },
        });
        if (porCodigo) return porCodigo.id;
      }
      if (decisao.acao === 'reconhecido') {
        throw Erros.invalido(
          'PRODUTO_NAO_RECONHECIDO',
          `Produto do item ${item.numeroItem} nao foi reconhecido`,
        );
      }
    }

    if (decisao.acao === 'vincular') {
      if (!decisao.produtoId) {
        throw Erros.invalido('PRODUTO_OBRIGATORIO', `Informe o produto do item ${item.numeroItem}`);
      }
      const produto = await tx.produto.findFirst({
        where: { id: decisao.produtoId, empresaId },
      });
      if (!produto) {
        throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
      }
      await tx.produto.update({
        where: { id: produto.id },
        data: {
          fornecedorId,
          ...(produto.codigoFornecedor
            ? {}
            : { codigoFornecedor: item.codigoProduto || produto.codigoFornecedor }),
          ...(decisao.controlaEstoque !== undefined
            ? { controlaEstoque: decisao.controlaEstoque }
            : {}),
          ...(decisao.descricaoComercial?.trim()
            ? { descricaoComercial: decisao.descricaoComercial.trim() }
            : {}),
        },
      });
      return produto.id;
    }

    // criar
    const controla = decisao.controlaEstoque ?? true;
    const descricaoComercial =
      decisao.descricaoComercial?.trim() || item.descricao;
    const criado = await tx.produto.create({
      data: {
        empresaId,
        nome: descricaoComercial.slice(0, 200),
        descricao: item.descricao,
        nomeFiscal: item.descricao,
        descricaoComercial,
        unidade: item.unidade,
        ncm: item.ncm,
        cest: item.cest,
        origemFiscal: item.origemFiscal,
        codigoFornecedor: item.codigoProduto || null,
        fornecedorId,
        ipi: item.ipi,
        precoVenda: 0,
        estoqueAtual: 0,
        controlaEstoque: controla,
        ativo: true,
      },
    });
    const codigo = await this.proximoCodigoInterno(tx, empresaId);
    await tx.$executeRaw`
      UPDATE "produtos"
      SET "codigoInterno" = ${codigo}
      WHERE "id" = ${criado.id}
        AND "empresaId" = ${empresaId}
        AND "codigoInterno" IS NULL
    `;
    return criado.id;
  }

  private async proximoCodigoInterno(
    tx: Prisma.TransactionClient,
    empresaId: string,
  ): Promise<string> {
    const existentes = await tx.produto.findMany({
      where: { empresaId, codigoInterno: { not: null } },
      select: { codigoInterno: true },
    });
    let maior = 0;
    for (const item of existentes) {
      const m = item.codigoInterno?.match(/^CI-(\d+)$/);
      if (m) maior = Math.max(maior, Number(m[1]));
    }
    return `CI-${String(maior + 1).padStart(6, '0')}`;
  }

  private async atualizarCamposFiscaisSemEstoque(
    tx: Prisma.TransactionClient,
    produto: {
      id: string;
      ncm: string | null;
      cest: string | null;
      origemFiscal: string | null;
      unidade: string;
      ipi: number | null;
    },
    item: NfeXmlParseado['itens'][number],
    decisao: DecisaoItem,
  ) {
    await tx.produto.update({
      where: { id: produto.id },
      data: {
        ipi: item.ipi ?? produto.ipi,
        ...(produto.ncm ? {} : { ncm: item.ncm }),
        ...(produto.cest ? {} : { cest: item.cest }),
        ...(produto.origemFiscal ? {} : { origemFiscal: item.origemFiscal }),
        // P5: unidade da nota; só preenche se vazia — unidade sempre tem default, então
        // só sobrescrevemos em produto novo (já veio da nota). Em vínculo, só se for 'un' genérico vazio fiscal.
        ...(decisao.descricaoComercial?.trim()
          ? { descricaoComercial: decisao.descricaoComercial.trim() }
          : {}),
      },
    });
  }

  private async aplicarEntrada(
    tx: Prisma.TransactionClient,
    empresaId: string,
    produto: {
      id: string;
      estoqueAtual: number;
      custoMedio: Prisma.Decimal | null;
      ultimoPreco: Prisma.Decimal | null;
      ncm: string | null;
      cest: string | null;
      origemFiscal: string | null;
      unidade: string;
      ipi: number | null;
      controlaEstoque: boolean;
      precoVenda: number;
      codigoInterno: string | null;
    },
    item: NfeXmlParseado['itens'][number],
    custoReferenciaSaldo: number | null,
    usuarioId: string,
    chaveAcesso: string,
  ) {
    await tx.$queryRaw`
      SELECT 1 FROM "produtos"
      WHERE "id" = ${produto.id} AND "empresaId" = ${empresaId}
      FOR UPDATE
    `;
    const atual = await tx.produto.findFirstOrThrow({
      where: { id: produto.id, empresaId },
    });
    const custoInformado = item.valorUnitario;
    const custoMedioAnterior = numeroOuNulo(atual.custoMedio);
    const ultimoPrecoAnterior = numeroOuNulo(atual.ultimoPreco);

    if (
      precisaCustoReferenciaSaldo(atual.estoqueAtual, custoMedioAnterior) &&
      custoReferenciaSaldo == null
    ) {
      throw Erros.invalido(
        'CUSTO_REFERENCIA_OBRIGATORIO',
        `Informe o custo de referencia do saldo para o item ${item.numeroItem}`,
      );
    }

    const custos = calcularCustoAposEntrada({
      saldoAnterior: atual.estoqueAtual,
      custoMedioAnterior,
      quantidadeEntrada: item.quantidade,
      precoUnitario: custoInformado,
      custoReferenciaSaldo,
    });

    const saldoApos = atual.estoqueAtual + item.quantidade;
    await tx.produto.update({
      where: { id: atual.id },
      data: {
        estoqueAtual: saldoApos,
        custoMedio: new Prisma.Decimal(custos.custoMedio.toFixed(4)),
        ultimoPreco: new Prisma.Decimal(custos.ultimoPreco.toFixed(4)),
        ipi: item.ipi ?? atual.ipi,
        ...(atual.ncm ? {} : { ncm: item.ncm }),
        ...(atual.cest ? {} : { cest: item.cest }),
        ...(atual.origemFiscal ? {} : { origemFiscal: item.origemFiscal }),
      },
    });

    await tx.movimentacaoEstoque.create({
      data: {
        empresaId,
        produtoId: atual.id,
        tipo: TipoMovimentacaoEstoque.ENTRADA,
        quantidade: item.quantidade,
        saldoApos,
        observacao: `NF-e ${chaveAcesso}`,
        usuarioId,
        precoUnitarioCusto: new Prisma.Decimal(custoInformado.toFixed(4)),
      },
    });

    await this.auditoria.registrar(tx, {
      empresaId,
      usuarioId,
      tipo: TipoAuditoria.ENTRADA_ESTOQUE,
      entidade: 'produto',
      entidadeId: atual.id,
      anterior: {
        estoqueAtual: atual.estoqueAtual,
        custoMedio: custoMedioAnterior,
        ultimoPreco: ultimoPrecoAnterior,
      },
      posterior: {
        estoqueAtual: saldoApos,
        quantidade: item.quantidade,
        precoUnitarioCusto: custoInformado,
        ...(custoReferenciaSaldo != null ? { custoReferenciaSaldo } : {}),
        custoMedio: custos.custoMedio,
        ultimoPreco: custos.ultimoPreco,
        origem: 'IMPORTACAO_XML',
        chaveAcesso,
      },
    });
  }
}
