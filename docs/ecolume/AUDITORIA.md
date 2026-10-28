# Auditoria ARCCO × Ecolume

Versão da especificação: `Especificacao_ARCCO_Ecolume_v1.pdf` (v1.0, 06/10/2026).

Esta auditoria foi aprovada como base de planejamento. Ela registra o que o código faz hoje. O plano de execução revisado, com dependências ajustadas, está em `PLANO_IMPLEMENTACAO.md`. Nada desta auditoria autoriza implementação.

Classificação:

- **JÁ IMPLEMENTADO:** atende o requisito integralmente.
- **PARCIALMENTE IMPLEMENTADO:** existe base no código e precisa de ajuste.
- **NÃO IMPLEMENTADO:** precisa ser criado.
- **INCOMPATÍVEL:** a implementação atual contradiz o documento.
- **PENDENTE:** depende de decisão externa (seção 18). Não foi preenchida com regra inventada.

Sugestões do PDF (marcação `[SUGESTÃO]`) não foram tratadas como obrigatórias. A seção 19 não entra na fase 1.

## Arquitetura encontrada no código

Monorepo com três partes:

- Frontend Vue em `apps/web`.
- API NestJS em `apps/api`.
- Contratos Zod em `packages/contratos`.

Três bancos:

| Banco | Schema | O que guarda |
|---|---|---|
| Plataforma | `apps/api/prisma/platform/schema.prisma` | `Empresa`, `Usuario`. `ramo` (`CONSTRUCAO` ou `SAUDE`), `segmento` (inclui `ILUMINACAO`), JSON `configuracoes`. |
| Operacional da construção | `apps/api/prisma/schema.prisma` | Contatos, obras, funil, orçamentos, produtos, estoque, WhatsApp, NF-e. Toda linha operacional tem `empresaId`. |
| Saúde | `apps/api/prisma/saude/` | Produto separado, casca `/saude`. Fora desta personalização. |

Isolamento atual: filtro por `empresaId` no mesmo banco operacional. `apps/api/src/database/banco-empresa.ts` fixa `BANCO_EMPRESA_UNICO` (`db_empresa_arcco`). O schema da plataforma já tem `databaseName` por empresa, mas o runtime não usa um banco por cliente. O teste `apps/api/src/modules/contatos/multi-tenant.spec.ts` cobre esse filtro só em contatos.

Autorização: perfis fixos `PROPRIETARIO`, `GESTOR`, `VENDEDOR`, `ATENDENTE` (`packages/contratos/src/enums/index.ts`). Não há permissão ligável por aba ou por ação. Menu em `apps/web/src/components/layout/BarraLateral.vue`.

Correspondência entre a especificação e o código:

| Conceito da spec | No código |
|---|---|
| Negócio | `Oportunidade`, código `OP-0001` |
| Orçamento | `Orcamento`, número `ORC-0001-v1`, campo `versao` |
| Pedido | Não existe. Fechamento é a etapa `Fechado` (`GANHA`) |
| Produto | `Produto` com `precoVenda` digitado e `estoqueAtual` gravado |
| Estoque | `MovimentacaoEstoque` (`ENTRADA`, `BAIXA`, `AJUSTE`) e saldo também no produto |
| NF-e de saída | `NotaFiscal` ligada ao orçamento, Focus NFe, CFOP `5102` fixo |
| Parceiro, fornecedor, comissão, checklist, pedido, nota de entrada | Não existem |

O chatbot em `apps/api/src/modules/chatbot/mensagens-ecolume.ts` já fala em nome da Ecolume. Isso é o fluxo de WhatsApp atual, o contrário do que a seção 6.2 pede para a implantação.

## Preservação da plataforma

A especificação manda remover Conversas, WhatsApp, Projetos e a aba Produtos. No código isso é o produto compartilhado de construção: iluminação, concreto e os demais segmentos usam o mesmo funil, o mesmo menu e o mesmo banco. Saúde é outro ramo e não deve ser alterada.

Remoções da Ecolume são visibilidade por empresa, não exclusão de código. O gancho existente é `Empresa.configuracoes`, com `segmento` e `ramo`. Tabelas novas (fornecedor, pedido, comissão, nota de entrada) ficam no banco operacional, sempre com `empresaId`. WhatsApp, obras, chatbot e a emissão atual continuam para quem não tiver o módulo ligado.

