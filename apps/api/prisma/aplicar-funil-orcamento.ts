/**
 * One-shot: renomeia Qualificação → Orçamento, move cards de ORCAMENTO_ENVIADO
 * para Negociação e desativa a etapa ORCAMENTO_ENVIADO.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const renomeadas = await prisma.etapaFunil.updateMany({
    where: { chaveSistema: 'QUALIFICACAO' },
    data: { nome: 'Orçamento' },
  });

  const etapasEnviado = await prisma.etapaFunil.findMany({
    where: { chaveSistema: 'ORCAMENTO_ENVIADO' },
    select: { id: true, empresaId: true },
  });

  let movidas = 0;
  for (const enviada of etapasEnviado) {
    const negociacao = await prisma.etapaFunil.findFirst({
      where: {
        empresaId: enviada.empresaId,
        chaveSistema: 'NEGOCIACAO',
        ativo: true,
      },
      select: { id: true },
    });
    if (!negociacao) continue;
    const resultado = await prisma.oportunidade.updateMany({
      where: { empresaId: enviada.empresaId, etapaId: enviada.id },
      data: { etapaId: negociacao.id },
    });
    movidas += resultado.count;
  }

  const desativadas = await prisma.etapaFunil.updateMany({
    where: { chaveSistema: 'ORCAMENTO_ENVIADO' },
    data: { ativo: false },
  });

  // eslint-disable-next-line no-console
  console.log(
    `OK — renomeadas=${renomeadas.count}, movidas=${movidas}, desativadas=${desativadas.count}`,
  );
}

main()
  .catch((erro) => {
    // eslint-disable-next-line no-console
    console.error(erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
