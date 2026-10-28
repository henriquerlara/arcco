import { Module } from '@nestjs/common';
import { AtividadesModule } from '../atividades/atividades.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AtividadesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
