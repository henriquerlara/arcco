import { Module } from '@nestjs/common';
import { AutenticacaoController } from './autenticacao.controller';
import { AutenticacaoService } from './autenticacao.service';
import { JwtService } from '../../common/auth/jwt.service';
import { SenhaService } from '../../common/auth/senha.service';

@Module({
  controllers: [AutenticacaoController],
  providers: [AutenticacaoService, JwtService, SenhaService],
  exports: [JwtService, SenhaService],
})
export class AutenticacaoModule {}
