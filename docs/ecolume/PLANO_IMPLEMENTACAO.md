# Plano de implementação Ecolume

Base: auditoria aprovada em `AUDITORIA.md`. Pendências em `PENDENCIAS.md`. Acompanhamento em `CHECKLIST.md`.

Este documento não implementa código. A execução começa somente após autorização explícita da ECOL-01.

A seção 19 do PDF (tabelas em PDF, cobrança, taxas, push, e-mail, envio integrado do orçamento, relatórios avançados) está fora da fase 1. Sugestões da P6 também ficam fora do caminho crítico até decisão da equipe.

## Por que a ordem não copia a seção 21

A seção 21 começa pelo menu. Aqui o menu da Ecolume vem em ECOL-01, e em seguida entram três pré-condições que a seção 21 não separa:

1. Permissão de custo e de dado financeiro antes de qualquer resposta que exponha esses campos (ECOL-26a).
2. Trilha de auditoria gravável antes do primeiro ajuste, da primeira mudança de preço e da primeira importação (ECOL-27a).
3. Migração que só adiciona estrutura, mais um relatório de reconciliação, antes de tratar o saldo como soma de movimentações (ECOL-04a e ECOL-04b).

O restante segue a dependência de dados: fornecedor e produto, clientes e parceiros, orçamento, pedido, funil, agenda, visão geral, fiscal. Permissões de aba e de ação sensível acompanham cada tela (ECOL-26b), sem esperar o fim para esconder custo.

## Regras transversais

Toda tarefa de ECOL-01 a ECOL-28 obedece a isto. Critério de aceite que falhe aqui não fecha a tarefa.

### Isolamento multiempresa

- Toda entidade nova tem `empresaId` obrigatório e índice.
- Toda leitura e escrita filtra `empresaId` do usuário autenticado. Identificador de outra empresa retorna não encontrado, no mesmo formato já usado pela API.
- Sequência de NEG, ORC, PED e código interno é por empresa. Não há contador global. Ver `PENDENCIAS.md`.
- Arquivo, XML e certificado ficam ligados à empresa dona. Download sem o mesmo `empresaId` falha.
- Teste mínimo de cada entidade nova: dois tenants, tentativa de ler, alterar e apagar o registro do outro. O teste de contatos em `apps/api/src/modules/contatos/multi-tenant.spec.ts` é o modelo, não a cobertura suficiente.
- Saúde (`/saude` e `prisma/saude`) não é alterada.

### Empresa sem a flag

- Flag desligada: menu, rótulos, funil, orçamento `ORC-n-vN`, código `OP-`, conversão pela etapa ganha, WhatsApp, obras, produtos e dashboard atuais permanecem.
- Código compartilhado ganha ramo explícito. O ramo antigo não é reescrito “no lugar”.
- Coluna nova é nula ou default que a UI antiga ignora. Nenhum backfill muda saldo, preço de venda, status de orçamento ou etapa.
- Regressão obrigatória: suíte unitária existente e `apps/web/e2e/fluxo-essencial.spec.ts` na empresa de demonstração sem a flag.

### Custo e financeiro

- Último preço, custo médio, IPI, ST, margem, lucro estimado, faturamento, ticket, valores da visão geral, pagamentos e comissões só saem da API se a permissão correspondente existir.
- Esconder no Vue não substitui o filtro da API.
- Até ECOL-26a estar testada, nenhuma tarefa posterior pode exibir esses campos, nem para administrador da Ecolume, salvo a própria tela de configuração de permissão.
- Administrador (`PROPRIETARIO` no modelo atual, alinhado ao perfil único da seção 16.1) recebe o conjunto completo quando ECOL-26a ligar o catálogo. Os outros perfis da Ecolume não herdam custo por serem `VENDEDOR` ou `GESTOR`.

### Estoque existente

Detalhe em ECOL-04a e ECOL-04b. Resumo: não recalcular saldo sozinho, não inventar custo histórico, não trocar a fonte do saldo enquanto o relatório mostrar divergência.

### Princípios da seção 3

- Preço, margem, descrição e custo sugeridos podem ser editados no documento (orçamento ou nota). A edição não grava no cadastro.
- Falta de saldo, de pagamento ou de cadastro gera aviso. Bloqueio só na emissão de NF quando faltar dado fiscal obrigatório, e no cancelamento de pedido com NF autorizada (11.5).
- Revisão de orçamento cria número novo. Não há versão que substitua o PDF já marcado como enviado.

## Migração e reconciliação de estoque

Estado atual: `Produto.estoqueAtual` é atualizado dentro da transação que também cria `MovimentacaoEstoque` (`entrada`, `ajuste`, `baixarPorOrcamento`). O saldo da tela é a coluna, não a soma. Movimentação antiga não tem preço unitário. SKU é opcional.

Estratégia:

1. ECOL-04a adiciona colunas nulas e tipos novos sem `UPDATE` de saldo, preço ou status.
2. ECOL-04b, por empresa, lista produto a produto: saldo da coluna, soma das quantidades das movimentações, diferença, quantidade de movimentos sem custo. Não grava correção.
3. A tela nova da Ecolume continua mostrando `estoqueAtual` enquanto existir diferença não reconhecida. Não passa a calcular saldo só pela soma.
4. Correção, se a Ecolume quiser, é um ajuste manual (ECOL-06) com motivo e auditoria, quantidade informada por uma pessoa. Não há script que zere a diferença.
5. Custo médio e último preço nascem nulos. A primeira entrada com preço (XML ou ajuste de estoque inicial com custo) aplica a regra da seção 7.7. Movimento antigo sem preço não entra na média.
6. Código interno é gerado na criação do produto pelo módulo. Produto já existente só recebe código quando a flag é ligada para aquela empresa, uma vez, em coluna nova, sem alterar o SKU. O código não muda depois. Empresas sem flag não passam por essa geração.
7. Empresa sem flag segue `entrada`, `ajuste` e `baixarPorOrcamento` como hoje, inclusive saldo negativo já possível na baixa.

Go-live do estoque da Ecolume fica bloqueado enquanto ECOL-04b não tiver sido executado nessa empresa e o resultado arquivado. ECOL-01 não depende disso.

## Cobertura dos requisitos obrigatórios

Seção 19 excluída. Itens `[SUGESTÃO]` estão na P6, no fim deste arquivo. `[PENDENTE]` aponta para `PENDENCIAS.md`.

