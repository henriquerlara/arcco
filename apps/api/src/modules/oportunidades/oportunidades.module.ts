import { Module } from '@nestjs/common';
import { OportunidadesController } from './oportunidades.controller';
import { OportunidadesService } from './oportunidades.service';
import { CamposPersonalizadosModule } from '../campos-personalizados/campos-personalizados.module';

@Module({
  imports: [CamposPersonalizadosModule],
  controllers: [OportunidadesController],
  providers: [OportunidadesService],
  exports: [OportunidadesService],
})
export class OportunidadesModule {}
