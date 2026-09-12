import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  PerfilUsuario,
  SegmentoEmpresa,
  TipoContato,
  StatusObra,
  PrioridadeOportunidade,
  ProvedorWhatsApp,
  StatusConexaoWhatsApp,
  StatusConversa,
  ModoAtendimento,
  DirecaoMensagem,
  TipoMensagem,
  StatusMensagem,
  configuracoesEmpresaPadrao,
} from '@arcco/contratos';
import { templatePorSegmento } from '../src/modules/empresas/templates-segmento';
import { normalizarTelefone } from '../src/common/utils/telefone';

/**
 * Seed mínimo + 1 negócio de teste (Iluminação) com produtos, orçamento e conversa mock
 * para exercitar montagem/envio/PDF e baixa no Fechado.
 */
const prisma = new PrismaClient();
const SENHA_PADRAO = 'Arcco@123';

interface EspecificacaoEmpresa {
  nome: string;
  nomeFantasia: string;
  segmento: SegmentoEmpresa;
  cidade: string;
  estado: string;
  telefone: string;
  emailProprietario: string;
  nomeProprietario: string;
  emailVendedor: string;
  nomeVendedor: string;
  emailAtendente: string;
  nomeAtendente: string;
  comNegocioTeste?: boolean;
}

const EMPRESAS: EspecificacaoEmpresa[] = [
  {
    nome: 'ARCCO Demo Iluminacao',
    nomeFantasia: 'ARCCO Demo Iluminação',
    segmento: SegmentoEmpresa.ILUMINACAO,
    cidade: 'São Paulo',
    estado: 'SP',
    telefone: '(11) 3000-1000',
    emailProprietario: 'proprietario.iluminacao@demo.arcco.local',
    nomeProprietario: 'Helena Prado',
    emailVendedor: 'vendedor.iluminacao@demo.arcco.local',
    nomeVendedor: 'Rafael Luz',
    emailAtendente: 'atendente.iluminacao@demo.arcco.local',
    nomeAtendente: 'Bianca Farol',
    comNegocioTeste: true,
  },
  {
    nome: 'ARCCO Demo Concreto',
    nomeFantasia: 'ARCCO Demo Concreto',
    segmento: SegmentoEmpresa.CONCRETO,
    cidade: 'Campinas',
    estado: 'SP',
    telefone: '(19) 3200-2000',
    emailProprietario: 'proprietario.concreto@demo.arcco.local',
    nomeProprietario: 'Otavio Concer',
    emailVendedor: 'vendedor.concreto@demo.arcco.local',
    nomeVendedor: 'Tiago Massa',
    emailAtendente: 'atendente.concreto@demo.arcco.local',
    nomeAtendente: 'Paula Brita',
  },
];

async function limparEmpresaExistente(emailProprietario: string): Promise<void> {
  const dono = await prisma.usuario.findUnique({ where: { email: emailProprietario } });
  if (dono) {
    await prisma.empresa.delete({ where: { id: dono.empresaId } }).catch(() => undefined);
  }
}

