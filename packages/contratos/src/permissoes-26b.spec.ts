import { describe, expect, it } from 'vitest';
import { PerfilUsuario } from './enums/index.js';
import { itensNavegacaoComercial } from './navegacao-comercial.js';
import {
  escopoAgendaEfetivo,
  normalizarChavesPermissao,
  PermissaoComercial,
  resolverPermissoes,
  veTodosNegocios,
} from './permissoes-comerciais.js';
import { PersonalizacaoComercial } from './schemas/empresa.js';

describe('ECOL-26b resolver e escopos', () => {
  const cfg = { personalizacaoComercial: PersonalizacaoComercial.ECOLUME };

  it('administrador recebe catálogo completo inclusive abas e escopos', () => {
    const ctx = resolverPermissoes({
      configuracoes: cfg,
      perfil: PerfilUsuario.PROPRIETARIO,
      concedidas: [],
    });
    expect(ctx.modo).toBe('ecolume');
    if (ctx.modo !== 'ecolume') return;
    expect(ctx.chaves.has(PermissaoComercial.ABA_VISAO_GERAL)).toBe(true);
    expect(ctx.chaves.has(PermissaoComercial.ESCOPO_AGENDA_TODAS)).toBe(true);
    expect(escopoAgendaEfetivo(ctx)).toBe('TODAS');
    expect(veTodosNegocios(ctx)).toBe(true);
  });

  it('GESTOR sem concessão não herda custo nem abas', () => {
    const ctx = resolverPermissoes({
      configuracoes: cfg,
      perfil: PerfilUsuario.GESTOR,
      concedidas: [],
    });
    expect(ctx.modo).toBe('ecolume');
    if (ctx.modo !== 'ecolume') return;
    expect(ctx.chaves.size).toBe(0);
    expect(escopoAgendaEfetivo(ctx)).toBe('PROPRIAS');
    expect(veTodosNegocios(ctx)).toBe(false);
  });

  it('escopo agenda: ENTREGAS e TODAS', () => {
    const entregas = resolverPermissoes({
      configuracoes: cfg,
      perfil: PerfilUsuario.VENDEDOR,
      concedidas: [PermissaoComercial.ESCOPO_AGENDA_ENTREGAS],
    });
    expect(escopoAgendaEfetivo(entregas)).toBe('ENTREGAS');
    const todas = resolverPermissoes({
      configuracoes: cfg,
      perfil: PerfilUsuario.VENDEDOR,
      concedidas: [PermissaoComercial.ESCOPO_AGENDA_TODAS],
    });
    expect(escopoAgendaEfetivo(todas)).toBe('TODAS');
  });

  it('normaliza escopos de agenda mutuamente exclusivos', () => {
    const n = normalizarChavesPermissao([
      PermissaoComercial.ESCOPO_AGENDA_TODAS,
      PermissaoComercial.ESCOPO_AGENDA_PROPRIAS,
      PermissaoComercial.VER_CUSTOS,
    ]);
    expect(n).toContain(PermissaoComercial.ESCOPO_AGENDA_TODAS);
    expect(n).not.toContain(PermissaoComercial.ESCOPO_AGENDA_PROPRIAS);
    expect(n).toContain(PermissaoComercial.VER_CUSTOS);
  });

  it('menu ECOLUME filtra por ABA_*', () => {
    const todos = itensNavegacaoComercial({
      personalizacao: PersonalizacaoComercial.ECOLUME,
      podeCatalogo: true,
      podeConfigurar: true,
      chavesComerciais: [
        PermissaoComercial.ABA_VISAO_GERAL,
        PermissaoComercial.ABA_NEGOCIOS,
      ],
    });
    expect(todos.map((i) => i.id)).toEqual(['dashboard', 'pipeline']);
  });

  it('legado não filtra menu por aba', () => {
    const itens = itensNavegacaoComercial({
      personalizacao: PersonalizacaoComercial.PADRAO,
      podeCatalogo: true,
      podeConfigurar: true,
      chavesComerciais: [],
    });
    expect(itens.some((i) => i.id === 'conversas')).toBe(true);
  });
});
