import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { FastifyReply } from 'fastify';
import { carregarEnv, ehProducao } from '../../config/env';
import { Erros } from '../erros/erros';

export const COOKIE_ACCESS = 'arcco_access';
export const COOKIE_REFRESH = 'arcco_refresh';

export interface ConteudoToken {
  sub: string;
  empresaId: string;
  perfil: string;
  versaoSessao: number;
}

function parseDuracaoParaSegundos(valor: string): number {
  const m = /^(\d+)([smhd])$/.exec(valor.trim());
  if (!m) return 900;
  const n = Number.parseInt(m[1]!, 10);
  const unidade = m[2];
  switch (unidade) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return 900;
  }
}

@Injectable()
export class JwtService {
  private readonly env = carregarEnv();
  private readonly acessoSecret = new TextEncoder().encode(this.env.JWT_ACCESS_SECRET);
  private readonly refreshSecret = new TextEncoder().encode(this.env.JWT_REFRESH_SECRET);

  private async assinar(
    payload: ConteudoToken,
    secret: Uint8Array,
    expira: string,
  ): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('arcco')
      .setExpirationTime(expira)
      .sign(secret);
  }

  async gerarAccessToken(payload: ConteudoToken): Promise<string> {
    return this.assinar(payload, this.acessoSecret, this.env.JWT_ACCESS_EXPIRES_IN);
  }

  async gerarRefreshToken(payload: ConteudoToken): Promise<string> {
    return this.assinar(payload, this.refreshSecret, this.env.JWT_REFRESH_EXPIRES_IN);
  }

  private async verificar(token: string, secret: Uint8Array): Promise<ConteudoToken> {
    try {
      const { payload } = await jwtVerify(token, secret, { issuer: 'arcco' });
      return this.extrair(payload);
    } catch {
      throw Erros.naoAutenticado();
    }
  }

  private extrair(payload: JWTPayload): ConteudoToken {
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.empresaId !== 'string' ||
      typeof payload.perfil !== 'string' ||
      typeof payload.versaoSessao !== 'number'
    ) {
      throw Erros.naoAutenticado();
    }
    return {
      sub: payload.sub,
      empresaId: payload.empresaId,
      perfil: payload.perfil,
      versaoSessao: payload.versaoSessao,
    };
  }

  verificarAccessToken(token: string): Promise<ConteudoToken> {
    return this.verificar(token, this.acessoSecret);
  }

  verificarRefreshToken(token: string): Promise<ConteudoToken> {
    return this.verificar(token, this.refreshSecret);
  }

  async emitirCookies(resposta: FastifyReply, payload: ConteudoToken): Promise<void> {
    const [access, refresh] = await Promise.all([
      this.gerarAccessToken(payload),
      this.gerarRefreshToken(payload),
    ]);

    const base = opcoesCookie();

    resposta.setCookie(COOKIE_ACCESS, access, {
      ...base,
      maxAge: parseDuracaoParaSegundos(this.env.JWT_ACCESS_EXPIRES_IN),
    });
    resposta.setCookie(COOKIE_REFRESH, refresh, {
      ...base,
      maxAge: parseDuracaoParaSegundos(this.env.JWT_REFRESH_EXPIRES_IN),
    });
  }

  limparCookies(resposta: FastifyReply): void {
    const base = opcoesCookie();
    resposta.clearCookie(COOKIE_ACCESS, base);
    resposta.clearCookie(COOKIE_REFRESH, base);
  }
}

/** Painel e API no Render ficam em hosts diferentes de onrender.com.
 *  O navegador trata isso como sites distintos e descarta cookie Lax. */
function opcoesCookie() {
  const producao = ehProducao();
  return {
    httpOnly: true,
    secure: producao,
    sameSite: (producao ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}