| Seção | Obrigação | Tarefa |
|---|---|---|
| 1 e 2 | Como ler e contexto | Sem código |
| 3 | Princípios | Regras transversais e critérios de cada tarefa |
| 4 | Quadro de telas | 6 a 16 |
| 5.1 | Relações empresa, usuário, fornecedor, produto, movimento, nota de entrada, contato, negócio, orçamento, pedido, pagamento, checklist, comissão, nota de saída, atividade, auditoria | ECOL-03 a ECOL-27, nas entidades de cada um |
| 5.1 | Contato único cliente/parceiro; negócio com 1 cliente, 0 ou 1 parceiro, N orçamentos, N pedidos; pedido nasce de 1 orçamento; item avulso; saldo só por movimentação | ECOL-09a, ECOL-10a, ECOL-11, ECOL-16, ECOL-15, ECOL-04b, ECOL-06 |
| 5.2 | NEG, ORC, PED, código interno, chave de NF-e de entrada única | ECOL-11, ECOL-12, ECOL-16, ECOL-04a, ECOL-07 |
| 6.1 | Menu e item só com permissão de aba | ECOL-01, ECOL-26a, ECOL-26b |
| 6.2 | Ecolume sem Conversas, WhatsApp na UI e textos de chatbot no shell dela | ECOL-01, ECOL-23 |
| 6.3 | Sem aba Projetos; anexo e endereço no negócio; arquivos na ficha do cliente | ECOL-01, ECOL-11, ECOL-09b |
| 6.4 | Sem aba Produtos; cadastro dentro do estoque | ECOL-01, ECOL-08 |
| 6.5 | Rótulo Clientes | ECOL-09a |
| 7.1 | Estoque lista todos os produtos e os dois caminhos de entrada mais o manual | ECOL-08, ECOL-07, ECOL-15 |
| 7.2 | Fornecedor e ST% | ECOL-03 |
| 7.3 | Campos do produto e preço sugerido calculado | ECOL-04a, ECOL-05, ECOL-08 |
| 7.4 | XML, chave única, vínculo, conferência, atualização de custo e IPI | ECOL-07 |
| 7.5 | Cadastro rápido e avulso | ECOL-15 |
| 7.6 | Estoque inicial opcional por ajuste | ECOL-06. Planilha é P6 |
| 7.7 | Dois custos, fórmula, casas, uso no orçamento | ECOL-05, ECOL-13. Margem global é P6 |
| 7.8 | Baixa, estorno, saldo negativo, sob encomenda e avulso | ECOL-17, ECOL-18 |
| 7.9 | Ajuste com motivo e auditoria | ECOL-06, ECOL-27a |
| 7.10 | Lista de compra | ECOL-08 |
| 7.11 | Colunas, cards, busca e filtros; custo conforme permissão | ECOL-08, ECOL-26a |
| 8.1 | Mesma base, etiqueta, marcar parceiro não apaga | ECOL-09a, ECOL-10a |
| 8.2 | Campos, mínimo nome e telefone, duplicidade, ViaCEP, fiscal só na NF | ECOL-09a, ECOL-24 |
| 8.3 | Lista | ECOL-09a |
| 8.4 | Ficha, totais, histórico, arquivos | ECOL-09b |
| 9.1 | Dados de parceria | ECOL-10a |
| 9.2 | RT no negócio, parâmetro de base | ECOL-11, ECOL-02, P1 |
| 9.3 | Comissão por pedido e status | ECOL-17, ECOL-10b, P2 |
| 9.4 | Tela e visão de comissões a pagar | ECOL-10a, ECOL-10b |
| 10.1 e 10.2 | Negócio agrupa; campos de criação | ECOL-11 |
| 10.3 | Editor, linha, totais, permissão de custo | ECOL-13, ECOL-26a. Textos livres, ambiente e indicador de margem são P6 |
| 10.4 | Fórmula e arredondamento | ECOL-13 |
| 10.5 | PDF, baixar, compartilhar, marcar enviado, trava | ECOL-14, ECOL-12 |
| 10.6 | Número novo, duplicar, baseado em | ECOL-12 |
| 10.7 | Busca | ECOL-19 |
| 11.1 | Assistente e efeitos da conversão | ECOL-17 |
| 11.2 | Casos de fechamento | ECOL-12, ECOL-16, ECOL-17, ECOL-19 |
| 11.3 | Checklist e ida a Finalizado | ECOL-17, ECOL-20, ECOL-24, ECOL-10b, ECOL-23 |
| 11.4 | Modelos e linhas de pagamento | ECOL-02, ECOL-17 |
| 11.5 | Cancelamento | ECOL-18, ECOL-24 |
| 12.1 a 12.4 | Colunas, motivos, card, filtros; prioridade mantida | ECOL-19 |
| 13.1 e 13.2 | Tipos e entregas | ECOL-20 |
| 13.3 | Follow-up | ECOL-21 |
| 13.4 | Lista e calendário | ECOL-22 |
| 13.5 | Sino interno; push fica na seção 19 | ECOL-21, ECOL-23 |
| 14.1 | Emissor, certificado, parâmetros | ECOL-24, ECOL-02, P3 |
| 14.2 | Emissão do pedido, parcial, validação, cancelar, carta de correção | ECOL-24 |
| 14.3 | Tela Fiscal | ECOL-25 |
| 15.1 a 15.7 | Cabeçalho, remoções, cards, gráfico, alertas, parceiros, visibilidade | ECOL-23, ECOL-26a |
| 16.1 | Administrador e permissões individuais, convite, desativar | ECOL-26a, ECOL-26b |
| 16.2 | Lista de permissões | ECOL-26a (catálogo e gates de custo/financeiro), ECOL-26b (demais ações nas telas) |
| 16.3 | Auditoria | ECOL-27a, ECOL-27b |
| 16.4 | Parâmetros | ECOL-02. Fiscais reais dependem de P3. Margem global e validade são P6 |
| 17 e 20 | Roteiro e aceite | ECOL-28 |
| 21 | Ordem sugerida | Substituída pela ordem deste plano, com o mesmo conjunto obrigatório |

Nenhum requisito obrigatório das seções 5 a 18 e 20 ficou sem tarefa. A seção 18 permanece aberta de propósito.

## Tarefas

Arquivos citados são o ponto de partida provável, não a lista fechada de um diff.

### ECOL-01 — Flag e menu

- Descrição: configuração por empresa que liga o módulo. Com ela, o shell mostra a ordem da seção 6.1 e esconde Conversas, Produtos, Projetos, chatbot e WhatsApp. Sem ela, `BarraLateral.vue` e as rotas atuais seguem iguais. Rotas e módulos não são apagados. Textos de WhatsApp e “pessoas” somem só do shell com a flag.
- PDF: 6.1, 6.2, 6.3, 6.4.
- Depende de: nada.
- Onde: `Empresa.configuracoes`, `BarraLateral.vue`, `apps/web/src/router/index.ts`, guard da API que informa a flag ao cliente.
- Banco: nenhuma tabela nova. Chave no JSON já existente.
- Regressão: empresa sem flag, inclusive a demo de `fluxo-essencial.spec.ts`, conserva Conversas, Produtos, Pessoas e Projetos. Saúde inalterada. Ligar a flag numa empresa não altera a outra.
- Aceite: dois logins no mesmo ambiente, um com flag e outro sem, veem menus diferentes. URL antiga de conversas, para a empresa com flag, não entra na navegação. O código de WhatsApp continua carregado para a empresa sem flag.
- Testes: unitário do resolvedor da flag por `empresaId`; e2e do menu atual sem flag; e2e do menu da seção 6.1 com flag.

