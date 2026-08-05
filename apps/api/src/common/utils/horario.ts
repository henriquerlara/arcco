import { toZonedTime } from 'date-fns-tz';
import type { HorarioAtendimento } from '@arcco/contratos';

const FUSO_PADRAO = 'America/Sao_Paulo';

type DiaSemana = keyof HorarioAtendimento;

const DIAS: DiaSemana[] = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
];

function minutosDoDia(hora: string): number {
  const [h, m] = hora.split(':').map((v) => Number.parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

/**
 * Verifica se um instante esta dentro de algum intervalo de atendimento configurado.
 * A comparacao e feita no fuso America/Sao_Paulo por padrao.
 */
export function estaEmHorarioAtendimento(
  horario: HorarioAtendimento | null | undefined,
  data: Date = new Date(),
  fuso: string = FUSO_PADRAO,
): boolean {
  if (!horario) return false;

  const local = toZonedTime(data, fuso);
  const diaIndice = local.getDay();
  const dia = DIAS[diaIndice];
  const intervalos = dia ? horario[dia] : undefined;

  if (!intervalos || intervalos.length === 0) return false;

  const agoraMin = local.getHours() * 60 + local.getMinutes();

  return intervalos.some((intervalo) => {
    const inicio = minutosDoDia(intervalo.inicio);
    const fim = minutosDoDia(intervalo.fim);
    return agoraMin >= inicio && agoraMin < fim;
  });
}
