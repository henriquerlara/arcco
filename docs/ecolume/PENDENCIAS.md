# Pendências Ecolume

Nenhuma regra abaixo foi escolhida por esta documentação. Onde o PDF manda deixar parâmetro, o plano cria o parâmetro com o único padrão que o próprio PDF escreve. Onde o PDF não escreve padrão, a implementação espera decisão.

## P1 a P6 (seção 18)

### P1 — Base de cálculo da RT

O PDF não decide se a RT incide sobre o valor bruto do pedido ou sobre o valor depois das taxas da forma de pagamento. Se for líquido, também não define a taxa por forma.

Impacto: cálculo da comissão (9.2 e 9.3). Linhas de pagamento da fase 1 não ganham campo de taxa. Taxas de maquininha estão na seção 19 e ficam fora.

Preparação permitida: parâmetro de base, com o padrão escrito na seção 16.4, “valor total do pedido”. Nenhum outro modo é calculado até a reunião.

Bloqueia regra nova de comissão. A ECOL-17 lança a comissão sobre o total do pedido (`baseOrigem: TOTAL_PEDIDO`), com `rtNegocio` persistida; ECOL-02 expõe o parâmetro fixado em TOTAL_PEDIDO e não habilita líquido até a P1.

### P2 — Momento e forma de pagamento da RT

O PDF não decide se a RT é paga no fechamento, após o cliente quitar, em lote mensal, por Pix ou contra nota do parceiro.

Impacto: controle de comissões (9.3). O sistema registra A pagar, Paga (data e forma informadas por quem marca) e Cancelada. Não libera nem bloqueia pagamento por calendário.

Não bloqueia o desenvolvimento do registro.

### P3 — Regime tributário e regras da NF-e

Faltam regime da Ecolume, CFOP, CSOSN/CST, tratamento de item com ST e textos complementares. O PDF manda definir com o contador e guardar em parâmetro, não no código.

Impacto: emissão real (14.2) e parâmetros (16.4).

Bloqueia ECOL-24 em **homologação/produção** e o critério de aceite de NF-e com regra fiscal verdadeira. A estrutura, validação cadastral, mock e UI do pedido (ECOL-24) já existem; emissão real exige parâmetros em `Empresa.configuracoes` + token/certificado. O CFOP `5102` fixo no fluxo legado (`notas-fiscais.service.ts`) **não** é parâmetro da Ecolume.

### P4 — Permissões por funcionário

Quem usará o sistema e o que cada pessoa pode ver ainda não foi definido.

Impacto: configuração (16.1). O PDF diz que isso não bloqueia o desenvolvimento. ECOL-26 entrega o mecanismo. A matriz por pessoa fica vazia até a Ecolume preencher. Administrador continua com acesso total, como a seção 16.1 já fixa.

### P5 — Conversão de unidades

Compra em rolo ou caixa e venda em metro ou unidade não tem fator definido.

Impacto: cadastro (7.3), XML (7.4) e baixa (7.8).

Preparação permitida: unidade da nota como unidade do produto; campo de fator opcional, vazio, sem participar de cálculo. Não bloqueia a fase 1 nesse formato. Bloqueia qualquer conversão automática.

### P6 — Validar sugestões

O PDF lista como sugestão, ainda não validada item a item:

- validade padrão do orçamento (15 dias) e demais textos livres do PDF (10.3);
- margem padrão global 1,6 (7.7.4);
- agrupamento de itens por ambiente (10.3);
- importação de estoque inicial por planilha (7.6);
- busca automática de NF-e contra o CNPJ (7.4).

O PDF diz para implementar como sugerido, salvo decisão contrária da equipe. Essa decisão não foi registrada. Essas entregas ficam fora do caminho crítico de ECOL-01 a ECOL-28 até a equipe confirmar. Não entram no roteiro obrigatório da seção 20.

## Ambiguidades que não são P1–P6

### Sequência “única em todo o sistema”

A seção 5.2 pede número sequencial único no sistema para negócio, orçamento e pedido. A plataforma isola dados por `empresaId` no mesmo banco, e o desenho prevê banco por empresa no futuro.