Estado: validada em 15/10/2026 com dois logins reais. Parceiros e Fiscal não entram no menu enquanto as telas não existirem (ver `PENDENCIAS.md`). A ECOL-26a não foi iniciada.

Estoque e Configurações seguem os perfis que já enxergavam essas áreas. Nenhuma aba nova foi aberta para `VENDEDOR` ou `ATENDENTE`. A matriz da seção 16.2 continua na ECOL-26a.

### ECOL-02 — Parâmetros

Estado: testada em 28/10/2026.

- Descrição: prazos de orçamento parado e de pendência de pedido (inicial 7), RT padrão de novo parceiro (inicial 10%), base da RT (inicial “valor total do pedido”), motivos de perda iniciais da seção 12.2, modelos de pagamento da seção 11.4. Margem global e validade de PDF como parâmetros opcionais (P6). Sem CFOP, CSOSN ou regime preenchidos por default (P3). Certificado/token só no ambiente do servidor.
- PDF: 16.4, 11.4, 12.2, 9.2.
- Depende de: ECOL-01.
- Onde: módulo de empresas, tela de configurações da empresa com flag.
- Banco: registros de parâmetro com `empresaId`, ou documento versionado dentro de `configuracoes`, desde que não misture segredo. Preferência por tabela se a lista de motivos e de modelos for editável.
- Regressão: empresa sem flag não lê esses defaults no funil nem no orçamento atuais.
- Aceite: alterar o prazo ou a RT padrão não exige deploy e não muda orçamento já travado nem comissão já lançada.
- Testes: leitura isolada por empresa; comissão futura usa o valor do parâmetro vigente na criação, não um literal no serviço.

### ECOL-26a — Permissões de custo e financeiro

- Descrição: catálogo da seção 16.2 persistido por usuário, com administrador em acesso total. Nesta tarefa a API passa a exigir permissão para devolver ou gravar custo, IPI, ST, margem, lucro, faturamento, ticket, pagamentos e comissões. As telas ainda não existem; o contrato e o guard sim. Demais ações (emitir NF, ajustar estoque, cancelar pedido) entram no guard aqui como chaves, e cada tarefa de tela recusa a chamada sem a chave.
- PDF: 16.1, 16.2, 15.7, 10.3, 7.11.
- Depende de: ECOL-01.
- Onde: `usuarios`, guards, `packages/contratos`.
- Banco: permissão por usuário e por empresa. Perfil reutilizável pode esperar ECOL-26b, mas a tabela já deve permitir o vínculo.
- Regressão: rotas atuais de produto, orçamento e dashboard, sem a flag, continuam autorizadas pelos perfis atuais. A flag não pode fazer `PerfilGuard` negar o CRM antigo.
- Aceite: usuário da empresa com flag, sem a permissão de custos, recebe produto, item de orçamento e métrica sem os campos de custo, mesmo chamando a API direto. Com a permissão, os campos voltam. Usuário de outra empresa não lê a permissão alheia.
- Testes: matriz das chaves de custo e financeiro; isolamento; empresa sem flag inalterada.

### ECOL-27a — Registro de auditoria

Estado: validada em 15/10/2026. A consulta continua na ECOL-27b.

- Descrição: serviço que grava quem, quando, empresa, tipo e payload mínimo. Ainda sem tela. Tipos previstos na seção 16.3 ficam reservados. Falha de auditoria numa ação obrigatória desfaz a transação da ação.
- PDF: 16.3, princípio 4 da seção 3.
- Depende de: ECOL-01.
- Onde: módulo novo, chamado pelos serviços seguintes.
- Banco: `logs_auditoria` com `empresaId`, índice por empresa, usuário, tipo e data. Sem dado de outra empresa no mesmo registro.
- Regressão: nenhuma escrita extra nas operações sem flag.
- Aceite: tentativa cruzada de leitura do log de outra empresa não retorna linha.
- Testes: gravação e isolamento. A consulta com filtros é ECOL-27b.

### ECOL-03 — Fornecedores

Estado: testada em 20/10/2026. Migração `20261020210000_fornecedor_ecolume` aplicada. Sem a ECOL-07/08.

- Descrição: razão social ou nome, nome curto, CNPJ, ST%, contato e observações. CNPJ identifica o emitente do XML. ST% obrigatório, pode ser zero. Alterar ST% não recalcula preço de venda nem orçamentos nesta entrega; a sugestão de produto fica para ECOL-08/13.
- PDF: 7.2.
- Depende de: ECOL-01, ECOL-26a (ST% é dado de custo).
- Onde: módulo `fornecedores` + `FornecedoresView`.
- Banco: `fornecedores` com `empresaId`; CNPJ único por empresa; `produtos.fornecedorId` opcional (SetNull).
- Regressão: produtos atuais não ganham fornecedor obrigatório; `codigoFornecedor` textual intacto.
- Aceite: fornecedor da empresa A invisível para B. ST% não volta na API sem permissão de custos. Empresa sem flag não acessa o recurso.
- Testes: CRUD isolado; ST% omitido sem permissão; vínculo sem alterar preço/estoque.

### ECOL-04 — Épico do produto

Concluído quando ECOL-04a e ECOL-04b estiverem validadas e o código interno imutável estiver coberto pelos testes de ECOL-04a. Não é uma entrega separada de tela.

### ECOL-04a — Migração aditiva

Estado: testada em 15/10/2026. A migração `20261015210000_produto_ecolume_aditivo` foi aplicada em `db_empresa_arcco`. Não há fornecedor como entidade. O custo médio não é calculado.

- Descrição: colunas nulas para nome fiscal, descrição comercial, código do fornecedor, EAN, CEST, origem, IPI, margem, último preço, custo médio, código interno. `estoqueAtual` e `precoVenda` intactos. Movimentação ganha motivo e preço unitário de custo opcionais, nulos no histórico. Fator de conversão de unidade existe e fica nulo (P5), sem entrar em conta.
- PDF: 5.2, 7.3, 7.7, P5.
- Depende de: ECOL-01.
- Onde: `apps/api/prisma/schema.prisma`, contratos de produto.
- Banco: `ALTER` aditivo aplicado. Sem `UPDATE` de saldo. Produtos anteriores ficam com `codigoInterno` nulo.
- Regressão: telas atuais de produto e estoque leem as colunas antigas e ignoram as novas.
- Aceite: depois da migration, contagem de produtos, saldos e preços de venda iguais ao backup lógico imediatamente anterior. Código interno, quando gerado na ativação da flag, não muda numa segunda execução.
- Testes: migration em banco de teste com produto sem movimentação, com movimentação e com saldo negativo; segunda execução da geração de código não renomeia; empresa sem flag não dispara a geração.

