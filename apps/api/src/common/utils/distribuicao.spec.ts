import { describe, expect, it } from 'vitest';
import { atribuirVendedor, proximoRoundRobin } from './distribuicao';

describe('atribuirVendedor', () => {
  it('escolhe o vendedor ativo com menor carga', () => {
    const escolhido = atribuirVendedor([
      { id: 'a', ativo: true, cargaAtual: 5 },
      { id: 'b', ativo: true, cargaAtual: 2 },
      { id: 'c', ativo: true, cargaAtual: 8 },
    ]);
    expect(escolhido?.id).toBe('b');
  });

  it('ignora vendedores inativos', () => {
    const escolhido = atribuirVendedor([
      { id: 'a', ativo: false, cargaAtual: 0 },
      { id: 'b', ativo: true, cargaAtual: 3 },
    ]);
    expect(escolhido?.id).toBe('b');
  });

  it('retorna null quando nao ha ativos', () => {
    expect(atribuirVendedor([{ id: 'a', ativo: false, cargaAtual: 0 }])).toBeNull();
  });

  it('em empate mantem o primeiro (deterministico)', () => {
    const escolhido = atribuirVendedor([
      { id: 'a', ativo: true, cargaAtual: 2 },
      { id: 'b', ativo: true, cargaAtual: 2 },
    ]);
    expect(escolhido?.id).toBe('a');
  });
});

describe('proximoRoundRobin', () => {
  it('circula entre os ativos', () => {
    const lista = [
      { id: 'a', ativo: true, cargaAtual: 0 },
      { id: 'b', ativo: true, cargaAtual: 0 },
    ];
    expect(proximoRoundRobin(lista, 0)?.id).toBe('a');
    expect(proximoRoundRobin(lista, 1)?.id).toBe('b');
    expect(proximoRoundRobin(lista, 2)?.id).toBe('a');
  });
});
