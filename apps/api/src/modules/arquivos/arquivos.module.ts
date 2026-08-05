import { Module } from '@nestjs/common';
import { ArquivosController } from './arquivos.controller';
import { ArquivosService } from './arquivos.service';
import { LocalStorageProvider } from './local.provider';
import { R2StorageProvider } from './r2.provider';
import { STORAGE_PROVIDER } from './storage.provider';
import { carregarEnv } from '../../config/env';

@Module({
  controllers: [ArquivosController],
  providers: [
    ArquivosService,
    LocalStorageProvider,
    R2StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [LocalStorageProvider, R2StorageProvider],
      useFactory: (local: LocalStorageProvider, r2: R2StorageProvider) => {
        const env = carregarEnv();
        return env.STORAGE_PROVIDER === 'r2' ? r2 : local;
      },
    },
  ],
  exports: [ArquivosService],
})
export class ArquivosModule {}
