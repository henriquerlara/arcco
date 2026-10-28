import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from './generated/saude';

@Injectable()
export class SaudePrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaSaude');

  constructor() {
    super({
      log: [{ emit: 'event', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Conectado ao banco da clínica');
    } catch (erro) {
      this.logger.error('Falha ao conectar ao banco da clínica', erro as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
