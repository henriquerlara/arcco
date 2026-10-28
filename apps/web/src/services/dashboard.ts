import type { MetricasDashboard } from '@/types';
import { desembrulhar, http } from './http';

export interface PeriodoDashboard {
  de?: string;
  ate?: string;
  dias?: number;
  chave?: string;
  responsavelId?: string;
}

export const servicoDashboard = {
  async metricas(periodo: PeriodoDashboard = {}): Promise<MetricasDashboard> {
    return desembrulhar<MetricasDashboard>(await http.get('/dashboard/metricas', { ...periodo }));
  },
};
