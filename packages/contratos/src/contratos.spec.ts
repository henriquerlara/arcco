import { describe, expect, it } from 'vitest';
import {
  cadastrarSchema,
  calcularMargemEfetiva,
  calcularPrecoSugerido,
  calcularPrecoUnitarioLinha,
  calcularTotalLinha,
  cnpjValido,
  cpfValido,
  criarContatoSchema,
  criarFornecedorSchema,
  configuracoesEmpresaPadrao,
  StatusEstoqueEcolume,
  statusEstoqueEcolume,
  configuracoesEmpresaSchema,
  itensNavegacaoComercial,
  lerPersonalizacaoComercial,
  PermissaoComercial,
  PerfilUsuario,
  PersonalizacaoComercial,
  publicarResposta,
  redigirSegredos,
  resolverPermissoes,
  rotaOcultaNaPersonalizacao,
  SegmentoEmpresa,
} from './index.js';

describe('contratos', () => {
  it('ECOL-13 fórmula 10.4 — exemplos Stella e arredondamento', () => {
    expect(
      calcularPrecoUnitarioLinha({
        custoBase: 120,
        ipiPercentual: 10,
        stPercentual: 30,
        margem: 1.6,
      }),
    ).toBe(274.56);
    expect(
      calcularPrecoUnitarioLinha({
        custoBase: 113.33,
        ipiPercentual: 10,
        stPercentual: 30,
        margem: 1.6,
      }),
    ).toBe(259.3);
    // Custo médio interno 4 casas (113,3333) ≠ exemplo com 2 casas (113,33).
    expect(
      calcularPrecoUnitarioLinha({
        custoBase: 113.3333,
        ipiPercentual: 10,
        stPercentual: 30,
        margem: 1.6,
      }),
    ).toBe(259.31);
    expect(calcularTotalLinha(2, 274.56)).toBe(549.12);
    expect(
      calcularMargemEfetiva({
        precoUnitario: 274.56,
        custoBase: 120,
        ipiPercentual: 10,
        stPercentual: 30,
      }),
    ).toBe(1.6);
    expect(calcularPrecoUnitarioLinha({ custoBase: null, margem: 1.6 })).toBeNull();
    expect(
      calcularMargemEfetiva({ precoUnitario: 10, custoBase: 0, ipiPercentual: 0, stPercentual: 0 }),
    ).toBeNull();
  });

  it('precoSugerido permanece visível sem VER_CUSTOS (§10.3)', () => {
    const ctx = resolverPermissoes({
      configuracoes: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME },
      perfil: PerfilUsuario.VENDEDOR,
      concedidas: [],
    });
    const pub = publicarResposta(ctx, {
      precoSugerido: 274.56,
      precoUnitario: 274.56,
      custoBase: 120,
      margem: 1.6,
      ipiPercentual: 10,
    });
    expect(pub.precoSugerido).toBe(274.56);
    expect(pub.precoUnitario).toBe(274.56);
    expect(pub.custoBase).toBeUndefined();
    expect(pub.margem).toBeUndefined();
    expect(pub.ipiPercentual).toBeUndefined();
  });

  it('status de estoque ECOLUME e preco sugerido sem inventar margem', () => {
    expect(
      statusEstoqueEcolume({ controlaEstoque: false, estoqueAtual: -5, estoqueMinimo: 1 }),
    ).toBe(StatusEstoqueEcolume.SOB_ENCOMENDA);
    expect(
      statusEstoqueEcolume({ controlaEstoque: true, estoqueAtual: -1, estoqueMinimo: 0 }),
    ).toBe(StatusEstoqueEcolume.A_COMPRAR);
    expect(
      statusEstoqueEcolume({ controlaEstoque: true, estoqueAtual: 0, estoqueMinimo: 0 }),
    ).toBe(StatusEstoqueEcolume.BAIXO);
    expect(
      statusEstoqueEcolume({ controlaEstoque: true, estoqueAtual: 10, estoqueMinimo: 2 }),
    ).toBe(StatusEstoqueEcolume.OK);
    expect(calcularPrecoSugerido({ ultimoPreco: 100, ipiPercentual: 10, aliquotaStPercentual: 18, margem: 1.6 })).toBe(
      207.68,
    );
    expect(calcularPrecoSugerido({ ultimoPreco: 100, margem: null })).toBeNull();
    expect(calcularPrecoSugerido({ ultimoPreco: null, margem: 1.6 })).toBeNull();
  });

  it('valida CPF/CNPJ no contato e exige ST% no fornecedor', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11111111111111')).toBe(false);
    expect(
      criarContatoSchema.safeParse({
        nome: 'Cliente PF',
        telefone: '11999990000',
        natureza: 'PF',
        documento: '52998224725',
      }).success,
    ).toBe(true);
    expect(
      criarContatoSchema.safeParse({
        nome: 'Cliente',
        telefone: '11999990000',
        documento: '11111111111',
      }).success,
    ).toBe(false);
    expect(
      criarFornecedorSchema.safeParse({
        nome: 'AA',
        cnpj: '11222333000181',
        aliquotaSt: 0,
      }).success,
    ).toBe(true);
    expect(
      criarFornecedorSchema.safeParse({
        nome: 'A',
        cnpj: '11222333000181',
      }).success,
    ).toBe(false);
    expect(
      criarFornecedorSchema.safeParse({
        nome: 'A',
        cnpj: '11111111111111',
        aliquotaSt: 1,
      }).success,
    ).toBe(false);
  });

  it('valida cadastro mínimo', () => {
    const resultado = cadastrarSchema.safeParse({
      nomeEmpresa: 'Empresa Teste',
      segmento: SegmentoEmpresa.ILUMINACAO,
      nome: 'João Silva',
      email: 'joao@teste.com',
      senha: 'Senha@123',
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita e-mail inválido no cadastro', () => {
    const resultado = cadastrarSchema.safeParse({
      nomeEmpresa: 'Empresa Teste',
      segmento: SegmentoEmpresa.CONCRETO,
      nome: 'João Silva',
      email: 'invalido',
      senha: 'Senha@123',
    });
    expect(resultado.success).toBe(false);
  });

  it('gera configurações padrão válidas', () => {
    const config = configuracoesEmpresaPadrao();
    const resultado = configuracoesEmpresaSchema.safeParse(config);
    expect(resultado.success).toBe(true);
    expect(config.chatbot.ativo).toBe(true);
    expect(config.horarioAtendimento.segunda).toHaveLength(1);
    expect(config.personalizacaoComercial).toBe(PersonalizacaoComercial.PADRAO);
  });
});