Sequência global entre empresas revela volume de um cliente a outro e acopla os tenants. A implementação não criará contador global. A unicidade será por `empresaId`. Falta a Ecolume ou o autor do documento confirmarem se aceitam esse recorte. Enquanto isso, ECOL-12, ECOL-11 e ECOL-16 usam sequência por empresa e não cruzam dados.

### Limite de desconto sem permissão de custos

A seção 16.2 diz que quem não vê custos só altera o preço dentro de um percentual máximo configurado. O PDF não informa o percentual nem o que fazer se o parâmetro estiver vazio.

ECOL-02 entrega `descontoMaximoPercentual` (null = bloqueado). Com `VER_CUSTOS`, o preço continua editável. Sem essa permissão e sem percentual, preço/desconto ficam indisponíveis (`PRECO_ALTERACAO_INDISPONIVEL` / `DESCONTO_ALTERACAO_INDISPONIVEL`). Com percentual, linhas + desconto geral são validados contra o teto efetivo.

### Custo médio 4 casas vs exemplo 10.4

O exemplo oficial usa base 113,33 → R$ 259,30. O custo médio interno (ECOL-05) guarda 4 casas (ex.: 113,3333), o que após a mesma fórmula arredonda a R$ 259,31. A UI permite escolher a base; não há arredondamento antecipado automático para 2 casas no custo persistido.

### Certificado A1

A seção 16.4 pede arquivo, senha e validade. **Decisão ECOL-28b:** o A1 é configurado **na conta Focus NFe** (painel da Focus), não em cofre do ARCCO. O produto usa só `FOCUS_NFE_TOKEN` no ambiente do servidor; não há upload de .pfx, senha em JSON/banco ou cofre local. `GET /fiscal/status-homologacao` e a tela Configurações → Nota fiscal informam isso (`certificado.provedorFocus: true`, `armazenamentoLocal: false`).

A senha nunca vai para `Empresa.configuracoes`, log ou repositório. Emissão real continua bloqueada até P3 + token + certificado válido na Focus. Não bloqueia ECOL-01.

### “Remover” WhatsApp, Projetos e Produtos

O verbo do PDF é remover. O repositório atende outros clientes e o ramo saúde com essas funções. A decisão de arquitetura, já na auditoria aprovada, é ocultar por empresa e não apagar código, rota global nem tabela. Histórico já gravado permanece. Webhook e chatbot globais não são desligados. Para a empresa com a flag, a interface e o envio de orçamento pelo WhatsApp deixam de ser oferecidos.

Na validação da ECOL-01 o processo da API ainda mapeou `ConversasController` e `POST /api/webhooks/meta/whatsapp`. Nada disso foi desligado. Se a leitura literal da seção 6.2 exigir bloquear esses endpoints só para a empresa com a flag, isso continua pendente de autorização. O código é compartilhado com as outras empresas.

### Permissões finas de Agenda (ECOL-26b)

Entregue: `ESCOPO_AGENDA_TODAS` / `PROPRIAS` / `ENTREGAS` na resolução efetiva; lista, calendário, sininho e alertas do dashboard filtram no backend. `todas=1` só amplia com escopo TODAS.

### Motivos de perda editáveis (ECOL-02)

Entregue: lista padrão §12.2 editável em `configuracoes.motivosPerda` + UI Parâmetros. Históricos de negócios perdidos preservam código/texto já gravados.

### Prazo de follow-up de orçamento (ECOL-02)

ECOL-21 lê `diasOrcamentoSemMovimentacao` (padrão 7); UI/API na ECOL-02.

### Agregador “Precisa da sua atenção” (ECOL-23)

Implementado no Dashboard ECOLUME (`alertas` em `/dashboard/metricas`). O sininho continua em `GET /atividades/resumo-agenda`. Prazos editáveis na ECOL-02. Alertas de agenda respeitam escopo ECOL-26b.

### Chaves de ação da seção 16.2

