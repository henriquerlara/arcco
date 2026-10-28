# Checklist de implementação Ecolume

Estados: **pendente**, **em andamento**, **implementada**, **testada**, **validada**.

Implementada significa código na branch, sem ser o estado final. Testada significa os testes da tarefa verdes, inclusive regressão de empresa sem a flag. Validada significa o critério de aceite conferido no roteiro ou na revisão, com pendência externa respeitada.

A ECOL-01, a ECOL-26a, a ECOL-27a e a ECOL-05 estão validadas. ECOL-02…27b e ECOL-28a estão testadas (ver histórico abaixo). A ECOL-28 permanece **validada parcialmente** por homologação fiscal real (`ECOL28_VALIDACAO.md`). A ECOL-28b está **implementada e testada com mock** — **HOMOLOGAÇÃO FISCAL PENDENTE** (sem token Focus + P3 + Sefaz).

Tarefa pai fica pendente até todas as filhas estarem validadas. O trabalho executável é o da filha quando ela existe.

| ID | Tarefa | Estado | Depende de | PDF |
|---|---|---|---|---|
| ECOL-01 | Flag por empresa e menu, sem apagar função dos outros clientes | validada | — | 6 |
| ECOL-02 | Parâmetros gerais, sem segredo e sem regra fiscal inventada | testada | ECOL-01 | 16.4 |
| ECOL-03 | Cadastro de fornecedor e ST% | testada | ECOL-01, ECOL-26a | 7.2 |
| ECOL-04 | Produto no padrão da spec (épico) | pendente | ECOL-04a, ECOL-04b | 5.2, 7.3 |
| ECOL-04a | Migração aditiva de produto e movimentação, sem mudar saldo | testada | ECOL-01 | 7.3, 7.7 |
| ECOL-04b | Relatório de reconciliação de estoque, somente leitura | testada | ECOL-04a | 7.3, 7.9 |
| ECOL-05 | Último preço e custo médio | validada | ECOL-04a, ECOL-26a, ECOL-27a | 7.7 |
| ECOL-06 | Ajuste com motivo, auditoria e estoque inicial explícito | testada | ECOL-04b, ECOL-05, ECOL-27a | 7.6, 7.9 |
| ECOL-07 | Importação de XML de NF-e de compra | testada | ECOL-03, ECOL-05, ECOL-06, ECOL-26a | 7.4 |
| ECOL-08 | Tela de estoque, sub-abas e lista de compra | testada | ECOL-06, ECOL-07, ECOL-26a | 7.1, 7.10, 7.11 |
| ECOL-09 | Clientes (épico) | testada | ECOL-09a, ECOL-09b | 8 |
| ECOL-09a | Cadastro único PF/PJ, lista e rótulos Clientes | testada | ECOL-01, ECOL-26a | 6.5, 8.1–8.3 |
| ECOL-09b | Ficha com totais, histórico e arquivos | testada | ECOL-09a, ECOL-11, ECOL-16 | 6.3, 8.4 |
| ECOL-10 | Parceiros (épico) | testada | ECOL-10a, ECOL-10b | 9 |
| ECOL-10a | Flag de parceiro, RT padrão e dados de pagamento | testada | ECOL-09a, ECOL-02 | 9.1 |
| ECOL-10b | Extrato, totais e marcação de comissão paga | testada | ECOL-10a, ECOL-17, ECOL-26a | 9.3, 9.4 |
| ECOL-11 | Negócio NEG, origem, parceiro, RT, endereço e anexos | testada | ECOL-09a, ECOL-10a, ECOL-27a | 5.2, 6.3, 10.1, 10.2 |
| ECOL-12 | Número ORC único por empresa, status, trava e duplicação | testada | ECOL-11 | 10.5, 10.6 |
| ECOL-13 | Editor de preço, fórmula e descrição comercial da linha | testada | ECOL-05, ECOL-12, ECOL-26a, ECOL-27a | 7.5, 10.3, 10.4 |
| ECOL-14 | PDF sem dado interno e marcação de enviado sem WhatsApp | testada | ECOL-13 | 10.5 |
| ECOL-15 | Item rápido no cadastro e item avulso | testada | ECOL-13 | 7.5, 10.3 |
| ECOL-16 | Pedido PED a partir de um orçamento, vários por negócio | testada (estrutura) | ECOL-12 | 5.1, 11.1, 11.2 |
| ECOL-17 | Conversão, baixa, pagamentos, comissão e checklist | testada | ECOL-10a, ECOL-15, ECOL-16, ECOL-06, ECOL-26a, ECOL-27a | 9.3, 11.1, 11.3, 11.4 |
| ECOL-18 | Cancelamento de pedido com estorno | testada | ECOL-17, ECOL-27a | 7.8, 11.5 |
| ECOL-19 | Funil pré e pós-venda, motivos de perda e busca | testada | ECOL-16, ECOL-17, ECOL-02 | 10.7, 12 |
| ECOL-20 | Tipos de agenda e entregas | testada | ECOL-17, ECOL-11 | 13.1, 13.2 |
| ECOL-21 | Follow-up de orçamento enviado e sininho interno | testada | ECOL-12, ECOL-02, ECOL-20 | 13.3, 13.5 |
| ECOL-22 | Calendário semanal e mensal | testada | ECOL-20 | 13.4 |
| ECOL-23 | Visão geral da Ecolume | testada | ECOL-17, ECOL-19, ECOL-21, ECOL-08, ECOL-26a | 15 |
| ECOL-24 | NF-e a partir do pedido | testada (mock; homologação P3) | ECOL-16, ECOL-02, ECOL-26a, P3 para produção | 14.1, 14.2 |
| ECOL-25 | Tela Fiscal | testada | ECOL-07, ECOL-24, ECOL-26a | 14.3 |
| ECOL-26 | Permissões (épico) | testada | ECOL-26a, ECOL-26b | 6.1, 16.1, 16.2 |
| ECOL-26a | Modelo, catálogo e bloqueio de custo e financeiro na API | validada | ECOL-01 | 15.7, 16.1, 16.2 |
| ECOL-26b | Atribuição por usuário, perfis salvos e demais ações da 16.2 | testada | ECOL-26a e a tela de cada ação | 16.1, 16.2 |
| ECOL-27 | Auditoria (épico) | testada | ECOL-27a, ECOL-27b | 16.3 |
| ECOL-27a | Registro de auditoria com empresa, ator, data e fato | validada | ECOL-01 | 16.3 |
| ECOL-27b | Consulta administrativa com filtros e cobertura da lista 16.3 | testada | ECOL-27a, ECOL-06, ECOL-07, ECOL-13, ECOL-17, ECOL-18, ECOL-24, ECOL-10b, ECOL-26b | 16.3 |
| ECOL-28 | Roteiro da seção 17 e critérios da seção 20 | validada parcialmente | todas as anteriores do caminho crítico, exceto sugestões P6 | 17, 20 |
| ECOL-28a | Lacunas obrigatórias 09b/10b/exclusão ORC/PENDENTE XML | testada | ECOL-28, ECOL-09b, ECOL-10b | 8.4, 9.4, 14.3, 16.2 |
| ECOL-28b | CC-e, e-mail DANFE/XML, fechamento fiscal (mock; homologação pendente) | implementada e testada com mock — homologação pendente | ECOL-24, ECOL-25, ECOL-26b, P3 + token para real | 14.2 (item 7) |
| ECOL-HOMOLOG | Homologação Focus/Sefaz + aceite final | **bloqueada** (token/P3/A1/aceite A1 ausentes) | ECOL-28b + credenciais reais | 14, 16.4, 20 |

