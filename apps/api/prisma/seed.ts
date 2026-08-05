import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  PerfilUsuario,
  SegmentoEmpresa,
  TipoContato,
  StatusObra,
  PrioridadeOportunidade,
  TipoAtividade,
  ProvedorWhatsApp,
  StatusConexaoWhatsApp,
  StatusConversa,
  ModoAtendimento,
  DirecaoMensagem,
  TipoMensagem,
  StatusMensagem,
  TipoEtapaFunil,
  configuracoesEmpresaPadrao,
} from '@arcco/contratos';
import { templatePorSegmento } from '../src/modules/empresas/templates-segmento';
import { normalizarTelefone } from '../src/common/utils/telefone';

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
  contatos: Array<{
    nome: string;
    telefone: string;
    tipo: TipoContato;
    empresaNome?: string;
  }>;
  obras: Array<{ nome: string; cidade: string; status: StatusObra; tipo: string }>;
  oportunidades: Array<{ titulo: string; valor: number; prioridade: PrioridadeOportunidade }>;
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
    contatos: [
      { nome: 'Marina Arquiteta', telefone: '(11) 98888-1111', tipo: TipoContato.ARQUITETO, empresaNome: 'Studio Marina' },
      { nome: 'Construtora Aurora', telefone: '(11) 98888-2222', tipo: TipoContato.CONSTRUTORA, empresaNome: 'Aurora Engenharia' },
      { nome: 'Carlos Proprietario', telefone: '(11) 98888-3333', tipo: TipoContato.PROPRIETARIO_OBRA },
    ],
    obras: [
      { nome: 'Residencia Alto de Pinheiros', cidade: 'São Paulo', status: StatusObra.EM_ANDAMENTO, tipo: 'Residencial' },
      { nome: 'Escritorio Faria Lima', cidade: 'São Paulo', status: StatusObra.PLANEJAMENTO, tipo: 'Comercial' },
    ],
    oportunidades: [
      { titulo: 'Iluminacao sala e cozinha', valor: 18500, prioridade: PrioridadeOportunidade.ALTA },
      { titulo: 'Projeto luminotecnico completo', valor: 42000, prioridade: PrioridadeOportunidade.MEDIA },
      { titulo: 'Fitas LED area externa', valor: 7600, prioridade: PrioridadeOportunidade.BAIXA },
    ],
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
    contatos: [
      { nome: 'Engenheiro Souza', telefone: '(19) 97777-1111', tipo: TipoContato.ENGENHEIRO, empresaNome: 'Souza Estruturas' },
      { nome: 'Construtora Solida', telefone: '(19) 97777-2222', tipo: TipoContato.CONSTRUTORA, empresaNome: 'Solida Obras' },
      { nome: 'Fernanda Compras', telefone: '(19) 97777-3333', tipo: TipoContato.COMPRADOR, empresaNome: 'Grupo FGM' },
    ],
    obras: [
      { nome: 'Galpao Logistico Viracopos', cidade: 'Campinas', status: StatusObra.EM_ANDAMENTO, tipo: 'Industrial' },
      { nome: 'Edificio Residencial Cambui', cidade: 'Campinas', status: StatusObra.PLANEJAMENTO, tipo: 'Residencial' },
    ],
    oportunidades: [
      { titulo: 'Concreto usinado 30 MPa - 120m3', valor: 96000, prioridade: PrioridadeOportunidade.URGENTE },
      { titulo: 'Piso industrial polido', valor: 55000, prioridade: PrioridadeOportunidade.ALTA },
      { titulo: 'Bombeamento laje 4o andar', valor: 12000, prioridade: PrioridadeOportunidade.MEDIA },
    ],
  },
];

async function limparEmpresaExistente(emailProprietario: string): Promise<void> {
  const dono = await prisma.usuario.findUnique({ where: { email: emailProprietario } });
  if (dono) {
    await prisma.empresa.delete({ where: { id: dono.empresaId } }).catch(() => undefined);
  }
}