A ECOL-26a+26b cobrem o catálogo §16.2 (custo/financeiro, ações, abas, agenda, negócios próprios, exclusões, `ALTERAR_PRECO` + limite ECOL-02). P4 = a Ecolume ainda precisa atribuir chaves reais aos funcionários (mecanismo pronto, sem inventar cargos).

### ECOL-04a e o que ela não fecha

A migração aditiva está aplicada. Os produtos que já existiam continuam com `codigoInterno` nulo até uma geração explícita naquela empresa com a flag. A geração não foi executada na empresa de demonstração. A entidade Fornecedor e o vínculo opcional `fornecedorId` existem desde a ECOL-03; `codigoFornecedor` textual permanece e produtos antigos ficam sem FK até associação explícita. IPI, margem e fator de conversão continuam sem fórmula de produto. A ECOL-05 calcula custo médio e último preço só em entradas novas com preço; não há backfill. Ajuste com custo unitário fica na ECOL-06. Duas criações simultâneas na mesma empresa podem disputar o mesmo `CI-######` e a transação que perder o índice único é desfeita. As colunas `custoMedio`, `ultimoPreco` e `precoUnitarioCusto` são `DECIMAL(18,4)` desde `20261020200000_produto_custo_decimal`. Recálculo de preço sugerido ao mudar ST% permanece na ECOL-08/13.

### ECOL-05 — saldo positivo com custo médio nulo (decidido)

Decisão: opção 3. Na empresa ECOLUME, se `estoqueAtual > 0` e `custoMedio` é nulo, a entrada com `precoUnitarioCusto` exige `custoReferenciaSaldo`. A média vira `(saldo × referência + qtd × preço) / (saldo + qtd)`. Sem a referência, a API responde `CUSTO_REFERENCIA_OBRIGATORIO` e não grava. Entrada sem custo continua só no saldo. Sem backfill. Campo protegido pela ECOL-26a.

### Saldo gravado e soma das movimentações

A ECOL-04b compara `estoqueAtual` com o saldo derivado das movimentações e não corrige. Nos três produtos do seed locais (`SPOT-01`, `FITA-5M`, `PERF-AL`) a diferença foi 0. Correção continua sendo ajuste manual na ECOL-06. A tela nova da Ecolume ainda mostra a coluna enquanto houver divergência não reconhecida.

### Emissão atual presa à etapa GANHA

Hoje a NF sai do orçamento com a oportunidade em `GANHA`. A spec emite a partir do pedido, total ou parcial. Os dois fluxos precisam coexistir: o atual para empresa sem flag; o novo só com a flag. Não há decisão de produto para migrar notas já emitidas.

## O que não é pendência

Estes pontos já estão escritos no PDF e não precisam de reunião para a fase 1:

- Fórmula da seção 10.4 e o exemplo numérico.
- Modelos de pagamento da seção 11.4.
- Colunas do funil da seção 12.1 e motivos iniciais da seção 12.2, com a lista editável depois.
- Prazos iniciais de 7 dias (orçamento parado e pendência de pedido) e RT padrão de 10% para novo parceiro (seção 16.4).
- Base inicial da RT igual ao valor total do pedido, até a P1 mudar o parâmetro.
- Administrador com acesso total (16.1).

## Decisões registradas na ECOL-01

Não são regras de negócio novas. São recortes para não antecipar tarefas nem aparentar tela pronta.

