import { Module } from '@nestjs/common';
import { ArquivosModule } from '../arquivos/arquivos.module';
import { EmpresasModule } from '../empresas/empresas.module';
import { OrcamentosModule } from '../orcamentos/orcamentos.module';
import { FocusNfeClient } from './focus-nfe.client';
import { NotasFiscaisService } from './notas-fiscais.service';
import { NotasFiscaisController } from './notas-fiscais.controller';

@Module({
  imports: [ArquivosModule, EmpresasModule, OrcamentosModule],
  controllers: [NotasFiscaisController],
  providers: [FocusNfeClient, NotasFiscaisService],
  exports: [NotasFiscaisService, FocusNfeClient],
})
export class FiscalModule {}