### ECOL-04b — Reconciliação

Estado: testada em 19/10/2026. Endpoint de leitura `GET /api/produtos/estoque/reconciliacao`. Sem migração. Sem correção de saldo. Contagem de movimentos sem custo fica para a implantação junto da ECOL-05; esta tarefa compara só quantidade.

- Descrição: consulta por empresa que compara `estoqueAtual` com a soma dos efeitos das movimentações (`ENTRADA` +, `BAIXA` −, `AJUSTE` com o delta gravado). Somente leitura. Não cria ajuste.
- PDF: 7.3, 7.9.
- Depende de: ECOL-04a.
- Onde: serviço de produtos, endpoint só de administrador da própria empresa.
- Banco: nenhum.
- Regressão: não grava.
- Aceite: diferença conhecida de teste aparece no relatório; chamar o endpoint não muda `estoqueAtual` nem insere movimentação.
- Testes: caso com soma igual à coluna; caso divergente; isolamento.

### ECOL-05 — Custos

Estado: validada em 20/10/2026, com persistência `DECIMAL(18,4)`. Cálculo em `custo-medio.ts` com `Prisma.Decimal`. Persistência só em `entrada` com a flag. Saldo positivo + média nula exige `custoReferenciaSaldo` (opção 3). Ajuste com custo é a ECOL-06.

- Descrição: ao registrar entrada com preço, atualiza último preço e custo médio com as regras da seção 7.7, inclusive saldo zero ou negativo antes da entrada. Saída não muda a média. Quatro casas internas, duas na exibição. Sem preço na entrada, os custos permanecem como estão. Não recalcula histórico.
- PDF: 7.7.
- Depende de: ECOL-04a, ECOL-26a, ECOL-27a.
- Onde: `produtos.service.ts`, em ramo usado pela flag. O ramo sem flag não calcula custo.
- Banco: colunas de custo da ECOL-04a convertidas por `20261020200000_produto_custo_decimal` para `DECIMAL(18,4)`.
- Regressão: `entrada` atual, sem preço, mantém o comportamento de saldo de hoje para empresa sem flag.
- Aceite: a tabela 7.7.2 fecha (100,00; 113,33; venda não muda a média; entrada com saldo 0 vira 125,00). Usuário sem permissão não recebe os dois custos.
- Testes: unitários dos quatro momentos; permissão; tenant.

### ECOL-06 — Ajustes

Estado: testada em 20/10/2026. Endpoint `POST /produtos/:id/ajuste` ampliado; ficha `EstoqueDetalheView` com modo ECOLUME.

- Descrição: ajuste informa diferença ou quantidade resultante e motivo (estoque inicial, inventário, avaria, perda, devolução, outro), observação opcional. Gera movimentação e auditoria com saldo anterior e novo. Estoque inicial da seção 7.6 é esse motivo, opcional, com custo unitário quando a pessoa informar. Não há importação de planilha aqui (P6).
- PDF: 7.6, 7.9.
- Depende de: ECOL-04b, ECOL-05, ECOL-27a, e a chave de permissão “ajustar estoque” de ECOL-26a.
- Onde: `produtos.service.ts`, ficha de estoque.
- Banco: motivo na movimentação.
- Regressão: ajuste atual por saldo contado, sem motivo, continua para empresa sem flag.
- Aceite: não existe caminho com a flag que altere `estoqueAtual` sem movimentação na mesma transação. Estorno de pedido não usa esta tela.
- Testes: cada motivo; auditoria; ausência da permissão; saldo de empresa sem flag inalterado.

### ECOL-07 — XML de entrada

Estado: testada em 20/10/2026. Migração `20261020220000_nota_entrada_ecolume` aplicada. Sem ECOL-08.

- Descrição: um ou vários XML, inclusive arrastar. Valida a chave de 44 dígitos e recusa a segunda importação. Acha fornecedor pelo CNPJ ou cria e pede ST%. Acha produto por fornecedor mais código do fornecedor, ou sugere criar, ou vincula a um produto já nascido no orçamento. Conferência permite corrigir vínculo, “controla estoque” e descrição comercial. Confirmar gera entrada, último preço (`vUnCom`), custo médio, IPI e preenche NCM, CEST, origem e unidade só se estiverem vazios. Guarda o XML. Unidade da nota no produto novo (P5); existentes não têm conversão.
- PDF: 7.4.
- Depende de: ECOL-03, ECOL-05, ECOL-06, permissão “importar XML”.
- Onde: `notas-entrada` + `NotasEntradaView`, storage de arquivos existente.
- Banco: `notas_entrada` / `itens_nota_entrada`, chave única por empresa.
- Regressão: emissão de NF de saída atual não passa a exigir nota de entrada.
- Aceite: segundo XML do mesmo fornecedor reutiliza o produto; a mesma chave não entra de novo; item “não controla estoque” não movimenta saldo.
- Testes: fixture de XML; chave repetida; vínculo com produto sem código de fornecedor; tenant; usuário sem permissão.

### ECOL-08 — Tela de estoque

Estado: testada em 20/10/2026. Sem migração. Pedidos na lista de compra ficam para ECOL-16.

- Descrição: sub-abas produtos, movimentações, fornecedores e lista de compra. Colunas da seção 7.11. Status OK, Baixo, A comprar e Sob encomenda. Busca por descrição comercial, nome fiscal, código interno, código do fornecedor e EAN. Filtros por fornecedor e status. Lista de compra agrupa saldo negativo por fornecedor; imprimir/exportar CSV. Custos e preço sugerido só com permissão. Preço sugerido calculado com último preço × (1+IPI%) × (1+ST%) × margem, sem inventar margem/custo.
- PDF: 7.1, 7.10, 7.11.
- Depende de: ECOL-06, ECOL-07, ECOL-26a.
- Onde: `EstoqueEcolumePainel.vue` + `EstoqueView.vue` (ramo legado).
- Banco: nenhum além dos anteriores.
- Regressão: rota de estoque sem flag mostra a grade atual (produto, saldo, mínimo, status, ações).
- Aceite: produto com saldo negativo aparece em A comprar e na lista; sob encomenda não aparece na lista; sem permissão de custos as colunas de custo não vêm no JSON.
- Testes: filtros e status; omissão de custo; e2e das abas ECOLUME vs legado.

### ECOL-09a — Clientes