- A personalização liga somente com `configuracoes.personalizacaoComercial = "ECOLUME"` na empresa. Segmento iluminação não liga a flag. O valor padrão, e qualquer valor ausente ou inválido, é `PADRAO`.
- Não há tela nem endpoint para o cliente gravar essa chave. `PATCH /api/empresa` não recebe configurações. `PATCH /api/empresa/onboarding` preserva o valor já armazenado daquela empresa e não aceita troca vinda do corpo da requisição.
- A flag é lida do banco da plataforma na sessão (`GET /api/autenticacao/eu`). O roteador só aplica o menu e o bloqueio de rota depois de `carregarSessao()`. Conta com `ramo` Saúde não entra nesse ramo do guard.
- A flag não é identificador de empresa. Acesso a dados continua pelo `empresaId` da sessão.
- Fiscal e Parceiros: Fiscal e Parceiros (ECOL-10a) estão no menu ECOLUME. Ordem: Visão geral, Negócios, Agenda, Clientes, Parceiros, Estoque, Fornecedores, Fiscal, Configurações.
- RT padrão de novos parceiros: ECOL-02 (`rtPadraoParceiro`, default 10%); parceiros/negócios antigos não são recalculados.
- Clientes e Parceiros compartilham `Contato` (ECOL-09a/10a). Totais de pedidos, extrato de comissões e arquivos na ficha ficam na ECOL-09b/10b.
- Conversas, Produtos, Projetos, WhatsApp e Automação saem da navegação e a URL direta dessas rotas volta para a visão geral. Os módulos e as APIs continuam no código. Webhook e chatbot não foram desligados.
- Estoque e Configurações continuam restritos aos mesmos perfis de hoje (`VENDEDOR` vê estoque; só `PROPRIETARIO` e `GESTOR` veem configurações). Isso não é a matriz da ECOL-26a.

## Validação da ECOL-26a

Conferida em 15/10/2026 com a API reiniciada em `http://127.0.0.1:3001` e o spec `permissoes.http.spec.ts` (9 testes, `ECOL_HTTP=1`). O banco foi o de teste local (`platform_db` e `db_empresa_arcco`). Duas empresas descartáveis foram criadas e removidas ao final. Nenhuma conta de demonstração teve permissão alterada.

- Proprietário da empresa com flag vê pipeline 1500, ticket médio e valor do funil. Gestor, vendedor e atendente sem concessão recebem a contagem do negócio e não recebem esses campos. O texto da resposta não contém `1500`.
- Vendedor com só `VER_CUSTOS` não recebe o faturamento do painel.
- Vendedor da empresa sem flag continua recebendo `valorPipeline`, `ticketMedioGanho` e `valorGanhoNoPeriodo`. `POST` de produto com `custoMedio` nessa empresa responde 201; o Zod descarta a chave desconhecida e a resposta não a devolve.
- Produto de outra empresa responde 404. O corpo não contém o nome do produto nem o valor do negócio.
- `POST` com `custoMedio` na empresa com flag, sem a chave, responde exatamente `{ erro: { codigo: "SEM_PERMISSAO", mensagem: "Voce nao tem permissao para esta acao" } }`. O valor enviado e `stack` não aparecem. `orderBy=custoMedio` e `margem=10` também são 403 só com a flag.
- Orçamento aninhado no detalhe do negócio conserva preço unitário 40 e total da linha 80. A resposta não ganha `custoMedio` nem `margem`.
- `POST /api/autenticacao/entrar` devolve `permissoesComerciais` calculada no servidor: catálogo para o proprietário, lista vazia para os outros perfis sem concessão, só `VER_CUSTOS` para quem recebeu essa chave, `null` sem a flag. O Nest responde 201 nesse POST, que já era o status padrão da rota.

A rede de segurança ficou no `PermissaoFinanceiraInterceptor`: resolve o contexto uma vez, recusa corpo e consulta restritos e publica toda resposta JSON autenticada. O modo legado devolve o valor intacto. `Date`, `Uint8Array`, `Buffer` e objeto com protótipo próprio não são percorridos, para não reescrever arquivo. O controller continua chamando `filtrar` de forma explícita.

Risco residual, sem cobertura automática completa:

- O bytes do PDF e o download de arquivo não são reabertos. O JSON que gera o PDF de orçamento passa pelo filtro e o desenho do PDF só usa preço comercial.
- Produto ainda não tem coluna de custo. A omissão de `custoMedio` em dado gravado está no teste unitário; no HTTP ela está no 403 do corpo e na ausência do campo na listagem.
- Resposta que não seja objeto simples autenticado não é varrida. Um endpoint novo que devolva classe ou binário com campo sensível no interior precisa do `filtrar` explícito.
- Chaves de ação sensíveis (estoque, XML, NF, pedido, exclusões, preço) estão gateadas na API ECOLUME; legado permanece aberto pelos perfis Nest. P4 = atribuir chaves reais aos usuários (sem inventar cargos).
- ECOL-26b: `ConjuntoPermissao` + atribuição HTTP/UI; `conjuntoId` nas concessões é metadado do último template aplicado.

