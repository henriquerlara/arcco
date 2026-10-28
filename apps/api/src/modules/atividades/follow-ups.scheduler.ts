import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FollowUpsService } from './follow-ups.service';

/** Intervalo do job real (não depende de abrir o dashboard). */
const INTERVALO_MS = 5 * 60_000;

@Injectable()
export class FollowUpsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('FollowUpsScheduler');
  private timer: NodeJS.Timeout | null = null;
  private rodando = false;

  constructor(private readonly followUps: FollowUpsService) {}

  onModuleInit() {
    if (process.env.ECOL_FOLLOWUP_SCHEDULER === '0') {
      this.logger.log('Scheduler de follow-up desligado (ECOL_FOLLOWUP_SCHEDULER=0)');
      return;
    }
    // Primeira passagem após subida (atraso curto para o Prisma conectar).
    setTimeout(() => void this.tick(), 15_000);
    this.timer = setInterval(() => void this.tick(), INTERVALO_MS);
    this.logger.log(`Scheduler de follow-up ativo a cada ${INTERVALO_MS / 60_000} min`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.rodando) return;
    this.rodando = true;
    try {
      const r = await this.followUps.processarTodas();
      if (r.ecolume + r.legado > 0) {
        this.logger.log(
          `Follow-ups criados: ecolume=${r.ecolume} legado=${r.legado} (empresas=${r.empresas})`,
        );
      }
    } catch (erro) {
      this.logger.warn(`Tick follow-up falhou: ${(erro as Error).message}`);
    } finally {
      this.rodando = false;
    }
  }
}
