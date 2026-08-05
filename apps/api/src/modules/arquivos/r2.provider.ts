import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { carregarEnv } from '../../config/env';
import type { ArquivoParaSalvar, StorageProvider } from './storage.provider';

/**
 * Storage no Cloudflare R2 (compativel com S3). Usa URLs assinadas para leitura.
 */
@Injectable()
export class R2StorageProvider implements StorageProvider {
  readonly nome = 'r2';
  private readonly env = carregarEnv();
  private readonly cliente = new S3Client({
    region: this.env.R2_REGION,
    endpoint: this.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: this.env.R2_ACCESS_KEY,
      secretAccessKey: this.env.R2_SECRET_KEY,
    },
  });

  async salvar(arquivo: ArquivoParaSalvar): Promise<{ caminho: string; url?: string }> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.env.R2_BUCKET,
        Key: arquivo.nomeArmazenamento,
        Body: arquivo.conteudo,
        ContentType: arquivo.tipoMime,
      }),
    );
    return { caminho: arquivo.nomeArmazenamento };
  }

  obterUrl(caminho: string): Promise<string> {
    return getSignedUrl(
      this.cliente,
      new GetObjectCommand({ Bucket: this.env.R2_BUCKET, Key: caminho }),
      { expiresIn: 3600 },
    );
  }

  async ler(caminho: string): Promise<Buffer> {
    const resposta = await this.cliente.send(
      new GetObjectCommand({ Bucket: this.env.R2_BUCKET, Key: caminho }),
    );
    const bytes = await resposta.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async remover(caminho: string): Promise<void> {
    await this.cliente.send(
      new DeleteObjectCommand({ Bucket: this.env.R2_BUCKET, Key: caminho }),
    );
  }
}