## Validação da ECOL-27a

Conferida em 15/10/2026 com `auditoria.integracao.spec.ts` (`ECOL_AUDIT=1`) em `db_empresa_arcco` e `platform_db`. Empresas descartáveis foram criadas e apagadas ao final. Nenhuma conta de demonstração foi alterada. Uma concessão gravada antes de derrubar a API continuou legível depois que o processo subiu de novo.

- Preço, entrada e ajuste gravam empresa, usuário, tipo, entidade e os valores anterior e posterior.
- Transação que recebe tipo desconhecido volta o saldo e não deixa log com o valor interrompido.
- A operação concluída permanece com o log.
- A empresa sem flag não recebe linha. A consulta pelo `empresaId` da outra empresa não devolve o log da primeira.
- `alterar` e `excluir` no serviço recusam qualquer chamador. Não há controller.
- Payload com senha, hash, token e certificado é persistido sem esses valores.
- Saída de estoque, emissão, cancelamento de nota e concessão de permissão geram os tipos correspondentes.

Limitações: o papel do banco ainda consegue `UPDATE` direto na tabela; a aplicação não oferece esse caminho. O download de XML/PDF da nota de saída ocorre antes da transação do status. A ECOL-07 grava `IMPORTACAO_XML` e guarda o XML de compra no storage. Conversão (ECOL-17) e cancelamento com estorno (ECOL-18) estão implementados. Cancelamento **não** reembolsa pagamentos recebidos nem estorna comissão já paga no banco — só alerta para tratamento manual (sem procedimento automático no PDF). Parâmetro comercial na ECOL-02. DF-e automático e conversão de unidades (P5) fora do escopo.

## Validação da ECOL-27b

Conferida em 28/10/2026. Consulta mescla `db_empresa_arcco` e `platform_db` sem TX distribuída. Pagamento de comissão e ST% de fornecedor passam a gravar log. Alteração de preço/margem em ORC enviado/convertido permanece inexistente (travada em rascunho). Exclusão de ORC rascunho e CC-e continuam fora do escopo (ECOL-26b).

## Validação da ECOL-28

Conferida em 28/10/2026. Detalhe e matriz: `ECOL28_VALIDACAO.md`.

## Validação da ECOL-28a

Conferida em 28/10/2026. Quatro lacunas de produto fechadas e testadas:

- ECOL-09b — ficha do cliente (§8.4): resumo, histórico NEG/ORC/PED, anexos, atalho parceiro.
- ECOL-10b — lista/extrato/visão de comissões (§9.4); snapshots ECOL-17; `VER_COMISSOES`.
- Exclusão ORC rascunho — `EXCLUIR_ORCAMENTO_RASCUNHO` + auditoria `EXCLUSAO_ORCAMENTO`.
- Nota de entrada `PENDENTE` / `CONFERIDA` — sem estoque até confirmação definitiva.

Pendências **ainda abertas** (não bloqueiam ECOL-28a):

- Homologação NF-e real (P3 + Focus + certificado) — **HOMOLOGAÇÃO FISCAL PENDENTE** / ECOL-28b.
- CC-e — implementada na ECOL-28b (mock sem token; ver abaixo).
- Envio DANFE/XML por e-mail — **§14.2 item 7** (não §19); implementado na ECOL-28b via Focus (mock sem token).
- P1–P5 e sugestões P6 — sem inventar regra.

## Validação da ECOL-28b

Conferida em 28/10/2026. **`ECOL-28b IMPLEMENTADA E TESTADA COM MOCK — HOMOLOGAÇÃO PENDENTE`**. Detalhe: `ECOL28_VALIDACAO.md` §10.