## Fora do caminho crítico (P6)

Não avançar estes itens sem decisão registrada em `PENDENCIAS.md`.

| ID | Tarefa | Estado |
|---|---|---|
| P6-PLANILHA | Importação CSV/Excel de estoque inicial | pendente |
| P6-MARGEM | Margem global 1,6 quando o produto não tem margem | estrutura ECOL-02 (opcional; sugestão 1,6) |
| P6-PDF-TEXTOS | Validade, prazo, condições e observações livres no PDF | validade dias opcional ECOL-02 (sugestão 15); textos livres pendentes |
| P6-AMBIENTE | Agrupamento de itens por ambiente | pendente |
| P6-DFE | Consulta automática de NF-e contra o CNPJ | pendente |

## Regressão contínua

Em toda tarefa que tocar código compartilhado, antes de marcar **testada**:

- suíte unitária já existente da API e de `packages/contratos`;
- `apps/web/e2e/fluxo-essencial.spec.ts` com empresa sem a flag;
- teste novo de isolamento da entidade criada ou alterada;
- empresa sem flag não recebe campo de custo, pedido nem menu novo na resposta usada pela UI atual.

### ECOL-02

Testada em 28/10/2026. Sem inventar desconto máximo padrão; P1 permanece TOTAL_PEDIDO; P3 estrutura vazia (emissão real bloqueada); P6 margem/validade opcionais com sugestão na API.

- Persistência em `Empresa.configuracoes` (JSON); `GET/PATCH /empresa/parametros-comerciais` só ECOLUME + PROPRIETARIO/GESTOR; auditoria `ALTERACAO_PARAMETRO_COMERCIAL` sem segredos.
- UI `ConfigParametrosView` + nav Parâmetros. Consumidores: RT novos parceiros, motivos kanban, follow-up/dashboard prazos, desconto ECOL-13/15, validade/margem novos ORC, base comissão TOTAL_PEDIDO.
- Contratos unitários + `empresas.parametros` + fórmula/desconto; API completa 277+ PASS (timeouts flaky ECOL-20/27a reexecutados PASS); `tsc`/`vue-tsc`/web build OK. Playwright config/desconto: SKIP (sem spec E2E dedicado neste ambiente).

### ECOL-01

Validada em 15/10/2026, sem a ECOL-26a.

- API: `pnpm exec vitest run` em `apps/api` — 10 arquivos, 67 testes, todos passaram. As duas falhas de `multi-tenant.spec.ts` vinham do mock anterior à ECOL-01: `obter` lia `contatosObras` e `listar` lia `_count`, e o Prisma falso não devolvia esses campos. O serviço de contatos não foi alterado nesta tarefa. O mock passou a devolver as relações vazias. As asserções de isolamento entre empresas permaneceram.
- Playwright: o `webServer` esperava `http://localhost:5173`. O Vite deste ambiente sobe em 5174, a mesma porta de `FRONTEND_URL`. O processo ficava no ar na porta errada e o teste estourava os 120s. A configuração passou a usar 5174. O timeout não foi aumentado.
- E2E executado com login real (`Arcco@123`), Vite em 5174 e API em 3001. Empresa sem flag: menu e rotas atuais. Empresa com `ECOLUME`: Visão geral, Negócios, Agenda, Clientes, Estoque e Configurações; sem Conversas, Pessoas, Projetos, Produtos, Parceiros e Fiscal. URLs ocultas voltam para `/app/dashboard`. `/app/contatos` vai para `/app/clientes`. Duas sessões simultâneas não misturam o menu. Contato criado e configurações da empresa abertos na conta sem flag.
- O teste "pipeline começa vazio sem dados de seed" falhou de propósito mantido: a demo de iluminação tem um negócio semeado e a tela mostra 1 card. A asserção não foi afrouxada. Por ser serial, essa falha pula os dois testes seguintes na mesma rodada; eles passaram numa execução filtrada (criar contato e abrir dados da empresa).
- Depois dos testes, a empresa de concreto estava de novo em `PADRAO`. Iluminação e Clínica Aurora continuam sem a chave. A API de conversas e o webhook `POST /api/webhooks/meta/whatsapp` seguem registrados. Isso está registrado em `PENDENCIAS.md` e não foi desligado.

### ECOL-26b

Testada em 28/10/2026. Mecanismo P4 (sem atribuições inventadas). Admin = `PROPRIETARIO` (acesso total). GESTOR não herda catálogo. Conjuntos = templates sem sync silencioso.

- Catálogo ampliado (abas, `ALTERAR_PRECO`, escopos agenda, `VER_NEGOCIOS_TODOS`, exclusões). `ConjuntoPermissao` + `PUT /permissoes/usuarios/:id`, CRUD conjuntos.
- Escopos na API: atividades/calendário/sininho/dashboard; negócios listar/kanban/detalhe. Exclusões cliente/produto. UI Equipe com editor agrupado.
- Contratos + `permissoes.26b` PASS; API 283 PASS / 9 SKIP (`permissoes.http`); `tsc` / `vue-tsc` / `nest build` / web build OK. Playwright: SKIP (sem E2E dedicado de matriz).

### ECOL-26a

Validada em 15/10/2026 com HTTP autenticado em `http://127.0.0.1:3001`. Sem a ECOL-26b e sem tela nova. Empresas e usuários do roteiro foram criados e apagados no teste. Contas de demonstração não foram alteradas.

- Catálogo em `packages/contratos/src/permissoes-comerciais.ts`. Concessão por usuário e empresa em `concessoes_permissao`, com `conjuntoId` reservado. Sem rota para o cliente gravar a própria permissão.
- Com a flag, só `PROPRIETARIO` recebe o catálogo. Os outros perfis só recebem chave gravada. Lista vazia não libera custo, faturamento, ticket, pagamento nem comissão. Sem a flag, produto, orçamento, negócio, métrica, PDF e nota seguem com o formato anterior.
- Produto, estoque, orçamento, negócio, dashboard, PDF e nota chamam `PermissoesService.filtrar`. O `PermissaoFinanceiraInterceptor` repete a publicação em toda resposta JSON autenticada e recusa corpo ou consulta com campo restrito antes do controller. Preço de venda, totais e quantidade permanecem. Objeto binário, `Date` e protótipo que não é objeto simples não são reescritos.
- HTTP (`ECOL_HTTP=1`, `permissoes.http.spec.ts`, 9 testes): proprietário vê `valorPipeline` 1500, ticket e `funil.valor`; gestor, vendedor e atendente sem concessão ficam com a contagem e sem esses campos, e o corpo não contém `1500`; concessão só de `VER_CUSTOS` não devolve o faturamento; empresa sem flag continua com `valorPipeline`, ticket e valor ganho; `POST` com `custoMedio` na empresa com flag responde 403 `SEM_PERMISSAO` sem o valor nem `stack`; o mesmo `POST` sem a flag responde 201 com `precoVenda` e sem gravar `custoMedio`; `orderBy=custoMedio` e `margem=10` são 403 só com a flag; produto de outra empresa é 404 e o corpo não traz o nome; orçamento aninhado no negócio conserva `precoUnitario` 40. A sessão devolve `permissoesComerciais` calculada no servidor (`null` sem a flag).
- Suíte da API sem o HTTP: 11 arquivos, 76 testes passaram, 9 do spec HTTP ficaram pulados. Contratos: 9 testes. `tsc --noEmit` da API e `vue-tsc --noEmit` do web passaram. Contratos e `tsc -p tsconfig.build.json` da API foram compilados antes do HTTP. Migração `20261015170000_concessao_permissao` já estava aplicada em `platform_db`.
- Playwright na mesma data, Vite 5174 e API 3001: `personalizacao-menu.spec.ts` 4 passou. `fluxo-essencial.spec.ts` passou em 8 testes quando o funil vazio foi excluído do filtro. Na suíte completa, "pipeline começa vazio sem dados de seed" continua vermelho (1 card do seed). A asserção não foi alterada.
- As chaves de ajustar estoque, XML, NF e pedido estão no catálogo e ainda não fecham as rotas atuais. O risco que sobra está em `PENDENCIAS.md`.