- Descrição: na flag, rótulos Clientes em menu, título, botão, busca e mensagens. Tipo PF/PJ. Cadastro mínimo com nome e um telefone. CPF, CNPJ e IE com validação de dígitos quando preenchidos, exigidos só na NF. Endereço com CEP preenchendo logradouro, bairro, cidade e UF (ViaCEP ou equivalente). Vários telefones. Pessoas da PJ. “Chegou por”. Aviso de CPF, CNPJ ou telefone já usado, com atalho para o cadastro, sem gravar duplicado por engano. O enum de papéis antigo continua para empresa sem flag.
- PDF: 6.5, 8.1, 8.2, 8.3.
- Depende de: ECOL-01, ECOL-26a (permissão da aba e de excluir).
- Onde: `Contato`, formulários em `apps/web/src/modules/contatos/`.
- Banco: colunas e tabela de telefones/pessoas da PJ, todas com `empresaId`. Papel antigo não é apagado.
- Regressão: chatbot e obras sem flag continuam lendo `TipoContato`.
- Aceite: salvar só nome e telefone funciona; documento repetido avisa; endereço do cliente não é o endereço da obra.
- Testes: dígitos de CPF/CNPJ; duplicidade; tenant; rótulos da flag; formulário antigo sem flag.

### ECOL-09b — Ficha do cliente

- Descrição: resumo com total comprado de pedidos não cancelados, quantidade de pedidos, última compra e parceiro de origem. Histórico de negócios, orçamentos e pedidos. Arquivos de todos os negócios, com data e negócio. Atalho para a ficha de parceiro quando houver flag.
- PDF: 8.4, 6.3.
- Depende de: ECOL-09a, ECOL-11, ECOL-16.
- Onde: `ContatoDetalheView.vue`.
- Banco: nenhum, se os vínculos já existirem.
- Regressão: ficha sem flag não espera pedido.
- Aceite: anexo de um negócio aparece na ficha; pedido cancelado não entra no total.
- Testes: agregação com dois negócios; isolamento.

### ECOL-10a — Dados de parceria

- Descrição: “é parceiro” revela tipo (arquiteto/designer, instalador/eletricista, construtora), RT padrão vinda do parâmetro e editável, dados de pagamento e observações. Desmarcar tira da aba Parceiros e não apaga contato, negócio nem comissão. Aba Clientes lista todos, com etiqueta. Aba Parceiros lista só parceiros. Nesta tarefa a lista ainda pode mostrar totais zerados.
- PDF: 9.1, 9.4 (cadastro), 8.1.
- Depende de: ECOL-09a, ECOL-02.
- Onde: contato e view nova, rota só com flag e permissão de aba.
- Banco: campos de parceria no contato ou tabela 1:1 com `empresaId`.
- Regressão: tipos antigos de contato fora da flag.
- Aceite: o mesmo contato pode ser cliente num negócio e parceiro em outro; desmarcar não remove linhas.
- Testes: flag; RT padrão 10% editável; tenant.

### ECOL-10b — Extrato de comissões

- Descrição: na ficha, extrato por pedido e negócios em aberto. Na lista, vendas indicadas, total vendido, a pagar e pago no período. Visão de todas as comissões a pagar, com total, filtro por período e parceiro. Marcar paga pede forma, preenche a data com hoje editável, e marca o item do checklist do pedido. Exige permissão de ver e de marcar. Não impõe data de pagamento (P2).
- PDF: 9.3, 9.4.
- Depende de: ECOL-10a, ECOL-17, ECOL-26a.
- Onde: módulo de parceiros e comissões.
- Banco: usa comissões de ECOL-17.
- Regressão: nenhuma comissão para empresa sem flag.
- Aceite: um clique marca paga e o checklist; cancelamento do pedido não é esta tela.
- Testes: totais do período; permissão; tenant.

### ECOL-11 — Negócio

- Descrição: criação com nome (sugestão “Cliente — Projeto”), cliente obrigatório com alta rápida mínima, origem cliente direto ou via parceiro, parceiro e RT quando a origem for parceiro, responsável padrão o autor, endereço da obra com atalho do endereço do cliente, anexos com data e autor, observações. Número `NEG-` sequencial por empresa. Sem orçamento, etapa Novo contato. Endereço deixa de depender da aba Projetos para quem tem a flag. Obras continuam para quem não tem.
- PDF: 5.2, 6.3, 10.1, 10.2.
- Depende de: ECOL-09a, ECOL-10a, ECOL-27a.
- Onde: `oportunidades.service.ts`, formulário de negócio.
- Banco: colunas de origem, parceiro, RT e endereço no negócio, com `empresaId` já existente na tabela. Sequência por empresa.
- Regressão: `proximoCodigo` continua emitindo `OP-` sem a flag.
- Aceite: RT do negócio nasce do parceiro e pode ser alterada só naquele negócio; anexo guarda quem enviou.
- Testes: sequência por empresa sem vazamento; origem sem parceiro recusa parceiro obrigatório; com parceiro, exige parceiro; flag off gera `OP-`.

### ECOL-12 — Orçamento, número e trava

- Descrição: número `ORC-` único por empresa, sem sufixo de versão. Status rascunho, enviado, convertido, substituído e recusado. Rascunho editável. Enviado em diante não. Duplicar cria rascunho no mesmo negócio, copia itens e grava “baseado em”. Orçamentos antigos `ORC-n-vN` e status `ACEITO` permanecem válidos fora da flag e não são renumerados.
- PDF: 10.5, 10.6, 11.2.
- Depende de: ECOL-11.
- Onde: `orcamentos.service.ts`.
- Banco: referência ao orçamento de origem. Status novos no enum sem remover os antigos enquanto a flag estiver desligada. Migração de enum aditiva.
- Regressão: criar e enviar orçamento sem flag ainda produz o formato atual e ainda pode integrar WhatsApp.
- Aceite: editar enviado falha; duplicata tem outro número; lista do negócio mostra a relação “baseado em”.
- Testes: trava; sequência; empresa sem flag.

### ECOL-13 — Fórmula e editor

- Descrição: busca do produto pela descrição comercial, nome fiscal, código interno ou código do fornecedor. A linha guarda código do produto, descrição comercial editável, quantidade, base (último preço como padrão, ou custo médio, ou custo digitado se nunca comprou), IPI, ST e margem editáveis, preço calculado e total. Sobrescrever o preço mostra a margem efetiva. Fórmula da seção 10.4, arredondamento para duas casas no preço unitário. Desconto geral em reais ou percentual. Edição da linha não altera o produto. Sem permissão de custos, a linha não traz custo, IPI, ST nem margem; o preço só muda se houver percentual máximo configurado (sem percentual, a alteração fica indisponível — ver pendências). Com permissão, nenhum campo de preço é bloqueado.
- PDF: 10.3, 10.4, 7.7.3.
- Depende de: ECOL-05, ECOL-12, ECOL-26a, ECOL-27a (alteração de preço ou margem em orçamento já enviado ou convertido entra no log; rascunho não precisa desse tipo).
- Onde: `ItemOrcamento`, editor Vue, `montarItens`.
- Banco: colunas da linha. `montarItens` não pode mais forçar `produto.nome` no ramo da flag.
- Regressão: orçamento sem flag continua copiando o nome do produto como hoje.
- Aceite: exemplo Stella fecha em R$ 274,56 (último preço) e R$ 259,30 (custo médio). Descrição reescrita não muda o cadastro. Usuário sem custo não recebe IPI, ST nem margem no payload.
- Testes: fórmula; margem efetiva; não propagação ao produto; permissão; flag off.

