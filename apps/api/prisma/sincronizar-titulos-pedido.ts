import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.oportunidade.findMany({
    where: { NOT: { titulo: { equals: undefined } } },
    select: { id: true, codigo: true, titulo: true },
  });
  let n = 0;
  for (const row of rows) {
    if (row.titulo === row.codigo) continue;
    await prisma.oportunidade.update({
      where: { id: row.id },
      data: { titulo: row.codigo },
    });
    n += 1;
  }
  console.log(`Títulos sincronizados com o nº do pedido: ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