### ECOL-27a

Validada em 15/10/2026. Consulta administrativa entregue na ECOL-27b.

- Serviço `AuditoriaService`. Tabela `logs_auditoria` no banco operacional, migração `20261015190000_logs_auditoria`. Cada linha tem `empresaId`, `usuarioId`, `criadoEm`, `tipo`, `entidade`, `entidadeId`, `anterior` e `posterior`.
- Só grava quando `personalizacaoComercial` é `ECOLUME`. Sem a flag, entrada de estoque altera o saldo e não cria linha.
- O log de preço, entrada, ajuste, saída e status da nota entra na mesma transação do banco operacional. O log de permissão entra na mesma transação da concessão, no banco da plataforma (`logs_auditoria` em `platform_db`, migração `20261015200000_logs_auditoria_plataforma`). Não há compensação entre os dois bancos. Repetir a mesma chave não gera outra linha.
- Integrado: alteração de `precoVenda`, entrada (inclusive saldo inicial), ajuste, baixa de estoque do orçamento, emissão e cancelamento quando a nota fica autorizada ou cancelada, e `conceder` permissão.
- Senha, token e certificado são removidos do payload. Não há alteração ou exclusão pela aplicação.
- Integração `ECOL_AUDIT=1`: 13 testes passaram na 27a.

### ECOL-27b

Testada em 28/10/2026. Completa a cobertura da §16.3 e a consulta administrativa.

- Lacunas fechadas: pagamento de comissão (`ALTERACAO_COMISSAO` em `marcarComissaoPaga`, idempotente) e alteração de ST% (`ALTERACAO_ST_FORNECEDOR` na mesma TX do fornecedor).
- Preço/margem em ORC enviado ou convertido: **NÃO APLICÁVEL** — edição só em rascunho; não se liberou edição só para auditar.
- Consulta: `GET /auditoria` e `GET /auditoria/:id` (só `PROPRIETARIO` + ECOLUME). Mescla operacional + plataforma sem TX distribuída; filtros usuário/tipo/período; paginação estável; detalhe redige segredos.
- UI: `ConfigAuditoriaView` em Configurações → Auditoria.
- Fora do escopo (documentado): exclusão de ORC rascunho sem endpoint; CC-e não implementada.
- Testes: `auditoria.consulta.spec.ts`, `auditoria.27b.integracao.spec.ts` (`ECOL_AUDIT=1`), comissão em `pedidos.conversao.integracao.spec.ts`. Playwright `auditoria-consulta.spec.ts`: admin + `vendedor.concreto` (restrito) — 2 PASS em 28/10/2026.

### ECOL-28

Validada parcialmente em 28/10/2026. Relatório completo: `docs/ecolume/ECOL28_VALIDACAO.md`.

- Roteiro §17 (`ecolume.roteiro17.integracao.spec.ts`, `ECOL_ROTEIRO=1`): **PASS** (12 passos + dashboard 1.642,56 / comissão Ana 164,26). NF-e do passo 9 = mock.
- Critérios §20: maioria CONFORME; lacunas de produto fechadas na ECOL-28a. **BLOQUEADO** homologação Focus/Sefaz (P3).
- Playwright (`workers=1`): agenda, auditoria, fiscal, personalização-menu — **11 PASS**.
- Veredito: `ECOL-28 VALIDADA PARCIALMENTE` + `HOMOLOGAÇÃO FISCAL PENDENTE`. ECOL-28a TESTADA; ECOL-28b = fiscal real.

### ECOL-28b

Implementada e testada com **mock Focus** em 28/10/2026. `FOCUS_NFE_TOKEN` ausente; P3 vazia; homologação Sefaz **não** executada. Veredito: **`ECOL-28b IMPLEMENTADA E TESTADA COM MOCK — HOMOLOGAÇÃO PENDENTE`**.

### ECOL-HOMOLOG

Tentativa em 28/10/2026. **Veredito: `HOMOLOGAÇÃO FISCAL BLOQUEADA`**. Nenhuma nota transmitida. Token ausente; P3 EMPTY em Aurora/Iluminação/Concreto; `FOCUS_NFE_ENV` unset; aceite formal A1-Focus não registrado. Regressão mock fiscal: 32 PASS. Detalhe: `ECOL28_VALIDACAO.md` §11. **Implantação fiscal real: bloquear.**

- Contratos: `ParametrosFiscaisNfe` ganha `tratamentoSt` e `informacoesComplementaresNfe` (não entram em `parametrosFiscaisCompletos`); auditoria `CARTA_CORRECAO_NF` e `ENVIO_EMAIL_NF`; schemas `cartaCorrecaoNfSchema` (15–1000) e `enviarEmailNfSchema` (1–10 e-mails).
- Focus client: `cartaCorrecao` (`POST /v2/nfe/{ref}/carta_correcao`) e `enviarEmail` (`POST /v2/nfe/{ref}/email`); sem token → mock com `mock: true`.
- Migração `20261028200000_evento_nota_fiscal` (`eventos_nota_fiscal`: CCE/EMAIL).
- `NfePedidoService`: `cartaCorrecao` (ECOLUME + `CARTA_CORRECAO`, NF AUTORIZADA, advisory lock, limite 20, evento + auditoria), `enviarEmailDanfe` (`EMITIR_NF`, evento AGENDADO), `statusHomologacao`; payload com `informacoes_adicionais_contribuinte` só do texto do contador; `_envioEmailPendente` removido (`_envioEmailViaFocus`); cancelar devolve `cartaCorrecaoSuportada: true`.
- Rotas: `POST notas-fiscais/:id/carta-correcao`, `POST notas-fiscais/:id/enviar-email`, `GET fiscal/status-homologacao`.
- UI: `AcoesNfeEventos` (CC-e + e-mail) no detalhe da `FiscalView` e no `PainelPedidos`; `ConfigFiscalView` mostra A1 gerenciado pela Focus, ambiente e P3.
- E-mail DANFE/XML: requisito **§14.2 item 7** (não §19).
- Testes: `nfe-pedido.cce-email.integracao.spec.ts` 11 PASS; helpers 5; suíte API 319 PASS / 9 SKIP; contratos 29; `tsc`/`vue-tsc`/nest build OK; Playwright `fiscal-abas` 2 PASS.

