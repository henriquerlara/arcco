import { PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { AppError } from '../erros/erros';

/**
 * Pipe que valida o payload contra um schema Zod dos contratos compartilhados.
 * Uso: @Body(new ZodValidationPipe(criarContatoSchema)) dados: CriarContatoInput
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(valor: unknown): T {
    try {
      return this.schema.parse(valor);
    } catch (erro) {
      if (erro instanceof ZodError) {
        throw new AppError(
          'DADOS_INVALIDOS',
          'Verifique os dados enviados',
          422,
          erro.flatten(),
        );
      }
      throw erro;
    }
  }
}
