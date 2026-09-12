import { lerAjustes, statusGeralAjustes, temAjustePendente } from './ajustes';

describe('lerAjustes', () => {
  it('parte descricao antiga em dois pedidos', () => {
    const lista = lerAjustes({ ajuste_status: 'pendente' }, 'teste\n\ntt');
    expect(lista).toHaveLength(2);
    expect(lista[0]?.texto).toBe('teste');
    expect(lista[1]?.texto).toBe('tt');
    expect(lista.every((i) => i.status === 'pendente')).toBe(true);
  });

  it('marca todos como corrigido quando o status global e corrigido', () => {
    const lista = lerAjustes({ ajuste_status: 'corrigido' }, 'teste\n\ntt');
    expect(lista.every((i) => i.status === 'corrigido')).toBe(true);
  });

  it('usa o array persistido quando existe', () => {
    const lista = lerAjustes(
      {
        ajustes: [
          { id: 'a1', texto: 'trocar LED', status: 'corrigido' },
          { id: 'a2', texto: 'incluir dimmer', status: 'pendente' },
        ],
      },
      'ignorada',
    );
    expect(lista).toHaveLength(2);
    expect(lista[0]?.status).toBe('corrigido');
    expect(lista[1]?.status).toBe('pendente');
    expect(statusGeralAjustes(lista)).toBe('pendente');
    expect(temAjustePendente({ tipo_solicitacao: 'Ajuste de orçamento', ajustes: lista })).toBe(
      true,
    );
  });
});