### ECOL-28a

Testada em 28/10/2026. Fecha 09b, 10b, exclusão ORC rascunho e PENDENTE de nota de entrada.

- Ficha cliente: `ContatosService.obter` → `fichaCliente` (resumo sem CANCELADO, histórico, anexos); UI em `ContatoDetalheView`.
- Parceiros: métricas na lista; extrato por snapshot; `GET /contatos/comissoes`; painel “Comissões a pagar”.
- ORC: `DELETE` só RASCUNHO + `EXCLUIR_ORCAMENTO_RASCUNHO` + auditoria `EXCLUSAO_ORCAMENTO`; UI no `PainelOrcamento`.
- XML: `POST /notas-entrada/pendente`, `GET .../conferencia`, confirmar com `notaEntradaId`; migração `20261028180000_nota_entrada_pendente`.
- Testes: `contatos.ficha` 6, `orcamentos.exclusao` 5, `notas-entrada` (pendente+regressão) 12; suíte API 306 PASS / 9 SKIP; contratos 29; `tsc`/`vue-tsc`/web build OK; Playwright menu+fiscal 7 PASS.
- Veredito: **`ECOL-28a TESTADA`**. Fora: P3/CC-e/ECOL-28b.

### ECOL-03

Testada em 20/10/2026. Sem a ECOL-07 e sem a ECOL-08. Sem recálculo de preço, custo ou orçamento.

- Migração `20261020210000_fornecedor_ecolume`: tabela `fornecedores` (`empresaId`, nome, nomeCurto, CNPJ único por empresa, `aliquotaSt` DECIMAL(7,4) obrigatório com zero permitido, contato, ativo) e `produtos.fornecedorId` opcional com `ON DELETE SET NULL`. `codigoFornecedor` textual permanece.
- API `CRUD /fornecedores` só com `personalizacaoComercial=ECOLUME`; sem flag: `FORNECEDOR_INDISPONIVEL`. CNPJ inválido / duplicado: `CNPJ_INVALIDO` / `CNPJ_DUPLICADO`. Exclusão com produto vinculado: `FORNECEDOR_EM_USO`. `PATCH .../vinculo-produto/:produtoId` não apaga texto nem altera preço/estoque.
- Alterar ST% não recalcula `precoVenda`, `custoMedio`, `ultimoPreco` nem orçamentos (preço sugerido fica para ECOL-08/13).
- `aliquotaSt` filtrado por `VER_CUSTOS` (ECOL-26a). Menu ECOLUME ganha Fornecedores. UI `FornecedoresView`.
- Integração `ECOL_FORNECEDOR=1` ou `ECOL_PRODUTO=1`: 5 passaram. Regressão 04a+04b+05+06: 43. Suíte API com flags: 141 passaram, 9 pulados (`ECOL_HTTP`). Contratos: 11. `tsc` API, `vue-tsc` e builds conferidos.

### ECOL-25

Testada em 27/10/2026. Sem ECOL-02/P3, CC-e, e-mail DANFE, homologação Sefaz.

- Tela `/app/fiscal` (menu ECOLUME) com abas: Notas emitidas, Notas de entrada, Pendentes de emissão. Redirect legado `fiscal/notas-entrada` → `?aba=entrada`.
- API `GET /fiscal/notas-emitidas` e `GET /fiscal/pendentes-emissao` (reusa reserva PROCESSANDO+AUTORIZADA da ECOL-24). Entrada: ECOL-07 embutida; listar/obter sem `IMPORTAR_XML`; mutação mantém a permissão.
- Limite modelo entrada: notas gravadas já saem `CONFERIDA` (não há fila PENDENTE persistida — conferência é pré-gravação).
- Simulação Focus marcada (`simulacao`); DANFE/XML só com arquivo. Emissão real bloqueada com aviso P3/token.
- Focados `ECOL_FISCAL=1`: 4 PASS. Regressão ECOL-24 + ECOL-07: PASS. Suíte API: 272 PASS / 9 SKIP (1 flaky ECOL-11 timeout sob carga, isolado PASS). Contratos: 14. `tsc` / `vue-tsc` / nest build OK. Playwright `fiscal-abas.spec.ts`: **SKIP** (API indisponível no ambiente).

### ECOL-24

Testada em 27/10/2026 com **mock Focus** (sem `FOCUS_NFE_TOKEN` / P3). Homologação Sefaz **não** executada. Veredito: `IMPLEMENTADA E TESTADA COM MOCK — HOMOLOGAÇÃO PENDENTE`. Tela Fiscal (ECOL-25) testada depois.

- Migração `20261027260000_nfe_pedido_ecolume`: `notas_fiscais.pedidoId` + `itens_nota_fiscal` (snapshot, `itemPedidoId`, Decimal).
- `NfePedidoService`: preparar/emitir/cancelar a partir do pedido; parcial/total; reserva PROCESSANDO+AUTORIZADA; advisory lock; HTTP Focus fora da TX; idempotência por `refFocus`.
- Validação cadastral (doc, endereço, NCM, origem, empresa). P3 (regime/CFOP/CSOSN|CST/natureza) e token: avisos; token sem P3 → `EMISSAO_BLOQUEADA_P3`. Sem inventar CFOP/CST.
- Checklist `NF_EMITIDA` só com cobertura **AUTORIZADA** 100%; cancelamento reabre. ECOL-18: NF autorizada do pedido ou orçamento bloqueia cancelamento do pedido.
- Cancelamento Focus (DELETE) se token; sem token = mock local. CC-e e e-mail DANFE/XML: entregues na ECOL-28b (mock sem token).
- UI: **Emitir NF-e** no `PainelPedidos` (ECOLUME). Painel legado orçamento oculto na flag.
- Focados `ECOL_NFE=1`: helpers 3 + integração 12 PASS (parcial, concorrência, rejeição, processando, idempotência/timeout, checklist, ECOL-18, estoque, legado, payload mock). Homologação real: SKIP. Playwright: SKIP.

### ECOL-23

Testada em 27/10/2026. NF-e do pedido (ECOL-24) testada depois com mock. Sem Fiscal (ECOL-25), UI de parâmetros (ECOL-02), matriz fina ECOL-26b.

- Dashboard ECOLUME: saudação; cabeçalho **Orçamentos em aberto**; períodos este mês (padrão) / mês anterior / 30d / ano / personalizado. Removidos configure conta, conversas ativas, “Resultado no período” e rodapé legado (só na flag).
- Indicadores §15.3: faturamento (PED ≠ CANCELADO + Δ%), vendas + conversão por NEG, ORC RASCUNHO/ENVIADO, ticket. Decisão: cancelados excluídos também da contagem de vendas (coerência com faturamento/ticket).
- Funil §15.4: colunas pré+pós ECOL-19; NEGOCIO/PEDIDO; clique → `/app/pipeline?coluna=`.
- Alertas §15.5: atrasadas, a comprar, abaixo do mínimo, ORC ENVIADO parado, checklist >X dias, entregas hoje/amanhã. Prazos via `diasOrcamentoSemMovimentacao` / `diasChecklistPendente` (padrão 7).
- Parceiros §15.6: ranking por valor vendido + comissão real (ECOL-17); sem CANCELADA.
- Permissões §15.7: sem `VER_FATURAMENTO` a API não devolve `indicadores`/`parceiros`/valores; comissão exige `VER_COMISSOES`. Legado intacto.
- Focados `ECOL_DASHBOARD=1`: helpers 3 + integração §17 PASS (R$ 1.642,56 / 1 venda / ticket / Ana Souza R$ 164,26). Suíte API: 254 PASS / 9 SKIP. Contratos: 14. `tsc` / `vue-tsc` / builds OK. Playwright: SKIP.

