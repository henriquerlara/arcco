import { describe, expect, it } from 'vitest';
import { TipoCampoPersonalizado } from '@arcco/contratos';
import { validarDadosPersonalizados, type DefinicaoCampo } from './campos-personalizados';

const def = (over: Partial<DefinicaoCampo>): DefinicaoCampo => ({
  chave: 'campo',
  rotulo: 'Campo',
  tipo: TipoCampoPersonalizado.TEXTO,
  obrigatorio: false,
  ativo: true,
  ...over,
});

describe('validarDadosPersonalizados', () => {
  it('acusa campo obrigatorio ausente', () => {
    const r = validarDadosPersonalizados([def({ chave: 'nome', obrigatorio: true })], {});
    expect(r.valido).toBe(false);
    expect(r.erros.nome).toBeDefined();
  });

  it('coage numero em string para number', () => {
    const r = validarDadosPersonalizados(
      [def({ chave: 'volume', tipo: TipoCampoPersonalizado.NUMERO })],
      { volume: '12,5' },
    );
    expect(r.valido).toBe(true);
    expect(r.dados.volume).toBe(12.5);
  });

  it('valida selecao contra opcoes', () => {
    const definicao = def({
      chave: 'fck',
      tipo: TipoCampoPersonalizado.SELECAO,
      opcoes: ['20', '25', '30'],
    });
    expect(validarDadosPersonalizados([definicao], { fck: '25' }).valido).toBe(true);
    expect(validarDadosPersonalizados([definicao], { fck: '99' }).valido).toBe(false);
  });

  it('valida booleano em string', () => {
    const r = validarDadosPersonalizados(
      [def({ chave: 'bomba', tipo: TipoCampoPersonalizado.BOOLEANO })],
      { bomba: 'true' },
    );
    expect(r.dados.bomba).toBe(true);
  });

  it('ignora campos desconhecidos (nao confia no frontend)', () => {
    const r = validarDadosPersonalizados([def({ chave: 'conhecido' })], {
      conhecido: 'ok',
      injetado: 'malicioso',
    });
    expect(r.dados).toEqual({ conhecido: 'ok' });
    expect(r.dados.injetado).toBeUndefined();
  });

  it('valida multisselecao', () => {
    const definicao = def({
      chave: 'ambientes',
      tipo: TipoCampoPersonalizado.MULTISSELECAO,
      opcoes: ['sala', 'cozinha', 'quarto'],
    });
    expect(validarDadosPersonalizados([definicao], { ambientes: ['sala', 'quarto'] }).valido).toBe(
      true,
    );
    expect(validarDadosPersonalizados([definicao], { ambientes: ['garagem'] }).valido).toBe(false);
  });

  it('ignora campos inativos', () => {
    const r = validarDadosPersonalizados(
      [def({ chave: 'antigo', ativo: false, obrigatorio: true })],
      {},
    );
    expect(r.valido).toBe(true);
  });
});
