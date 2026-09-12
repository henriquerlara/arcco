import { describe, expect, it } from 'vitest';
import { IntencaoChatbot, type ChatbotConfig, type EstadoBot } from '@arcco/contratos';
import { avancarChatbot, FLUXO } from './maquina-estados';
import { SAUDACAO_PADRAO, OPCAO_INVALIDA } from './mensagens-ecolume';

const config: ChatbotConfig = {
  ativo: true,
  nome: 'Assistente Ecolume',
  mensagemInicial: '',
  mensagemForaHorario: 'Estamos fora do horario.',
  mensagemTransferencia: 'Transferindo.',
  mensagemFinal: 'Finalizado.',
  textoPerguntaProjeto: 'a lista de materiais',
};

const estadoVazio: EstadoBot = { dadosColetados: {}, tentativas: 0 };

const base = {
  intencao: IntencaoChatbot.OUTRO,
  opcaoMenu: null as IntencaoChatbot | null,
  config,
  emHorario: true,
};

describe('avancarChatbot - menu Ecolume v8', () => {
  it('mostra saudacao oficial e menu 1-5 na primeira interacao', () => {
    const saida = avancarChatbot({ ...base, texto: 'oi', estado: estadoVazio });
    expect(saida.acao).toBe('NENHUMA');
    expect(saida.novoEstado.fluxo).toBe(FLUXO.MENU);
    expect(saida.novoEstado.etapa).toBe('direcionamento');
    const texto = saida.respostas.join('\n');
    expect(texto).toContain(SAUDACAO_PADRAO.slice(0, 40));
    expect(texto).toContain('1 Vendas');
    expect(texto).toContain('5 Outros');
  });

  it('inclui mensagem de fora de horario quando aplicavel', () => {
    const saida = avancarChatbot({ ...base, texto: 'oi', estado: estadoVazio, emHorario: false });
    expect(saida.respostas.join('\n')).toContain('fora do horario');
  });

  it('rejeita opcao invalida no menu principal', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '9',
      estado: { fluxo: FLUXO.MENU, etapa: 'direcionamento', dadosColetados: {}, tentativas: 0 },
    });
    expect(saida.acao).toBe('NENHUMA');
    expect(saida.respostas[0]).toBe(OPCAO_INVALIDA);
    expect(saida.novoEstado.fluxo).toBe(FLUXO.MENU);
  });

  it('opcao 1 abre submenu de Vendas', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '1',
      opcaoMenu: IntencaoChatbot.VENDAS,
      estado: { fluxo: FLUXO.MENU, etapa: 'direcionamento', dadosColetados: {}, tentativas: 0 },
    });
    expect(saida.novoEstado.fluxo).toBe(FLUXO.VENDAS);
    expect(saida.novoEstado.etapa).toBe('tipo');
    expect(saida.respostas.join('\n')).toContain('Novo Orçamento');
  });

  it('opcao 3 abre S.A.C', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '3',
      opcaoMenu: IntencaoChatbot.SAC,
      estado: { fluxo: FLUXO.MENU, etapa: 'direcionamento', dadosColetados: {}, tentativas: 0 },
    });
    expect(saida.novoEstado.fluxo).toBe(FLUXO.SAC);
    expect(saida.respostas.join('\n')).toContain('Produto com defeito');
  });
});