### ECOL-22

Testada em 27/10/2026. Dashboard (ECOL-23) testado depois. Sem recorrência, drag-and-drop, Google Calendar, ECOL-02/26b.

- Agenda ECOLUME: alternância Lista / Semana / Mês; legenda por tipo; navegação período + Hoje.
- API `GET /atividades?de=&ate=` (intervalo inclusivo); `porPagina` até 500. Sem migração.
- Helpers `@arcco/contratos` (`agenda-calendario`): semana segunda→domingo, grade do mês, rótulos dia inteiro/manhã/tarde/horário sem inventar clock.
- Filtros status/tipo/responsável em todas as vistas; clique abre formulário existente; invalidação após salvar/concluir.
- Sem flag: só lista legada. Scheduler ECOL-21 intacto.
- Focados `ECOL_CALENDARIO=1`: helpers 4 + integração 1 PASS. Regressão Agenda 20/21: PASS. Suíte API: 250 PASS / 9 SKIP. Contratos: 14. `tsc` / `vue-tsc` / builds OK. Playwright `agenda-calendario.spec.ts`: **SKIP** (API indisponível no ambiente).

### ECOL-21

Testada em 27/10/2026. Calendário (ECOL-22) e Visão geral (ECOL-23) testados depois. Sem parâmetros UI ECOL-02, push/WhatsApp/e-mail. Matriz fina de agenda na ECOL-26b.

- Migração `20261027250000_followup_resultado_ecolume`: `atividades.resultadoConclusao`.
- Relógio “sem movimentação”: `orcamento.enviadoEm` (fallback `atualizadoEm`). Prazo `configuracoes.diasOrcamentoSemMovimentacao` (padrão 7, §16.4).
- `FollowUpsService` + `FollowUpsScheduler` (setInterval 5 min, independente do dashboard). Dedup por NEG (advisory lock); sem regenerar na mesma onda após conclusão (`concluidaEm >= ref`).
- Legado “Negócio parado OP-” só em empresa sem flag ECOLUME.
- Conclusão `POST .../concluir-follow-up` com resultado no histórico; idempotente.
- Sininho `SinoAgenda` + `GET /atividades/resumo-agenda` (hoje + atrasadas; próprias salvo gestor/proprietário com `todas`).
- Focados `ECOL_FOLLOWUP=1`: helpers 4 + integração 4 PASS. Suíte API: 245 PASS / 9 SKIP. Contratos: 14. `tsc` / `vue-tsc` OK. Playwright: SKIP.

### ECOL-20

Testada em 27/10/2026. Follow-up (ECOL-21) e calendário (ECOL-22) testados depois. Sem Dashboard (ECOL-23), NF-e (ECOL-24). Matriz fina de permissões de agenda (só próprias / só atribuídas) fica na ECOL-26b.

- Migração `20261027240000_agenda_entrega_ecolume`: enum `ENTREGA`/`VISITA` + campos de entrega em `atividades`.
- Tipos §13.1 na Agenda ECOLUME; entrega §13.2 com pedido obrigatório, endereço (obra→cliente), contato no local, período manhã/tarde.
- Conclusão parcial vs final: só final marca checklist Entregue + `faseKanban=ENTREGUE` (+ FINALIZADO se checklist 100%). Idempotente. Cancelado bloqueia. Sem nova baixa de estoque.
- Kanban: botão **Agendar entrega** em Pronto para entrega; `dataEntrega` no card. UI Agenda: filtro Entregas a fazer + diálogo parcial/final.
- Focados `ECOL_ENTREGA=1`: 4 PASS. Regressão 17/18/19: PASS. Playwright: não executado.

### ECOL-19

Testada em 27/10/2026. Agenda (ECOL-20) e Follow-up (ECOL-21) testados depois. Sem Dashboard (ECOL-23), NF-e (ECOL-24). Edição da lista de motivos de perda fica na ECOL-02.

- Migração `20261027230000_kanban_ecolume`: `pedidos.faseKanban` + `historico_fase_pedido`.
- Dual board ECOLUME: pré-venda (negócio) + pós-venda (pedido). Legado sem flag mantém colunas atuais.
- Automáticos: novo → Novo contato; 1º ORC → Orçamento em aberto; conversão → Pedido confirmado; checklist 100% → Finalizado; cancelamento retira do funil ativo. Perdido exige motivo (lista padrão) e marca ORCs abertos como RECUSADO sem cancelar pedidos.
- Movimentos manuais de pedido não alteram estoque/pagamento/comissão; Finalizado manual bloqueado.
- UI `PipelineEcolume.vue` (busca NEG/ORC/PED, filtros, DnD). Playwright ECOL-19: não executado.
- Focados `ECOL_KANBAN=1`: helpers 8 + integração 3 PASS. Regressão ECOL-11/16 unitários: PASS. `tsc` API / `vue-tsc` OK.

### ECOL-18

Testada em 27/10/2026. Sem Kanban completo na época (ECOL-19 agora testada), Agenda (ECOL-20), NF-e completa (ECOL-24) nem reembolso automático.

- Migração `20261027220000_cancelamento_pedido_ecolume`: `canceladoPorId`, `motivoCancelamento`.
- `PedidosService.cancelar`: `CANCELAR_PEDIDO`, motivo + confirmação; bloqueia NF `AUTORIZADA` no ORC de origem; estorno pelas BAIXAs reais (`ESTORNO_PEDIDO`, sem mexer custo médio/último preço); comissão → `CANCELADA` (paga preserva evidência + alerta); ORC → `RECUSADO`; pagamentos intactos (alerta se houver recebidos); auditoria `CANCELAMENTO_PEDIDO` na mesma TX operacional.
- UI `PainelPedidos` (motivo, confirmação, status CANCELADO). Playwright dedicado: não executado.
- Focados `ECOL_CANCEL=1`: 7 PASS. Regressão pedidos/estoque: 41. Suíte API: **222 PASS / 9 SKIP / 0 FAIL**. Contratos: 14. `tsc` API / `vue-tsc` OK. Atomicidade/concorrência/rollback cobertos.

### ECOL-17

Testada em 27/10/2026. Sem cancelamento (ECOL-18 — agora testada). Kanban (ECOL-19) testado depois. Agenda (ECOL-20), NF-e (ECOL-24) e parâmetros ECOL-02 pendentes. Base da RT = total do pedido (P1 / §16.4) até ECOL-02.