Recurso reutilizável da plataforma: fornecedor, custo, XML de entrada, pedido, pagamento, comissão, permissões granulares e auditoria. Exclusivo da configuração Ecolume: menu enxuto, rótulo Clientes, funil pré/pós-venda, parâmetros iniciais da seção 16.4 e a decisão de não operar WhatsApp dentro do sistema.

## Seções 1 a 3

Contexto, convenções e princípios. Não são telas. Os princípios da seção 3 passam a ser restrição de implementação no plano: o sistema sugere e o usuário decide; preço editado no orçamento não altera o cadastro; código interno é a identidade; revisão não sobrescreve o enviado; falta de saldo ou de pagamento alerta e não bloqueia; a emissão de NF é a exceção que exige dado fiscal.

## 4. Resumo por tela

Coberto pelas seções 6 a 16. Nenhuma linha do quadro está integralmente atendida para a Ecolume.

## 5. Modelo de dados — NÃO IMPLEMENTADO

Evidência: `apps/api/prisma/schema.prisma`.

Não há `Pedido`, `Pagamento`, `Checklist` nem `Comissão` de parceiro. `Fornecedor`, `NotaEntrada` e `LogAuditoria` passaram a existir nas ECOL-03/07/27a. `Contato` ganhou `natureza` PF/PJ, endereço, IE, pessoas da PJ e `ehParceiro` na ECOL-09a (nulos no legado). `Oportunidade` aponta para no máximo uma `Obra` e vários `Orcamento`. `converterOrcamentoFinal` em `apps/api/src/modules/orcamentos/orcamentos.service.ts` converte um único orçamento. `MovimentacaoEstoque` existe, e `Produto.estoqueAtual` é atualizado na mesma operação em `apps/api/src/modules/produtos/produtos.service.ts` (`entrada`, `ajuste`, `baixarPorOrcamento`).

**INCOMPATÍVEL:** numeração `OP-0001` em `proximoCodigo` (`apps/api/src/modules/oportunidades/oportunidades.service.ts`) contra `NEG-0001`. Orçamento `ORC-{n}-v{versao}` contra número único `ORC-0001` sem sufixo de versão.

A frase “único em todo o sistema” (seção 5.2) conflita com o isolamento por empresa. Registrado em `PENDENCIAS.md`. Não vira sequência global.

## 6. Menu e remoções — INCOMPATÍVEL com o que a Ecolume pede

`BarraLateral.vue` mostra: Visão geral, Conversas, Negócios, Agenda, Produtos, Estoque, Pessoas, Projetos, Configurações. Rotas em `apps/web/src/router/index.ts`: `/app/conversas`, `/app/produtos`, `/app/contatos` (título Pessoas), `/app/obras` (título Projetos). Não há `/app/parceiros` nem `/app/fiscal`. Configurações incluem chatbot e WhatsApp.

O código de WhatsApp, obras e produtos permanece para os outros clientes. O menu da seção 6.1, para a Ecolume, está **não implementado**. A renomeação Pessoas → Clientes (6.5) também não existe.

## 7. Estoque — PARCIALMENTE IMPLEMENTADO

Já existe, em `Produto`, `MovimentacaoEstoque`, `produtos.service.ts` e `apps/web/src/modules/estoque/EstoqueView.vue`:

- SKU, nome, unidade, NCM, saldo, mínimo, `controlaEstoque`, ativo.
- Entrada e ajuste com movimentação e usuário.
- Baixa na conversão do orçamento. O cálculo não impede saldo negativo (`saldoApos = estoqueAtual - quantidade`).
- Lista com produto, saldo, mínimo e status.

Não existe: fornecedor e ST%, nome fiscal separado da descrição comercial, código do fornecedor, EAN, CEST, origem, IPI, margem, último preço, custo médio, sub-abas, lista de compra, importação de XML, status “A comprar” e “Sob encomenda”, preço sugerido calculado. Ajuste pede saldo contado, sem os motivos da seção 7.9. Entrada não grava custo.

A baixa negativa é efeito do cálculo, sem status nem lista de compra. Não atende 7.8.

`[SUGESTÃO]` da 7.6 (planilha) e o parágrafo de distribuição DF-e na 7.4 não estão no código e não são obrigatórios até decisão da P6.

## 8. Clientes — PARCIALMENTE IMPLEMENTADO

