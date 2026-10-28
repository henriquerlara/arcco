# ECOL-28 — Validação final vs PDF (§17 / §18 / §20)

Data: 28/10/2026. Fonte de verdade: `Especificacao_ARCCO_Ecolume_v1.pdf`. Histórico de planejamento: este diretório.

## Veredito

**`ECOL-28 VALIDADA PARCIALMENTE — PENDÊNCIAS IDENTIFICADAS`** (baseline 28/10/2026 manhã)

**Atualização ECOL-28a (28/10/2026 tarde):** as quatro lacunas de produto (09b, 10b, exclusão ORC, PENDENTE XML) foram **implementadas e testadas** — ver seção 9. Homologação fiscal real permanece fora.

**`HOMOLOGAÇÃO FISCAL PENDENTE`** (Focus/Sefaz real não exercitada; mock ECOL-24 + roteiro §17 passo 9 OK).

**Atualização ECOL-28b (28/10/2026):** **`ECOL-28b IMPLEMENTADA E TESTADA COM MOCK — HOMOLOGAÇÃO PENDENTE`** — CC-e e e-mail DANFE/XML implementados (§14.2); ver seção 10. Sem token Focus + P3 + Sefaz, não há evidência de emissão real.

Fase 1 de produto (exceto P3/CC-e/P6/§19) fecha com ECOL-28a TESTADA; implantação com emissão real ainda depende de P3 + credenciais.

---

## 1. Matriz de conformidade (PDF → implementação)

Legenda: **CONFORME** | **PARCIAL** | **AUSENTE** | **BLOQUEADO** | **FORA DA FASE 1**.

| Seção | Requisito | Evidência | Status | Pendência |
|---|---|---|---|---|
| 3 | Princípios (aviso≠bloqueio; revisão; flag) | Serviços + testes ECOL-01…27 | CONFORME | — |
| 5.1–5.2 | NEG/ORC/PED por empresa | ECOL-11/12/16 | CONFORME | Sequência global entre empresas: decisão em PENDENCIAS (unicidade por `empresaId`) |
| 6 | Menu ECOLUME; sem WhatsApp/chatbot/Produtos/Projetos/Pessoas na UI | `personalizacao-menu.spec.ts` PASS | CONFORME | APIs legado/webhook globais permanecem (ocultar ≠ apagar) |
| 7 | Estoque, XML, custo médio, saldo negativo, ajuste, lista compra | ECOL-03…08 + roteiro §17 passos 6–7 | CONFORME | P5 fator conversão vazio; P6 planilha fora |
| 8.1–8.3 | Cadastro PF/PJ Clientes | ECOL-09a | CONFORME | — |
| 8.4 | Ficha completa: resumo, histórico, anexos | ECOL-09b / `fichaCliente` + ContatoDetalheView | CONFORME (ECOL-28a) | — |
| 9.1–9.2 | Parceiro + RT | ECOL-10a + conversão | CONFORME | P1 base TOTAL_PEDIDO |
| 9.3 | Comissão no pedido (A pagar/Paga) | `marcarComissaoPaga` + §17 passo 11 | CONFORME | P2 momento/forma: registro manual |
| 9.4 | Extrato / visão geral comissões | ECOL-10b lista/extrato/`GET /contatos/comissoes` | CONFORME (ECOL-28a) | P2 momento de pagamento |
| 10.3–10.5 | Fórmula, revisão, trava, PDF confidencial | ECOL-12…15 + PDF specs; §17 3–5 | CONFORME / PARCIAL | Textos livres (validade/prazo/condições) = **P6**; `observacoes` já no PDF |
| 10.3 / 16.2 | Exclusão ORC rascunho autorizada | `DELETE /orcamentos/:id` + `EXCLUIR_ORCAMENTO_RASCUNHO` | CONFORME (ECOL-28a) | — |
| 11 | Conversão, pagamentos, checklist, multi-PED | ECOL-16/17/18 + §17 | CONFORME | — |
| 12 | Kanban pré/pós + busca | ECOL-19 | CONFORME | — |
| 13 | Entregas, follow-up, sininho, calendário | ECOL-20…22; Playwright agenda PASS | CONFORME | — |
| 14.1–14.2 | NF-e pedido (parcial/integral) | ECOL-24 mock + §17 passo 9 | PARCIAL / BLOQUEADO homologação | **P3** + token/certificado |
| 14.2 | CC-e | `POST /notas-fiscais/:id/carta-correcao`; `cartaCorrecaoSuportada: true` | CONFORME COM MOCK (ECOL-28b) | Sefaz real exige token + P3 |
| 14.2 (item 7) | Envio DANFE/XML por e-mail | `POST /notas-fiscais/:id/enviar-email` (Focus `/email`) | CONFORME COM MOCK (ECOL-28b) | E-mail real exige `FOCUS_NFE_TOKEN` |
| 14.3 | Tela Fiscal 3 abas | ECOL-25; Playwright fiscal PASS | CONFORME | — |
| 15 | Dashboard ECOLUME | ECOL-23 + §17 asserts faturamento/ticket/parceira | CONFORME | — |
| 16.1–16.2 | Permissões; sem custo na API sem chave | ECOL-26a/b | CONFORME | P4 atribuição real aos usuários |
| 16.3 | Auditoria eventos | ECOL-27a/b; Playwright admin PASS | CONFORME | — |
| 16.4 | Parâmetros | ECOL-02 | CONFORME | Certificado A1 cofre ainda não |
| 17 | Roteiro 12 passos | `ecolume.roteiro17.integracao.spec.ts` PASS (`ECOL_ROTEIRO=1`) | CONFORME | Passo 9 = mock, não Sefaz |
| 18 | P1–P6 | Documentado em PENDENCIAS | — | Sem inventar regras |
| 19 | Cobrança automática, WhatsApp/chatbot etc. | Fora fase 1 (PLANO) | FORA DA FASE 1 | E-mail DANFE/XML **não** é §19: está em §14.2 item 7 (linha acima) |
| 20 | Critérios de aceite | Ver seção 3 + ECOL-28a | PARCIAL → quase completo | P3 homologação |

