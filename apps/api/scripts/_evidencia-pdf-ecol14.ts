import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  compactarTextoPdf,
  extrairTextoPdf,
  renderizarPdfEcolume,
  TERMOS_PROIBIDOS_PDF_ECOLUME,
} from '../src/modules/orcamentos/pdf-orcamento';

async function main() {
  const buf = await renderizarPdfEcolume({
    empresa: {
      nome: 'Ecolume Iluminação',
      telefone: '1933334444',
      endereco: 'Rua Comercial, 100, Campinas/SP',
      cnpj: '11222333000181',
    },
    vendedor: { nome: 'Ana Vendas', email: 'ana@ecolume.local' },
    logo: null,
    orcamento: {
      numero: 'ORC-0014',
      versao: 1,
      descontoValor: 50,
      subtotal: 549.12,
      total: 499.12,
      validadeEm: new Date('2026-12-15T12:00:00Z'),
      criadoEm: new Date('2026-10-27T15:00:00Z'),
      observacoes: 'Prazo de entrega sob consulta. Condições: Pix ou boleto 30 dias.',
      itens: [
        {
          nome: 'Luminaria Stella - descricao comercial editada',
          sku: 'SKU-NAO-DEVE-APARECER',
          unidade: 'un',
          quantidade: 2,
          precoUnitario: 274.56,
          desconto: 0,
          totalLinha: 549.12,
        },
      ],
    },
    cliente: 'Cliente Evidência LTDA',
    telefoneCliente: '11988887777',
    obra: 'Obra Demo',
    enderecoObra: 'Av Evidência, 50',
    numeroPedido: 'NEG-0014',
  });

  const dir = join(process.cwd(), 'tmp');
  mkdirSync(dir, { recursive: true });
  const pdfPath = join(dir, 'ecol14-evidencia.pdf');
  const txtPath = join(dir, 'ecol14-evidencia.txt');
  writeFileSync(pdfPath, buf);
  const bruto = extrairTextoPdf(buf);
  const compacto = compactarTextoPdf(bruto);
  writeFileSync(txtPath, `${bruto}\n\n--- compacto ---\n${compacto}\n`);

  const proibidos = TERMOS_PROIBIDOS_PDF_ECOLUME.filter((t) =>
    compacto.includes(compactarTextoPdf(t)),
  );
  const checks = {
    magic: buf.subarray(0, 4).toString('utf8') === '%PDF',
    orc: compacto.includes('ORC-0014'),
    cliente: compacto.includes('ClienteEvidênciaLTDA'),
    descricao: compacto.includes(compactarTextoPdf('Luminaria Stella - descricao comercial editada')),
    total: /499,12|499.12/.test(compacto),
    semSku: !compacto.includes('SKU-NAO-DEVE-APARECER'),
    proibidos,
  };
  console.log(JSON.stringify({ pdfPath, txtPath, size: buf.length, checks }, null, 2));
  if (!checks.magic || !checks.orc || !checks.cliente || !checks.descricao || !checks.total || !checks.semSku || proibidos.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
