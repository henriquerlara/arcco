# ARCCO — Banco de dados

Modelo de dados do MVP, implementado em `apps/api/prisma/schema.prisma` (Prisma + PostgreSQL). São **14 tabelas**, todas multiempresa (isoladas por `empresaId`).

Convenções:

- Modelos Prisma em **PascalCase** (português); tabelas em **snake_case** via `@@map`.
- Chaves primárias `id: String @id @default(uuid())`.
- `criadoEm`/`atualizadoEm` com `@default(now())` e `@updatedAt`.
- Colunas flexíveis em **JSONB** (`Json`).
- `onDelete: Cascade` a partir de `Empresa` (apagar empresa remove seus dados).

---

## As 14 tabelas

| # | Modelo | Tabela | Descrição |
| --- | --- | --- | --- |
| 1 | `Empresa` | `empresas` | Tenant raiz. Guarda dados e `configuracoes` (JSONB). |
| 2 | `Usuario` | `usuarios` | Usuários da empresa, com perfil e sessão. |
| 3 | `Contato` | `contatos` | Pessoas/empresas (clientes, arquitetos, etc.). |
| 4 | `Obra` | `obras` | Obras/projetos associados aos contatos. |
| 5 | `ContatoObra` | `contatos_obras` | Vínculo N:N entre contatos e obras (com papel). |
| 6 | `Categoria` | `categorias` | Categorias de oportunidade (por segmento). |
| 7 | `EtapaFunil` | `etapas_funil` | Etapas do funil de vendas (ABERTA/GANHA/PERDIDA). |
| 8 | `Oportunidade` | `oportunidades` | Negociações no funil. |
| 9 | `Atividade` | `atividades` | Tarefas/follow-ups vinculados. |
| 10 | `ConexaoWhatsApp` | `conexoes_whatsapp` | Instâncias de WhatsApp (mock/Evolution). |
| 11 | `Conversa` | `conversas` | Conversas de WhatsApp (com estado do bot). |
| 12 | `Mensagem` | `mensagens` | Mensagens de cada conversa. |
| 13 | `Arquivo` | `arquivos` | Metadados de arquivos (local/R2). |
| 14 | `CampoPersonalizado` | `campos_personalizados` | Definição de campos customizados por entidade. |

---

## Relacionamentos

```
Empresa (1) ──< Usuario
        (1) ──< Contato ──< Oportunidade
        (1) ──< Obra    ──< Oportunidade (opcional)
        (1) ──< Categoria ──< Oportunidade (opcional)
        (1) ──< EtapaFunil ──< Oportunidade
        (1) ──< Atividade (>─ Oportunidade / Contato / Obra, todos opcionais)
        (1) ──< ConexaoWhatsApp ──< Conversa ──< Mensagem
        (1) ──< Arquivo
        (1) ──< CampoPersonalizado

Contato (N) ──< ContatoObra >── (N) Obra      # N:N com papel
Conversa (N) ─── (0..1) Contato               # conversa pode existir sem contato
```

Detalhes importantes:

- **`ContatoObra`** materializa o N:N entre `Contato` e `Obra`, guardando o `papel` (ex.: "Responsavel tecnico"). Unicidade: `@@unique([empresaId, contatoId, obraId, papel])`.
- **`Oportunidade`** exige `contatoId` e `etapaId`; `obraId`, `categoriaId` e `responsavelId` são opcionais.
- **`Atividade`** pode se ligar a uma oportunidade, contato e/ou obra (todos opcionais), mas sempre tem `responsavelId` e `empresaId`.
- **`Conversa`** referencia `ConexaoWhatsApp` (opcional) e `Contato` (opcional); mensagens pertencem à conversa.

---

## Campos JSONB

O modelo usa JSONB para flexibilidade sem alterar o schema:

| Tabela | Campo | Uso |
| --- | --- | --- |
| `empresas` | `configuracoes` | Horário de atendimento, config do chatbot e `onboardingConcluido`. Estrutura validada por `configuracoesEmpresaSchema` (`@arcco/contratos`). |
| `contatos` | `dadosPersonalizados` | Valores dos campos personalizados da entidade CONTATO. |
| `obras` | `dadosPersonalizados` | Valores dos campos personalizados da entidade OBRA. |
| `oportunidades` | `dadosPersonalizados` | Valores dos campos personalizados da entidade OPORTUNIDADE. |
| `conversas` | `estadoBot` | Estado da máquina de estados do chatbot (`fluxo`, `etapa`, `dadosColetados`, `ultimaPergunta`, `tentativas`). |
| `mensagens` | `metadados` | Metadados livres (ex.: `{ erro: "..." }` em falha de envio). |

Exemplo de `empresas.configuracoes`:

```json
{
  "horarioAtendimento": {
    "segunda": [{ "inicio": "08:00", "fim": "18:00" }],
    "sabado": [],
    "domingo": []
  },
  "chatbot": {
    "ativo": true,
    "nome": "Assistente ARCCO",
    "mensagemInicial": "Olá! Aqui é a ARCCO Demo Iluminação. Como posso ajudar hoje?",
    "mensagemForaHorario": "Nosso atendimento humano está fechado neste momento...",
    "mensagemTransferencia": "Vou transferir você para um de nossos atendentes...",
    "mensagemFinal": "Obrigado! Sua solicitação foi registrada..."
  },
  "onboardingConcluido": true
}
```

Exemplo de `conversas.estadoBot`:

```json
{ "fluxo": "NOVO_ORCAMENTO", "etapa": "1", "dadosColetados": { "_nome": "Marina" }, "ultimaPergunta": "_necessidade", "tentativas": 0 }
```

Exemplo de `oportunidades.dadosPersonalizados` (segmento concreto):

```json
{ "volume_m3": "120", "fck": "30", "precisa_bomba": true, "prazo_desejado": "15 dias" }
```

---

## Índices e unicidade

Todos os índices são compostos com `empresaId` para reforçar o isolamento multiempresa e acelerar consultas por tenant.

| Tabela | Índices / Uniques |
| --- | --- |
| `usuarios` | `email @unique`; `@@index([empresaId])` |
| `contatos` | `@@unique([empresaId, telefoneNormalizado])`; `@@index([empresaId])`, `@@index([empresaId, nome])`, `@@index([responsavelId])` |
| `obras` | `@@index([empresaId])`, `@@index([empresaId, status])` |
| `contatos_obras` | `@@unique([empresaId, contatoId, obraId, papel])`; `@@index([empresaId])`, `@@index([contatoId])`, `@@index([obraId])` |
| `categorias` | `@@index([empresaId])` |
| `etapas_funil` | `@@index([empresaId])`, `@@index([empresaId, ordem])` |
| `oportunidades` | `@@unique([empresaId, codigo])`; `@@index([empresaId])`, `@@index([empresaId, etapaId])`, `@@index([empresaId, responsavelId])`, `@@index([contatoId])` |
| `atividades` | `@@index([empresaId])`, `@@index([empresaId, responsavelId])`, `@@index([empresaId, concluida, vencimento])`, `@@index([oportunidadeId])` |
| `conexoes_whatsapp` | `nomeInstancia @unique`; `@@index([empresaId])` |
| `conversas` | `@@index([empresaId])`, `@@index([empresaId, status])`, `@@index([empresaId, telefoneNormalizado])`, `@@index([empresaId, atualizadoEm])` |
| `mensagens` | `@@unique([conversaId, idExterno])` (idempotência); `@@index([empresaId])`, `@@index([conversaId, criadoEm])` |
| `arquivos` | `@@index([empresaId])`, `@@index([empresaId, entidade, entidadeId])` |
| `campos_personalizados` | `@@unique([empresaId, entidade, chave])`; `@@index([empresaId, entidade])` |

> A unicidade `@@unique([conversaId, idExterno])` em `mensagens` garante **idempotência**: mensagens reentregues pelo webhook com o mesmo `idExterno` não são duplicadas.

---

## Enums principais

Definidos no schema (e espelhados em `@arcco/contratos`):

