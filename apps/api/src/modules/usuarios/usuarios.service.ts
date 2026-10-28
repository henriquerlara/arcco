import { Injectable } from '@nestjs/common';
import { PerfilUsuario, type CriarUsuarioInput } from '@arcco/contratos';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { SenhaService } from '../../common/auth/senha.service';
import { Erros } from '../../common/erros/erros';
import { PermissoesService } from '../permissoes/permissoes.service';
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
    private readonly permissoes: PermissoesService,
  ) {}

  private async assertAdminEquipe(ator: { id: string; empresaId: string; perfil: string }) {
    await this.permissoes.assertAdministraPermissoes(ator);
  }

  private async contarAdminsAtivos(empresaId: string, excetoId?: string) {
    return this.prisma.usuario.count({
      where: {
        empresaId,
        perfil: PerfilUsuario.PROPRIETARIO,
        ativo: true,
        ...(excetoId ? { id: { not: excetoId } } : {}),
      },
    });
  }

  async listar(empresaId: string) {
    const usuarios = await this.prisma.usuario.findMany({
      where: { empresaId },
      select: CAMPOS_PUBLICOS,
      orderBy: { criadoEm: 'asc' },
    });
    if (!(await this.permissoes.empresaEcolume(empresaId))) return usuarios;

    const concessoes = await this.prisma.concessaoPermissao.findMany({
      where: { empresaId },
      select: { usuarioId: true, chave: true },
    });
    const porUsuario = new Map<string, string[]>();
    for (const c of concessoes) {
      const lista = porUsuario.get(c.usuarioId) ?? [];
      lista.push(c.chave);
      porUsuario.set(c.usuarioId, lista);
    }
    return usuarios.map((u) => ({
      ...u,
      permissoesConcedidas:
        u.perfil === PerfilUsuario.PROPRIETARIO ? null : (porUsuario.get(u.id) ?? []),
    }));
  }

  async obter(empresaId: string, id: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, empresaId },
      select: CAMPOS_PUBLICOS,
    });
    if (!usuario) throw Erros.naoEncontrado('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado');
    return usuario;
  }

  async criar(
    empresaId: string,
    dto: CriarUsuarioInput,
    ator: { id: string; perfil: string },
  ) {
    await this.assertAdminEquipe({ id: ator.id, empresaId, perfil: ator.perfil });
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

  async atualizar(
    empresaId: string,
    id: string,
    dto: AtualizarUsuarioInput,
    ator: { id: string; perfil: string },
  ) {
    await this.assertAdminEquipe({ id: ator.id, empresaId, perfil: ator.perfil });
    const alvo = await this.obter(empresaId, id);

    if (id === ator.id && dto.perfil && dto.perfil !== alvo.perfil) {
      throw Erros.invalido('AUTOELEVACAO', 'Nao e permitido alterar o proprio perfil');
    }
    // Schema de atualização não inclui PROPRIETARIO — demover admin exige rebaixar via perfil permitido.
    if (alvo.perfil === PerfilUsuario.PROPRIETARIO && dto.perfil) {
      const restantes = await this.contarAdminsAtivos(empresaId, id);
      if (restantes < 1) {
        throw Erros.invalido(
          'ULTIMO_ADMIN',
          'Nao e possivel remover o ultimo administrador ativo',
        );
      }
    }
    if (alvo.perfil === PerfilUsuario.PROPRIETARIO && dto.ativo === false) {
      const restantes = await this.contarAdminsAtivos(empresaId, id);
      if (restantes < 1) {
        throw Erros.invalido(
          'ULTIMO_ADMIN',
          'Nao e possivel desativar o ultimo administrador ativo',
        );
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dto.nome,
        perfil: dto.perfil,
        ativo: dto.ativo,
        ...(dto.ativo === false ? { versaoSessao: { increment: 1 } } : {}),
      },
      select: CAMPOS_PUBLICOS,
    });
  }

  async redefinirSenha(empresaId: string, id: string, dto: RedefinirSenhaInput, ator: { id: string; perfil: string }) {
    await this.assertAdminEquipe({ id: ator.id, empresaId, perfil: ator.perfil });
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

  async remover(empresaId: string, id: string, solicitante: { id: string; perfil: string }) {
    await this.assertAdminEquipe({
      id: solicitante.id,
      empresaId,
      perfil: solicitante.perfil,
    });
    if (id === solicitante.id) {
      throw Erros.invalido('ACAO_INVALIDA', 'Voce nao pode desativar a propria conta');
    }
    const usuario = await this.obter(empresaId, id);
    if (usuario.perfil === PerfilUsuario.PROPRIETARIO) {
      const restantes = await this.contarAdminsAtivos(empresaId, id);
      if (restantes < 1) {
        throw Erros.invalido(
          'ULTIMO_ADMIN',
          'Nao e possivel desativar o ultimo administrador ativo',
        );
      }
    }
    await this.prisma.usuario.update({
      where: { id },
      data: { ativo: false, versaoSessao: { increment: 1 } },
    });
    return { ok: true };
  }
}
