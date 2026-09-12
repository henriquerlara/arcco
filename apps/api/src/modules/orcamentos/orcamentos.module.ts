import { Module, forwardRef } from '@nestjs/common';
import { OrcamentosController } from './orcamentos.controller';
import { OrcamentosService } from './orcamentos.service';
import { ArquivosModule } from '../arquivos/arquivos.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [ArquivosModule, ProdutosModule, forwardRef(() => WhatsAppModule)],
  controllers: [OrcamentosController],
  providers: [OrcamentosService],
  exports: [OrcamentosService],
})
export class OrcamentosModule {}