- `PerfilUsuario`: `PROPRIETARIO`, `GESTOR`, `VENDEDOR`, `ATENDENTE`
- `SegmentoEmpresa`: `ILUMINACAO`, `PISOS_REVESTIMENTOS`, `ESQUADRIAS`, `CONCRETO`, `MATERIAIS_CONSTRUCAO`, `SERVICOS_OBRAS`, `OUTRO`
- `TipoContato`: `PROPRIETARIO_OBRA`, `ARQUITETO`, `ENGENHEIRO`, `CONSTRUTORA`, `INSTALADOR`, `COMPRADOR`, `EMPRESA`, `OUTRO`
- `StatusObra`: `PLANEJAMENTO`, `EM_ANDAMENTO`, `PAUSADA`, `CONCLUIDA`, `CANCELADA`
- `TipoEtapaFunil`: `ABERTA`, `GANHA`, `PERDIDA`
- `PrioridadeOportunidade`: `BAIXA`, `MEDIA`, `ALTA`, `URGENTE`
- `TipoAtividade`: `LIGACAO`, `MENSAGEM`, `REUNIAO`, `ENVIAR_ORCAMENTO`, `REVISAR_ORCAMENTO`, `FOLLOW_UP`, `TAREFA`
- `ProvedorWhatsApp`: `EVOLUTION`, `MOCK`
- `StatusConexaoWhatsApp`: `DESCONECTADO`, `CONECTANDO`, `QR_CODE`, `CONECTADO`, `ERRO`
- `StatusConversa`: `BOT_ATENDENDO`, `AGUARDANDO_HUMANO`, `EM_ATENDIMENTO`, `AGUARDANDO_CLIENTE`, `FINALIZADA`
- `ModoAtendimento`: `BOT`, `HUMANO`, `PAUSADO`
- `DirecaoMensagem`: `RECEBIDA`, `ENVIADA`
- `TipoMensagem`: `TEXTO`, `IMAGEM`, `AUDIO`, `DOCUMENTO`, `LOCALIZACAO`, `SISTEMA`
- `StatusMensagem`: `RECEBIDA`, `PROCESSANDO`, `ENVIADA`, `ENTREGUE`, `LIDA`, `ERRO`
- `EntidadeCampoPersonalizado`: `CONTATO`, `OBRA`, `OPORTUNIDADE`
- `TipoCampoPersonalizado`: `TEXTO`, `TEXTO_LONGO`, `NUMERO`, `MOEDA`, `DATA`, `BOOLEANO`, `SELECAO`, `MULTISSELECAO`

---

## Exemplos de consulta (Prisma)

Sempre filtrando por `empresaId` (multi-tenant):

```ts
// Oportunidades abertas de uma empresa, por etapa
const oportunidades = await prisma.oportunidade.findMany({
  where: { empresaId, etapa: { tipo: 'ABERTA' } },
  include: { contato: true, etapa: true, categoria: true },
  orderBy: { criadoEm: 'desc' },
});

// Conversa por telefone normalizado (usa índice composto)
const conversa = await prisma.conversa.findFirst({
  where: { empresaId, telefoneNormalizado: '5511988881111' },
});

// Registrar mensagem de forma idempotente
await prisma.mensagem.upsert({
  where: { conversaId_idExterno: { conversaId, idExterno } },
  update: {},
  create: { empresaId, conversaId, idExterno, direcao: 'RECEBIDA', conteudo, status: 'RECEBIDA' },
});

// Atividades vencidas e não concluídas (usa índice [empresaId, concluida, vencimento])
const atrasadas = await prisma.atividade.findMany({
  where: { empresaId, concluida: false, vencimento: { lt: new Date() } },
  orderBy: { vencimento: 'asc' },
});
```

---

## Migrations e seed

- Gerar client: `pnpm db:generate`
- Aplicar migrations (dev): `pnpm db:migrate`
- Sincronizar sem migration: `pnpm db:push`
- Popular demonstração: `pnpm db:seed`

O seed cria 2 empresas (Iluminação e Concreto), usuários (proprietário/vendedor/atendente), funil, categorias e campos por segmento, contatos, obras, oportunidades, atividades e uma conversa mock com mensagens. Detalhes em `apps/api/prisma/seed.ts` e no [README](../README.md#contas-demonstrativas).
