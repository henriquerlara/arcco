import { Global, Module } from '@nestjs/common';
import { PlatformPrismaService } from './platform-prisma.service';
import { PrismaService } from './prisma.service';
import { SaudePrismaService } from './saude-prisma.service';

@Global()
@Module({
  providers: [PrismaService, PlatformPrismaService, SaudePrismaService],
  exports: [PrismaService, PlatformPrismaService, SaudePrismaService],
})
export class PrismaModule {}
