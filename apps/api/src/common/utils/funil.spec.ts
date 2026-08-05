import { describe, expect, it } from 'vitest';
import { TipoEtapaFunil } from '@arcco/contratos';
import { avaliarTransicaoEtapa } from './funil';

describe('avaliarTransicaoEtapa', () => {
  it('nao permite mover para etapa inexistente', () => {
    const r = avaliarTransicaoEtapa(null);
    expect(r.permitido).toBe(false);
  });

  it('nao permite mover para etapa inativa', () => {
    const r = avaliarTransicaoEtapa({ id: 'x', tipo: TipoEtapaFunil.ABERTA, ativo: false });
    expect(r.permitido).toBe(false);
  });

  it('exige motivo ao mover para PERDIDA', () => {
    const semMotivo = avaliarTransicaoEtapa({ id: 'p', tipo: TipoEtapaFunil.PERDIDA, ativo: true });
    expect(semMotivo.permitido).toBe(false);

    const comMotivo = avaliarTransicaoEtapa(
      { id: 'p', tipo: TipoEtapaFunil.PERDIDA, ativo: true },
      'Preco alto',
    );
    expect(comMotivo.permitido).toBe(true);
    expect(comMotivo.motivoPerda).toBe('Preco alto');
    expect(comMotivo.fechadaEm).toBeInstanceOf(Date);
  });

  it('marca fechamento ao ganhar e limpa motivo', () => {
    const r = avaliarTransicaoEtapa({ id: 'g', tipo: TipoEtapaFunil.GANHA, ativo: true });
    expect(r.permitido).toBe(true);
    expect(r.fechadaEm).toBeInstanceOf(Date);
    expect(r.motivoPerda).toBeNull();
  });

  it('reabrir (ABERTA) limpa fechamento', () => {
    const r = avaliarTransicaoEtapa({ id: 'a', tipo: TipoEtapaFunil.ABERTA, ativo: true });
    expect(r.permitido).toBe(true);
    expect(r.fechadaEm).toBeNull();
  });
});
