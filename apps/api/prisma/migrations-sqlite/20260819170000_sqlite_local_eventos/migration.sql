-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "segmento" TEXT NOT NULL DEFAULT 'OUTRO',
    "telefone" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "configuracoes" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" TEXT NOT NULL DEFAULT 'VENDEDOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deveTrocarSenha" BOOLEAN NOT NULL DEFAULT false,
    "versaoSessao" INTEGER NOT NULL DEFAULT 0,
    "ultimoAcessoEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "usuarios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "telefoneNormalizado" TEXT NOT NULL,
    "email" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'OUTRO',
    "empresaNome" TEXT,
    "origem" TEXT,
    "observacoes" TEXT,
    "responsavelId" TEXT,
    "dadosPersonalizados" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "contatos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "obras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "identificacao" TEXT,
    "tipo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANEJAMENTO',
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "previsao" DATETIME,
    "observacoes" TEXT,
    "dadosPersonalizados" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "obras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contatos_obras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contatos_obras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contatos_obras_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contatos_obras_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "categorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "etapas_funil" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'ABERTA',
    "chaveSistema" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "etapas_funil_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "oportunidades" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "prioridade" TEXT NOT NULL DEFAULT 'MEDIA',
    "valorEstimado" REAL,
    "previsaoFechamento" DATETIME,
    "proximaAcao" TEXT,
    "dataProximaAcao" DATETIME,
    "codigoOrcamento" TEXT,
    "motivoPerda" TEXT,
    "dadosPersonalizados" JSONB NOT NULL DEFAULT '{}',
    "fechadaEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "oportunidades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "oportunidades_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "oportunidades_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "oportunidades_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "oportunidades_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "etapas_funil" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "historicos_etapa_oportunidade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "etapaNome" TEXT NOT NULL,
    "etapaAnteriorId" TEXT,
    "etapaAnteriorNome" TEXT,
    "origem" TEXT NOT NULL,
    "usuarioId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historicos_etapa_oportunidade_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "historicos_etapa_oportunidade_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "eventos_oportunidade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'SISTEMA',
    "dados" JSONB NOT NULL DEFAULT '{}',
    "usuarioId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventos_oportunidade_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "eventos_oportunidade_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atividades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT,
    "contatoId" TEXT,
    "obraId" TEXT,
    "responsavelId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "vencimento" DATETIME NOT NULL,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "concluidaEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "atividades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atividades_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atividades_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atividades_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conexoes_whatsapp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "nomeInstancia" TEXT NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'MOCK',
    "status" TEXT NOT NULL DEFAULT 'DESCONECTADO',
    "numero" TEXT,
    "qrCode" TEXT,
    "ultimoErro" TEXT,
    "conectadoEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "conexoes_whatsapp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "conexaoId" TEXT,
    "contatoId" TEXT,
    "telefone" TEXT NOT NULL,
    "telefoneNormalizado" TEXT NOT NULL,
    "nomeContato" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BOT_ATENDENDO',
    "modo" TEXT NOT NULL DEFAULT 'BOT',
    "estadoBot" JSONB,
    "intencaoAtual" TEXT,
    "atendenteId" TEXT,
    "oportunidadeId" TEXT,
    "naoLidas" INTEGER NOT NULL DEFAULT 0,
    "ultimaMensagemEm" DATETIME,
    "ultimaMensagemPreview" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "conversas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversas_conexaoId_fkey" FOREIGN KEY ("conexaoId") REFERENCES "conexoes_whatsapp" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversas_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "idExterno" TEXT,
    "direcao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'TEXTO',
    "conteudo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENVIADA',
    "remetente" TEXT,
    "autorUsuarioId" TEXT,
    "arquivoId" TEXT,
    "metadados" JSONB,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mensagens_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "arquivos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campos_personalizados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "opcoes" JSONB NOT NULL DEFAULT '[]',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "usarNoChatbot" BOOLEAN NOT NULL DEFAULT false,
    "textoPergunta" TEXT,
    "mostrarNoResumo" BOOLEAN NOT NULL DEFAULT true,
    "permitirFiltro" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "campos_personalizados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
