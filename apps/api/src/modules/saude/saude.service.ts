import { Injectable } from '@nestjs/common';
import { Prisma } from '../../database/generated/saude';
import type {
  CriarConsultaInput,
  CriarMedicamentoInput,
  CriarPacienteInput,
  CriarProfissionalInput,
} from '@arcco/contratos';
import { StatusConsulta } from '@arcco/contratos';
import { SaudePrismaService } from '../../database/saude-prisma.service';
import { Erros } from '../../common/erros/erros';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

@Injectable()
export class SaudeService {
  constructor(private readonly prisma: SaudePrismaService) {}

  async inicio(empresaId: string) {
    const hoje = this.dataHoje();
    const [consultasHoje, aguardando, medicamentosBaixos, profissionais] = await Promise.all([
      this.prisma.consulta.findMany({
        where: { empresaId, data: hoje, status: { not: StatusConsulta.CANCELADA } },
        include: { paciente: true, profissional: true },
        orderBy: { hora: 'asc' },
      }),
      this.prisma.consulta.count({
        where: { empresaId, data: hoje, status: StatusConsulta.AGENDADA },
      }),
      this.prisma.medicamento.findMany({
        where: { empresaId, ativo: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.profissional.count({ where: { empresaId, ativo: true } }),
    ]);

    return {
      consultasHoje: consultasHoje.map((c) => this.serializarConsulta(c)),
      resumo: {
        consultasHoje: consultasHoje.length,
        aguardandoConfirmacao: aguardando,
        profissionais,
        medicamentosAbaixoDoMinimo: medicamentosBaixos.filter((m) => m.estoque <= m.estoqueMinimo)
          .length,
      },
    };
  }

  listarPacientes(empresaId: string) {
    return this.prisma.paciente.findMany({
      where: { empresaId },
      orderBy: { nome: 'asc' },
    });
  }

  async criarPaciente(empresaId: string, dto: CriarPacienteInput) {
    return this.prisma.paciente.create({
      data: {
        empresaId,
        nome: dto.nome.trim(),
        telefone: dto.telefone.trim(),
        cpf: dto.cpf?.trim() || null,
        email: dto.email?.trim() || null,
        nascimento: dto.nascimento ? new Date(`${dto.nascimento}T00:00:00.000Z`) : null,
        convenio: dto.convenio?.trim() || null,
        numeroCarteira: dto.numeroCarteira?.trim() || null,
        observacoes: dto.observacoes?.trim() || null,
      },
    });
  }

  listarProfissionais(empresaId: string) {
    return this.prisma.profissional.findMany({
      where: { empresaId, ativo: true },
      include: { grades: { orderBy: { diaSemana: 'asc' } } },
      orderBy: { nome: 'asc' },
    });
  }

  async criarProfissional(empresaId: string, dto: CriarProfissionalInput) {
    return this.prisma.profissional.create({
      data: {
        empresaId,
        nome: dto.nome.trim(),
        especialidade: dto.especialidade,
        grades: {
          create: [1, 2, 3, 4, 5].map((diaSemana) => ({
            empresaId,
            diaSemana,
            aberto: true,
            horaInicio: '08:00',
            horaFim: '18:00',
          })),
        },
      },
      include: { grades: true },
    });
  }

  async agenda(empresaId: string, dataIso?: string) {
    const data = dataIso ? new Date(`${dataIso}T00:00:00.000Z`) : this.dataHoje();
    const diaSemana = data.getUTCDay();
    const profissionais = await this.prisma.profissional.findMany({
      where: { empresaId, ativo: true },
      include: {
        grades: { where: { diaSemana } },
        consultas: {
          where: { data, status: { not: StatusConsulta.CANCELADA } },
          include: { paciente: true },
          orderBy: { hora: 'asc' },
        },
      },
      orderBy: { nome: 'asc' },
    });

    return {
      data: data.toISOString().slice(0, 10),
      dia: DIAS[diaSemana],
      profissionais: profissionais.map((p) => ({
        id: p.id,
        nome: p.nome,
        especialidade: p.especialidade,
        grade: p.grades[0] ?? null,
        consultas: p.consultas.map((c) => this.serializarConsulta({ ...c, profissional: p })),
      })),
    };
  }

  listarConsultas(empresaId: string) {
    return this.prisma.consulta
      .findMany({
        where: { empresaId },
        include: { paciente: true, profissional: true },
        orderBy: [{ data: 'asc' }, { hora: 'asc' }],
        take: 200,
      })
      .then((lista) => lista.map((c) => this.serializarConsulta(c)));
  }

  async criarConsulta(empresaId: string, dto: CriarConsultaInput) {
    const profissional = await this.prisma.profissional.findFirst({
      where: { id: dto.profissionalId, empresaId, ativo: true },
    });
    if (!profissional) throw Erros.naoEncontrado('PROFISSIONAL_NAO_ENCONTRADO', 'Profissional não encontrado');

    const paciente = await this.prisma.paciente.findFirst({
      where: { id: dto.pacienteId, empresaId },
    });
    if (!paciente) throw Erros.naoEncontrado('PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado');

    try {
      const consulta = await this.prisma.consulta.create({
        data: {
          empresaId,
          pacienteId: paciente.id,
          profissionalId: profissional.id,
          data: new Date(`${dto.data}T00:00:00.000Z`),
          hora: dto.hora,
          especialidade: profissional.especialidade,
          convenio: dto.convenio?.trim() || paciente.convenio,
          numeroCarteira: dto.numeroCarteira?.trim() || paciente.numeroCarteira,
          observacoes: dto.observacoes?.trim() || null,
        },
        include: { paciente: true, profissional: true },
      });
      return this.serializarConsulta(consulta);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw Erros.conflito('HORARIO_OCUPADO', 'Este profissional já tem consulta nesse horário');
      }
      throw erro;
    }
  }

  async atualizarConsulta(empresaId: string, id: string, status: StatusConsulta) {
    const atual = await this.prisma.consulta.findFirst({ where: { id, empresaId } });
    if (!atual) throw Erros.naoEncontrado('CONSULTA_NAO_ENCONTRADA', 'Consulta não encontrada');
    const consulta = await this.prisma.consulta.update({
      where: { id },
      data: { status },
      include: { paciente: true, profissional: true },
    });
    return this.serializarConsulta(consulta);
  }

  listarMedicamentos(empresaId: string) {
    return this.prisma.medicamento.findMany({
      where: { empresaId, ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  criarMedicamento(empresaId: string, dto: CriarMedicamentoInput) {
    return this.prisma.medicamento.create({
      data: {
        empresaId,
        nome: dto.nome.trim(),
        apresentacao: dto.apresentacao?.trim() || null,
        estoque: dto.estoque,
        estoqueMinimo: dto.estoqueMinimo,
      },
    });
  }

  async ajustarEstoque(empresaId: string, id: string, estoque: number) {
    const atual = await this.prisma.medicamento.findFirst({ where: { id, empresaId } });
    if (!atual) throw Erros.naoEncontrado('MEDICAMENTO_NAO_ENCONTRADO', 'Medicamento não encontrado');
    return this.prisma.medicamento.update({ where: { id }, data: { estoque } });
  }

  async configuracao(empresaId: string) {
    return this.prisma.configuracaoClinica.upsert({
      where: { empresaId },
      update: {},
      create: { empresaId },
    });
  }

  async atualizarConfiguracao(
    empresaId: string,
    dto: { duracaoSlotMinutos: number; horizonteDias: number },
  ) {
    return this.prisma.configuracaoClinica.upsert({
      where: { empresaId },
      update: dto,
      create: { empresaId, ...dto },
    });
  }

  private dataHoje(): Date {
    const agora = new Date();
    return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  }

  private serializarConsulta(consulta: {
    id: string;
    data: Date;
    hora: string;
    especialidade: string;
    convenio: string | null;
    numeroCarteira: string | null;
    observacoes: string | null;
    status: string;
    paciente: { id: string; nome: string; telefone: string };
    profissional: { id: string; nome: string; especialidade: string };
  }) {
    return {
      id: consulta.id,
      data: consulta.data.toISOString().slice(0, 10),
      hora: consulta.hora,
      especialidade: consulta.especialidade,
      convenio: consulta.convenio,
      numeroCarteira: consulta.numeroCarteira,
      observacoes: consulta.observacoes,
      status: consulta.status,
      paciente: consulta.paciente,
      profissional: {
        id: consulta.profissional.id,
        nome: consulta.profissional.nome,
        especialidade: consulta.profissional.especialidade,
      },
    };
  }
}
