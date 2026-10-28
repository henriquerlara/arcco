import { ESPECIALIDADES_CLINICA } from '@arcco/contratos';
import { http } from './http';

export interface PacienteClinica {
  id: string;
  nome: string;
  telefone: string;
  cpf?: string | null;
  email?: string | null;
  convenio?: string | null;
  numeroCarteira?: string | null;
}

export interface ProfissionalClinica {
  id: string;
  nome: string;
  especialidade: string;
  grades?: { diaSemana: number; aberto: boolean; horaInicio: string; horaFim: string }[];
}

export interface ConsultaClinica {
  id: string;
  data: string;
  hora: string;
  especialidade: string;
  convenio?: string | null;
  status: 'AGENDADA' | 'CONFIRMADA' | 'REALIZADA' | 'CANCELADA';
  paciente: { id: string; nome: string; telefone: string };
  profissional: { id: string; nome: string; especialidade: string };
}

export interface MedicamentoClinica {
  id: string;
  nome: string;
  apresentacao?: string | null;
  estoque: number;
  estoqueMinimo: number;
}

const rotulos = Object.fromEntries(ESPECIALIDADES_CLINICA.map((item) => [item.id, item.rotulo]));

export function rotuloEspecialidade(id: string): string {
  return rotulos[id] ?? id;
}

export const ROTULO_STATUS: Record<ConsultaClinica['status'], string> = {
  AGENDADA: 'Agendada',
  CONFIRMADA: 'Confirmada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
};

export function classeStatus(status: ConsultaClinica['status']): string {
  if (status === 'CONFIRMADA') return 'bg-[#d7f3ee] text-[#0f6e62]';
  if (status === 'REALIZADA') return 'bg-[#e5f2ea] text-[#1f6b45]';
  if (status === 'CANCELADA') return 'bg-[#f3f4f4] text-[#6b7576]';
  return 'bg-[#fff4df] text-[#8a5a12]';
}

/** Data da consulta vem como YYYY-MM-DD. Formata no calendário local, sem deslocar o dia. */
export function rotuloDataConsulta(valor: string): string {
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

export const servicoSaude = {
  inicio: () =>
    http.get<{
      consultasHoje: ConsultaClinica[];
      resumo: {
        consultasHoje: number;
        aguardandoConfirmacao: number;
        profissionais: number;
        medicamentosAbaixoDoMinimo: number;
      };
    }>('/saude/inicio'),
  pacientes: () => http.get<PacienteClinica[]>('/saude/pacientes'),
  criarPaciente: (corpo: Record<string, unknown>) =>
    http.post<PacienteClinica>('/saude/pacientes', corpo),
  profissionais: () => http.get<ProfissionalClinica[]>('/saude/profissionais'),
  criarProfissional: (corpo: { nome: string; especialidade: string }) =>
    http.post<ProfissionalClinica>('/saude/profissionais', corpo),
  agenda: (data: string) =>
    http.get<{
      data: string;
      dia: string;
      profissionais: {
        id: string;
        nome: string;
        especialidade: string;
        grade: { aberto: boolean; horaInicio: string; horaFim: string } | null;
        consultas: ConsultaClinica[];
      }[];
    }>('/saude/agenda', { data }),
  consultas: () => http.get<ConsultaClinica[]>('/saude/consultas'),
  criarConsulta: (corpo: Record<string, unknown>) =>
    http.post<ConsultaClinica>('/saude/consultas', corpo),
  atualizarConsulta: (id: string, status: ConsultaClinica['status']) =>
    http.patch<ConsultaClinica>(`/saude/consultas/${id}`, { status }),
  medicamentos: () => http.get<MedicamentoClinica[]>('/saude/medicamentos'),
  criarMedicamento: (corpo: Record<string, unknown>) =>
    http.post<MedicamentoClinica>('/saude/medicamentos', corpo),
  ajustarEstoque: (id: string, estoque: number) =>
    http.patch<MedicamentoClinica>(`/saude/medicamentos/${id}`, { estoque }),
  configuracao: () =>
    http.get<{ duracaoSlotMinutos: number; horizonteDias: number }>('/saude/configuracao'),
  salvarConfiguracao: (corpo: { duracaoSlotMinutos: number; horizonteDias: number }) =>
    http.patch<{ duracaoSlotMinutos: number; horizonteDias: number }>('/saude/configuracao', corpo),
};
