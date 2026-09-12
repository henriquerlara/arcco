# ARCCO — Integração WhatsApp (Evolution API)

Como o ARCCO se conecta ao WhatsApp: configuração, criação de instância, QR Code, webhook, segurança, idempotência e o modo mock para desenvolvimento.

A implementação está em `apps/api/src/modules/whatsapp/`:

- `whatsapp.provider.ts` — contrato `WhatsAppProvider` e token de injeção.
- `evolution.provider.ts` — integração real com a Evolution API.
- `mock.provider.ts` — provedor simulado.
- `whatsapp.service.ts` — orquestração (conexões e mensageria).
- `whatsapp.controller.ts` — rotas `/api/whatsapp`.
- `webhook.controller.ts` — entrada `/api/webhooks/evolution`.

---

## Provedores plugáveis

O provedor é escolhido pela variável `WHATSAPP_PROVIDER`:

| Valor | Provider | Comportamento |
| --- | --- | --- |
| `mock` (padrão) | `MockWhatsAppProvider` | Não envia nada; loga e devolve ids simulados. Conexões sempre `CONECTADO`. |
| `evolution` | `EvolutionWhatsAppProvider` | Fala HTTP com uma instância da Evolution API. |

O contrato comum implementado por ambos:

```ts
interface WhatsAppProvider {
  nome: string;
  enviarTexto(nomeInstancia, telefone, texto): Promise<EnvioResultado>;
  conectar(nomeInstancia): Promise<ResultadoConexao>;
  desconectar(nomeInstancia): Promise<void>;
  statusConexao(nomeInstancia): Promise<ResultadoConexao>;
}
```

---

## Configuração

Variáveis de ambiente relevantes (ver `apps/api/src/config/env.ts`):

```env
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://127.0.0.1:8080
EVOLUTION_API_KEY=arcco-evolution-dev-key-change-me
EVOLUTION_WEBHOOK_SECRET=arcco-webhook-secret-dev-change-me
API_PUBLIC_URL=http://host.docker.internal:3000
```

- `EVOLUTION_API_URL` — URL base da Evolution (sem barra final; a barra é normalizada).
- `EVOLUTION_API_KEY` — enviada no header `apikey` em toda chamada (deve bater com `AUTHENTICATION_API_KEY` da Evolution).
- `EVOLUTION_WEBHOOK_SECRET` — validado no header `x-webhook-secret` do webhook de entrada.
- `API_PUBLIC_URL` — URL pública da API, usada para montar o endereço do webhook na Evolution. Com Evolution no Docker e API no host, use `http://host.docker.internal:3000`.

### Subir a stack opcional da Evolution (Docker)

Na raiz do repositório:

```bash
docker compose up -d
```

Sobe:

| Serviço | Porta | Uso |
| --- | --- | --- |
| `postgres` | `5434` | Banco do ARCCO |
| `evolution-api` | `8080` | Evolution API |
| `evolution-postgres` / `evolution-redis` | interno | Persistência da Evolution |

Depois:

```bash
pnpm db:generate
pnpm db:migrate   # ou db:push
pnpm db:seed
pnpm dev:api
pnpm dev:web
```

No painel: **Configurações → WhatsApp** → criar conexão → conectar → escanear QR. Ao conectar, a API cria a instância na Evolution e configura o webhook automaticamente para `{API_PUBLIC_URL}/api/webhooks/evolution`.

Logs da Evolution: `pnpm docker:logs` (ou `docker compose logs -f evolution-api`).

Para voltar ao simulador sem WhatsApp real: `WHATSAPP_PROVIDER=mock` no `.env`.

---

## Endpoints da Evolution usados

`EvolutionWhatsAppProvider` chama (via `fetch`) os seguintes caminhos, sempre com header `apikey`:

| Ação | Método/Caminho | Observação |
| --- | --- | --- |
| Enviar texto | `POST /message/sendText/:instancia` | Corpo `{ number, text }`; retorna `key.id` (usado como `idExterno`). |
| Conectar / QR | `GET /instance/connect/:instancia` | Retorna `base64`/`code` com o QR Code. |
| Desconectar | `DELETE /instance/logout/:instancia` | |
| Estado da conexão | `GET /instance/connectionState/:instancia` | `state === 'open'` ⇒ `CONECTADO`. |

---

## Rotas da API (`/api/whatsapp`)

Todas exigem autenticação; criar/gerir conexões exige perfil `PROPRIETARIO` ou `GESTOR`.

| Método | Rota | Perfil | Descrição |
| --- | --- | --- | --- |
| `GET` | `/whatsapp/conexoes` | qualquer | Lista conexões da empresa. |
| `POST` | `/whatsapp/conexoes` | PROPRIETARIO/GESTOR | Cria conexão (valida `nomeInstancia`). |
| `POST` | `/whatsapp/conexoes/:id/conectar` | PROPRIETARIO/GESTOR | Conecta e obtém QR (Evolution) ou já `CONECTADO` (mock). |
| `GET` | `/whatsapp/conexoes/:id/status` | qualquer | Consulta e atualiza o status. |
| `DELETE` | `/whatsapp/conexoes/:id` | PROPRIETARIO/GESTOR | Desconecta (logout) e limpa o QR. |
| `POST` | `/whatsapp/conversas/:conversaId/enviar` | qualquer | Envio manual do atendente (marca conversa `EM_ATENDIMENTO`). |
| `POST` | `/whatsapp/simulador/mensagem` | qualquer | Simula mensagem recebida (útil no modo mock). |