- Migração `20261027210000_conversao_pedido_ecolume`: `pagamentos_pedido`, `comissoes_pedido`, `checklist_itens_pedido`, `itens_separacao_pedido`, `itens_compra_pedido`, `movimentacoes_estoque.pedidoId`.
- Reusa `criarEstruturaAPartirDeOrcamento(tx)`: CONVERTIDO, SUBSTITUIDO só selecionados, BAIXA ordenada (saldo negativo OK), pagamentos §11.4 (6 modelos; soma ≠ total avisa), comissão `rtNegocio` × total (A_PAGAR), checklist §11.3 (100% → FINALIZADO), auditoria `CONVERSAO_PEDIDO` na mesma TX operacional, etapa `PEDIDO_CONFIRMADO` se existir.
- `CONVERTER_PEDIDO` / `VER_PAGAMENTOS` / `VER_COMISSOES`. UI `AssistenteConversaoPedido` (4 passos). Legado sem flag: `PEDIDO_INDISPONIVEL`.
- Atomicidade: só no banco operacional (auditoria operacional na mesma TX). Plataforma não participa da conversão.
- Focados `ECOL_CONV=1`: 20 PASS (pagamentos 6 + estrutura 7 + conversão 7). Regressão estoque/pedido: 34. Suíte API: **215 PASS / 9 SKIP / 0 FAIL**. Contratos: 14. `tsc` API, `vue-tsc` OK.

### ECOL-16 (estrutura)

Testada em 27/10/2026. Estrutura reutilizada pela ECOL-17 via `criarEstruturaAPartirDeOrcamento(tx?)`.

- Migração `20261027200000_pedido_ecolume`: `pedidos` / `itens_pedido`, `StatusPedido`, `orcamentoId` único, `PED-####` por empresa.
- Snapshot de itens/totais/descontos; `pg_advisory_xact_lock`; conversão operacional na ECOL-17.
- Unitários: 7. Integração `ECOL_PEDIDO=1`: 1. Controller passou a expor `converter` / `previsualizar` na ECOL-17 (sem `criar` estrutural público).

### ECOL-15

Testada em 27/10/2026. Sem pedidos (ECOL-16). Preço avulso / cadastro rápido sem `VER_CUSTOS` permanece bloqueado até ECOL-02 (`PRECO_ALTERACAO_INDISPONIVEL`).

- Contratos: `salvarNoCadastro` + `fornecedorId` em `itemOrcamentoInputSchema`.
- `ProdutosService.criarCadastroRapidoTx`: produto saldo 0, `codigoInterno`, `ultimoPreco` = custo, `custoMedio` null, sem movimentação; fornecedor validado na empresa.
- `OrcamentosService.montarItens` (mesma transação do criar/atualizar): SIM cria e vincula; NÃO/avulso fica `produtoId=null`. Trava RASCUNHO e legado intactos.
- UI `PainelOrcamento`: **Item novo** (nome, fornecedor, custo, IPI, margem, qtd) com pergunta ao salvar; **Item avulso** (descrição, qtd, preço).
- Unitários: 5 (fórmula avulso + cadastro SIM/NÃO/falha). Suíte API c/ flags: **194 PASS / 9 SKIP / 0 FAIL**. Contratos: 14. `tsc` API, `vue-tsc`, `nest build` e build web OK.

### ECOL-14

Testada em 27/10/2026. Sem item rápido/avulso (ECOL-15), pedidos (ECOL-16) nem WhatsApp API. Campos dedicados de prazo/condições (P6-PDF-TEXTOS) continuam fora; validade e observações livres já entram no PDF quando preenchidos.

- `pdf-orcamento.ts`: `renderizarPdfEcolume` (logo, empresa, `ORC-####`, data, cliente, só `item.nome` comercial, qtd/unitário/totais/descontos) vs `renderizarPdfLegado` (SKU/versão). Valores só dos persistidos (ECOL-13); sem SKU, nome fiscal, custo, IPI, ST, margem, NCM, CEST, EAN, fornecedor.
- `gerarPdf`: ECOLUME não-RASCUNHO com `arquivoId` não regenera (imutabilidade). `GET :id/pdf` + `conteudoPdf` reutilizam o arquivo enviado. `marcar-enviado` ECOL-12 intacto (status/data; sem mensagem).
- UI `PainelOrcamento`: PDF, Baixar, Compartilhar (Web Share API com fallback download). `servicoArquivos.baixar` / `compartilhar`.
- Evidência: `apps/api/tmp/ecol14-evidencia.pdf` + texto extraído — ORC-0014, cliente, descrição comercial, R$ 274,56 / 499,12, sem SKU/termos proibidos.
- Unitários PDF: 8. Serviço imutabilidade/legado: 4. Compartilhar web: 2. Orçamentos+estoque c/ flags: 28 PASS. Suíte API c/ flags: **189 PASS / 9 SKIP / 0 FAIL**. Contratos: 14. `tsc` API, `vue-tsc`, `nest build` e build web OK.

### ECOL-13

Testada em 27/10/2026. Sem PDF (ECOL-14), item rápido/avulso (ECOL-15) nem pedidos (ECOL-16).

- Migração `20261027160000_orcamento_item_formula_ecolume`: snapshot na linha (`baseCusto`, `custoBase`, IPI/ST/margem, `precoManual`, `margemEfetiva`, `codigoInterno`) + `descontoTipo`/`descontoPercentual` no cabeçalho.
- Fórmula 10.4 em `formula-orcamento.ts` (decimal/bigint): 120→R$ 274,56; 113,33→R$ 259,30. Diferença 4 casas (113,3333→259,31) documentada em `PENDENCIAS.md`.
- `montarItens` ECOLUME não sobrescreve descrição; legado ainda copia `produto.nome`. Duplicação preserva snapshots. Trava ECOL-12 intacta.
- Sem `VER_CUSTOS`: custos/IPI/ST/margem omitidos na resposta; `precoSugerido` permanece (§10.3). Preço/desconto manuais bloqueados até ECOL-02 (`PRECO_ALTERACAO_INDISPONIVEL` / `DESCONTO_ALTERACAO_INDISPONIVEL`).
- UI `PainelOrcamento`: bases, dois custos, IPI/ST/margem, margem efetiva, desconto R$/%.
- Unitários fórmula: 6. Contratos: 14 (fórmula + `precoSugerido` sem VER_CUSTOS). Regressão orçamentos+estoque: 16 PASS. Suíte API c/ flags: **168 PASS / 22 SKIP / 0 FAIL** (timeout ECOL-04a sob carga corrigido no describe). `tsc` API, `vue-tsc`, `nest build` e build web OK.

### ECOL-12

Testada em 27/10/2026. Sem fórmula/editor (ECOL-13), PDF limpo (ECOL-14), item rápido (ECOL-15) nem pedidos (ECOL-16).

