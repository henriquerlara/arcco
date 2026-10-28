import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PermissaoFinanceiraInterceptor } from './permissoes.interceptor';
import { PermissoesController } from './permissoes.controller';
import { PermissoesService } from './permissoes.service';

@Global()
@Module({
  controllers: [PermissoesController],
  providers: [
    PermissoesService,
    { provide: APP_INTERCEPTOR, useClass: PermissaoFinanceiraInterceptor },
  ],
  exports: [PermissoesService],
})
export class PermissoesModule {}
