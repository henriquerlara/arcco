-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoContato" AS ENUM ('PROPRIETARIO_OBRA', 'ARQUITETO', 'ENGENHEIRO', 'CONSTRUTORA', 'INSTALADOR', 'COMPRADOR', 'EMPRESA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusObra" AS ENUM ('PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoEtapaFunil" AS ENUM ('ABERTA', 'GANHA', 'PERDIDA');

-- CreateEnum
CREATE TYPE "OrigemHistoricoEtapa" AS ENUM ('CRIACAO', 'MANUAL', 'CHATBOT', 'ORCAMENTO_WHATSAPP');

-- CreateEnum
CREATE TYPE "PrioridadeOportunidade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoAtividade" AS ENUM ('LIGACAO', 'MENSAGEM', 'REUNIAO', 'ENVIAR_ORCAMENTO', 'REVISAR_ORCAMENTO', 'FOLLOW_UP', 'TAREFA');

-- CreateEnum
CREATE TYPE "ProvedorWhatsApp" AS ENUM ('MOCK', 'META');

-- CreateEnum
CREATE TYPE "StatusConexaoWhatsApp" AS ENUM ('DESCONECTADO', 'CONECTANDO', 'QR_CODE', 'CONECTADO', 'ERRO');

-- CreateEnum
CREATE TYPE "StatusConversa" AS ENUM ('BOT_ATENDENDO', 'AGUARDANDO_HUMANO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "ModoAtendimento" AS ENUM ('BOT', 'HUMANO', 'PAUSADO');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('RECEBIDA', 'ENVIADA');

-- CreateEnum
CREATE TYPE "TipoMensagem" AS ENUM ('TEXTO', 'IMAGEM', 'AUDIO', 'DOCUMENTO', 'LOCALIZACAO', 'SISTEMA');

-- CreateEnum
CREATE TYPE "StatusMensagem" AS ENUM ('RECEBIDA', 'PROCESSANDO', 'ENVIADA', 'ENTREGUE', 'LIDA', 'ERRO');

-- CreateEnum
CREATE TYPE "EntidadeCampoPersonalizado" AS ENUM ('CONTATO', 'OBRA', 'OPORTUNIDADE');

-- CreateEnum
CREATE TYPE "TipoCampoPersonalizado" AS ENUM ('TEXTO', 'TEXTO_LONGO', 'NUMERO', 'MOEDA', 'DATA', 'BOOLEANO', 'SELECAO', 'MULTISSELECAO');

-- CreateEnum
CREATE TYPE "StatusOrcamento" AS ENUM ('RASCUNHO', 'ENVIADO', 'ACEITO', 'CANCELADO', 'CONVERTIDO');

-- CreateEnum
CREATE TYPE "StatusNotaFiscal" AS ENUM ('RASCUNHO', 'PROCESSANDO', 'AUTORIZADA', 'REJEITADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA', 'BAIXA', 'AJUSTE');

-- CreateTable
CREATE TABLE "contatos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "telefoneNormalizado" TEXT NOT NULL,
    "email" TEXT,
    "tipo" "TipoContato" NOT NULL DEFAULT 'OUTRO',
    "empresaNome" TEXT,
    "documento" TEXT,
    "origem" TEXT,
    "observacoes" TEXT,
    "responsavelId" TEXT,
    "dadosPersonalizados" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obras" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "identificacao" TEXT,
    "tipo" TEXT,
    "status" "StatusObra" NOT NULL DEFAULT 'PLANEJAMENTO',
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "previsao" TIMESTAMP(3),
    "observacoes" TEXT,
    "dadosPersonalizados" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos_obras" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contatos_obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas_funil" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" "TipoEtapaFunil" NOT NULL DEFAULT 'ABERTA',
    "chaveSistema" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etapas_funil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oportunidades" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "obraId" TEXT,
    "categoriaId" TEXT,
    "etapaId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "descricao" TEXT,
    "origem" TEXT,
    "prioridade" "PrioridadeOportunidade" NOT NULL DEFAULT 'MEDIA',
    "valorEstimado" DOUBLE PRECISION,
    "previsaoFechamento" TIMESTAMP(3),
    "proximaAcao" TEXT,
    "dataProximaAcao" TIMESTAMP(3),
    "codigoOrcamento" TEXT,
    "motivoPerda" TEXT,
    "dadosPersonalizados" JSONB NOT NULL DEFAULT '{}',
    "fechadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oportunidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historicos_etapa_oportunidade" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "etapaNome" TEXT NOT NULL,
    "etapaAnteriorId" TEXT,
    "etapaAnteriorNome" TEXT,
    "origem" "OrigemHistoricoEtapa" NOT NULL,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historicos_etapa_oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_oportunidade" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'SISTEMA',
    "dados" JSONB NOT NULL DEFAULT '{}',
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT,
    "contatoId" TEXT,
    "obraId" TEXT,
    "responsavelId" TEXT NOT NULL,
    "tipo" "TipoAtividade" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "concluidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conexoes_whatsapp" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nomeInstancia" TEXT NOT NULL,
    "provedor" "ProvedorWhatsApp" NOT NULL DEFAULT 'MOCK',
    "status" "StatusConexaoWhatsApp" NOT NULL DEFAULT 'DESCONECTADO',
    "modoConexao" TEXT,
    "wabaId" TEXT,
    "phoneNumberId" TEXT,
    "isTestConnection" BOOLEAN NOT NULL DEFAULT false,
    "numero" TEXT,
    "qrCode" TEXT,
    "ultimoErro" TEXT,
    "conectadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conexoes_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "conexaoId" TEXT,
    "contatoId" TEXT,
    "telefone" TEXT NOT NULL,
    "telefoneNormalizado" TEXT NOT NULL,
    "nomeContato" TEXT,
    "status" "StatusConversa" NOT NULL DEFAULT 'BOT_ATENDENDO',
    "modo" "ModoAtendimento" NOT NULL DEFAULT 'BOT',
    "estadoBot" JSONB,
    "intencaoAtual" TEXT,
    "atendenteId" TEXT,
    "oportunidadeId" TEXT,
    "naoLidas" INTEGER NOT NULL DEFAULT 0,
    "ultimaMensagemEm" TIMESTAMP(3),
    "ultimaMensagemPreview" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "idExterno" TEXT,
    "direcao" "DirecaoMensagem" NOT NULL,
    "tipo" "TipoMensagem" NOT NULL DEFAULT 'TEXTO',
    "conteudo" TEXT NOT NULL,
    "status" "StatusMensagem" NOT NULL DEFAULT 'ENVIADA',
    "remetente" TEXT,
    "autorUsuarioId" TEXT,
    "arquivoId" TEXT,
    "metadados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeArmazenamento" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'local',
    "caminho" TEXT NOT NULL,
    "url" TEXT,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "enviadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campos_personalizados" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "entidade" "EntidadeCampoPersonalizado" NOT NULL,
    "chave" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoCampoPersonalizado" NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "opcoes" JSONB NOT NULL DEFAULT '[]',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "usarNoChatbot" BOOLEAN NOT NULL DEFAULT false,
    "textoPergunta" TEXT,
    "mostrarNoResumo" BOOLEAN NOT NULL DEFAULT true,
    "permitirFiltro" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campos_personalizados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sku" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "ncm" TEXT,
    "precoVenda" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estoqueAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estoqueMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "controlaEstoque" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusOrcamento" NOT NULL DEFAULT 'RASCUNHO',
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "descontoValor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validadeEm" TIMESTAMP(3),
    "arquivoId" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "aceitoEm" TIMESTAMP(3),
    "convertidoEm" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_orcamento" (
    "id" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "produtoId" TEXT,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "quantidade" DOUBLE PRECISION NOT NULL,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "desconto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLinha" DOUBLE PRECISION NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itens_orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipo" "TipoMovimentacaoEstoque" NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "saldoApos" DOUBLE PRECISION NOT NULL,
    "orcamentoId" TEXT,
    "oportunidadeId" TEXT,
    "observacao" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_fiscais" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "status" "StatusNotaFiscal" NOT NULL DEFAULT 'RASCUNHO',
    "chaveAcesso" TEXT,
    "numero" TEXT,
    "serie" TEXT,
    "protocolo" TEXT,
    "mensagemErro" TEXT,
    "idExternoFocus" TEXT,
    "refFocus" TEXT,
    "arquivoXmlId" TEXT,
    "arquivoPdfId" TEXT,
    "payloadEnvio" JSONB,
    "respostaFocus" JSONB,
    "autorizadoEm" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contatos_empresaId_idx" ON "contatos"("empresaId");

-- CreateIndex
CREATE INDEX "contatos_empresaId_nome_idx" ON "contatos"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "contatos_responsavelId_idx" ON "contatos"("responsavelId");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_empresaId_telefoneNormalizado_key" ON "contatos"("empresaId", "telefoneNormalizado");

-- CreateIndex
CREATE INDEX "obras_empresaId_idx" ON "obras"("empresaId");

-- CreateIndex
CREATE INDEX "obras_empresaId_status_idx" ON "obras"("empresaId", "status");

-- CreateIndex
CREATE INDEX "contatos_obras_empresaId_idx" ON "contatos_obras"("empresaId");

-- CreateIndex
CREATE INDEX "contatos_obras_contatoId_idx" ON "contatos_obras"("contatoId");

-- CreateIndex
CREATE INDEX "contatos_obras_obraId_idx" ON "contatos_obras"("obraId");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_obras_empresaId_contatoId_obraId_papel_key" ON "contatos_obras"("empresaId", "contatoId", "obraId", "papel");

-- CreateIndex
CREATE INDEX "categorias_empresaId_idx" ON "categorias"("empresaId");

-- CreateIndex
CREATE INDEX "etapas_funil_empresaId_idx" ON "etapas_funil"("empresaId");

-- CreateIndex
CREATE INDEX "etapas_funil_empresaId_ordem_idx" ON "etapas_funil"("empresaId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_funil_empresaId_chaveSistema_key" ON "etapas_funil"("empresaId", "chaveSistema");

-- CreateIndex
CREATE INDEX "oportunidades_empresaId_idx" ON "oportunidades"("empresaId");

-- CreateIndex
CREATE INDEX "oportunidades_empresaId_etapaId_idx" ON "oportunidades"("empresaId", "etapaId");

-- CreateIndex
CREATE INDEX "oportunidades_empresaId_responsavelId_idx" ON "oportunidades"("empresaId", "responsavelId");

-- CreateIndex
CREATE INDEX "oportunidades_contatoId_idx" ON "oportunidades"("contatoId");

-- CreateIndex
CREATE UNIQUE INDEX "oportunidades_empresaId_codigo_key" ON "oportunidades"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "historicos_etapa_oportunidade_empresaId_idx" ON "historicos_etapa_oportunidade"("empresaId");

-- CreateIndex
CREATE INDEX "historicos_etapa_oportunidade_oportunidadeId_criadoEm_idx" ON "historicos_etapa_oportunidade"("oportunidadeId", "criadoEm");

-- CreateIndex
CREATE INDEX "eventos_oportunidade_empresaId_criadoEm_idx" ON "eventos_oportunidade"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX "eventos_oportunidade_oportunidadeId_criadoEm_idx" ON "eventos_oportunidade"("oportunidadeId", "criadoEm");

-- CreateIndex
CREATE INDEX "atividades_empresaId_idx" ON "atividades"("empresaId");

-- CreateIndex
CREATE INDEX "atividades_empresaId_responsavelId_idx" ON "atividades"("empresaId", "responsavelId");

-- CreateIndex
CREATE INDEX "atividades_empresaId_concluida_vencimento_idx" ON "atividades"("empresaId", "concluida", "vencimento");

-- CreateIndex
CREATE INDEX "atividades_oportunidadeId_idx" ON "atividades"("oportunidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "conexoes_whatsapp_nomeInstancia_key" ON "conexoes_whatsapp"("nomeInstancia");

-- CreateIndex
CREATE INDEX "conexoes_whatsapp_empresaId_idx" ON "conexoes_whatsapp"("empresaId");

-- CreateIndex
CREATE INDEX "conexoes_whatsapp_phoneNumberId_idx" ON "conexoes_whatsapp"("phoneNumberId");

-- CreateIndex
CREATE INDEX "conversas_empresaId_idx" ON "conversas"("empresaId");

-- CreateIndex
CREATE INDEX "conversas_empresaId_status_idx" ON "conversas"("empresaId", "status");

-- CreateIndex
CREATE INDEX "conversas_empresaId_telefoneNormalizado_idx" ON "conversas"("empresaId", "telefoneNormalizado");

-- CreateIndex
CREATE INDEX "conversas_empresaId_atualizadoEm_idx" ON "conversas"("empresaId", "atualizadoEm");

-- CreateIndex
CREATE INDEX "mensagens_empresaId_idx" ON "mensagens"("empresaId");

-- CreateIndex
CREATE INDEX "mensagens_conversaId_criadoEm_idx" ON "mensagens"("conversaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_conversaId_idExterno_key" ON "mensagens"("conversaId", "idExterno");

-- CreateIndex
CREATE INDEX "arquivos_empresaId_idx" ON "arquivos"("empresaId");

-- CreateIndex
CREATE INDEX "arquivos_empresaId_entidade_entidadeId_idx" ON "arquivos"("empresaId", "entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "campos_personalizados_empresaId_entidade_idx" ON "campos_personalizados"("empresaId", "entidade");

-- CreateIndex
CREATE UNIQUE INDEX "campos_personalizados_empresaId_entidade_chave_key" ON "campos_personalizados"("empresaId", "entidade", "chave");

-- CreateIndex
CREATE INDEX "produtos_empresaId_idx" ON "produtos"("empresaId");

-- CreateIndex
CREATE INDEX "produtos_empresaId_ativo_idx" ON "produtos"("empresaId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_empresaId_sku_key" ON "produtos"("empresaId", "sku");

-- CreateIndex
CREATE INDEX "orcamentos_empresaId_idx" ON "orcamentos"("empresaId");

-- CreateIndex
CREATE INDEX "orcamentos_oportunidadeId_versao_idx" ON "orcamentos"("oportunidadeId", "versao");

-- CreateIndex
CREATE INDEX "orcamentos_oportunidadeId_vigente_idx" ON "orcamentos"("oportunidadeId", "vigente");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_empresaId_numero_key" ON "orcamentos"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "itens_orcamento_orcamentoId_idx" ON "itens_orcamento"("orcamentoId");

-- CreateIndex
CREATE INDEX "itens_orcamento_produtoId_idx" ON "itens_orcamento"("produtoId");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_empresaId_criadoEm_idx" ON "movimentacoes_estoque"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_produtoId_criadoEm_idx" ON "movimentacoes_estoque"("produtoId", "criadoEm");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_orcamentoId_idx" ON "movimentacoes_estoque"("orcamentoId");

-- CreateIndex
CREATE INDEX "notas_fiscais_empresaId_idx" ON "notas_fiscais"("empresaId");

-- CreateIndex
CREATE INDEX "notas_fiscais_orcamentoId_idx" ON "notas_fiscais"("orcamentoId");

-- CreateIndex
CREATE INDEX "notas_fiscais_oportunidadeId_idx" ON "notas_fiscais"("oportunidadeId");

-- CreateIndex
CREATE INDEX "notas_fiscais_empresaId_status_idx" ON "notas_fiscais"("empresaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notas_fiscais_empresaId_refFocus_key" ON "notas_fiscais"("empresaId", "refFocus");

-- AddForeignKey
ALTER TABLE "contatos_obras" ADD CONSTRAINT "contatos_obras_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos_obras" ADD CONSTRAINT "contatos_obras_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "etapas_funil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historicos_etapa_oportunidade" ADD CONSTRAINT "historicos_etapa_oportunidade_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_oportunidade" ADD CONSTRAINT "eventos_oportunidade_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_conexaoId_fkey" FOREIGN KEY ("conexaoId") REFERENCES "conexoes_whatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_orcamento" ADD CONSTRAINT "itens_orcamento_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_orcamento" ADD CONSTRAINT "itens_orcamento_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