### ECOL-14 — PDF e enviado

- Descrição: PDF com logo e dados da empresa, número, data, cliente, só descrição comercial, quantidades, preços, subtotais e total. Sem nome fiscal, SKU, fornecedor, custo, IPI, ST ou margem. Baixar e compartilhar no celular. Marcar enviado grava data e hora e trava. Não chama WhatsApp no ramo da flag.
- PDF: 10.5.
- Depende de: ECOL-13.
- Onde: renderização em `orcamentos.service.ts`.
- Banco: `enviadoEm` já existe.
- Regressão: PDF sem flag pode continuar com SKU até haver pedido explícito de mudar o PDF de todos os clientes. O ramo da flag é outro.
- Aceite: inspeção do texto do PDF da flag não contém os termos proibidos do produto de teste. Marcar enviado não cria mensagem.
- Testes: conteúdo do PDF; ausência de chamada ao serviço de WhatsApp; flag off ainda gera o PDF antigo.

### ECOL-15 — Item rápido e avulso

- Descrição: “Item novo” pede nome, fornecedor, custo, IPI e margem. Ao salvar a linha, pergunta se grava no cadastro. Sim cria produto com saldo zero e aquele custo como último preço de referência. Não cria movimento de compra. “Item avulso” fica só no orçamento, sem produto e sem estoque. O XML posterior consegue vincular o produto criado aqui (ECOL-07).
- PDF: 7.5, 10.3.
- Depende de: ECOL-13.
- Onde: editor de orçamento e produtos.
- Banco: nenhum além do produto.
- Regressão: item sem `produtoId` no orçamento antigo continua válido.
- Aceite: recusar o cadastro não cria produto; avulso não aparece na baixa.
- Testes: os dois botões; vínculo posterior coberto junto de ECOL-07.

### ECOL-16 — Pedido

- Descrição: `PED-` por empresa, nascido de exatamente um orçamento, copiando itens, quantidades, preços e descrições. Vários pedidos no mesmo negócio. Um orçamento não gera dois pedidos.
- PDF: 5.1, 5.2, 11.1, 11.2.
- Depende de: ECOL-12.
- Onde: módulo de pedidos.
- Banco: `pedidos` e `itens_pedido` com `empresaId`.
- Regressão: fechar oportunidade sem flag não cria pedido.
- Aceite: segundo pedido no mesmo negócio, a partir de outro orçamento, convive com o primeiro. Repetir conversão do mesmo orçamento falha.
- Testes: cardinalidade; sequência; flag off.

### ECOL-17 — Conversão

- Descrição: ação manual “Converter em pedido”. Assistente único: aviso de itens que ficarão negativos, modelo de pagamento lido dos parâmetros (Pix à vista, crédito com parcelas, débito, sinal mais restante, sinal mais boletos, personalizado), escolha de outros orçamentos do negócio para marcar substituído, nenhum marcado por padrão. Ao confirmar, nesta ordem: cria o pedido e marca o orçamento convertido; baixa quem controla estoque; monta separação e itens a comprar; grava pagamentos; lança comissão se houver parceiro (base do parâmetro × RT do negócio); cria checklist; coloca o card em Pedido confirmado; audita. Soma das linhas diferente do pedido avisa e não bloqueia. Checklist: pagamento recebido (manual); itens comprados (só se houver falta); material separado (manual); NF (gancho para ECOL-24); entregue (gancho para ECOL-20); comissão (gancho para ECOL-10b). Marcar e desmarcar grava data, usuário e auditoria. Quando os itens visíveis do checklist estão todos marcados, o pedido vai para Finalizado. Itens ocultos (sem compra ou sem parceiro) não impedem os 100%. Permissão de converter, de ver pagamentos e de ver comissão.
- PDF: 11.1, 11.3, 11.4, 9.3, 7.8.
- Depende de: ECOL-10a, ECOL-15, ECOL-16, ECOL-06, ECOL-26a, ECOL-27a.
- Onde: pedidos, estoque, orçamentos.
- Banco: pagamentos, comissões, itens de checklist, com `empresaId`.
- Regressão: `converterOrcamentoFinal` segue sendo o caminho da etapa ganha sem flag, uma vez por oportunidade, sem comissão.
- Aceite: cenário dos passos 5 e 6 da seção 17: sinal 50% gera duas linhas de R$ 821,28; fita vai a −1; perfil de 25 a 19; comissão R$ 164,26 a pagar; avulso e sob encomenda não baixam.
- Testes: cada modelo de pagamento; soma divergente; comissão com a base padrão; sem parceiro não cria comissão; baixa negativa; flag off; tenant.

### ECOL-18 — Cancelar pedido

- Descrição: confirmação e motivo. Estorna quantidades com movimentação de entrada que não altera custo médio. Cancela a comissão. Tira o card do funil. Marca o orçamento de origem como recusado. Se existir NF-e autorizada, não cancela o pedido e aponta o cancelamento da nota. Exige permissão.
- PDF: 11.5, 7.8, 9.3.
- Depende de: ECOL-17, ECOL-27a. O atalho de NF fica completo em ECOL-24; até lá, a existência de nota autorizada já bloqueia.
- Onde: pedidos e estoque.
- Banco: nenhum novo.
- Regressão: perder oportunidade sem flag continua só cancelando orçamento vigente, sem estorno novo além do que o código já faz (hoje não estorna).
- Aceite: saldo volta; custo médio permanece; comissão cancelada.
- Testes: estorno depois de saldo negativo; bloqueio com NF autorizada; auditoria.

### ECOL-19 — Funil e busca

