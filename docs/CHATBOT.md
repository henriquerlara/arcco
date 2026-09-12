# ARCCO — Chatbot (Ecolume v8)

O chatbot faz a triagem inicial das conversas de WhatsApp seguindo o **fluxo oficial Ecolume v8**: cumprimenta, oferece o menu de 5 seções, coleta dados em cada ramificação e transfere para um atendente humano com resumo estruturado.

Implementação:

- `apps/api/src/modules/chatbot/mensagens-ecolume.ts` — textos oficiais do PDF v8.
- `apps/api/src/modules/chatbot/maquina-estados.ts` — **máquina de estados pura** (sem I/O), determinística e testada.
- `apps/api/src/modules/chatbot/chatbot.service.ts` — orquestração (CPF, persistir estado/resumo, criar oportunidade, transferir).
- `apps/api/src/modules/ia/` — classificação de intenção auxiliar (`rules` ou `openai`) quando o cliente não usa o menu numérico.

---

## Menu principal (PDF)

```
1 Vendas — Negociação, orçamento novo, ajuste de orçamento
2 Financeiro — Segunda via de boleto e NF, contestação de cobrança
3 S.A.C — Serviço de pós-venda
4 Entrega — Informações sobre a entrega do seu pedido
5 Outros
```

Opção inválida: *"Não consegui identificar sua seleção. Por favor, escolha uma das opções disponíveis."*

### Personalização por empresa

Única parte configurável: `chatbot.textoPerguntaProjeto` (padrão: `"a lista de materiais"`).

Usada em Novo Orçamento:

> Para elaborarmos seu orçamento com precisão, você já possui **{textoPerguntaProjeto}**?

---

## Intenções

Enum `IntencaoChatbot` (`@arcco/contratos`):

| Intenção | Uso no v8 |
| --- | --- |
| `VENDAS` | Menu 1 / palavras “vendas”, “comercial” |
| `NOVO_ORCAMENTO` / `NEGOCIAR_*` / `AJUSTAR_*` | NLP → entra no submenu de Vendas |
| `FINANCEIRO` | Menu 2 |
| `SAC` / `POS_VENDA` | Menu 3 |
| `ENTREGA` / `ACOMPANHAR_SOLICITACAO` | Menu 4 |
| `OUTRO` / `DUVIDA` / `FALAR_COM_PESSOA` | Menu 5 (descrição livre) |

### Como a intenção é detectada

1. **Menu numérico** (`intencaoPorOpcaoMenu`): `1`–`5` mapeiam para Vendas / Financeiro / S.A.C / Entrega / Outros.
2. **Dentro das ramificações**, opções numéricas são lidas **pela máquina de estados** (não pela IA).
3. **Classificação** (`AI_PROVIDER`): `rules` (regex) ou `openai` — fallback quando o cliente escreve texto livre no menu.

---

## Estados e fluxos

```json
{
  "fluxo": "VENDAS",
  "etapa": "novo_cpf",
  "dadosColetados": { "tipoVendas": "Novo Orçamento", "cpf": "..." },
  "resumo": "Seção: Vendas\n...",
  "tentativas": 0
}
```

Fluxos: `MENU` · `VENDAS` · `FINANCEIRO` · `SAC` · `ENTREGA` · `OUTROS` · `FINALIZADO`.

### Vendas → Novo Orçamento

1. Pede CPF.
2. Service busca contato com `dadosPersonalizados.cpf` (normalizado).
3. **Cadastro encontrado** → pergunta configurável (Sim/Não).
4. **Cadastro não encontrado** → pede endereço da obra → mesma pergunta.
5. Sim → pede arquivo/lista → `CRIAR_OPORTUNIDADE` + transferência.
6. Não → mensagem de conexão com especialista → `CRIAR_OPORTUNIDADE` + transferência.

Demais opções de Vendas (ajuste, negociação, dúvidas), Financeiro, S.A.C, Entrega e Outros seguem o PDF e terminam em `TRANSFERIR` com resumo.

---

## Transferência e resumo

Ao transferir:

1. `estadoBot.resumo` e `dadosColetados._resumo` / `_secao` são persistidos.
2. Uma mensagem `SISTEMA` com `[Resumo da triagem]` é gravada na conversa (visível no inbox).
3. Conversa vai para `AGUARDANDO_HUMANO`.

O bot **nunca** informa preços, prazos de entrega ou disponibilidade.

---

## Horário de atendimento

Fora do horário, o bot ainda executa a triagem, mas acrescenta `mensagemForaHorario` junto à saudação.

---

## Limites

- Respostas são textos determinísticos do PDF (não geradas por LLM).
- Mídia pedida (arquivo/foto) é aceita como resposta e o fluxo avança — o conteúdo não é interpretado.
- Sem roteamento automático por setor (vendedor/financeiro/SAC): todos vão à fila humana, com a seção no resumo.
- Campos personalizados `usarNoChatbot` **não** dirigem mais o fluxo (substituídos pelas etapas fixas do v8).

---

## Testes

- `chatbot/maquina-estados.spec.ts` — menu, Vendas/CPF, Financeiro, S.A.C, Entrega, Outros, opção inválida.
- `ia/regras-intencao.spec.ts` — regras e menu 1–5.

Simulador mock: ver [`EVOLUTION_API.md`](EVOLUTION_API.md#modo-mock-desenvolvimento).