### Nota de entrada — status “PENDENTE DE CONFERÊNCIA”

**ECOL-28a:** `POST /notas-entrada/pendente` grava `PENDENTE` sem estoque; `GET .../conferencia` reabre; `confirmar` com `notaEntradaId` promove a `CONFERIDA` com movimento atômico. Migração `20261028180000_nota_entrada_pendente` (`produtoId` nullable). Status: **CONFORME**.

---

## 2. Resultado dos 12 passos (§17)

Arquivo: `apps/api/src/modules/ecolume/ecolume.roteiro17.integracao.spec.ts`.  
Comando: `ECOL_ROTEIRO=1 pnpm exec vitest run src/modules/ecolume/ecolume.roteiro17.integracao.spec.ts`  
Resultado (28/10/2026): **1 passed** (~4–5s de teste).

| Passo | Resultado |
|---|---|
| 1 Cadastros Ana/João/Stella/B/produtos/estoques | PASS |
| 2 NEG-0001 + parceira + anexo | PASS |
| 3 ORC-0001 preços 274,56 / 90,72 total 1.917,12 | PASS |
| 4 PDF sem interno; enviado; bloqueio edição | PASS |
| 5 ORC-0002 revisão 4 fitas total 1.642,56 | PASS |
| 6 PED-0001; pagamentos 821,28+821,28; comissão 164,26; estoque −1 / 19 | PASS |
| 7 XML 10×125; saldo 9; custo/último 125 | PASS |
| 8 Checklist compra/separação; kanban; agendar entrega | PASS |
| 9 NF-e integral **mock** + checklist NF | PASS (homologação real **não**) |
| 10 Entrega + pagamentos | PASS |
| 11 Comissão paga; checklist 100%; FINALIZADO | PASS |
| 12 ORC-0003 → PED-0002; PED-0001 intacto | PASS |
| Dashboard mês 1º fechamento | Faturamento 1.642,56; 1 venda; ticket 1.642,56; Ana 1 pedido / comissão 164,26 | PASS |

---

## 3. Checklist §20 (evidência)

| Critério | Status | Evidência |
|---|---|---|
| Menu ECOLUME / sem refs indevidas | PASS | Playwright `personalizacao-menu` (5) |
| XML entrada, duplicidade, reconhecimento, custo, saldo−, estorno, sem controle | PASS | Integração ECOL-07/18 + §17 |
| Fórmula ORC, revisão, trava, busca, PDF confidencial | PASS | ECOL-12…15 + §17 |
| Conversão, pagamentos, comissões, checklist, multi-PED | PASS | ECOL-17 + §17 |
| Kanban cards pré/pós | PASS | ECOL-19 |
| Entregas / follow-up / sininho / calendário | PASS | ECOL-20…22; Playwright agenda |
| Tela Fiscal + faturamento parcial | PASS | ECOL-24/25; Playwright fiscal; parcial em nfe-pedido |
| Dashboard valores | PASS | §17 + ECOL-23 |
| Permissões; sem custo/IPI/ST/margem indevidos | PASS | ECOL-26a/b |
| Auditoria §16.3 | PASS | ECOL-27; Playwright admin + restrito |
| Ficha cliente §8.4 | FAIL / AUSENTE | ECOL-09b |
| Extrato comissões §9.4 | FAIL / AUSENTE | ECOL-10b |
| Homologação NF-e real | BLOQUEADO | P3 + Focus |
| Negativos: concorrência, idempotência, tenant, legado | PASS | Specs ECOL-16/17/24 + menu legado |