- Descrição: colunas da seção 12.1. Card de negócio e card de pedido ao mesmo tempo. Arrastar manual permanece e entra no histórico, junto com movimento automático. Perdido pede motivo da lista configurável e recusa orçamentos abertos; pode reabrir. Finalizado mostra 30 dias por padrão. Card de negócio: nome, NEG, cliente, parceiro, valor do orçamento aberto mais recente, quantidade de orçamentos, responsável, dias parado, prioridade mantida. Card de pedido: PED, negócio, cliente, valor, pendências do checklist, entrega agendada, responsável. Título Negócios, total em orçamentos abertos, botão novo negócio. Busca por cliente, razão social, nome fantasia, ORC, PED, NEG, nome do negócio e parceiro, abrindo o negócio no documento encontrado. Filtros: responsável, parceiro, período, só pré-venda, só pós-venda. Permissão de ver todos os negócios ou só os próprios.
- PDF: 12, 10.7, 11.2.
- Depende de: ECOL-16, ECOL-17, ECOL-02.
- Onde: `PipelineView.vue`, funil, oportunidades. Etapas atuais das outras empresas não são apagadas nem reordenadas.
- Banco: etapas da flag por empresa. Sem `DELETE` das etapas Negociação e Fechado das empresas sem flag.
- Regressão: kanban sem flag conserva as cinco etapas atuais.
- Aceite: um negócio com orçamento aberto e um pedido entregue mostra os dois cards. Mover para Perdido sem motivo falha.
- Testes: transições da seção 12.1; busca de cada chave; flag off; permissão de escopo.

### ECOL-20 — Entregas

- Descrição: tipos entrega, visita, reunião, follow-up e tarefa, com os campos comuns da seção 13.1. Entrega: data, horário ou manhã/tarde, endereço, contato no local, pedido, responsável e observações. Endereço da obra do negócio, ou do cliente se não houver, e telefone do cliente vêm preenchidos e podem ser editados. Mais de uma entrega por pedido. Checklist e coluna Entregue só quando o usuário indicar que aquela conclusão é a entrega final. Lista de itens com descrição comercial e nome fiscal para conferência. Botão no card “Pronto para entrega”. Filtro “Entregas a fazer”. Permissão de ver agenda de todos, a própria, ou só entregas atribuídas.
- PDF: 13.1, 13.2.
- Depende de: ECOL-17, ECOL-11.
- Onde: `atividades`, views de agenda. Tipos antigos permanecem no ramo sem flag.
- Banco: campos de entrega e tipo novo, aditivos.
- Regressão: lista atual de atividades sem flag, com os tipos já existentes.
- Aceite: abrir pelo card vem preenchido; concluir como final marca checklist e move o card; entrega parcial não marca.
- Testes: preenchimento; parcial versus final; permissão do entregador; flag off.

### ECOL-21 — Follow-up e sininho

- Descrição: orçamento enviado sem movimentação além do prazo do parâmetro gera follow-up para o responsável do negócio. Não duplica se já houver pendência daquele negócio. Conclusão pede uma linha de resultado no histórico do negócio. O follow-up antigo de “Negócio parado OP-” não roda para empresa com flag. Sininho com contador de compromissos do dia e atrasados. Sem push e sem e-mail.
- PDF: 13.3, 13.5.
- Depende de: ECOL-12, ECOL-02, ECOL-20.
- Onde: `dashboard.service.ts`, shell.
- Banco: nenhum obrigatório se o resultado for evento do negócio.
- Regressão: empresa sem flag continua com a regra atual de 7 dias sobre `atualizadoEm` da oportunidade.
- Aceite: dois acessos ao dashboard não criam dois follow-ups; resultado aparece no histórico.
- Testes: prazo configurado; deduplicação; flag off ainda cria o follow-up antigo só na empresa sem flag.

### ECOL-22 — Calendário

- Descrição: além da lista, semana e mês com cor por tipo. Filtros de status, tipo e responsável continuam na lista.
- PDF: 13.4.
- Depende de: ECOL-20.
- Onde: `AtividadesView.vue`, só com a flag.
- Banco: nenhum.
- Regressão: lista sem flag.
- Aceite: o mesmo compromisso aparece na lista e no dia correto do calendário.
- Testes: e2e da troca de visão; flag off.

### ECOL-23 — Visão geral

- Descrição: saudação mantida. “Orçamentos em aberto” com valor. Período: este mês (padrão), mês anterior, últimos 30 dias, ano e personalizado. Remove, só na flag, card de configurar conta, conversas ativas, bloco que repete resultado e rodapé de pessoas/conversas/negócios. Cards: faturamento (pedidos do período sem cancelados, contra o período anterior), vendas concluídas (quantidade e conversão por negócio, não por orçamento), orçamentos em rascunho ou enviado com valor, ticket médio. Gráfico de todas as colunas da seção 12.1; clique abre o funil filtrado. Alertas: atividades atrasadas, a comprar, abaixo do mínimo, orçamentos parados, pedidos com checklist aberto além do prazo, entregas de hoje e amanhã. Ranking de parceiros no período. Sem permissão de faturamento, a API não manda valores; a tela mostra alertas e agenda.
- PDF: 15.
- Depende de: ECOL-17, ECOL-19, ECOL-21, ECOL-08, ECOL-26a.
- Onde: `dashboard.service.ts`, `DashboardView.vue`, ramo da flag.
- Banco: nenhum.
- Regressão: dashboard sem flag conserva conversas, pessoas novas e a fórmula atual de conversão.
- Aceite: no mês do exemplo da seção 17, faturamento R$ 1.642,56, uma venda, ticket R$ 1.642,56, Ana Souza com um pedido e comissão R$ 164,26. Usuário sem permissão não recebe esses números.
- Testes: agregador com fixtures; omissão financeira; dashboard antigo sem flag.

### ECOL-24 — NF-e do pedido

- Descrição: emitir a partir do pedido, total ou parcial, sem passar da quantidade vendida. Descrição da linha editável só na nota; NCM e código interno permanecem. Validação lista o que falta (CPF/CNPJ, endereço, IE, NCM, parâmetros) e onde corrigir. Envio ao emissor já integrado (Focus), em homologação. Autorizada guarda número, série, XML e DANFE. Quando a quantidade faturada cobre o pedido, marca o checklist. Cancelar com justificativa e carta de correção se o emissor expuser; se não expuser, a tarefa registra o limite e não simula a Sefaz. Natureza, CFOP e CST/CSOSN só leem parâmetro. Com P3 vazia, a emissão real não é habilitada. Certificado só entra com armazenamento de segredo fora do JSON plano e fora do git; até lá a tela avisa que o certificado não está configurado. O fluxo antigo, orçamento mais etapa ganha, permanece sem a flag.
- PDF: 14.1, 14.2, 11.5.
- Depende de: ECOL-16, ECOL-02, ECOL-26a. Produção e o critério de homologação com imposto correto dependem de P3 e do certificado.
- Onde: `notas-fiscais.service.ts`, configuração.
- Banco: nota ligada a `pedidoId` sem quebrar `orcamentoId` das notas já existentes. Quantidade faturada por item.
- Regressão: emitir pela oportunidade ganha sem flag continua possível.
- Aceite: parcial não marca o checklist; segunda emissão não ultrapassa o vendido; payload não contém CFOP literal da Ecolume; usuário sem permissão de emitir recebe recusa.
- Testes: quantidades; validação de campo faltante; flag off; tenant. Homologação fica para quando P3 e o token existirem, e ECOL-28 registra se esse passo ficou bloqueado.