describe('avancarChatbot - Vendas / Novo Orçamento', () => {
  it('pede CPF ao escolher Novo Orçamento', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '1',
      estado: { fluxo: FLUXO.VENDAS, etapa: 'tipo', dadosColetados: {}, tentativas: 0 },
    });
    expect(saida.novoEstado.etapa).toBe('novo_cpf');
    expect(saida.respostas[0]).toContain('CPF');
  });

  it('com cadastro encontrado pergunta sobre lista de materiais', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '12345678901',
      cadastroEncontrado: true,
      estado: {
        fluxo: FLUXO.VENDAS,
        etapa: 'novo_cpf',
        dadosColetados: { tipoVendas: 'Novo Orçamento' },
        tentativas: 0,
      },
    });
    expect(saida.novoEstado.etapa).toBe('novo_projeto');
    expect(saida.respostas.join('\n')).toContain('Cadastro localizado');
    expect(saida.respostas.join('\n')).toContain('a lista de materiais');
  });

  it('sem cadastro pede endereco da obra', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '12345678901',
      cadastroEncontrado: false,
      estado: {
        fluxo: FLUXO.VENDAS,
        etapa: 'novo_cpf',
        dadosColetados: { tipoVendas: 'Novo Orçamento' },
        tentativas: 0,
      },
    });
    expect(saida.novoEstado.etapa).toBe('novo_endereco');
    expect(saida.respostas[0]).toContain('endereço da obra');
  });

  it('usa textoPerguntaProjeto configuravel', () => {
    const saida = avancarChatbot({
      ...base,
      config: { ...config, textoPerguntaProjeto: 'o projeto luminotécnico' },
      texto: 'Rua das Flores, 100',
      estado: {
        fluxo: FLUXO.VENDAS,
        etapa: 'novo_endereco',
        dadosColetados: { cpf: '123', cadastroEncontrado: 'nao' },
        tentativas: 0,
      },
    });
    expect(saida.respostas.join('\n')).toContain('o projeto luminotécnico');
  });

  it('com projeto aceita arquivo e cria oportunidade', () => {
    const pergunta = avancarChatbot({
      ...base,
      texto: '1',
      estado: {
        fluxo: FLUXO.VENDAS,
        etapa: 'novo_projeto',
        dadosColetados: { cpf: '123', tipoVendas: 'Novo Orçamento' },
        tentativas: 0,
      },
    });
    expect(pergunta.novoEstado.etapa).toBe('novo_arquivo');

    const fim = avancarChatbot({
      ...base,
      texto: 'lista-materiais.pdf',
      estado: pergunta.novoEstado,
    });
    expect(fim.acao).toBe('CRIAR_OPORTUNIDADE');
    expect(fim.dadosOportunidade?.campos.arquivo_lista).toBe('lista-materiais.pdf');
    expect(fim.dadosOportunidade?.campos.possui_projeto).toBe('Sim');
  });

  it('sem projeto cria oportunidade e transfere', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '2',
      estado: {
        fluxo: FLUXO.VENDAS,
        etapa: 'novo_projeto',
        dadosColetados: { cpf: '123', tipoVendas: 'Novo Orçamento' },
        tentativas: 0,
      },
    });
    expect(saida.acao).toBe('CRIAR_OPORTUNIDADE');
    expect(saida.dadosOportunidade?.campos.cpf).toBe('123');
    expect(saida.dadosOportunidade?.campos.tipo_solicitacao).toBe('Novo orçamento');
    expect(saida.dadosOportunidade?.campos.possui_projeto).toBe('Não');
    expect(saida.dadosOportunidade?.necessidade).toBeUndefined();
    expect(saida.novoEstado.fluxo).toBe(FLUXO.FINALIZADO);
    expect(saida.novoEstado.resumo).toContain('Vendas');
    expect(saida.respostas[0]).toContain('especialistas');
  });

  it('negociacao transfere com resumo', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '3',
      estado: { fluxo: FLUXO.VENDAS, etapa: 'tipo', dadosColetados: {}, tentativas: 0 },
    });
    expect(saida.acao).toBe('TRANSFERIR');
    expect(saida.novoEstado.resumo).toContain('Negociação');
  });

  it('ajuste de orcamento cria oportunidade com codigo e o que deve mudar', () => {
    const codigo = avancarChatbot({
      ...base,
      texto: '2',
      estado: { fluxo: FLUXO.VENDAS, etapa: 'tipo', dadosColetados: {}, tentativas: 0 },
    });
    expect(codigo.novoEstado.etapa).toBe('ajuste_codigo');

    const descricao = avancarChatbot({
      ...base,
      texto: 'OP-0001',
      estado: codigo.novoEstado,
    });
    expect(descricao.novoEstado.etapa).toBe('ajuste_descricao');

    const fim = avancarChatbot({
      ...base,
      texto: 'Trocar as luminarias do 2o andar por LED',
      estado: descricao.novoEstado,
    });
    expect(fim.acao).toBe('CRIAR_OPORTUNIDADE');
    expect(fim.dadosOportunidade?.codigoOrcamento).toBe('OP-0001');
    expect(fim.dadosOportunidade?.descricao).toContain('luminarias');
    expect(fim.dadosOportunidade?.campos.tipo_solicitacao).toBe('Ajuste de orçamento');
    expect(fim.dadosOportunidade?.campos.ajuste_status).toBe('pendente');
    expect(fim.dadosOportunidade?.campos.codigo_orcamento).toBe('OP-0001');
  });
});

describe('avancarChatbot - Financeiro', () => {
  it('coleta pedido e transfere em segunda via', () => {
    const inicio = avancarChatbot({
      ...base,
      texto: '1',
      estado: { fluxo: FLUXO.FINANCEIRO, etapa: 'assunto', dadosColetados: {}, tentativas: 0 },
    });
    expect(inicio.novoEstado.etapa).toBe('boleto_pedido');

    const fim = avancarChatbot({
      ...base,
      texto: 'PED-100',
      estado: inicio.novoEstado,
    });
    expect(fim.acao).toBe('TRANSFERIR');
    expect(fim.novoEstado.dadosColetados?.numeroPedido).toBe('PED-100');
    expect(fim.novoEstado.resumo).toContain('Financeiro');
  });
});

describe('avancarChatbot - S.A.C devolucao', () => {
  it('aviso de sobra de obra e pergunta NF', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '3',
      estado: {
        fluxo: FLUXO.SAC,
        etapa: 'devolucao_motivo',
        dadosColetados: { produto: 'LED', numeroPedido: '1' },
        tentativas: 0,
      },
    });
    expect(saida.novoEstado.etapa).toBe('devolucao_nf');
    expect(saida.respostas.join('\n')).toContain('sobra de obra');
    expect(saida.respostas.join('\n')).toContain('nota fiscal');
  });
});

describe('avancarChatbot - Entrega e Outros', () => {
  it('problema na entrega com tipo invalido', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '9',
      estado: {
        fluxo: FLUXO.ENTREGA,
        etapa: 'problema_tipo',
        dadosColetados: { numeroPedido: '1' },
        tentativas: 0,
      },
    });
    expect(saida.respostas[0]).toBe(OPCAO_INVALIDA);
  });

  it('outros coleta descricao e transfere', () => {
    const saida = avancarChatbot({
      ...base,
      texto: 'Preciso de ajuda com algo especifico',
      estado: { fluxo: FLUXO.OUTROS, etapa: 'descricao', dadosColetados: {}, tentativas: 0 },
    });
    expect(saida.acao).toBe('TRANSFERIR');
    expect(saida.novoEstado.resumo).toContain('Outros');
  });
});
