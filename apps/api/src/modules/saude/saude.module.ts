import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RamoGuard } from './ramo.guard';
import { SaudeController } from './saude.controller';
import { SaudeService } from './saude.service';

@Module({
  controllers: [SaudeController],
  providers: [SaudeService, { provide: APP_GUARD, useClass: RamoGuard }],
})
export class SaudeModule {}