---

## 4. Testes executados (28/10/2026)

### Integração / unitário API

- Suíte com flags ECOL: **291 PASS**, 9 SKIP (gates `ECOL_*=1` / HTTP opcional), 55 arquivos PASS / 1 SKIP.
- Roteiro §17: **PASS**.

### E2E Playwright (`workers=1`, API :3001, Vite :5174)

| Spec | Resultado |
|---|---|
| `agenda-calendario.spec.ts` | 2 PASS |
| `auditoria-consulta.spec.ts` | 2 PASS (restrito = `vendedor.concreto`) |
| `fiscal-abas.spec.ts` | 2 PASS |
| `personalizacao-menu.spec.ts` | 5 PASS |
| **Total ECOL E2E** | **11 PASS / 0 SKIP falso** |

Homologação fiscal Focus/Sefaz: **não executada** (registrada como pendente).

### Typecheck / build

- `nest build` e web build: OK em rodadas anteriores da sessão.
- `vue-tsc` / `tsc`: rodada consolidada em paralelo à validação (sem erro funcional novo nos módulos tocados).

---

## 5. Defeitos corrigidos nesta validação

1. **Fiscal — aba Pendentes não atualizava URL** (Radix Tabs controlado). `FiscalView` passou a abas nativas `role=tab` + `selecionarAba` / sync de query. Playwright ECOL-25 PASS.
2. **Agenda — nav de período permanecia na vista Lista** (query `vista` não removida de forma confiável). Sync URL↔vista + `delete` da chave. Playwright ECOL-22 PASS.
3. **E2E auditoria restrito** usava e-mail `gestor.concreto` inexistente no seed → SKIP. Ajustado para `vendedor.concreto@demo.arcco.local`.

---

## 6. Pendências classificadas

### Obrigatórias (bloqueiam “fase 1 completa” no PDF)

| Item | Classificação | Ação |
|---|---|---|
| ECOL-09b ficha cliente §8.4 | Obrigatório | Entregar resumo/histórico/anexos |
| ECOL-10b extrato comissões §9.4 | Obrigatório | Tela/visão agregada (marcar paga no pedido já existe) |
| Exclusão ORC rascunho | Obrigatório (se §20) | `DELETE` autorizado + auditoria |
| Status PENDENTE conferência nota entrada | Obrigatório se lido literal §7.4 | Persistir rascunho pré-confirmação |
| Homologação NF-e | Dependência externa P3 | Contador + token Focus + A1 |

### Sugestões / P6 (fora caminho crítico até decisão)

Textos livres PDF; margem global 1,6; ambiente; CSV estoque; DF-e automático.

### Dependências externas / decisões

P1–P5; certificado A1 (decisão ECOL-28b: gerenciado no painel Focus, não em cofre ARCCO).

### Infra

- `pnpm run build` da API usa `rm` (falha nativa no Windows); usar `nest build` ou Remove-Item.
- Playwright: **sempre `workers=1`** neste ambiente (OOM com 4).
- Specs E2E restauram `PADRAO` no `afterAll` da empresa concreto.

### Candidatas de follow-up

- **ECOL-28a**: **TESTADA** (28/10/2026) — ver §9.
- **ECOL-28b**: **IMPLEMENTADA E TESTADA COM MOCK** (CC-e + e-mail) — ver §10; homologação fiscal P3 + token + Sefaz segue pendente.

---

## 7. Prioridade do que falta (após ECOL-28a)

1. Fechar P3 com contador e rodar homologação Focus — sem isso, **não** marcar emissão real como aceita (**ECOL-28b**).
2. CC-e (após P3).
3. P4: atribuir permissões reais aos usuários Ecolume.
4. P6 / §19 só após decisão registrada.

---

## 8. Segurança / regressão (amostra)

- Autorização e filtro financeiro no backend (26a interceptor).
- Isolamento `empresaId` nos specs de integração.
- Auditoria na mesma TX das operações críticas (27a + `EXCLUSAO_ORCAMENTO`).
- Idempotência conversão / NF-e / estoque / exclusão ORC / confirmação XML coberta.
- Legado com flag off: Playwright menu + testes “legado”.
- Sem emissão/cobrança real nos testes (mock Focus).