### ECOL-25 — Tela Fiscal

- Descrição: notas emitidas (número, série, data, cliente, pedido, valor, status, download), notas de entrada (fornecedor, número, data, valor, itens, conferida ou pendente, importar XML) e pedidos com item ainda não faturado. Permissão da aba.
- PDF: 14.3, 7.4.
- Depende de: ECOL-07, ECOL-24, ECOL-26a.
- Onde: view nova e menu.
- Banco: nenhum.
- Regressão: sem a aba para empresa sem flag.
- Aceite: as três listas batem com os registros da empresa logada.
- Testes: e2e das sub-abas; isolamento.

### ECOL-26 — Épico

Concluído com ECOL-26a e ECOL-26b.

### ECOL-26b — Atribuição e ações restantes

Estado: testada em 28/10/2026.

- Descrição: administrador convida por nome, e-mail e permissões. Desativar mantém histórico. Dá para salvar um conjunto como perfil reutilizável, sem perfil pré-definido além do administrador. Aplica na interface e na API as chaves ainda não exercidas nas telas: abas, alterar preço dentro do limite, ver todos os negócios ou os próprios, converter, cancelar pedido, ajustar estoque, importar XML, emitir e cancelar NF, carta de correção, agenda, exclusão de cliente, de rascunho e de produto sem movimentação. P4 não é preenchida (só o mecanismo).
- PDF: 16.1, 16.2, 6.1.
- Depende de: ECOL-26a e de cada tela cuja ação passa a ser negada. Pode ser entregue em fatias por grupo, desde que nenhuma fatia ligue dado de custo antes de ECOL-26a.
- Onde: `ConfigEquipeView.vue`, guards.
- Banco: perfis nomeados com `empresaId`.
- Regressão: convite e papéis atuais continuam para empresa sem flag.
- Aceite: usuário sem permissão de custos não vê custo em estoque, orçamento, pedido, PDF, fiscal nem visão geral. Excluir produto com movimentação falha.
- Testes: uma requisição negada por chave da seção 16.2; perfil salvo reaplicado a outro usuário da mesma empresa; não vaza para outra empresa.

### ECOL-27 — Épico

Concluído com ECOL-27a e ECOL-27b.

### ECOL-27b — Consulta de auditoria

Estado: testada em 28/10/2026.

- Descrição: tela só de administrador, filtros por usuário, tipo e período. Cobre, no mínimo: conversão, cancelamento de pedido, ajuste de estoque, importação de nota, emissão e cancelamento de NF, pagamento de comissão, alteração de ST e alteração de permissão. Preço/margem em ORC enviado/convertido: fluxo inexistente (NÃO APLICÁVEL).
- PDF: 16.3, 20.
- Depende de: ECOL-27a e das tarefas que geram esses fatos.
- Onde: configurações (`ConfigAuditoriaView`), API `GET /auditoria`.
- Banco: nenhum novo; leitura mesclada operacional + plataforma.
- Regressão: usuário não administrador não acessa.
- Aceite: cada tipo aplicável aparece depois de executar a ação numa empresa de teste.
- Testes: filtro; ausência de linha de outra empresa; cada tipo aplicável; atomicidade ST/comissão.

### ECOL-28 — Aceite da fase 1

- Descrição: executar o roteiro da seção 17 e a lista da seção 20. Inclui regressão sem flag e isolamento. Itens P6 não são pré-requisito. Emissão em homologação só entra se P3 e o emissor estiverem disponíveis; se não estiverem, o relatório de ECOL-28 marca o critério fiscal como bloqueado, não como aprovado.
- PDF: 17, 20.
- Depende de: caminho crítico completo.
- Onde: `apps/web/e2e` e testes de API novos.
- Banco: massa descartável, empresa de teste com flag, outra sem flag.
- Regressão: `fluxo-essencial.spec.ts` e testes de chatbot verdes.
- Aceite: valores do exemplo (R$ 274,56, R$ 259,30, totais R$ 1.917,12 e R$ 1.642,56, comissão R$ 164,26, faturamento do mês) e o restante da seção 20. PDF sem dado interno. Menu da flag sem Conversas, Produtos e Projetos.
- **Estado 28/10/2026:** validada parcialmente — evidências em `ECOL28_VALIDACAO.md`. §17 PASS; E2E ECOL PASS; homologação fiscal bloqueada; 09b/10b/exclusão ORC/PENDENTE nota ainda abertos.
- Testes: o próprio roteiro, mais a suíte antiga.

## Sugestões fora do caminho crítico (P6)

Não agendar até decisão em `PENDENCIAS.md`.

| Item | Seção | Se for aprovado |
|---|---|---|
| Planilha de estoque inicial | 7.6 | Depois de ECOL-06, gerando os mesmos ajustes auditados, nunca atualizando saldo sem movimento |
| Margem global 1,6 | 7.7.4 | Parâmetro em ECOL-02, usado só quando o produto não tem margem, sempre editável na linha |
| Textos livres do PDF | 10.3 | Campos no orçamento e no PDF de ECOL-14, validade inicial 15 dias só se a decisão confirmar o número |
| Ambientes | 10.3 | Grupo opcional na linha, subtotal, sem mudar a baixa |
| DF-e automático | 7.4 | Depende do contrato do emissor; notas entram como pendentes de conferência, no mesmo fluxo de ECOL-07 |

## Alterações em relação ao plano da auditoria

O plano verbal anterior numerava ECOL-01 a ECOL-28 numa sequência só. Esta revisão mantém esses identificadores e corta cinco deles:

- ECOL-04 virou épico. ECOL-04a só adiciona esquema. ECOL-04b só lê divergência. Saldo existente não é reescrito.
- ECOL-09 e ECOL-10 foram partidos. A ficha com totais e o extrato de comissão esperam o pedido, em ECOL-09b e ECOL-10b. O cadastro não fica bloqueado por isso.
- ECOL-26a subiu para imediatamente depois da flag. Custo, faturamento, pagamento e comissão não podem aparecer em ECOL-08, ECOL-13, ECOL-17 ou ECOL-23 antes desse guard. ECOL-26b ficou com a tela de atribuição e o restante das ações, em fatias, ainda antes de ECOL-28.
- ECOL-27a subiu para antes de ajuste, preço, importação, conversão e cancelamento. ECOL-27b é a consulta, no fim, quando os fatos já existem.
- Cada tarefa ganhou critério explícito de empresa sem flag e de teste cruzado de `empresaId`.

A ordem da seção 21 do PDF continua válida como mapa de produto. A ordem de merge passa a ser a deste arquivo.
