import { describe, expect, it } from 'vitest';
import { StatusOrcamento } from '@arcco/contratos';
import { OrcamentosService } from './orcamentos.service';
import {
  compactarTextoPdf,
  extrairTextoPdf,
  TERMOS_PROIBIDOS_PDF_ECOLUME,
} from './pdf-orcamento';

function textoPdf(buf: Buffer) {
  return compactarTextoPdf(extrairTextoPdf(buf));
}
import type { PrismaService } from '../../database/prisma.service';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';
import type { ArquivosService } from '../arquivos/arquivos.service';
import type { PermissoesService } from '../permissoes/permissoes.service';
import type { ProdutosService } from '../produtos/produtos.service';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';

function montarPdf(ecolume: boolean) {
  const buffers = new Map<string, Buffer>();
  let arqSeq = 0;
  const orcamento = {
    id: 'orc-1',
    empresaId: 'emp',
    oportunidadeId: 'opp-1',
    numero: 'ORC-0007',
    versao: 1,
    status: StatusOrcamento.RASCUNHO as string,
    vigente: false,
    observacoes: 'Prazo sob consulta. Pagamento: 30 dias.',
    descontoValor: 50,
    descontoTipo: 'VALOR',
    descontoPercentual: null as number | null,
    subtotal: 549.12,
    total: 499.12,
    validadeEm: new Date('2026-12-01T12:00:00Z'),
    arquivoId: null as string | null,
    enviadoEm: null as Date | null,
    aceitoEm: null as Date | null,
    convertidoEm: null as Date | null,
    orcamentoOrigemId: null as string | null,
    criadoPorId: 'u1',
    criadoEm: new Date('2026-10-27T15:00:00Z'),
    atualizadoEm: new Date('2026-10-27T15:00:00Z'),
    itens: [
      {
        id: 'item-1',
        orcamentoId: 'orc-1',
        produtoId: 'prod-1',
        nome: 'Descrição comercial Stella editada',
        unidade: 'un',
        quantidade: 2,
        precoUnitario: 274.56,
        desconto: 0,
        totalLinha: 549.12,
        ordem: 0,
        custoBase: 120,
        ipiPercentual: 6.5,
        stPercentual: 0,
        margem: 1.6,
        codigoInterno: 'INT-999',
        produto: {
          sku: 'SKU-INTERNO-PROIBIDO',
          nome: 'Nome fiscal interno',
          nomeFiscal: 'Nome fiscal interno',
          codigoInterno: 'INT-999',
          ncm: '94054010',
          ean: '7891234567890',
        },
      },
    ],
    orcamentoOrigem: null,
  };

  const oportunidade = {
    id: 'opp-1',
    empresaId: 'emp',
    codigo: 'NEG-0003',
    responsavelId: 'u1',
    contato: { nome: 'Cliente Comercial LTDA', telefone: '11999998888' },
    obra: { nome: 'Projeto Alfa', endereco: 'Av Obra 100', bairro: null, cidade: 'Campinas', estado: 'SP', cep: null },
  };

  const prisma = {
    orcamento: {
      findFirst: async ({ where }: { where: { id?: string; empresaId: string } }) => {
        if (where.empresaId !== 'emp' || (where.id && where.id !== orcamento.id)) return null;
        return structuredClone(orcamento);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (where.id !== orcamento.id) throw new Error('missing');
        Object.assign(orcamento, data);
        return structuredClone(orcamento);
      },
    },
    oportunidade: {
      findFirst: async ({ where }: { where: { id: string; empresaId: string } }) =>
        where.id === oportunidade.id && where.empresaId === oportunidade.empresaId
          ? oportunidade
          : null,
    },
    produto: {
      findFirst: async () => null,
      findMany: async () => [],
    },
  };

  const platform = {
    empresa: {
      findUniqueOrThrow: async () => ({
        id: 'emp',
        nome: 'Ecolume Iluminação LTDA',
        nomeFantasia: 'Ecolume Iluminação',
        telefone: '1933334444',
        cnpj: '11222333000181',
        cidade: 'Campinas',
        estado: 'SP',
        logoArquivoId: null,
        enderecoFiscal: {
          logradouro: 'Rua A',
          numero: '10',
          municipio: 'Campinas',
          uf: 'SP',
          cep: '13000000',
        },
      }),
    },
    usuario: {
      findFirst: async () => ({ nome: 'Ana', email: 'ana@teste.local' }),
    },
  };

  const arquivos = {
    enviar: async (_e: string, _u: string | null, entrada: { nome: string; conteudo: Buffer }) => {
      arqSeq += 1;
      const id = `arq-${arqSeq}`;
      buffers.set(id, Buffer.from(entrada.conteudo));
      return { id, nome: entrada.nome, tipoMime: 'application/pdf', tamanho: entrada.conteudo.length };
    },
    conteudo: async (empresaId: string, id: string) => {
      if (empresaId !== 'emp') throw new Error('isolamento');
      const buffer = buffers.get(id);
      if (!buffer) throw new Error('arquivo ausente');
      return { arquivo: { id, nome: `${id}.pdf`, tipoMime: 'application/pdf' }, buffer };
    },
  };

  const permissoes = {
    empresaEcolume: async () => ecolume,
  } as unknown as PermissoesService;

  const produtos = {
    buscar: async () => null,
    obter: async () => null,
  } as unknown as ProdutosService;

  const servico = new OrcamentosService(
    prisma as unknown as PrismaService,
    platform as unknown as PlatformPrismaService,
    arquivos as unknown as ArquivosService,
    produtos,
    permissoes,
    {} as WhatsAppService,
  );

  return { servico, orcamento, buffers, arquivos };
}

