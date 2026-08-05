# ARCCO — Chatbot

O chatbot faz a triagem inicial das conversas de WhatsApp: cumprimenta, oferece um menu, coleta dados de orçamento e transfere para um atendente humano quando necessário.

Implementação:

- `apps/api/src/modules/chatbot/maquina-estados.ts` — **máquina de estados pura** (sem I/O), determinística e testada.
- `apps/api/src/modules/chatbot/chatbot.service.ts` — orquestração (efeitos colaterais: persistir estado, criar oportunidade, transferir).
- `apps/api/src/modules/ia/` — classificação de intenção (`rules` ou `openai`).
- `apps/api/src/modules/ia/regras-intencao.ts` — regras/palavras-chave e leitura do menu numérico.

---

## Intenções

Enum `IntencaoChatbot` (`@arcco/contratos`):

| Intenção | Significado | Ação no MVP |
| --- | --- | --- |
| `NOVO_ORCAMENTO` | Cliente quer orçar/comprar | Inicia o fluxo de coleta de orçamento. |
| `NEGOCIAR_ORCAMENTO` | Desconto/condições | Transfere para humano. |
| `AJUSTAR_ORCAMENTO` | Alterar/revisar orçamento | Transfere para humano. |
| `DUVIDA` | Dúvida/informação | Transfere para humano. |
| `ACOMPANHAR_SOLICITACAO` | Status/andamento | Transfere para humano. |
| `FINANCEIRO` | Boleto, NF, pagamento | Transfere para humano. |
| `ENTREGA` | Prazo, frete, rastreio | Transfere para humano. |
| `POS_VENDA` | Garantia, troca, assistência | Transfere para humano. |
| `FALAR_COM_PESSOA` | Falar com atendente | Transfere para humano. |
| `OUTRO` | Não reconhecida | Reapresenta o menu (até o limite). |

### Como a intenção é detectada

1. **Menu numérico** (`intencaoPorOpcaoMenu`): se a mensagem começa com `1`–`4`, mapeia direto:
   - `1` → `NOVO_ORCAMENTO`
   - `2` → `ACOMPANHAR_SOLICITACAO`
   - `3` → `DUVIDA`
   - `4` → `FALAR_COM_PESSOA`
2. **Classificação** (`AI_PROVIDER`):
   - `rules` (padrão): regex/palavras-chave com peso (`classificarIntencaoRegras`). Ex.: "orçamento", "preço", "cotação" → `NOVO_ORCAMENTO`; "atendente", "humano", "vendedor" → `FALAR_COM_PESSOA`; "desconto", "negociar" → `NEGOCIAR_ORCAMENTO`; "boleto", "nota fiscal" → `FINANCEIRO`; etc. Retorna `{ intencao, confianca }`.
   - `openai`: usa o SDK e o modelo `OPENAI_MODEL` para classificar (mesmo conjunto de intenções). Determinístico o suficiente para triagem; cai para regras/`OUTRO` quando indisponível.

A opção de menu tem prioridade sobre a classificação livre.

---

## Estados e fluxos

A máquina tem três fluxos (`FLUXO`):

- `MENU` — apresentação e roteamento por intenção.
- `NOVO_ORCAMENTO` — coleta sequencial de dados.
- `FINALIZADO` — encerrado (após criar oportunidade ou transferir).

O estado persistido em `Conversa.estadoBot` (JSONB) tem o formato:

```json
{ "fluxo": "NOVO_ORCAMENTO", "etapa": "1", "dadosColetados": {}, "ultimaPergunta": "_necessidade", "tentativas": 0 }
```

### Fluxo de menu / roteamento

```
Mensagem → (opção de menu? senão classifica intenção)
   ├─ NOVO_ORCAMENTO      → inicia coleta
   ├─ FALAR_COM_PESSOA    → transfere
   ├─ ACOMPANHAR / FINANCEIRO / ENTREGA / POS_VENDA / NEGOCIAR / AJUSTAR / DUVIDA → transfere
   └─ OUTRO (desconhecida)
        ├─ primeira interação      → mostra saudação + menu
        └─ tentativas >= 3         → transfere para humano
```