- Migração `20261027140000_orcamento_ecolume_status_origem`: enum `SUBSTITUIDO`/`RECUSADO`; `orcamentoOrigemId`. Números legados `ORC-n-vN` e status `ACEITO` preservados.
- ECOLUME: `ORC-####` com `pg_advisory_xact_lock`, sem sufixo de versão; vários ORC no mesmo NEG; rascunho em branco permitido.
- Trava no backend após sair de `RASCUNHO` (`ORCAMENTO_BLOQUEADO` no `PATCH`). `POST :id/marcar-enviado` grava `enviadoEm` e, na flag, marca ENVIADO anterior como `SUBSTITUIDO`. WhatsApp/`enviar` permanece no legado.
- `POST :id/duplicar`: novo RASCUNHO, novo número, mesmos itens/negócio, `orcamentoOrigemId` + UI “Baseado em”.
- UI `PainelOrcamento`: número, status, data de envio, duplicar, marcar enviado, edição só em rascunho (flag); legado inalterado.
- Unitários: 5. Integração `ECOL_ORCAMENTO=1`: 2. Contratos: 12. Suíte API c/ flags (verificação final): **162 PASS / 22 SKIP / 0 FAIL**. Timeouts ECOL-07 (`testTimeout`/`afterAll`) e ECOL-11 (`afterAll`/`beforeAll`) corrigidos na causa (limite 5s/10s insuficiente sob Postgres compartilhado). `tsc` API, `vue-tsc`, `nest build` e build web conferidos na verificação.
- Trava: único mutador comercial é `PATCH`→`atualizar` (sem endpoints de itens); `ORCAMENTO_BLOQUEADO` em ENVIADO/SUBSTITUIDO/RECUSADO/CONVERTIDO/ACEITO/CANCELADO. `duplicar` com novo ORC, itens copiados, origem e original intactos.

### ECOL-11

Testada em 20/10/2026. Sem orçamentos (ECOL-12), pedidos (ECOL-16) nem comissões (ECOL-10b).

- Migração `20261021020000_oportunidade_negocio_ecolume`: `origemNegocio`, `parceiroId`, `rtNegocio`, endereço da obra no `Oportunidade`. Códigos `NEG-####` com `pg_advisory_xact_lock`; legado `OP-####` preservado.
- Cliente obrigatório (ou `clienteMinimo`); origem direto/via parceiro; RT copiada do parceiro e persistida no negócio; responsável padrão = criador; etapa inicial `NOVO_CONTATO`; anexos via `Arquivo` (`entidade=OPORTUNIDADE`).
- UI: formulário ECOLUME (nome, cliente, origem, parceiro, RT, endereço com copiar do cliente); ficha mostra NEG, etapa, parceiro, obra e anexos.
- Unitários: 3. Integração `ECOL_NEGOCIO=1`: 2. Suíte API c/ flags: 168 PASS / 9 SKIP. `tsc` API, `vue-tsc`, `nest build` e build web OK (após limpeza de `dist`/caches; disco ~1,4 GB livres no momento do build).

### ECOL-10a

Testada em 20/10/2026. Sem a ECOL-10b (extrato/comissões), ECOL-02 (parâmetro RT editável). ECOL-11 coberta em seção própria.

- Migração `20261021010000_contato_parceiro_ecolume`: `tipoParceiro`, `rtPadrao`, Pix/banco/titular/`observacoesParceria` no `Contato`. Desmarcar `ehParceiro` remove da aba Parceiros e preserva os campos.
- RT inicial 10% (`RT_PADRAO_PARCEIRO`) até ECOL-02; editável por parceiro (0–100 decimal). Dados bancários opcionais.
- Menu e rotas `/app/parceiros`; Clientes lista todos com etiqueta; Parceiros só `ehParceiro=true`.
- `VER_PAGAMENTOS` filtra Pix/banco/titular; `VER_COMISSOES` filtra `rtPadrao`. Sem flag: campos de parceria não gravados.
- Unitários `contatos.parceiro.spec.ts`: 3. Contatos totais: 16. Contratos: 12 (menu Parceiros). Suíte API c/ flags: 163 PASS / 9 SKIP. `tsc` API e `vue-tsc`/build web OK. `nest build` falhou por `ENOSPC` no disco (cópia do engine Saúde); `tsc -p tsconfig.build.json` cobre o TypeScript. Isolamento ECOL-04a: contagem de custo limitada aos SKUs do seed.

### ECOL-09a

Testada em 20/10/2026. Sem a ECOL-09b; ECOL-10a coberta em seção própria. Sem ECOL-11 nem emissão fiscal.

- Migração `20261020230000_contato_ecolume_pf_pj`: enum `NaturezaPessoa` (PF/PJ) e colunas aditivas em `contatos` (`natureza`, `nomeFantasia`, IE/`ieIsento`, endereço do cliente, `telefonesExtras`, `pessoasEmpresa`, `ehParceiro`). Contatos legados ficam com `natureza` nula. `TipoContato` permanece para empresa sem flag e módulos legados.
- Com flag: criação exige PF/PJ; mínimo nome/razão social + telefone; CPF/CNPJ opcionais com validação de dígitos; IE com Isento; endereço independente da obra; pessoas da PJ; “Chegou por” em `origem`. Sem flag: formulário e API de papéis antigos inalterados; campos ECOLUME não são gravados.
- Duplicidade (telefone ou documento na mesma empresa): `CONTATO_DUPLICADO` 409 com `detalhes.contato` para abrir o existente; sem merge. Isolamento por `empresaId`.
- UI: rótulos Clientes, formulário condicional PF/PJ, ViaCEP com edição manual, lista com busca/filtros natureza/parceiro/cidade, etiqueta Parceiro se `ehParceiro`, sem estatísticas inventadas de pedidos.
- Unitários `contatos.ecolume.spec.ts`: 5. Multi-tenant: 5. Integração `ECOL_CONTATO=1`/`ECOL_PRODUTO=1`: 3. Contratos (CPF/CNPJ no schema): 12. `tsc` API, `vue-tsc` e build web conferidos. Build API via `nest build` (script `rm` falha no Windows; artefato gerado).

### ECOL-08

Testada em 20/10/2026. Sem a ECOL-09b e sem pedidos na lista de compra (ECOL-16).

- UI ECOLUME: `EstoqueEcolumePainel` com sub-abas produtos, movimentações, fornecedores (`FornecedoresView` embutido) e lista de compra (CSV/impressão). Legado sem flag inalterado em `EstoqueView`.
- Status: SOB_ENCOMENDA → A_COMPRAR → BAIXO → OK. Sem status ZERADO. Cards: cadastrados, abaixo do mínimo, a comprar, sob encomenda.
- Busca: descrição comercial, nome fiscal, código interno, código do fornecedor, EAN. Filtros por fornecedor e status. Preço sugerido só com dados (`ultimoPreco` + `margem`); protegido por VER_CUSTOS com custos.
- API: `estoque/movimentacoes`, `estoque/lista-compra`; listagem/resumo ramificam com a flag. Ajuste continua na ECOL-06 (`AJUSTAR_ESTOQUE`).
- Integração `ECOL_ESTOQUE=1`/`ECOL_PRODUTO=1`: 3 passaram. Contratos (status/fórmula): 12. Suíte API com flags: 152 passaram, 9 pulados (`ECOL_HTTP`). E2e de abas versionado em `personalizacao-menu.spec.ts`.

### ECOL-07

Testada em 20/10/2026. Sem a ECOL-08. Sem DF-e automático (P6) e sem conversão de unidades (P5).

- Migração `20261020220000_nota_entrada_ecolume`: `notas_entrada` (chave única por empresa) e `itens_nota_entrada`. XML no storage existente (`arquivoXmlId`).
- Fluxo: pré-visualizar (sem gravação) → conferência → confirmar atômico (fornecedor/ST%, produtos, entradas ECOL-05, IPI, NCM/CEST/origem se vazios, auditoria `IMPORTACAO_XML` + `ENTRADA_ESTOQUE`). Lote com resultado individual. Parser recusa DOCTYPE/ENTITY e limite 2 MB. Lock advisory + unique contra corrida.
- Permissão `IMPORTAR_XML`. Empresa sem flag: `NOTA_ENTRADA_INDISPONIVEL`. UI `NotasEntradaView` + menu Fiscal com seletor de produto (usar sugerido / vincular / criar).
- Integração `ECOL_NFE=1`/`ECOL_PRODUTO=1`: parser 3 + integração 5. Suíte API / contratos / `tsc` / `vue-tsc` / builds conferidos na entrega do seletor.

