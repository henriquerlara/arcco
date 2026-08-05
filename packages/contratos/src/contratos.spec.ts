import { describe, expect, it } from 'vitest';
import {
  cadastrarSchema,
  configuracoesEmpresaPadrao,
  configuracoesEmpresaSchema,
  SegmentoEmpresa,
} from './index.js';

describe('contratos', () => {
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
  });
});