async function semearNegocioTeste(params: {
  empresaId: string;
  vendedorId: string;
  mensagemInicial: string;
}): Promise<void> {
  const { empresaId, vendedorId, mensagemInicial } = params;

  const spot = await prisma.produto.create({
    data: {
      empresaId,
      sku: 'SPOT-01',
      nome: 'Spot embutido 7W',
      unidade: 'un',
      precoVenda: 89.9,
      estoqueAtual: 40,
      estoqueMinimo: 10,
      controlaEstoque: true,
    },
  });
  const fita = await prisma.produto.create({
    data: {
      empresaId,
      sku: 'FITA-5M',
      nome: 'Fita LED 5m 3000K',
      unidade: 'un',
      precoVenda: 149.0,
      estoqueAtual: 3,
      estoqueMinimo: 5,
      controlaEstoque: true,
    },
  });
  const perfil = await prisma.produto.create({
    data: {
      empresaId,
      sku: 'PERF-AL',
      nome: 'Perfil de alumínio 2m',
      unidade: 'un',
      precoVenda: 62.5,
      estoqueAtual: 25,
      estoqueMinimo: 5,
      controlaEstoque: true,
    },
  });

  await prisma.movimentacaoEstoque.createMany({
    data: [
      {
        empresaId,
        produtoId: spot.id,
        tipo: 'ENTRADA',
        quantidade: 40,
        saldoApos: 40,
        observacao: 'Saldo inicial (seed)',
      },
      {
        empresaId,
        produtoId: fita.id,
        tipo: 'ENTRADA',
        quantidade: 3,
        saldoApos: 3,
        observacao: 'Saldo inicial (seed) — abaixo do mínimo de propósito',
      },
      {
        empresaId,
        produtoId: perfil.id,
        tipo: 'ENTRADA',
        quantidade: 25,
        saldoApos: 25,
        observacao: 'Saldo inicial (seed)',
      },
    ],
  });

  const contato = await prisma.contato.create({
    data: {
      empresaId,
      nome: 'Cliente Teste Orçamento',
      telefone: '(11) 97777-0001',
      telefoneNormalizado: normalizarTelefone('(11) 97777-0001'),
      tipo: TipoContato.PROPRIETARIO_OBRA,
      origem: 'seed-teste',
      responsavelId: vendedorId,
    },
  });

  const obra = await prisma.obra.create({
    data: {
      empresaId,
      nome: 'Apartamento Teste — Moema',
      cidade: 'São Paulo',
      estado: 'SP',
      status: StatusObra.EM_ANDAMENTO,
      tipo: 'Residencial',
    },
  });

  const etapaOrcamento = await prisma.etapaFunil.findFirst({
    where: { empresaId, chaveSistema: 'QUALIFICACAO', ativo: true },
  });
  if (!etapaOrcamento) throw new Error('Etapa Orçamento não encontrada no seed');

  const oportunidade = await prisma.oportunidade.create({
    data: {
      empresaId,
      codigo: 'OP-0001',
      titulo: 'OP-0001',
      contatoId: contato.id,
      obraId: obra.id,
      etapaId: etapaOrcamento.id,
      responsavelId: vendedorId,
      prioridade: PrioridadeOportunidade.ALTA,
      origem: 'seed-teste',
      descricao: 'Negócio de teste para montar orçamento, gerar PDF e baixar estoque no Fechado.',
    },
  });

  const itens = [
    {
      produtoId: spot.id,
      nome: spot.nome,
      unidade: spot.unidade,
      quantidade: 12,
      precoUnitario: spot.precoVenda,
      desconto: 0,
      totalLinha: 12 * spot.precoVenda,
      ordem: 0,
    },
    {
      produtoId: fita.id,
      nome: fita.nome,
      unidade: fita.unidade,
      // quantidade acima do estoque (8) para mostrar o aviso
      quantidade: 15,
      precoUnitario: fita.precoVenda,
      desconto: 0,
      totalLinha: 15 * fita.precoVenda,
      ordem: 1,
    },
    {
      produtoId: perfil.id,
      nome: perfil.nome,
      unidade: perfil.unidade,
      quantidade: 4,
      precoUnitario: perfil.precoVenda,
      desconto: 0,
      totalLinha: 4 * perfil.precoVenda,
      ordem: 2,
    },
  ];
  const subtotal = itens.reduce((acc, i) => acc + i.totalLinha, 0);

  await prisma.orcamento.create({
    data: {
      empresaId,
      oportunidadeId: oportunidade.id,
      numero: 'ORC-0001-v1',
      versao: 1,
      status: 'RASCUNHO',
      vigente: false,
      observacoes: null,
      descontoValor: 0,
      subtotal,
      total: subtotal,
      itens: { create: itens },
    },
  });

  await prisma.oportunidade.update({
    where: { id: oportunidade.id },
    data: {
      valorEstimado: subtotal,
      codigoOrcamento: 'ORC-0001-v1',
    },
  });

  const conexao = await prisma.conexaoWhatsApp.create({
    data: {
      empresaId,
      nomeInstancia: `mock-${empresaId.slice(0, 8)}`,
      provedor: ProvedorWhatsApp.MOCK,
      status: StatusConexaoWhatsApp.CONECTADO,
      numero: normalizarTelefone('(11) 3000-1000'),
    },
  });

  const conversa = await prisma.conversa.create({
    data: {
      empresaId,
      conexaoId: conexao.id,
      contatoId: contato.id,
      oportunidadeId: oportunidade.id,
      telefone: contato.telefone,
      telefoneNormalizado: contato.telefoneNormalizado,
      nomeContato: contato.nome,
      status: StatusConversa.EM_ATENDIMENTO,
      modo: ModoAtendimento.HUMANO,
      ultimaMensagemEm: new Date(),
      ultimaMensagemPreview: 'Quero orçamento da sala',
      estadoBot: { fluxo: 'MENU', dadosColetados: {}, tentativas: 0 } as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.mensagem.createMany({
    data: [
      {
        empresaId,
        conversaId: conversa.id,
        direcao: DirecaoMensagem.RECEBIDA,
        tipo: TipoMensagem.TEXTO,
        conteudo: 'Oi, quero orçamento para sala e cozinha',
        status: StatusMensagem.RECEBIDA,
        remetente: contato.telefone,
        idExterno: `seed_teste_${empresaId}_1`,
      },
      {
        empresaId,
        conversaId: conversa.id,
        direcao: DirecaoMensagem.ENVIADA,
        tipo: TipoMensagem.TEXTO,
        conteudo: mensagemInicial,
        status: StatusMensagem.ENVIADA,
        remetente: 'bot',
        idExterno: `seed_teste_${empresaId}_2`,
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log(
    `  → Negócio de teste: ${oportunidade.codigo} · orçamento rascunho com aviso de estoque`,
  );
}

async function semear(spec: EspecificacaoEmpresa): Promise<void> {
  await limparEmpresaExistente(spec.emailProprietario);

  const senhaHash = await argon2.hash(SENHA_PADRAO, { type: argon2.argon2id });
  const template = templatePorSegmento(spec.segmento);
  const config = configuracoesEmpresaPadrao();
  config.onboardingConcluido = true;
  config.chatbot.mensagemInicial =
    `Olá! Seja muito bem-vindo à ${spec.nomeFantasia}. Sou o assistente virtual da equipe e estou aqui para tornar o seu atendimento mais ágil e preciso. Em breve, um dos nossos especialistas estará com você. Como posso direcioná-lo hoje?`;

  const empresa = await prisma.empresa.create({
    data: {
      nome: spec.nome,
      nomeFantasia: spec.nomeFantasia,
      segmento: spec.segmento,
      cidade: spec.cidade,
      estado: spec.estado,
      telefone: spec.telefone,
      configuracoes: config as unknown as Prisma.InputJsonValue,
    },
  });

  const [, vendedor] = await Promise.all([
    prisma.usuario.create({
      data: {
        empresaId: empresa.id,
        nome: spec.nomeProprietario,
        email: spec.emailProprietario,
        senhaHash,
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    }),
    prisma.usuario.create({
      data: {
        empresaId: empresa.id,
        nome: spec.nomeVendedor,
        email: spec.emailVendedor,
        senhaHash,
        perfil: PerfilUsuario.VENDEDOR,
      },
    }),
    prisma.usuario.create({
      data: {
        empresaId: empresa.id,
        nome: spec.nomeAtendente,
        email: spec.emailAtendente,
        senhaHash,
        perfil: PerfilUsuario.ATENDENTE,
      },
    }),
  ]);

  await prisma.categoria.createMany({
    data: template.categorias.map((c) => ({
      empresaId: empresa.id,
      nome: c.nome,
      descricao: c.descricao ?? null,
      ordem: c.ordem,
    })),
  });

  await prisma.etapaFunil.createMany({
    data: template.etapas.map((e) => ({
      empresaId: empresa.id,
      nome: e.nome,
      ordem: e.ordem,
      tipo: e.tipo,
      chaveSistema: e.chaveSistema,
    })),
  });

  await prisma.campoPersonalizado.createMany({
    data: template.campos.map((campo, i) => ({
      empresaId: empresa.id,
      entidade: campo.entidade,
      chave: campo.chave,
      rotulo: campo.rotulo,
      tipo: campo.tipo,
      obrigatorio: campo.obrigatorio ?? false,
      opcoes: campo.opcoes ?? [],
      ordem: campo.ordem ?? i,
      usarNoChatbot: campo.usarNoChatbot ?? false,
      textoPergunta: campo.textoPergunta ?? null,
      mostrarNoResumo: campo.mostrarNoResumo ?? true,
    })),
  });

  if (spec.comNegocioTeste) {
    await semearNegocioTeste({
      empresaId: empresa.id,
      vendedorId: vendedor.id,
      mensagemInicial: config.chatbot.mensagemInicial,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Empresa semeada: ${spec.nomeFantasia} (${spec.emailProprietario})`);
}

async function main(): Promise<void> {
  for (const spec of EMPRESAS) {
    await semear(spec);
  }
  // eslint-disable-next-line no-console
  console.log(`\nSeed OK. Senha: ${SENHA_PADRAO}`);
  // eslint-disable-next-line no-console
  console.log(
    'Teste: entre como proprietario.iluminacao@demo.arcco.local → Negócios → OP-0001',
  );
}

main()
  .catch((erro) => {
    // eslint-disable-next-line no-console
    console.error('Erro no seed:', erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