### ECOL-04a

Testada em 15/10/2026. Sem a ECOL-05 e sem a ECOL-03.

- Antes da migração, `db_empresa_arcco` tinha 3 produtos e 3 movimentações. SKUs `SPOT-01`, `FITA-5M` e `PERF-AL` eram únicos. Não havia produto sem SKU nem saldo negativo.
- Migração `20261015210000_produto_ecolume_aditivo`: só `ADD COLUMN`. Nenhuma linha de saldo, preço ou movimentação foi reescrita. `codigoInterno` ficou nulo nos produtos já existentes. O SKU não foi copiado para o código interno.
- Colunas novas, todas nulas: `codigoInterno`, `nomeFiscal`, `descricaoComercial`, `codigoFornecedor`, `ean`, `cest`, `origemFiscal`, `ipi`, `margem`, `custoMedio`, `ultimoPreco`, `fatorConversao`. Na movimentação: `motivo` e `precoUnitarioCusto`. `ativo`, `estoqueAtual`, `precoVenda`, `sku`, `nome`, `descricao`, `ncm` e `unidade` já existiam.
- Não há `fornecedorId`. O código do fornecedor é texto. A entidade Fornecedor continua na ECOL-03. `ipi`, `margem`, `custoMedio`, `ultimoPreco` e `fatorConversao` não entram no contrato de escrita e não são calculados. A média é a ECOL-05. O fator permanece nulo (P5).
- Empresa com a flag recebe `CI-000001` em diante, só onde `codigoInterno` é nulo, na ordem `criadoEm` e `id`. A geração grava só essa coluna. A segunda execução atribui zero e não renomeia. Empresa sem a flag não gera código e a resposta omite as chaves novas.
- Trocar o código interno responde `CODIGO_INTERNO_IMUTAVEL`. A alteração de `precoVenda` continua auditada. A atribuição do código não cria tipo novo de auditoria.
- `custoMedio`, `ultimoPreco`, `ipi`, `margem` e `precoUnitarioCusto` passam pelo filtro da ECOL-26a. `precoVenda` permanece visível.
- Integração `ECOL_PRODUTO=1`: 6 testes passaram. Os três produtos do seed conservaram preço e saldo (`SPOT-01` 89,9 e 40). As movimentações continuaram sem `precoUnitarioCusto`. A criação na empresa com flag gerou `CI-000001` e não alterou o saldo do seed. Produtos com saldo 0, 5 e -2 receberam código sem mudança de saldo. A segunda geração devolveu 0. A empresa sem flag criou produto com estoque e preço e sem as chaves novas. Vendedor sem `VER_CUSTOS` não recebeu custo, IPI nem margem; com a concessão, recebeu `custoMedio`. Entrada e ajuste alteraram só o saldo.
- Suíte da API sem as flags de integração: 80 passaram e 28 ficaram pulados. Contratos: 10. `tsc --noEmit` da API, `vue-tsc` do web e `tsc -p tsconfig.build.json` passaram. O ramo Saúde não foi alterado.

### ECOL-04b

Testada em 19/10/2026. Sem a ECOL-05 e sem a ECOL-03. Sem migração nova.

- Endpoint `GET /api/produtos/estoque/reconciliacao`, perfis `PROPRIETARIO` e `GESTOR`. Só responde quando `personalizacaoComercial` é `ECOLUME`; sem a flag responde `RECONCILIACAO_INDISPONIVEL`.
- Saldo derivado: `ENTRADA` soma a quantidade, `BAIXA` subtrai, `AJUSTE` aplica o delta já gravado com sinal. Agregação por `groupBy` de `produtoId` e `tipo`. Sem saldo inicial fora da movimentação. Sem correção automática. Sem log de auditoria de negócio.
- DTO mínimo: `produtoId`, `sku`, `codigoInterno`, `estoqueAtual`, `saldoMovimentacoes`, `diferenca`, `consistente`. Sem custo, IPI nem margem.
- Integração `ECOL_PRODUTO=1` (`produtos.reconciliacao.integracao.spec.ts`): 10 testes passaram — consistente 40/40, divergente 40/35 sem escrita, zero, negativo consistente e divergente, saldo 5 sem movimento, entrada+baixa+ajuste, isolamento entre empresas, empresa sem flag, leitura repetida sem alterar produto/preço/custo/movimento/log.
- Regressão ECOL-04a (`produtos.integracao.spec.ts`): 6 passaram. Seed `SPOT-01`, `FITA-5M` e `PERF-AL` com diferença 0 na leitura. Suíte da API: 80 passaram e 38 ficaram pulados. Contratos: 10. `tsc --noEmit` da API e `tsc -p tsconfig.build.json` passaram. O frontend não foi alterado nesta tarefa.

### ECOL-05

Validada em 20/10/2026. Sem a ECOL-03, a ECOL-07 e a ECOL-08.

- Entrada com `precoUnitarioCusto` na empresa ECOLUME atualiza `custoMedio` e `ultimoPreco`, grava o custo na movimentação e inclui os valores no log `ENTRADA_ESTOQUE`, na mesma transação com `FOR UPDATE`. Colunas `DECIMAL(18,4)` (`20261020200000_produto_custo_decimal`).
- Fórmula: saldo ≤ 0 → média = preço da entrada; saldo positivo com média conhecida → média ponderada; saldo positivo com média nula → exige `custoReferenciaSaldo` e pondera `(saldo × referência + qtd × preço) / total`. Sem referência: `CUSTO_REFERENCIA_OBRIGATORIO`, sem escrita. BAIXA não altera custos. Entrada sem preço mantém os custos. Sem backfill.
- `custoReferenciaSaldo` e `precoUnitarioCusto` protegidos pela ECOL-26a. Empresa sem flag ignora ambos.
- Unitários: 4. Integração `ECOL_PRODUTO=1`: 15. Regressão 04a (6) e 04b (10). Suíte API / contratos / tsc / vue-tsc passaram na validação.

### ECOL-06

Testada em 20/10/2026. Sem a ECOL-03, a ECOL-07 e a ECOL-08. Sem migração nova.

- `POST /produtos/:id/ajuste`: ECOLUME exige `motivo`, aceita `saldoContado` (com `saldoAnteriorEsperado`) ou `diferenca`, custo opcional via ECOL-05, `FOR UPDATE`, `AJUSTAR_ESTOQUE`. Legado: `saldoContado` + observação.
- UI `EstoqueDetalheView`: saldo anterior / diferença / resultante, modos final ou diferença, motivos tipados, custo se `VER_CUSTOS`.
- Integração `ECOL_PRODUTO=1` (`produtos.ajuste.integracao.spec.ts`): 8 passaram. Regressão 04a+04b+05+06: 43 passaram. Suíte API: 84 / 61 pulados. Contratos: 10. `tsc`, build API e `vue-tsc` passaram.
