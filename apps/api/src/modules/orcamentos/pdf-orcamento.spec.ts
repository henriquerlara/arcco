import { describe, expect, it } from 'vitest';
import {
  compactarTextoPdf,
  extrairTextoPdf,
  renderizarPdfEcolume,
  renderizarPdfLegado,
  type DadosPdfOrcamento,
} from './pdf-orcamento';

function base(parcial: Partial<DadosPdfOrcamento['orcamento']> = {}): DadosPdfOrcamento {
  return {
    empresa: {
      nome: 'Ecolume Iluminação',
      telefone: '1933334444',
      endereco: 'Rua A, 10, Campinas/SP',
      cnpj: '11222333000181',
    },
    vendedor: { nome: 'Ana', email: 'ana@teste.local' },
    logo: null,
    orcamento: {
      numero: 'ORC-0007',
      versao: 1,
      descontoValor: 50,
      subtotal: 549.12,
      total: 499.12,
      validadeEm: new Date('2026-12-01T12:00:00Z'),
      criadoEm: new Date('2026-10-27T12:00:00Z'),
      observacoes: 'Entrega sob consulta',
      itens: [
        {
          nome: 'Descrição comercial Stella editada',
          sku: 'SKU-INTERNO-PROIBIDO',
          unidade: 'un',
          quantidade: 2,
          precoUnitario: 274.56,
          desconto: 0,
          totalLinha: 549.12,
        },
      ],
      ...parcial,
    },
    cliente: 'Cliente Comercial LTDA',
    telefoneCliente: '11999998888',
    obra: 'Projeto Alfa',
    enderecoObra: 'Av Obra, 100',
    numeroPedido: 'NEG-0003',
  };
}

function texto(buf: Buffer) {
  return compactarTextoPdf(extrairTextoPdf(buf));
}

describe('ECOL-14 PDF comercial', () => {
  it('inclui campos comerciais e valores persistidos sem SKU/custo/IPI', async () => {
    const buf = await renderizarPdfEcolume(base());
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    const t = texto(buf);

    expect(t).toContain('ORC-0007');
    expect(t).toContain('ClienteComercialLTDA');
    expect(t).toContain('DescriçãocomercialStellaeditada');
    expect(t).toContain('NEG-0003');
    expect(t).toMatch(/274,56|274.56/);
    expect(t).toMatch(/499,12|499.12/);
    expect(t).toContain('Desconto');
    expect(t).toContain('Entregasobconsulta');

    expect(t).not.toContain('SKU-INTERNO-PROIBIDO');
    expect(t).not.toContain('SKU');
    expect(t).not.toContain('versão');
    expect(t).not.toContain('custoMedio');
    expect(t).not.toContain('ultimoPreco');
    expect(t).not.toContain('custoBase');
    expect(t).not.toContain('nomeFiscal');
    expect(t).not.toContain('IPI');
    expect(t).not.toContain('NCM');
    expect(t).not.toContain('Fornecedor');
  }, 15_000);

  it('mostra desconto de linha quando persistido', async () => {
    const buf = await renderizarPdfEcolume(
      base({
        itens: [
          {
            nome: 'Item com desc',
            sku: null,
            unidade: 'un',
            quantidade: 1,
            precoUnitario: 100,
            desconto: 10,
            totalLinha: 90,
          },
        ],
        subtotal: 90,
        descontoValor: 0,
        total: 90,
      }),
    );
    const t = texto(buf);
    expect(t).toContain('Itemcomdesc');
    expect(t).toContain('Desc.linha');
  }, 15_000);

  it('legado ainda pode imprimir SKU', async () => {
    const buf = await renderizarPdfLegado(base());
    const t = texto(buf);
    expect(t).toContain('SKU-INTERNO-PROIBIDO');
    expect(t).toContain('versão');
  }, 15_000);

  it('não recalcula: usa total/preço informados mesmo com números “estranhos”', async () => {
    const buf = await renderizarPdfEcolume(
      base({
        itens: [
          {
            nome: 'Linha travada',
            sku: null,
            unidade: 'un',
            quantidade: 1,
            precoUnitario: 123.45,
            desconto: 0,
            totalLinha: 123.45,
          },
        ],
        subtotal: 123.45,
        descontoValor: 0,
        total: 123.45,
      }),
    );
    const t = texto(buf);
    expect(t).toContain('Linhatravada');
    expect(t).toMatch(/123,45|123.45/);
  }, 15_000);
});
