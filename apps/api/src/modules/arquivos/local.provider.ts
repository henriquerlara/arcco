import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { carregarEnv } from '../../config/env';
import type { ArquivoParaSalvar, StorageProvider } from './storage.provider';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly nome = 'local';
  private readonly env = carregarEnv();
  private readonly base = path.resolve(this.env.LOCAL_STORAGE_PATH);

  private async garantirDiretorio(arquivo: string): Promise<void> {
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
  }

  private caminhoAbsoluto(chave: string): string {
    return path.join(this.base, chave);
  }

  async salvar(arquivo: ArquivoParaSalvar): Promise<{ caminho: string; url?: string }> {
    const abs = this.caminhoAbsoluto(arquivo.nomeArmazenamento);
    await this.garantirDiretorio(abs);
    await fs.writeFile(abs, arquivo.conteudo);
    return {
      caminho: arquivo.nomeArmazenamento,
      url: `${this.env.API_PUBLIC_URL}/arquivos/${encodeURIComponent(arquivo.nomeArmazenamento)}/conteudo`,
    };
  }

  async obterUrl(caminho: string): Promise<string> {
    return `${this.env.API_PUBLIC_URL}/arquivos/${encodeURIComponent(caminho)}/conteudo`;
  }

  ler(caminho: string): Promise<Buffer> {
    return fs.readFile(this.caminhoAbsoluto(caminho));
  }

  async remover(caminho: string): Promise<void> {
    await fs.rm(this.caminhoAbsoluto(caminho), { force: true });
  }
}
