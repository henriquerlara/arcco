# ARCCO — Roadmap

Evolução planejada do produto além do MVP. O MVP entrega CRM comercial + atendimento por WhatsApp com chatbot de triagem (ver [`MVP.md`](MVP.md)). Este roadmap descreve os próximos módulos, do mais próximo ao mais distante.

> As datas/ordenações são indicativas e podem mudar conforme prioridade. Cada item lista dependências, escopo esperado e como se conecta ao que já existe.

---

## Legenda de status

- **Planejado** — definido, ainda não iniciado.
- **Em estudo** — depende de decisão/spike técnico.
- **Futuro** — visão de longo prazo.

---

## 1. Orçamento completo

**Status:** Planejado · **Base atual:** o chatbot já cria `Oportunidade` com `dadosPersonalizados`; existe `codigoOrcamento` na oportunidade.

Transformar a oportunidade em um **orçamento estruturado**:

- Itens de orçamento (produto/serviço, quantidade, unidade, preço unitário, desconto).
- Cálculo de totais, impostos e condições comerciais.
- Versionamento de propostas (revisões) e status (rascunho, enviado, aprovado, recusado).
- Geração de **PDF** da proposta e envio pelo WhatsApp.
- Modelos/templates por segmento (aproveitando `templates-segmento`).

**Novas entidades (previstas):** `Orcamento`, `ItemOrcamento`, `Produto`/`CatalogoItem`.

---

## 2. Pedidos

**Status:** Planejado · **Depende de:** Orçamento.

Converter um orçamento aprovado em **pedido de venda**:

- Fluxo orçamento → pedido → separação → faturamento.
- Status do pedido e histórico.
- Vínculo com obra e contato.

**Novas entidades (previstas):** `Pedido`, `ItemPedido`.

---

## 3. Financeiro

**Status:** Planejado · **Base atual:** intenção `FINANCEIRO` já classificada (hoje transfere para humano).

- Contas a receber vinculadas a pedidos.
- Registro de pagamentos, parcelas e vencimentos.
- Emissão de **boletos** / integração com meios de pagamento.
- Painel de inadimplência e conciliação básica.
- Automatizar respostas de 2ª via/status no chatbot.

---

## 4. Nota Fiscal (NF-e / NFS-e)

**Status:** Em estudo · **Depende de:** Pedidos, Financeiro.

- Emissão de nota fiscal a partir do pedido.
- Integração com provedor de NF (ex.: emissor/gateway fiscal).
- Armazenamento do DANFE/XML (aproveitando o módulo de Arquivos, local/R2).
- Envio da nota ao cliente pelo WhatsApp.

---

## 5. Estoque

**Status:** Planejado · **Depende de:** catálogo de produtos (Orçamento).

- Cadastro de produtos com saldo por local.
- Movimentações (entrada/saída/reserva) ligadas a pedidos.
- Alertas de estoque mínimo.
- Reflexo da disponibilidade no orçamento/pedido.

**Novas entidades (previstas):** `Produto`, `MovimentacaoEstoque`.

---

## 6. Entrega / Logística

**Status:** Planejado · **Base atual:** intenção `ENTREGA` já classificada.

- Programação de entregas por pedido/obra (endereço já existe em `Obra`).
- Status de entrega e comprovação.
- Rastreio simples e notificação ao cliente pelo WhatsApp.
- Roteirização básica (futuro).

---

## 7. Integração com ERP

**Status:** Em estudo.

- Sincronização de clientes, produtos, pedidos e financeiro com ERPs de mercado.
- Estratégia de integração: API/webhooks e/ou conectores.
- Mapeamento de entidades ARCCO ↔ ERP e resolução de conflitos.

---

## 8. OCR de documentos

**Status:** Futuro · **Base atual:** módulo de Arquivos (upload local/R2).

- Extração de texto de PDFs/imagens (ex.: plantas, listas de materiais, orçamentos concorrentes).
- Pré-preenchimento de itens de orçamento a partir de documentos enviados no WhatsApp.
- Pipeline: upload → OCR → estruturação → revisão humana.

---

## 9. Transcrição de áudio

**Status:** Futuro · **Base atual:** `TipoMensagem.AUDIO` já existe no schema (hoje não interpretado).

- Transcrição de áudios do WhatsApp (speech-to-text).
- Alimentar a classificação de intenção do chatbot com o texto transcrito.
- Exibir a transcrição no inbox para o atendente.

---

## 10. Meta / WhatsApp Cloud API

**Status:** Canal oficial do produto.

- WhatsApp Cloud API da Meta, reaproveitando o contrato `WhatsAppProvider`.
- Templates de mensagem e janela de 24h.
- Webhook e credenciais da Meta.

---

## 11. Relatórios

**Status:** Planejado · **Base atual:** dashboard com métricas e gráfico de funil.

- Relatórios de conversão por etapa, vendedor, categoria e origem.
- Análise de tempo de resposta e de atendimento (bot vs. humano).
- Exportação (CSV/PDF) e filtros por período.
- Metas comerciais e acompanhamento.

---

## 12. Billing / Assinaturas da plataforma

**Status:** Futuro.

- Planos e limites por empresa (usuários, conexões WhatsApp, volume de mensagens).
- Cobrança recorrente e gestão de assinatura.
- Controle de acesso a features por plano.
- Painel de uso e faturas.

---

## Visão consolidada

| # | Módulo | Status | Principais dependências |
| --- | --- | --- | --- |
| 1 | Orçamento completo | Planejado | Catálogo de produtos |
| 2 | Pedidos | Planejado | Orçamento |
| 3 | Financeiro | Planejado | Pedidos |
| 4 | Nota Fiscal | Em estudo | Pedidos, Financeiro |
| 5 | Estoque | Planejado | Catálogo de produtos |
| 6 | Entrega / Logística | Planejado | Pedidos |
| 7 | Integração ERP | Em estudo | Orçamento/Pedidos/Financeiro |
| 8 | OCR de documentos | Futuro | Arquivos |
| 9 | Transcrição de áudio | Futuro | WhatsApp/IA |
| 10 | Meta / WhatsApp Cloud API | Canal oficial | Webhook e credenciais Meta |
| 11 | Relatórios | Planejado | Dados do CRM/atendimento |
| 12 | Billing / Assinaturas | Futuro | Multiempresa |

Os módulos foram desenhados para reaproveitar as fundações do MVP: **multiempresa por `empresaId`**, **providers plugáveis** (WhatsApp, IA, storage), **campos personalizados/JSONB** e **contratos Zod compartilhados**.