A saudação usa `chatbot.mensagemInicial` (config da empresa) e, fora do horário de atendimento, acrescenta `mensagemForaHorario`. O menu oferecido:

```
Escolha uma opção:
1) Fazer um orçamento
2) Acompanhar uma solicitação
3) Tirar uma dúvida
4) Falar com um atendente
```

### Fluxo de novo orçamento (coleta)

As perguntas são montadas dinamicamente (`montarPerguntas`):

1. **Nome** (`_nome`) — apenas se o contato é desconhecido e o nome não é conhecido.
2. **Necessidade** (`_necessidade`) — "o que você precisa orçar (produto, serviço ou material)".
3. **Campos personalizados** marcados com `usarNoChatbot=true` para a entidade OPORTUNIDADE (usam o `textoPergunta` configurado). Ex.: no segmento concreto, "Qual o volume aproximado em m³?", "Qual o FCK necessário?", "Vai precisar de bombeamento?".

A cada resposta, o valor é salvo em `dadosColetados` e a `etapa` avança. Ao responder a última pergunta, o bot dispara a ação `CRIAR_OPORTUNIDADE` e envia a `mensagemFinal`.

```
início → _nome? → _necessidade → [campos personalizados...] → CRIAR_OPORTUNIDADE → FINALIZADO
```

O `ChatbotService` então cria a `Oportunidade` (com contato resolvido, etapa inicial do funil, `dadosPersonalizados` preenchidos) e associa a conversa a ela.

---

## Transferência para humano

A transferência acontece quando:

- A intenção é `FALAR_COM_PESSOA` (menu opção 4 ou palavras-chave).
- A intenção exige atendimento humano (financeiro, entrega, pós-venda, acompanhar, negociar, ajustar, dúvida).
- O bot não entende a mensagem após **3 tentativas** (`MAX_TENTATIVAS`).

Efeito: o bot envia a `mensagemTransferencia`, o fluxo vai para `FINALIZADO` e o `ChatbotService` muda a conversa para `AGUARDANDO_HUMANO`. O atendente assume no inbox; ao responder (`POST /api/whatsapp/conversas/:id/enviar`), a conversa passa a `EM_ATENDIMENTO` e o `atendenteId` é registrado.

Quando a conversa **não** está em modo `BOT` (`HUMANO`/`PAUSADO`), o bot não responde — as mensagens apenas são registradas e ficam para o atendente.

---

## Horário de atendimento

A configuração da empresa define janelas por dia da semana (`horarioAtendimento`). Fora do horário, o bot ainda **registra a solicitação** (inclusive coleta de orçamento), mas acrescenta a `mensagemForaHorario` na saudação, sinalizando que o atendimento humano continuará no próximo período. A verificação de horário é utilitária e testada (`common/utils/horario`).

---

## Limites da IA (MVP)

- **O LLM só classifica intenção.** Não gera respostas livres nem negocia; as respostas do bot são textos determinísticos da máquina de estados/configuração.
- **Somente texto.** O processamento trata mensagens de texto; mídia (áudio/imagem/documento) não é interpretada — transcrição e OCR são roadmap.
- **Cobertura limitada de fluxos automáticos.** Apenas o menu e a coleta de orçamento são totalmente automatizados; as demais intenções transferem para humano.
- **Determinismo e custo.** Com `AI_PROVIDER=rules` o bot roda 100% offline, sem custo e de forma previsível — ideal para testes e ambientes sem OpenAI.
- **Sem contexto longo.** A máquina considera a mensagem atual + o estado persistido; não faz memória conversacional ampla nem raciocínio multi-turno além do fluxo definido.

---

## Testes

- `chatbot/maquina-estados.spec.ts` — cobre menu, coleta, criação de oportunidade e transferência.
- `ia/regras-intencao.spec.ts` — cobre a classificação por regras e a leitura do menu numérico.

Para experimentar rapidamente, use o simulador do modo mock (ver [`EVOLUTION_API.md`](EVOLUTION_API.md#modo-mock-desenvolvimento)).
