-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('PROPRIETARIO', 'GESTOR', 'VENDEDOR', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "SegmentoEmpresa" AS ENUM ('ILUMINACAO', 'PISOS_REVESTIMENTOS', 'ESQUADRIAS', 'CONCRETO', 'MATERIAIS_CONSTRUCAO', 'SERVICOS_OBRAS', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoContato" AS ENUM ('PROPRIETARIO_OBRA', 'ARQUITETO', 'ENGENHEIRO', 'CONSTRUTORA', 'INSTALADOR', 'COMPRADOR', 'EMPRESA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusObra" AS ENUM ('PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoEtapaFunil" AS ENUM ('ABERTA', 'GANHA', 'PERDIDA');

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

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "segmento" "SegmentoEmpresa" NOT NULL DEFAULT 'OUTRO',
    "telefone" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "configuracoes" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'VENDEDOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deveTrocarSenha" BOOLEAN NOT NULL DEFAULT false,
    "versaoSessao" INTEGER NOT NULL DEFAULT 0,
    "ultimoAcessoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

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
    "opcoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
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

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_empresaId_idx" ON "usuarios"("empresaId");

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

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos_obras" ADD CONSTRAINT "contatos_obras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos_obras" ADD CONSTRAINT "contatos_obras_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos_obras" ADD CONSTRAINT "contatos_obras_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_funil" ADD CONSTRAINT "etapas_funil_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "etapas_funil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conexoes_whatsapp" ADD CONSTRAINT "conexoes_whatsapp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_conexaoId_fkey" FOREIGN KEY ("conexaoId") REFERENCES "conexoes_whatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campos_personalizados" ADD CONSTRAINT "campos_personalizados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
