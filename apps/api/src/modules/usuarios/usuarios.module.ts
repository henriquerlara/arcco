import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { SenhaService } from '../../common/auth/senha.service';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, SenhaService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
