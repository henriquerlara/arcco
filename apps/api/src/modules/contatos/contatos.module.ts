import { Module } from '@nestjs/common';
import { ContatosController } from './contatos.controller';
import { ContatosService } from './contatos.service';
import { CamposPersonalizadosModule } from '../campos-personalizados/campos-personalizados.module';

@Module({
  imports: [CamposPersonalizadosModule],
  controllers: [ContatosController],
  providers: [ContatosService],
  exports: [ContatosService],
})
export class ContatosModule {}
