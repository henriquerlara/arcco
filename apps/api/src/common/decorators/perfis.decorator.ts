import { SetMetadata } from '@nestjs/common';
import type { PerfilUsuario } from '@arcco/contratos';

export const PERFIS_CHAVE = 'perfis_permitidos';

/**
 * Restringe o handler aos perfis informados. Sem o decorator, qualquer usuario
 * autenticado tem acesso.
 */
export const Perfis = (...perfis: PerfilUsuario[]) => SetMetadata(PERFIS_CHAVE, perfis);
