import { Module } from '@nestjs/common';
import { ArquivosModule } from '../arquivos/arquivos.module';
import { NotasEntradaController } from './notas-entrada.controller';
import { NotasEntradaService } from './notas-entrada.service';

@Module({
  imports: [ArquivosModule],
  controllers: [NotasEntradaController],
  providers: [NotasEntradaService],
  exports: [NotasEntradaService],
})
export class NotasEntradaModule {}