## ECOL-HOMOLOG (28/10/2026)

**`HOMOLOGAÇÃO FISCAL BLOQUEADA`**. Não houve transmissão Focus/Sefaz.

Bloqueios objetivos:

1. `FOCUS_NFE_TOKEN` ausente no ambiente.
2. `FOCUS_NFE_ENV` unset (default código = homologação; produção não ligada).
3. P3 vazia em todas as empresas locais (regime/CFOP/natureza/CSOSN|CST).
4. Aceite formal Ecolume do modelo A1-na-Focus **não** encontrado no repositório.

Diagnóstico sem valores: `apps/api/scripts/_check-p3-homolog.ts`. Detalhe: `ECOL28_VALIDACAO.md` §11.

**Recomendação:** não liberar implantação fiscal real até P3 + token homologação + A1 Focus + aceite A1 + roteiro homologado com protocolos.

Entregue (mock Focus): CC-e (`POST /notas-fiscais/:id/carta-correcao`, `CARTA_CORRECAO`, 15–1000 caracteres, máx. 20 autorizadas por NF-e), envio de DANFE/XML por e-mail (`POST /notas-fiscais/:id/enviar-email`, `EMITIR_NF`, evento `AGENDADO`), `informacoes_adicionais_contribuinte` no payload só a partir de `informacoesComplementaresNfe` (com `tratamentoSt` anexado como texto do contador), `GET /fiscal/status-homologacao`, tabela `eventos_nota_fiscal`.

**O contador/responsável fiscal precisa preencher (nada disso é inventado pelo ARCCO):**

- Regime tributário, CFOP padrão, natureza da operação e CSOSN **ou** CST (`parametrosFiscaisCompletos`).
- Tratamento de item com ST (`tratamentoSt`, texto) e informações complementares da NF-e (`informacoesComplementaresNfe`, texto) — opcionais para liberar a emissão, mas só vão para a NF se preenchidos.
- Quem for ao ar: `FOCUS_NFE_TOKEN` (segredo do servidor) e `FOCUS_NFE_ENV`; certificado A1 **no painel da Focus**.

Continua pendente: homologação real (token + P3 + Sefaz). Sem token, CC-e e e-mail são simulados (`mock: true`) e **não** valem na Sefaz nem enviam e-mail. Produção nunca é habilitada automaticamente.

Infra: `nest build` no Windows falha com EPERM se `node dist/main.js` estiver ativo (DLL Prisma); usar `tsc --noEmit` ou parar o processo. Playwright: `workers=1`.

### ECOL-18 — sem reembolso automático

A especificação (§11.5) não define reembolso, conciliação bancária nem devolução automática de valores RECEBIDOS. O cancelamento preserva as linhas de pagamento e exibe alerta informativo. Comissão já `PAGA` vira `CANCELADA` com evidências (`pagoEm`/`formaPagamento`) e sinalização de tratamento financeiro manual.

A concessão e o seu log passaram a compartilhar a transação de `platform_db` (migração `20261015200000_logs_auditoria_plataforma`). A compensação entre bancos foi retirada. Sem a flag, a chave continua sendo gravada e o log não.

## Validação da ECOL-01

Conferida em 15/10/2026 com API em `127.0.0.1:3001` e Vite em `localhost:5174`.

- Suíte da API: 67 testes, 10 arquivos, todos verdes.
- Quatro cenários de `e2e/personalizacao-menu.spec.ts` passaram com login real: empresa sem flag, empresa com `ECOLUME`, redirecionamento das rotas ocultas, `/app/clientes`, `/app/contatos` e duas sessões sem misturar o menu.
- A empresa de concreto, criada pelo seed só para ter o segundo tenant, voltou a `PADRAO` ao final. Iluminação e Clínica Aurora ficaram sem a chave.
- `fluxo-essencial.spec.ts` passou no login, no menu antigo e na criação de contato. O teste que espera o funil vazio encontrou o negócio do seed e permanece vermelho. A asserção não foi alterada.