`nomeInstancia` deve ter ≥ 3 caracteres e casar `^[a-z0-9-_]+$` (letras, números, `-` e `_`).

---

## Criando uma instância e conectando (QR Code)

1. **Criar a conexão** no painel (Configurações → WhatsApp) ou via `POST /api/whatsapp/conexoes` com `{ "nomeInstancia": "empresa-x" }`. O provedor gravado é `EVOLUTION` ou `MOCK` conforme `WHATSAPP_PROVIDER`.
2. **Conectar** via `POST /api/whatsapp/conexoes/:id/conectar`.
   - Em `evolution`: a API chama `instance/connect` e devolve o **QR Code** (`base64`/`code`), com status `QR_CODE`. O usuário escaneia com o WhatsApp do celular.
   - Em `mock`: retorna `CONECTADO` imediatamente, sem QR.
3. **Verificar status** via `GET /api/whatsapp/conexoes/:id/status`. Quando o estado na Evolution for `open`, o status vira `CONECTADO`.
4. **Configurar o webhook** na Evolution apontando para `POST {API_PUBLIC_URL}/api/webhooks/evolution`, incluindo o header `x-webhook-secret` com o valor de `EVOLUTION_WEBHOOK_SECRET`.

Estados de conexão: `DESCONECTADO → CONECTANDO → QR_CODE → CONECTADO` (ou `ERRO`).

---

## Webhook de entrada

Endpoint público (marcado com `@Publico()`): `POST /api/webhooks/evolution`.

Payload esperado (parcial) da Evolution:

```json
{
  "instance": "empresa-x",
  "data": {
    "key": { "remoteJid": "5511999990000@s.whatsapp.net", "id": "ABC123", "fromMe": false },
    "message": { "conversation": "Quero um orçamento" },
    "pushName": "Cliente Teste"
  }
}
```

Processamento (`WebhookController.evolution`):

1. Valida o header `x-webhook-secret` contra `EVOLUTION_WEBHOOK_SECRET` (quando configurado). Se não bater ⇒ `naoAutenticado`.
2. Ignora mensagens sem `instance`/`remoteJid` ou com `fromMe: true` (mensagens enviadas pela própria conta).
3. Extrai o texto de `message.conversation` ou `message.extendedTextMessage.text`; se vazio, ignora.
4. Deriva o telefone removendo o sufixo `@...` do `remoteJid`.
5. Encaminha para `WhatsAppService.processarMensagemRecebida({ nomeInstancia, telefone, nome, texto, idExterno })`.

A partir daí, o service resolve/cria a `Conversa`, registra a `Mensagem` recebida e, se a conversa estiver em modo `BOT`, aciona o chatbot e envia as respostas. Ver [`CHATBOT.md`](CHATBOT.md).

---

## Segurança

- **Segredo do webhook:** o header `x-webhook-secret` deve corresponder a `EVOLUTION_WEBHOOK_SECRET`. Use um valor forte e único em produção.
- **API key da Evolution:** nunca commitar; mantenha em variável de ambiente.
- **HTTPS:** exponha a API atrás de TLS (`API_PUBLIC_URL` com `https`).
- **Filtragem de origem:** apenas o webhook é público; todas as rotas de gestão de WhatsApp exigem sessão autenticada e (para escrita) perfil elevado.
- **Rejeição de eco:** mensagens `fromMe` são descartadas, evitando reprocessar o que a própria conta enviou.
- **Cabeçalhos de segurança:** a API usa `@fastify/helmet`.

---

## Idempotência

Mensagens do WhatsApp podem ser reentregues pelo provedor. Para evitar duplicação:

- Cada `Mensagem` guarda o `idExterno` (id da Evolution). A tabela `mensagens` tem `@@unique([conversaId, idExterno])`.
- O registro de mensagens usa esse par único, de modo que reentregas com o mesmo `idExterno` não criam duplicatas.
- Mensagens sem `idExterno` (ex.: geradas internamente) recebem ids próprios (mock/atendente/simulador).

---

## Modo mock (desenvolvimento)

Com `WHATSAPP_PROVIDER=mock`:

- **Nada é enviado** ao WhatsApp real. `MockWhatsAppProvider.enviarTexto` apenas loga (`[instancia] -> telefone: texto`) e devolve um `idExterno` `mock_<uuid>`.
- Conexões retornam sempre `CONECTADO` (número fixo `5511999990000`), sem QR.
- Para testar o fluxo do bot ponta a ponta, use o **simulador**:

```
POST /api/whatsapp/simulador/mensagem
Content-Type: application/json
(autenticado — cookie de sessão)

{
  "telefone": "5511999990000",
  "nome": "Cliente Teste",
  "texto": "Quero um orçamento"
}
```

`garantirInstanciaSimulada` cria/reaproveita uma instância mock da empresa e a mensagem passa pelo **mesmo** `processarMensagemRecebida` do webhook — ou seja, o comportamento do chatbot é idêntico ao de produção, só sem tráfego real de WhatsApp.

O seed já cria uma conexão mock (`mock-<id>`) e uma conversa de exemplo por empresa, permitindo explorar o inbox logo após `pnpm db:seed`.
