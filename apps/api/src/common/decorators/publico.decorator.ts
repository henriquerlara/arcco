import { SetMetadata } from '@nestjs/common';

export const PUBLICO_CHAVE = 'rota_publica';

/** Marca uma rota como publica, ignorando o AuthGuard global. */
export const Publico = () => SetMetadata(PUBLICO_CHAVE, true);
