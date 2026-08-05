import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider';

interface EntradaUpload {
  nome: string;
  tipoMime: string;
  conteudo: Buffer;
  entidade?: string;
  entidadeId?: string;
}

@Injectable()
export class ArquivosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async enviar(empresaId: string, usuarioId: string, entrada: EntradaUpload) {
    const extensao = path.extname(entrada.nome) || '';
    const nomeArmazenamento = `${empresaId}/${new Date().getFullYear()}/${randomUUID()}${extensao}`;

    const { caminho, url } = await this.storage.salvar({
      nomeArmazenamento,
      conteudo: entrada.conteudo,
      tipoMime: entrada.tipoMime,
    });

    return this.prisma.arquivo.create({
      data: {
        empresaId,
        nome: entrada.nome,
        nomeArmazenamento,
        tipoMime: entrada.tipoMime,
        tamanho: entrada.conteudo.length,
        provedor: this.storage.nome,
        caminho,
        url: url ?? null,
        entidade: entrada.entidade ?? null,
        entidadeId: entrada.entidadeId ?? null,
        enviadoPorId: usuarioId,
      },
    });
  }

  listar(empresaId: string, entidade?: string, entidadeId?: string) {
    return this.prisma.arquivo.findMany({
      where: { empresaId, ...(entidade ? { entidade } : {}), ...(entidadeId ? { entidadeId } : {}) },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async obter(empresaId: string, id: string) {
    const arquivo = await this.prisma.arquivo.findFirst({ where: { id, empresaId } });
    if (!arquivo) throw Erros.naoEncontrado('ARQUIVO_NAO_ENCONTRADO', 'Arquivo nao encontrado');
    return arquivo;
  }

  async urlAssinada(empresaId: string, id: string) {
    const arquivo = await this.obter(empresaId, id);
    const url = await this.storage.obterUrl(arquivo.caminho);
    return { url };
  }

  async conteudo(empresaId: string, id: string) {
    const arquivo = await this.obter(empresaId, id);
    const buffer = await this.storage.ler(arquivo.caminho);
    return { arquivo, buffer };
  }

  async remover(empresaId: string, id: string) {
    const arquivo = await this.obter(empresaId, id);
    await this.storage.remover(arquivo.caminho);
    await this.prisma.arquivo.delete({ where: { id } });
    return { ok: true };
  }
}
