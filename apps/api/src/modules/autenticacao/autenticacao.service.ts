import { Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  configuracoesEmpresaPadrao,
  PerfilUsuario,
  type CadastrarInput,
  type EntrarInput,
  type SegmentoEmpresa,
  type TrocarSenhaInput,
} from '@arcco/contratos';
import { BANCO_EMPRESA_UNICO } from '../../database/banco-empresa';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService, COOKIE_REFRESH } from '../../common/auth/jwt.service';
import { SenhaService } from '../../common/auth/senha.service';
import { Erros } from '../../common/erros/erros';
import { RateLimiterMemoria } from '../../common/utils/rate-limit';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { templatePorSegmento } from '../empresas/templates-segmento';

@Injectable()
export class AutenticacaoService {
  private readonly limiterEntrar = new RateLimiterMemoria(8, 5 * 60_000);
  private readonly limiterCadastrar = new RateLimiterMemoria(5, 30 * 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly jwt: JwtService,
    private readonly senha: SenhaService,
  ) {}

  async cadastrar(dto: CadastrarInput, ip: string, resposta: FastifyReply) {
    this.limiterCadastrar.consumir(ip);

    const emailNormalizado = dto.email.trim().toLowerCase();
    const existente = await this.platform.usuario.findUnique({ where: { email: emailNormalizado } });
    if (existente) {
      throw Erros.conflito('EMAIL_EM_USO', 'Este e-mail ja esta cadastrado');
    }

    const senhaHash = await this.senha.hash(dto.senha);
    const template = templatePorSegmento(dto.segmento as SegmentoEmpresa);
    const config = configuracoesEmpresaPadrao();

    const { empresa, usuario } = await this.platform.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          nome: dto.nomeEmpresa,
          nomeFantasia: dto.nomeFantasia ?? null,
          segmento: dto.segmento,
          telefone: dto.telefone ?? null,
          cidade: dto.cidade ?? null,
          estado: dto.estado ?? null,
          configuracoes: config as unknown as object,
          databaseHost: BANCO_EMPRESA_UNICO.host,
          databasePort: BANCO_EMPRESA_UNICO.port,
          databaseName: BANCO_EMPRESA_UNICO.name,
        },
      });

      const usuario = await tx.usuario.create({
        data: {
          empresaId: empresa.id,
          nome: dto.nome,
          email: emailNormalizado,
          senhaHash,
          perfil: PerfilUsuario.PROPRIETARIO,
          ativo: true,
        },
      });

      return { empresa, usuario };
    });

    if (template.categorias.length) {
      await this.prisma.categoria.createMany({
        data: template.categorias.map((c) => ({
          empresaId: empresa.id,
          nome: c.nome,
          descricao: c.descricao ?? null,
          ordem: c.ordem,
        })),
      });
    }

    await this.prisma.etapaFunil.createMany({
      data: template.etapas.map((e) => ({
        empresaId: empresa.id,
        nome: e.nome,
        ordem: e.ordem,
        tipo: e.tipo,
        chaveSistema: e.chaveSistema,
      })),
    });

    if (template.campos.length) {
      await this.prisma.campoPersonalizado.createMany({
        data: template.campos.map((campo, i) => ({
          empresaId: empresa.id,
          entidade: campo.entidade,
          chave: campo.chave,
          rotulo: campo.rotulo,
          tipo: campo.tipo,
          obrigatorio: campo.obrigatorio ?? false,
          opcoes: campo.opcoes ?? [],
          ordem: campo.ordem ?? i,
          usarNoChatbot: campo.usarNoChatbot ?? false,
          textoPergunta: campo.textoPergunta ?? null,
          mostrarNoResumo: campo.mostrarNoResumo ?? true,
        })),
      });
    }

    await this.emitir(resposta, usuario);
    this.limiterCadastrar.reiniciar(ip);

    return {
      usuario: this.serializarUsuario(usuario),
      empresa: this.serializarEmpresa(empresa),
    };
  }

  async entrar(dto: EntrarInput, ip: string, resposta: FastifyReply) {
    this.limiterEntrar.consumir(ip);

    const email = dto.email.trim().toLowerCase();
    const usuario = await this.platform.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.ativo) throw Erros.credenciaisInvalidas();

    const ok = await this.senha.verificar(usuario.senhaHash, dto.senha);
    if (!ok) throw Erros.credenciaisInvalidas();

    await this.platform.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcessoEm: new Date() },
    });

    const empresa = await this.platform.empresa.findUniqueOrThrow({
      where: { id: usuario.empresaId },
    });

    await this.emitir(resposta, usuario);
    this.limiterEntrar.reiniciar(`${ip}:${email}`);

    return {
      usuario: this.serializarUsuario(usuario),
      empresa: this.serializarEmpresa(empresa),
    };
  }

  async renovar(req: FastifyRequest, resposta: FastifyReply) {
    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[COOKIE_REFRESH];
    if (!token) throw Erros.naoAutenticado();

    const conteudo = await this.jwt.verificarRefreshToken(token);
    const usuario = await this.platform.usuario.findUnique({ where: { id: conteudo.sub } });
    if (!usuario || !usuario.ativo) throw Erros.naoAutenticado();
    if (usuario.versaoSessao !== conteudo.versaoSessao) {
      throw Erros.naoAutenticado('Sessao encerrada. Entre novamente');
    }

    await this.emitir(resposta, usuario);
    return { usuario: this.serializarUsuario(usuario) };
  }

  async sair(usuario: UsuarioAutenticado, resposta: FastifyReply) {
    await this.platform.usuario.update({
      where: { id: usuario.id },
      data: { versaoSessao: { increment: 1 } },
    });
    this.jwt.limparCookies(resposta);
    return { ok: true };
  }

  async eu(usuario: UsuarioAutenticado) {
    const registro = await this.platform.usuario.findUnique({
      where: { id: usuario.id },
      include: { empresa: true },
    });
    if (!registro) throw Erros.naoAutenticado();
    return {
      usuario: this.serializarUsuario(registro),
      empresa: this.serializarEmpresa(registro.empresa),
    };
  }

  async trocarSenha(usuario: UsuarioAutenticado, dto: TrocarSenhaInput, resposta: FastifyReply) {
    const registro = await this.platform.usuario.findUnique({ where: { id: usuario.id } });
    if (!registro) throw Erros.naoAutenticado();

    const ok = await this.senha.verificar(registro.senhaHash, dto.senhaAtual);
    if (!ok) throw Erros.invalido('SENHA_ATUAL_INVALIDA', 'A senha atual esta incorreta');

    const novoHash = await this.senha.hash(dto.senhaNova);
    const atualizado = await this.platform.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash: novoHash,
        deveTrocarSenha: false,
        versaoSessao: { increment: 1 },
      },
    });

    // Reemite cookies para a sessao atual com a nova versao.
    await this.emitir(resposta, atualizado);
    return { ok: true };
  }

  private async emitir(
    resposta: FastifyReply,
    usuario: { id: string; empresaId: string; perfil: string; versaoSessao: number },
  ) {
    await this.jwt.emitirCookies(resposta, {
      sub: usuario.id,
      empresaId: usuario.empresaId,
      perfil: usuario.perfil,
      versaoSessao: usuario.versaoSessao,
    });
  }

  private serializarUsuario(u: {
    id: string;
    empresaId: string;
    nome: string;
    email: string;
    perfil: string;
    ativo: boolean;
    deveTrocarSenha: boolean;
    ultimoAcessoEm: Date | null;
  }) {
    return {
      id: u.id,
      empresaId: u.empresaId,
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      ativo: u.ativo,
      deveTrocarSenha: u.deveTrocarSenha,
      ultimoAcessoEm: u.ultimoAcessoEm,
    };
  }

  private serializarEmpresa(e: {
    id: string;
    nome: string;
    nomeFantasia: string | null;
    segmento: string;
    telefone: string | null;
    cidade: string | null;
    estado: string | null;
    configuracoes: unknown;
  }) {
    const configuracoes = (e.configuracoes ?? {}) as { onboardingConcluido?: boolean };
    return {
      id: e.id,
      nome: e.nome,
      nomeFantasia: e.nomeFantasia,
      segmento: e.segmento,
      telefone: e.telefone,
      cidade: e.cidade,
      estado: e.estado,
      onboardingConcluido: configuracoes.onboardingConcluido ?? false,
      configuracoes: e.configuracoes,
    };
  }
}
