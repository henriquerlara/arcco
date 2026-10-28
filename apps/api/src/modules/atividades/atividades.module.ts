import { Module } from '@nestjs/common';
import { AtividadesController } from './atividades.controller';
import { AtividadesService } from './atividades.service';
import { FollowUpsService } from './follow-ups.service';
import { FollowUpsScheduler } from './follow-ups.scheduler';

@Module({
  controllers: [AtividadesController],
  providers: [AtividadesService, FollowUpsService, FollowUpsScheduler],
  exports: [AtividadesService, FollowUpsService],
})
export class AtividadesModule {}