describe('ECOL-14 PDF orçamento (serviço)', () => {
  it('gera PDF comercial com campos obrigatórios e sem dados internos', async () => {
    const { servico, orcamento, buffers } = montarPdf(true);
    const out = await servico.gerarPdf('emp', orcamento.id, 'u1');
    expect(out.arquivoId).toBeTruthy();
    const buf = buffers.get(out.arquivoId!)!;
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    const t = textoPdf(buf);

    expect(t).toContain('ORC-0007');
    expect(t).toContain('EcolumeIluminação');
    expect(t).toContain('ClienteComercialLTDA');
    expect(t).toContain('DescriçãocomercialStellaeditada');
    expect(t).toContain('NEG-0003');
    expect(t).toMatch(/274,56|274.56/);
    expect(t).toMatch(/499,12|499.12/);
    expect(t).toContain('Prazosobconsulta');
    expect(t).toContain('Pagamento:30dias');

    expect(t).not.toContain('SKU-INTERNO-PROIBIDO');
    expect(t).not.toContain('Nomefiscalinterno');
    expect(t).not.toContain('INT-999');
    expect(t).not.toContain('94054010');
    expect(t).not.toContain('7891234567890');
    for (const termo of TERMOS_PROIBIDOS_PDF_ECOLUME) {
      expect(t.includes(compactarTextoPdf(termo)), `não deveria conter "${termo}"`).toBe(false);
    }
  }, 20_000);

  it('não regenera PDF após enviado (imutabilidade do arquivo)', async () => {
    const { servico, orcamento, buffers } = montarPdf(true);
    const primeiro = await servico.gerarPdf('emp', orcamento.id, 'u1');
    const idArquivo = primeiro.arquivoId!;
    const bytesAntes = Buffer.from(buffers.get(idArquivo)!);

    orcamento.status = StatusOrcamento.ENVIADO;
    orcamento.enviadoEm = new Date();
    // Mutação “fantasma” nos itens não deve refletir no PDF congelado.
    orcamento.itens[0]!.nome = 'HACK NÃO DEVE IR AO PDF';
    orcamento.itens[0]!.precoUnitario = 1;
    orcamento.total = 1;

    const segundo = await servico.gerarPdf('emp', orcamento.id, 'u1');
    expect(segundo.arquivoId).toBe(idArquivo);
    expect(buffers.size).toBe(1);
    expect(Buffer.compare(buffers.get(idArquivo)!, bytesAntes)).toBe(0);

    const { buffer } = await servico.conteudoPdf('emp', orcamento.id, 'u1');
    const t = textoPdf(buffer);
    expect(t).toContain('DescriçãocomercialStellaeditada');
    expect(t).not.toContain('HACKNÃODEVEIRAO PDF'.replace(/\s/g, ''));
    expect(t).not.toContain(compactarTextoPdf('HACK NÃO DEVE IR AO PDF'));
    expect(t).toMatch(/499,12|499.12/);
  }, 20_000);

  it('legado ainda imprime SKU e regenera', async () => {
    const { servico, orcamento, buffers } = montarPdf(false);
    const a = await servico.gerarPdf('emp', orcamento.id, 'u1');
    const t1 = textoPdf(buffers.get(a.arquivoId!)!);
    expect(t1).toContain('SKU-INTERNO-PROIBIDO');
    expect(t1).toContain('versão');

    orcamento.status = StatusOrcamento.ENVIADO;
    orcamento.itens[0]!.nome = 'Legado atualizado';
    const b = await servico.gerarPdf('emp', orcamento.id, 'u1');
    expect(b.arquivoId).not.toBe(a.arquivoId);
    const t2 = textoPdf(buffers.get(b.arquivoId!)!);
    expect(t2).toContain('Legadoatualizado');
  }, 20_000);

  it('rascunho ECOLUME pode regenerar; valores persistidos, não do produto', async () => {
    const { servico, orcamento, buffers } = montarPdf(true);
    await servico.gerarPdf('emp', orcamento.id, 'u1');
    orcamento.itens[0]!.nome = 'Descrição comercial Stella editada v2';
    orcamento.itens[0]!.precoUnitario = 259.3;
    orcamento.itens[0]!.totalLinha = 518.6;
    orcamento.subtotal = 518.6;
    orcamento.descontoValor = 0;
    orcamento.total = 518.6;
    // produto “atual” mudaria — PDF usa só a linha.
    orcamento.itens[0]!.produto = {
      sku: 'NOVO-SKU',
      nome: 'Novo nome fiscal',
      nomeFiscal: 'Novo nome fiscal',
      codigoInterno: 'NOVO',
      ncm: '11111111',
      ean: '000',
    };

    const out = await servico.gerarPdf('emp', orcamento.id, 'u1');
    const t = textoPdf(buffers.get(out.arquivoId!)!);
    expect(t).toContain('DescriçãocomercialStellaeditadav2');
    expect(t).toMatch(/259,30|259.30|259,3/);
    expect(t).not.toContain('NOVO-SKU');
    expect(t).not.toContain(compactarTextoPdf('Novo nome fiscal'));
  }, 20_000);
});
