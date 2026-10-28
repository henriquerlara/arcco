import { Module } from '@nestjs/common';
import { OportunidadesController } from './oportunidades.controller';
import { OportunidadesService } from './oportunidades.service';
import { CamposPersonalizadosModule } from '../campos-personalizados/campos-personalizados.module';
import { ContatosModule } from '../contatos/contatos.module';
import { ProdutosModule } from '../produtos/produtos.module';

@Module({
  imports: [CamposPersonalizadosModule, ProdutosModule, ContatosModule],
  controllers: [OportunidadesController],
  providers: [OportunidadesService],
  exports: [OportunidadesService],
})
export class OportunidadesModule {}