---

## 9. ECOL-28a — Fechamento das lacunas obrigatórias (28/10/2026)

**Veredito: `ECOL-28a TESTADA`**

| Item | Status | Evidência |
|---|---|---|
| ECOL-09b ficha cliente §8.4 | TESTADA | `fichaCliente` em `obter`; UI `ContatoDetalheView`; `contatos.ficha.integracao.spec.ts` 6 PASS |
| ECOL-10b parceiros/comissões §9.4 | TESTADA | métricas na lista; extrato snapshot RT; `GET /contatos/comissoes`; `ComissoesAPagarPainel.vue` |
| Exclusão ORC rascunho §16.2 | TESTADA | `DELETE /orcamentos/:id` + `EXCLUIR_ORCAMENTO_RASCUNHO`; `orcamentos.exclusao.integracao.spec.ts` 5 PASS |
| PENDENTE XML §14.3/7.4 | TESTADA | `salvarPendente` / `conferencia` / confirmar por id; migração `produtoId` nullable; 4+5 PASS notas-entrada |

Regressão API (singleFork, flags ECOL): **306 PASS / 9 SKIP**. Contratos 29 PASS. `tsc` / `vue-tsc` / web build OK. `nest build` exige parar `node dist/main.js` no Windows (DLL Prisma). Playwright menu+fiscal: **7 PASS**.


---

## 10. ECOL-28b — Fechamento fiscal (28/10/2026)

**Veredito: `ECOL-28b IMPLEMENTADA E TESTADA COM MOCK — HOMOLOGAÇÃO PENDENTE`**

Evidência de emissão real **inexistente**: `FOCUS_NFE_TOKEN` ausente no ambiente de teste, P3 vazia (regime/CFOP/natureza/CSOSN|CST), nenhuma chamada Sefaz. Todos os testes usam mock do `FocusNfeClient`. Não se marca emissão real como aceita.

### Entregas

| Item | Evidência |
|---|---|
| Contratos | `ParametrosFiscaisNfe` + `tratamentoSt`/`informacoesComplementaresNfe` (fora de `parametrosFiscaisCompletos`); `CARTA_CORRECAO_NF`, `ENVIO_EMAIL_NF`; `cartaCorrecaoNfSchema` (15–1000), `enviarEmailNfSchema` (1–10 e-mails) |
| Focus client | `cartaCorrecao` → `POST /v2/nfe/{ref}/carta_correcao {correcao}`; `enviarEmail` → `POST /v2/nfe/{ref}/email {emails}`; sem token: mock (`CC-e simulada` / `E-mail simulado (token ausente)`); token nunca logado |
| Banco | Migração `20261028200000_evento_nota_fiscal` (`eventos_nota_fiscal`) aplicada (`migrate deploy`) |
| CC-e | ECOLUME + `CARTA_CORRECAO`; só NF AUTORIZADA; advisory lock por nota; máx. 20 autorizadas; evento CCE + auditoria `CARTA_CORRECAO_NF`; rejeição do emissor persiste `REJEITADO` sem auditoria |
| E-mail | ECOLUME + `EMITIR_NF`; só NF AUTORIZADA; evento EMAIL `AGENDADO` (ou `ERRO`) + auditoria `ENVIO_EMAIL_NF`; sem token: `mock: true` + aviso de que envio real exige token |
| Payload | `informacoes_adicionais_contribuinte` só quando `informacoesComplementaresNfe` existe (+ `tratamentoSt` como texto do contador, sem códigos tributários inventados); `_envioEmailPendente` substituído por `_envioEmailViaFocus` |
| Status | `GET /fiscal/status-homologacao` (ambiente, token, P3, faltantes, `certificado.provedorFocus=true`, `armazenamentoLocal=false`, CC-e/e-mail disponíveis e se são reais); `integrations/focus-nfe/status` estendido |
| UI | `AcoesNfeEventos` no detalhe da `FiscalView` e no `PainelPedidos`; `ConfigFiscalView` mostra A1 na Focus, ambiente, P3 e itens a preencher; sem upload de certificado/senha |

### Testes (28/10/2026)

