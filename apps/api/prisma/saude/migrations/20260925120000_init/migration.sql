CREATE TYPE "StatusConsulta" AS ENUM ('AGENDADA', 'CONFIRMADA', 'REALIZADA', 'CANCELADA');

CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT,
    "nascimento" DATE,
    "convenio" TEXT,
    "numeroCarteira" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profissionais" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "especialidade" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grades_semanais" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "aberto" BOOLEAN NOT NULL DEFAULT true,
    "horaInicio" TEXT NOT NULL DEFAULT '08:00',
    "horaFim" TEXT NOT NULL DEFAULT '18:00',
    CONSTRAINT "grades_semanais_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consultas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "hora" TEXT NOT NULL,
    "especialidade" TEXT NOT NULL,
    "convenio" TEXT,
    "numeroCarteira" TEXT,
    "observacoes" TEXT,
    "status" "StatusConsulta" NOT NULL DEFAULT 'AGENDADA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "consultas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "medicamentos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "apresentacao" TEXT,
    "estoque" INTEGER NOT NULL DEFAULT 0,
    "estoqueMinimo" INTEGER NOT NULL DEFAULT 5,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "medicamentos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "configuracoes_clinica" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "duracaoSlotMinutos" INTEGER NOT NULL DEFAULT 30,
    "horizonteDias" INTEGER NOT NULL DEFAULT 30,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configuracoes_clinica_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pacientes_empresaId_idx" ON "pacientes"("empresaId");
CREATE INDEX "profissionais_empresaId_idx" ON "profissionais"("empresaId");
CREATE UNIQUE INDEX "grades_semanais_profissionalId_diaSemana_key" ON "grades_semanais"("profissionalId", "diaSemana");
CREATE INDEX "grades_semanais_empresaId_idx" ON "grades_semanais"("empresaId");
CREATE UNIQUE INDEX "consultas_profissionalId_data_hora_key" ON "consultas"("profissionalId", "data", "hora");
CREATE INDEX "consultas_empresaId_data_idx" ON "consultas"("empresaId", "data");
CREATE INDEX "medicamentos_empresaId_idx" ON "medicamentos"("empresaId");
CREATE UNIQUE INDEX "configuracoes_clinica_empresaId_key" ON "configuracoes_clinica"("empresaId");

ALTER TABLE "grades_semanais" ADD CONSTRAINT "grades_semanais_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
