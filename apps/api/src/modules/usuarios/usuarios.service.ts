import { Injectable } from '@nestjs/common';
import { PerfilUsuario, type CriarUsuarioInput } from '@arcco/contratos';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { SenhaService } from '../../common/auth/senha.service';
import { Erros } from '../../common/erros/erros';
import type { AtualizarUsuarioInput, RedefinirSenhaInput } from './usuarios.schemas';

const CAMPOS_PUBLICOS = {
  id: true,
  empresaId: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  deveTrocarSenha: true,
  ultimoAcessoEm: true,
  criadoEm: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PlatformPrismaService,
    private readonly senha: SenhaService,
  ) {}

  listar(empresaId: string) {
    return this.prisma.usuario.findMany({
      where: { empresaId },
      select: CAMPOS_PUBLICOS,
      orderBy: { criadoEm: 'asc' },
    });
  }

  async obter(empresaId: string, id: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, empresaId },
      select: CAMPOS_PUBLICOS,
    });
    if (!usuario) throw Erros.naoEncontrado('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado');
    return usuario;
  }

  async criar(empresaId: string, dto: CriarUsuarioInput) {
    const email = dto.email.trim().toLowerCase();
    const existente = await this.prisma.usuario.findUnique({ where: { email } });
    if (existente) throw Erros.conflito('EMAIL_EM_USO', 'Este e-mail ja esta cadastrado');

    const senhaHash = await this.senha.hash(dto.senhaTemporaria);
    return this.prisma.usuario.create({
      data: {
        empresaId,
        nome: dto.nome,
        email,
        senhaHash,
        perfil: dto.perfil,
        deveTrocarSenha: true,
      },
      select: CAMPOS_PUBLICOS,
    });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarUsuarioInput) {
    await this.obter(empresaId, id);
    return this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dto.nome,
        perfil: dto.perfil,
        ativo: dto.ativo,
      },
      select: CAMPOS_PUBLICOS,
    });
  }

  async redefinirSenha(empresaId: string, id: string, dto: RedefinirSenhaInput) {
    await this.obter(empresaId, id);
    const senhaHash = await this.senha.hash(dto.senhaTemporaria);
    await this.prisma.usuario.update({
      where: { id },
      data: {
        senhaHash,
        deveTrocarSenha: true,
        versaoSessao: { increment: 1 },
      },
    });
    return { ok: true };
  }

  async remover(empresaId: string, id: string, solicitanteId: string) {
    if (id === solicitanteId) {
      throw Erros.invalido('ACAO_INVALIDA', 'Voce nao pode desativar a propria conta');
    }
    const usuario = await this.obter(empresaId, id);
    if (usuario.perfil === PerfilUsuario.PROPRIETARIO) {
      throw Erros.invalido('ACAO_INVALIDA', 'Nao e possivel desativar o proprietario');
    }
    await this.prisma.usuario.update({
      where: { id },
      data: { ativo: false, versaoSessao: { increment: 1 } },
    });
    return { ok: true };
  }
}