- `nfe-pedido.cce-email.integracao.spec.ts` (`ECOL_NFE=1`): **11 PASS** — CC-e AUTORIZADA (seq. 1 e 2 + auditoria), rejeição RASCUNHO/CANCELADA/texto curto/sem permissão, rejeição do emissor, limite 20, e-mail AGENDADO, validações de e-mail/HTTP erro/PROCESSANDO/permissão, payload informações/ST, status de homologação, cancelar com `cartaCorrecaoSuportada: true`, isolamento de tenant, legado → `NFE_PEDIDO_INDISPONIVEL`.
- `nfe-pedido.helpers.spec.ts`: 5 PASS (leitura estendida de parâmetros; schemas).
- Regressão API com flags `ECOL_*=1` (singleFork): **319 PASS / 9 SKIP** (60 arquivos; 1 skip de arquivo = HTTP opcional). Contratos: 29 PASS.
- `tsc --noEmit` (API), `vue-tsc --noEmit` (web), `nest build`: OK.
- Playwright `fiscal-abas.spec.ts` (`workers=1`): **2 PASS**.
- `FOCUS_NFE_TOKEN` presente: **não**.

### O que o contador / operação precisa fornecer (P3)

1. Regime tributário, CFOP padrão, natureza da operação, CSOSN **ou** CST — `Empresa.configuracoes` (ECOL-02).
2. Texto de tratamento de ST e informações complementares da NF-e (opcionais; só vão na NF se preenchidos).
3. Validar a CC-e e o texto adicional em homologação Focus/Sefaz.

### Certificado A1

Configurado **no painel da conta Focus**, não em cofre ARCCO. O ARCCO guarda apenas o token da API em variável de ambiente do servidor; nunca arquivo/senha do certificado em JSON ou banco.

### Limites / não habilitado

- Sem token, CC-e e e-mail são simulados e **não** têm efeito na Sefaz nem no e-mail real.
- Nenhuma habilitação automática de produção (`FOCUS_NFE_ENV` default `homologacao`).
- Homologação real exige: token Focus + P3 completa + A1 na Focus + roteiro de homologação com o contador.

---

## 11. ECOL-HOMOLOG — Tentativa de homologação real (28/10/2026)

**Veredito: `HOMOLOGAÇÃO FISCAL BLOQUEADA`**

Nenhuma NF-e, CC-e, cancelamento ou e-mail foi transmitido à Focus/Sefaz nesta sessão. Pré-condições não satisfeitas.

### Verificações iniciais (sem revelar segredos)

| Item | Resultado |
|---|---|
| `FOCUS_NFE_TOKEN` em `.env` / processo | **ausente** (`TokenPresent=false`, length 0) |
| `FOCUS_NFE_ENV` | **unset** (código default interno `homologacao` — produção **não** ativada) |
| P3 nas empresas do banco local | **incompleta em todas** (script `scripts/_check-p3-homolog.ts`: só SET/EMPTY) |
| Clínica Aurora / Demo Iluminação / Demo Concreto | `p3Completo: false` — regime, CFOP, natureza, CSOSN/CST **EMPTY** |
| Aceite formal Ecolume do A1 na Focus | **não registrado** neste repositório |
| Operações 1–10 do roteiro de homologação | **não executadas** (bloqueio deliberado) |

### Divergência A1 vs PDF §16.4

O PDF pede arquivo A1 + senha + validade no sistema. Decisão de produto (ECOL-28b): A1 permanece no **painel Focus**; ARCCO só usa token de API em variável de ambiente. **Não há aceite formal da Ecolume** documentado além dessa decisão técnica em `PENDENCIAS.md`. Recomendação: Ecolume/contador formalizarem por escrito se aceitam A1 só na Focus antes do go-live.

### Regressão mock (não é homologação)

`ECOL_NFE=1 ECOL_FISCAL=1` em `src/modules/fiscal`: **32 PASS** (ECOL-24 + ECOL-28b CC-e/e-mail). Distinguir de autorização Sefaz: **zero** evidência Sefaz.

### Recomendação de implantação

**Bloquear** emissão real / go-live fiscal até:

1. Contador preencher e aprovar P3 (regime, CFOP, natureza, CSOSN ou CST; ST/infos se aplicável).
2. `FOCUS_NFE_TOKEN` de **homologação** no servidor + `FOCUS_NFE_ENV=homologacao` explícito.
3. Emitente + A1 válidos na conta Focus de homologação.
4. Aceite escrito da Ecolume sobre A1 gerenciado pela Focus (divergência §16.4).
5. Reexecução deste roteiro ECOL-HOMOLOG com evidência de protocolos/status Sefaz (sem dados sensíveis nos docs).

Enquanto isso, o produto pode operar com **mock** em ambientes sem token; não confundir mock com homologação.