`Contato` tem nome, telefone único por empresa, e-mail, documento livre, origem, observações e responsável. Lista e ficha existem (`apps/web/src/modules/contatos/`).

**RESOLVIDO (ECOL-09a):** `TipoContato` permanece no legado; com flag ECOLUME o cadastro usa `natureza` PF/PJ e etiqueta `ehParceiro` (preenchimento completo na ECOL-10a).

Não há CPF e CNPJ validados em separado, inscrição estadual, endereço com ViaCEP, vários telefones, pessoas da PJ, “chegou por”, totais de compra nem anexos reunidos na ficha (8.4). Duplicidade só impede o mesmo telefone normalizado. Não há aviso de CPF/CNPJ. Não há integração ViaCEP no frontend (só máscara de CEP).

## 9. Parceiros — NÃO IMPLEMENTADO

ECOL-10a: `Contato` tem `ehParceiro`, `tipoParceiro`, `rtPadrao` e dados de pagamento; rota `/app/parceiros`. Comissão/extrato (ECOL-10b) e cálculo por pedido ainda não existem. `TipoContato` legado permanece fora da flag.
ECOL-11: `Oportunidade` com `origemNegocio`, `parceiroId`, `rtNegocio`, endereço da obra e códigos `NEG-`; anexos em `Arquivo`. Sem ORC/PED nesta etapa.

## 10. Negócios e orçamentos — PARCIALMENTE IMPLEMENTADO

Já existe:

- Negócio com cliente, responsável e prioridade.
- Anexo via `Arquivo` (`entidade`, `entidadeId`, `enviadoPorId`, `criadoEm`).
- Orçamento em rascunho editável. `atualizar` recusa status diferente de `RASCUNHO`.
- Item com `produtoId` opcional.
- Desconto geral, PDF com logo e dados da empresa, marcação de enviado.

**INCOMPATÍVEL:**

- *(ECOL-16/17)* N pedidos por negócio a partir de orçamentos distintos; 1:1 orçamento↔pedido.
- `montarItens` grava `produto.nome` na linha. A descrição comercial editada não sobrevive.
- ~~O PDF imprime o SKU~~ **Resolvido na ECOL-14 (flag):** PDF comercial sem SKU/custo/IPI/ST/margem; legado sem flag ainda pode imprimir SKU.
- `prepararEnvio` (legado) ainda pode preencher `aceitoEm` e devolver dados para WhatsApp. Na flag, a marcação de enviado é só status/data (ECOL-12/14); o envio do PDF é manual (baixar/compartilhar).
- Não há fórmula `custo × (1+IPI%) × (1+ST%) × margem`, escolha de base de custo, margem efetiva, “baseado em” nem busca por NEG, ORC, PED e parceiro (10.7).
- Endereço da obra está em `Obra`, não no negócio (6.3 e 10.2).

`[SUGESTÃO]` ainda ausente: validade, prazo e condições no PDF; agrupamento por ambiente; indicador interno de margem. Dependem da P6.

## 11. Pedidos — NÃO IMPLEMENTADO

*(Atualização ECOL-17, 27/10/2026)* Pedido, assistente de conversão, 6 modelos de pagamento, checklist, lista de separação/compra e comissão na conversão existem na flag. Cancelamento com estorno continua na ECOL-18. Sem a flag, o caminho legado segue: card a `Fechado` e baixa pelo orçamento. `cancelarVigenteNoPerdido` muda o orçamento para `CANCELADO` e não estorna saldo.

A base da RT (P1) e o momento do pagamento da RT (P2) continuam pendentes. O plano deixa parâmetro e registro, sem regra extra.

## 12. Funil — PARCIALMENTE IMPLEMENTADO

Kanban com arrastar, prioridade e responsável em `apps/web/src/modules/pipeline/PipelineView.vue`. Etapas padrão em `apps/api/src/modules/empresas/templates-segmento.ts`: Novo contato, Orçamento, Negociação, Fechado, Perdido.

**INCOMPATÍVEL** com a seção 12.1, que remove Negociação e Fechado e cria colunas de pedido, com card de negócio e card de pedido ao mesmo tempo. `motivoPerda` é texto livre, sem lista editável (12.2). Histórico de etapa existe (`HistoricoEtapaOportunidade`). Prioridade no card é `[MANTER]` e já existe.

## 13. Agenda — PARCIALMENTE IMPLEMENTADO