async function semear(spec: EspecificacaoEmpresa): Promise<void> {
  await limparEmpresaExistente(spec.emailProprietario);

  const senhaHash = await argon2.hash(SENHA_PADRAO, { type: argon2.argon2id });
  const template = templatePorSegmento(spec.segmento);
  const config = configuracoesEmpresaPadrao();
  config.onboardingConcluido = true;
  config.chatbot.mensagemInicial = `Ola! Aqui e a ${spec.nomeFantasia}. Como posso ajudar hoje?`;

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

  const [proprietario, vendedor] = await Promise.all([
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

  const etapas = await prisma.etapaFunil.findMany({
    where: { empresaId: empresa.id },
    orderBy: { ordem: 'asc' },
  });
  const primeiraCategoria = await prisma.categoria.findFirst({
    where: { empresaId: empresa.id },
    orderBy: { ordem: 'asc' },
  });

  const contatos = [];
  for (const c of spec.contatos) {
    const contato = await prisma.contato.create({
      data: {
        empresaId: empresa.id,
        nome: c.nome,
        telefone: c.telefone,
        telefoneNormalizado: normalizarTelefone(c.telefone),
        tipo: c.tipo,
        empresaNome: c.empresaNome ?? null,
        origem: 'seed',
        responsavelId: vendedor.id,
      },
    });
    contatos.push(contato);
  }

  const obras = [];
  for (const o of spec.obras) {
    const obra = await prisma.obra.create({
      data: {
        empresaId: empresa.id,
        nome: o.nome,
        cidade: o.cidade,
        estado: spec.estado,
        status: o.status,
        tipo: o.tipo,
      },
    });
    obras.push(obra);
  }

  // Vincula o primeiro contato a primeira obra.
  if (contatos[0] && obras[0]) {
    await prisma.contatoObra.create({
      data: {
        empresaId: empresa.id,
        contatoId: contatos[0].id,
        obraId: obras[0].id,
        papel: 'Responsavel tecnico',
      },
    });
  }

  const etapasAbertas = etapas.filter((e) => e.tipo === TipoEtapaFunil.ABERTA);

  let indice = 0;
  for (const op of spec.oportunidades) {
    const contato = contatos[indice % contatos.length]!;
    const obra = obras[indice % obras.length];
    const etapa = etapasAbertas[indice % etapasAbertas.length] ?? etapas[0]!;
    const oportunidade = await prisma.oportunidade.create({
      data: {
        empresaId: empresa.id,
        codigo: `OP-${String(indice + 1).padStart(4, '0')}`,
        titulo: op.titulo,
        contatoId: contato.id,
        obraId: obra?.id ?? null,
        categoriaId: primeiraCategoria?.id ?? null,
        etapaId: etapa.id,
        responsavelId: vendedor.id,
        prioridade: op.prioridade,
        valorEstimado: op.valor,
        origem: 'seed',
      },
    });

    await prisma.atividade.create({
      data: {
        empresaId: empresa.id,
        oportunidadeId: oportunidade.id,
        contatoId: contato.id,
        responsavelId: vendedor.id,
        tipo: TipoAtividade.FOLLOW_UP,
        titulo: `Retornar contato sobre ${op.titulo}`,
        vencimento: new Date(Date.now() + (indice + 1) * 86400_000),
      },
    });

    indice += 1;
  }

  // Conexao WhatsApp (mock) + conversa de exemplo com mensagens.
  const conexao = await prisma.conexaoWhatsApp.create({
    data: {
      empresaId: empresa.id,
      nomeInstancia: `mock-${empresa.id.slice(0, 8)}`,
      provedor: ProvedorWhatsApp.MOCK,
      status: StatusConexaoWhatsApp.CONECTADO,
      numero: normalizarTelefone(spec.telefone),
    },
  });

  const contatoConversa = contatos[0]!;
  const conversa = await prisma.conversa.create({
    data: {
      empresaId: empresa.id,
      conexaoId: conexao.id,
      contatoId: contatoConversa.id,
      telefone: contatoConversa.telefone,
      telefoneNormalizado: contatoConversa.telefoneNormalizado,
      nomeContato: contatoConversa.nome,
      status: StatusConversa.AGUARDANDO_HUMANO,
      modo: ModoAtendimento.BOT,
      ultimaMensagemEm: new Date(),
      ultimaMensagemPreview: 'Gostaria de um orcamento',
      estadoBot: { fluxo: 'MENU', dadosColetados: {}, tentativas: 0 } as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.mensagem.createMany({
    data: [
      {
        empresaId: empresa.id,
        conversaId: conversa.id,
        direcao: DirecaoMensagem.RECEBIDA,
        tipo: TipoMensagem.TEXTO,
        conteudo: 'Ola, gostaria de um orcamento',
        status: StatusMensagem.RECEBIDA,
        remetente: contatoConversa.telefone,
        idExterno: `seed_${empresa.id}_1`,
      },
      {
        empresaId: empresa.id,
        conversaId: conversa.id,
        direcao: DirecaoMensagem.ENVIADA,
        tipo: TipoMensagem.TEXTO,
        conteudo: config.chatbot.mensagemInicial,
        status: StatusMensagem.ENVIADA,
        remetente: 'bot',
        idExterno: `seed_${empresa.id}_2`,
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log(`Empresa semeada: ${spec.nomeFantasia} (proprietario: ${proprietario.email})`);
}

async function main(): Promise<void> {
  for (const spec of EMPRESAS) {
    await semear(spec);
  }
  // eslint-disable-next-line no-console
  console.log(`\nSeed concluido. Senha padrao de acesso: ${SENHA_PADRAO}`);
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
