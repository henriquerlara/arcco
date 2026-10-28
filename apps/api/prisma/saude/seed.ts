import { PrismaClient as PlatformClient } from '../../src/database/generated/platform';
import { PrismaClient as SaudeClient } from '../../src/database/generated/saude';
import * as argon2 from 'argon2';

const platform = new PlatformClient();
const saude = new SaudeClient();

const EMAIL = 'marina.alves@demo.arcco.local';
const SENHA = 'Arcco@123';

function hojeMais(dias: number): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate() + dias));
}

async function main() {
  const senhaHash = await argon2.hash(SENHA, { type: argon2.argon2id });
  const existente = await platform.usuario.findUnique({ where: { email: EMAIL } });
  if (existente) {
    await saude.consulta.deleteMany({ where: { empresaId: existente.empresaId } });
    await saude.gradeSemanal.deleteMany({ where: { empresaId: existente.empresaId } });
    await saude.medicamento.deleteMany({ where: { empresaId: existente.empresaId } });
    await saude.paciente.deleteMany({ where: { empresaId: existente.empresaId } });
    await saude.profissional.deleteMany({ where: { empresaId: existente.empresaId } });
    await saude.configuracaoClinica.deleteMany({ where: { empresaId: existente.empresaId } });
    await platform.usuario.deleteMany({ where: { empresaId: existente.empresaId } });
    await platform.empresa.delete({ where: { id: existente.empresaId } });
  }

  const empresa = await platform.empresa.create({
    data: {
      nome: 'Clínica Aurora',
      nomeFantasia: 'Clínica Aurora',
      ramo: 'SAUDE',
      segmento: 'OUTRO',
      telefone: '3731800386',
      cidade: 'Divinópolis',
      estado: 'MG',
      databaseHost: 'localhost',
      databasePort: 5432,
      databaseName: 'db_clinica_arcco',
      configuracoes: { onboardingConcluido: true },
    },
  });

  await platform.usuario.create({
    data: {
      empresaId: empresa.id,
      nome: 'Marina Alves',
      email: EMAIL,
      senhaHash,
      perfil: 'PROPRIETARIO',
      ativo: true,
    },
  });

  const profissionais = await Promise.all(
    [
      ['Dr. João Silva', 'cardiologia'],
      ['Dra. Ana Costa', 'clinico_geral'],
      ['Dr. Pedro Lima', 'dermatologia'],
    ].map(([nome, especialidade]) =>
      saude.profissional.create({
        data: {
          empresaId: empresa.id,
          nome,
          especialidade,
          grades: {
            create: [1, 2, 3, 4, 5].map((diaSemana) => ({
              empresaId: empresa.id,
              diaSemana,
              aberto: true,
              horaInicio: '08:00',
              horaFim: '18:00',
            })),
          },
        },
      }),
    ),
  );

  const pacientes = await Promise.all(
    [
      ['Helena Duarte', '37999910001', 'Unimed', '001122'],
      ['Carlos Mendes', '37999910002', 'Particular', null],
      ['Lívia Nogueira', '37999910003', 'Amil', '884421'],
    ].map(([nome, telefone, convenio, numeroCarteira]) =>
      saude.paciente.create({
        data: {
          empresaId: empresa.id,
          nome,
          telefone,
          convenio,
          numeroCarteira,
        },
      }),
    ),
  );

  await saude.consulta.createMany({
    data: [
      {
        empresaId: empresa.id,
        pacienteId: pacientes[0].id,
        profissionalId: profissionais[0].id,
        data: hojeMais(0),
        hora: '09:00',
        especialidade: 'cardiologia',
        convenio: 'Unimed',
        numeroCarteira: '001122',
        status: 'CONFIRMADA',
      },
      {
        empresaId: empresa.id,
        pacienteId: pacientes[1].id,
        profissionalId: profissionais[1].id,
        data: hojeMais(0),
        hora: '10:30',
        especialidade: 'clinico_geral',
        convenio: 'Particular',
        status: 'AGENDADA',
      },
      {
        empresaId: empresa.id,
        pacienteId: pacientes[2].id,
        profissionalId: profissionais[2].id,
        data: hojeMais(1),
        hora: '14:00',
        especialidade: 'dermatologia',
        convenio: 'Amil',
        numeroCarteira: '884421',
        status: 'AGENDADA',
      },
    ],
  });

  await saude.medicamento.createMany({
    data: [
      { empresaId: empresa.id, nome: 'Dipirona', apresentacao: '500 mg', estoque: 40, estoqueMinimo: 10 },
      { empresaId: empresa.id, nome: 'Amoxicilina', apresentacao: '500 mg', estoque: 4, estoqueMinimo: 8 },
      { empresaId: empresa.id, nome: 'Losartana', apresentacao: '50 mg', estoque: 22, estoqueMinimo: 6 },
    ],
  });

  await saude.configuracaoClinica.create({
    data: { empresaId: empresa.id, duracaoSlotMinutos: 30, horizonteDias: 30 },
  });

  console.log(`Clínica semeada. Entre em /saude/entrar com ${EMAIL} / ${SENHA}`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(async () => {
    await platform.$disconnect();
    await saude.$disconnect();
  });