`Atividade` tem título, vencimento, responsável, vínculo com negócio, contato ou obra, e conclusão. Tipos atuais: ligação, mensagem, reunião, enviar orçamento, revisar orçamento, follow-up, tarefa. Não há entrega, visita, calendário, período manhã/tarde, endereço de entrega nem sininho.

Follow-up automático em `apps/api/src/modules/dashboard/dashboard.service.ts`: negócio aberto sem atualização há 7 dias, título `Negócio parado OP-…`, sem duplicar pendência do mesmo tipo. A seção 13.3 muda o gatilho para orçamento enviado sem movimentação, prazo configurável, e pede o resultado no histórico do negócio.

Notificação externa (push e e-mail) está na seção 19 e fica fora.

## 14. Fiscal — PARCIALMENTE IMPLEMENTADO

Saída: `apps/api/src/modules/fiscal/notas-fiscais.service.ts` emite a partir do orçamento convertido com a oportunidade em etapa `GANHA`. Envia à Focus NFe, ou usa mock sem `FOCUS_NFE_TOKEN`. Grava número, série, chave e arquivos quando a Focus devolve. Status do enum: rascunho, processando, autorizada, rejeitada, cancelada.

Não existe tela Fiscal, nota de entrada, XML de compra, emissão parcial, descrição editável na nota, certificado A1 na aplicação, carta de correção nem controle de quantidade já faturada. CFOP `5102` está fixo no serviço. Cancelamento de NF autorizada não está ligado a pedido.

P3 (regime, CFOP, CSOSN/CST, ST e textos) bloqueia emissão real. O CFOP atual não pode ser copiado como regra da Ecolume.

## 15. Visão geral — PARCIALMENTE IMPLEMENTADO

`apps/web/src/modules/dashboard/DashboardView.vue` tem saudação, período, ticket médio e gráfico por etapa. Também tem o que a seção 15.2 remove na Ecolume: card de configurar conta, conversas ativas, pessoas novas e rodapé. Os cálculos usam oportunidades ganhas ou perdidas e conversas, não pedidos nem comissão. Não há ranking de parceiros, itens a comprar, orçamento parado nem entregas de hoje e amanhã. O período padrão é janela em dias (o serviço usa 30 se não houver intervalo), não “este mês”.

Indicadores financeiros para quem não tem permissão (15.7) não existem, porque não há essa permissão.

## 16. Configurações — PARCIALMENTE IMPLEMENTADO

Já existe: dados da empresa, CNPJ, IE, endereço fiscal, logo, equipe com perfil fixo, usuário `ativo`. Não existe permissão por aba ou ação, perfil reutilizável além dos quatro papéis, limite de desconto, certificado A1, parâmetros da seção 16.4 nem consulta de auditoria. `EventoOportunidade` registra fatos do negócio, não a lista da seção 16.3.

P4 não bloqueia construir o mecanismo. Não define a matriz por pessoa.

## 17 e 20

O roteiro da seção 17 foi executado na ECOL-28 (`ecolume.roteiro17.integracao.spec.ts`, PASS). Os critérios da seção 20 foram auditados em `ECOL28_VALIDACAO.md`: validação parcial — faltam ECOL-09b, ECOL-10b, exclusão de ORC rascunho, PENDENTE de conferência em nota de entrada e homologação fiscal P3.

## 21

A ordem sugerida no PDF começa pelo menu. A ordem técnica do plano coloca antes a flag por empresa, o modelo de permissão de custo e financeiro, a trilha de auditoria e a migração aditiva de estoque. O motivo está no plano. A seção 21 não é descartada: cada entrega do PDF continua mapeada.

## Testes existentes que a fase 1 não pode quebrar

- `apps/web/e2e/fluxo-essencial.spec.ts` — login, painel, pipeline, contatos, conversas e configurações, com a empresa de demonstração de iluminação sem a flag.
- `apps/api/src/modules/contatos/multi-tenant.spec.ts` — isolamento de contatos.
- Testes de chatbot e intenções (`maquina-estados.spec.ts`, `regras-intencao.spec.ts`), que cobrem o WhatsApp atual.
- `packages/contratos/src/contratos.spec.ts` e utilitários em `apps/api/src/common/utils/`.

Não há teste de custo médio, XML de entrada, pedido, comissão nem permissão granular.
