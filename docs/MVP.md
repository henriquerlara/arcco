# ARCCO — MVP

Este documento descreve o produto mínimo viável (MVP) do ARCCO: o problema que resolve, o objetivo, o que está dentro e fora do escopo, as personas e o fluxo principal.

---

## Problema

Empresas que vendem para o setor de construção (iluminação, concreto, pisos e revestimentos, esquadrias, materiais e serviços para obras) recebem a maioria dos contatos comerciais pelo **WhatsApp**, de forma desorganizada:

- Pedidos de orçamento chegam misturados a dúvidas, cobranças e conversas pessoais.
- As informações do cliente e da obra ficam soltas no histórico do chat.
- Sem triagem, o vendedor perde tempo com contatos frios e esquece follow-ups.
- Não há visibilidade do funil de vendas nem métricas confiáveis.
- Cada atendente responde de um jeito, sem padronização.

O resultado é **perda de oportunidades**, retrabalho e dificuldade de gestão comercial.

---

## Objetivo

Oferecer uma plataforma que **centraliza o atendimento comercial via WhatsApp e o transforma em um CRM estruturado**, com um chatbot que faz a triagem inicial, coleta os dados de um pedido de orçamento e transfere para um atendente humano quando necessário — tudo isolado por empresa (multi-tenant).

Metas do MVP:

1. Conectar (ou simular) o WhatsApp e receber mensagens em um inbox único.
2. Triagem automática por chatbot (menu + intenção) sem intervenção humana inicial.
3. Registrar automaticamente contatos, conversas e **oportunidades** a partir do bot.
4. Dar ao time uma visão de funil (pipeline), atividades e um dashboard com métricas.
5. Permitir configuração por empresa (funil, categorias, campos personalizados, chatbot, equipe).

---

## Escopo (dentro do MVP)

- **Autenticação e multiempresa:** cadastro de empresa, login com JWT (cookies httpOnly), onboarding, troca de senha temporária, perfis de usuário.
- **CRM:**
  - Contatos (com tipo, telefone normalizado, campos personalizados).
  - Obras (endereço, status, vínculo com contatos via papéis).
  - Oportunidades (código, valor estimado, prioridade, etapa do funil, categoria).
  - Funil configurável (etapas ABERTA/GANHA/PERDIDA).
  - Atividades (follow-up, ligação, reunião, etc. com vencimento e conclusão).
  - Campos personalizados por entidade (contato, obra, oportunidade).
- **Atendimento WhatsApp:**
  - Conexões Meta Cloud API, inbox de conversas, envio manual por atendente.
  - Chatbot (máquina de estados determinística) com menu, coleta de orçamento e transferência.
  - Classificação de intenção por regras (offline) ou OpenAI.
- **Dashboard:** métricas comerciais e gráfico de funil.
- **Configurações:** empresa, equipe, categorias, funil, campos, chatbot, WhatsApp.
- **Arquivos:** upload com armazenamento local ou Cloudflare R2.
- **Observabilidade:** OpenTelemetry opcional.

---

## Não escopo (fora do MVP)

Itens conscientemente deixados para o [roadmap](ROADMAP.md):

- Geração de **orçamento/proposta** formal (itens, preços, PDF).
- **Pedidos**, **financeiro** (boletos, contas a receber), **nota fiscal**.
- **Estoque** e **entrega/logística**.
- Integração com **ERP**.
- **OCR** de documentos e **transcrição** de áudio.
- **Relatórios avançados** e **billing/assinaturas** da própria plataforma.
- Respostas livres geradas por IA (o LLM só classifica intenção).
- Atualizações em tempo real via WebSocket (o inbox usa polling).

---

## Personas

| Persona | Perfil (sistema) | Necessidade principal |
| --- | --- | --- |
| **Proprietário(a)** | `PROPRIETARIO` | Visão geral do negócio, configuração da empresa, equipe e integrações; acesso total. |
| **Gestor(a) comercial** | `GESTOR` | Acompanhar funil e métricas, distribuir e supervisionar atendimentos, configurar funil/campos. |
| **Vendedor(a)** | `VENDEDOR` | Trabalhar as oportunidades atribuídas, registrar atividades e fechar negócios. |
| **Atendente** | `ATENDENTE` | Responder conversas transferidas pelo bot, qualificar e encaminhar. |
| **Cliente final** | (externo, via WhatsApp) | Pedir orçamento, tirar dúvidas e falar com uma pessoa. |

O cliente final não acessa o painel — interage apenas pelo WhatsApp, onde o chatbot faz a triagem.

---

## Fluxo principal

O fluxo central do MVP é **do primeiro contato no WhatsApp até uma oportunidade no funil**:

1. **Mensagem recebida** — o cliente manda uma mensagem para o número da empresa. Ela chega via webhook da Meta (`POST /api/webhooks/meta/whatsapp`) ou pelo simulador.
2. **Conversa criada/resolvida** — a API normaliza o telefone e resolve (ou cria) a `Conversa` e, quando possível, associa a um `Contato`.
3. **Triagem pelo bot** — se a conversa está em modo `BOT`, o `ChatbotService` classifica a intenção (regras ou OpenAI) e a máquina de estados responde:
   - Saudação + **menu** (1 orçamento · 2 acompanhar · 3 dúvida · 4 atendente).
   - Se o cliente escolhe orçamento, o bot **coleta dados** (nome, necessidade e campos personalizados marcados para o chatbot).
4. **Criação da oportunidade** — ao concluir a coleta, o bot cria uma **Oportunidade** no funil com os dados informados e uma mensagem de encerramento.
5. **Transferência para humano** — quando a intenção exige (falar com pessoa, negociação, financeiro, etc.) ou após tentativas sem entendimento, a conversa muda para `AGUARDANDO_HUMANO`.
6. **Atendimento humano** — o atendente assume a conversa no inbox (`EM_ATENDIMENTO`), responde manualmente e trabalha a oportunidade (etapas do funil, atividades, follow-ups).
7. **Gestão** — proprietário/gestor acompanham o pipeline e o dashboard, com métricas de volume, conversão e valores.

Esse ciclo transforma um canal informal (WhatsApp) em um processo comercial rastreável, que é a proposta de valor do MVP.

Para o detalhamento do bot (intenções, estados e limites), veja [`CHATBOT.md`](CHATBOT.md).