describe('personalização comercial por empresa', () => {
  const completo = { podeCatalogo: true, podeConfigurar: true };

  it('sem a chave, o menu permanece o da plataforma', () => {
    expect(lerPersonalizacaoComercial({})).toBe(PersonalizacaoComercial.PADRAO);
    expect(lerPersonalizacaoComercial(null)).toBe(PersonalizacaoComercial.PADRAO);
    expect(lerPersonalizacaoComercial({ personalizacaoComercial: 'OUTRO' })).toBe(
      PersonalizacaoComercial.PADRAO,
    );

    const rotulos = itensNavegacaoComercial({
      personalizacao: lerPersonalizacaoComercial({}),
      ...completo,
    }).map((item) => item.rotulo);

    expect(rotulos).toEqual([
      'Visão geral',
      'Conversas',
      'Negócios',
      'Agenda',
      'Produtos',
      'Estoque',
      'Pessoas',
      'Projetos',
      'Configurações',
    ]);
  });

  it('com ECOLUME, a navegação segue a seção 6 só onde a tela já existe', () => {
    const personalizacao = lerPersonalizacaoComercial({
      personalizacaoComercial: PersonalizacaoComercial.ECOLUME,
    });
    const itens = itensNavegacaoComercial({ personalizacao, ...completo });

    expect(itens.map((item) => item.rotulo)).toEqual([
      'Visão geral',
      'Negócios',
      'Agenda',
      'Clientes',
      'Parceiros',
      'Estoque',
      'Fornecedores',
      'Fiscal',
      'Configurações',
    ]);
    expect(itens.map((item) => item.rota)).toEqual([
      '/app/dashboard',
      '/app/pipeline',
      '/app/agenda',
      '/app/clientes',
      '/app/parceiros',
      '/app/estoque',
      '/app/fornecedores',
      '/app/fiscal',
      '/app/configuracoes/empresa',
    ]);
    expect(itens.some((item) => item.rotulo === 'Parceiros')).toBe(true);
    expect(itens.some((item) => item.rotulo === 'Fiscal')).toBe(true);
  });

  it('duas empresas não compartilham a personalização', () => {
    const ecolume = { personalizacaoComercial: PersonalizacaoComercial.ECOLUME };
    const padrao = { onboardingConcluido: true };
    expect(lerPersonalizacaoComercial(ecolume)).toBe(PersonalizacaoComercial.ECOLUME);
    expect(lerPersonalizacaoComercial(padrao)).toBe(PersonalizacaoComercial.PADRAO);
    expect(lerPersonalizacaoComercial(ecolume)).toBe(PersonalizacaoComercial.ECOLUME);
  });

  it('URL direta de conversas, produtos, projetos, WhatsApp e automação só fecha na Ecolume', () => {
    for (const nome of [
      'conversas',
      'produtos',
      'obras',
      'obra-detalhe',
      'config-whatsapp',
      'config-chatbot',
    ]) {
      expect(rotaOcultaNaPersonalizacao(nome, PersonalizacaoComercial.ECOLUME)).toBe(true);
      expect(rotaOcultaNaPersonalizacao(nome, PersonalizacaoComercial.PADRAO)).toBe(false);
      expect(rotaOcultaNaPersonalizacao(nome, undefined)).toBe(false);
    }
    expect(rotaOcultaNaPersonalizacao('dashboard', PersonalizacaoComercial.ECOLUME)).toBe(false);
    expect(rotaOcultaNaPersonalizacao('estoque', PersonalizacaoComercial.ECOLUME)).toBe(false);
  });

  it('vendedor da Ecolume vê estoque e não vê configuração; atendente não vê estoque', () => {
    const ecolume = PersonalizacaoComercial.ECOLUME;
    const vendedor = itensNavegacaoComercial({
      personalizacao: ecolume,
      podeCatalogo: true,
      podeConfigurar: false,
    }).map((item) => item.id);
    const atendente = itensNavegacaoComercial({
      personalizacao: ecolume,
      podeCatalogo: false,
      podeConfigurar: false,
    }).map((item) => item.id);

    expect(vendedor).toContain('estoque');
    expect(vendedor).toContain('fornecedores');
    expect(vendedor).toContain('fiscal');
    expect(vendedor).not.toContain('configuracoes');
    expect(atendente).not.toContain('estoque');
    expect(atendente).not.toContain('fornecedores');
    expect(atendente).not.toContain('fiscal');
    expect(atendente).not.toContain('produtos');
  });

  it('sem concessão, a flag esconde custo e preserva o preço de venda', () => {
    const bloqueado = resolverPermissoes({
      configuracoes: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME },
      perfil: PerfilUsuario.VENDEDOR,
      concedidas: [],
    });
    const legado = resolverPermissoes({
      configuracoes: {},
      perfil: PerfilUsuario.VENDEDOR,
      concedidas: [],
    });
    const produto = { precoVenda: 10, custoMedio: 4, margem: 20 };

    expect(publicarResposta(bloqueado, produto)).toEqual({ precoVenda: 10 });
    expect(publicarResposta(legado, produto)).toEqual(produto);
    expect(bloqueado.modo === 'ecolume' && bloqueado.chaves.has(PermissaoComercial.VER_CUSTOS)).toBe(
      false,
    );
  });

  it('tira senha, token e certificado do payload de auditoria', () => {
    const limpo = redigirSegredos({
      precoVenda: 10,
      senha: 'Arcco@123',
      senhaHash: 'hash',
      acesso: { token: 'segredo', nome: 'Maria' },
      certificado: { arquivo: 'a1.pfx' },
    });
    expect(limpo).toEqual({ precoVenda: 10, acesso: { nome: 'Maria' } });
    expect(JSON.stringify(limpo)).not.toContain('Arcco@123');
    expect(JSON.stringify(limpo)).not.toContain('segredo');
    expect(JSON.stringify(limpo)).not.toContain('a1.pfx');
  });
});
