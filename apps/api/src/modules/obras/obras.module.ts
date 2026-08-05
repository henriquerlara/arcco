import { Module } from '@nestjs/common';
import { ObrasController } from './obras.controller';
import { ObrasService } from './obras.service';
import { CamposPersonalizadosModule } from '../campos-personalizados/campos-personalizados.module';

@Module({
  imports: [CamposPersonalizadosModule],
  controllers: [ObrasController],
  providers: [ObrasService],
  exports: [ObrasService],
})
export class ObrasModule {}
