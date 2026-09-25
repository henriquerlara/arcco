import { Body, Controller, Get, Header, HttpCode, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { PerfilUsuario } from '@arcco/contratos';
import { Publico } from '../../common/decorators/publico.decorator';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Erros } from '../../common/erros/erros';
import { MetaGraphClient } from './meta.graph';
import { MetaWhatsAppService } from './meta-whatsapp.service';

const testMessageSchema = z.object({
  to: z.string().optional(),
  templateName: z.string().optional(),
  languageCode: z.string().optional(),
});

const sendTextSchema = z.object({
  to: z.string().optional(),
  conversaId: z.string().uuid().optional(),
  texto: z.string().min(1),
});

const createTemplateSchema = z.object({
  name: z.string().min(3),
  language: z.string().default('pt_BR'),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).default('UTILITY'),
  body: z.string().min(1).max(1024),
});

@Controller()
export class MetaWhatsAppController {
  constructor(
    private readonly meta: MetaWhatsAppService,
    private readonly graph: MetaGraphClient,
  ) {}

  /** Verificação do webhook (Meta Developers) — body = challenge puro. */
  @Publico()
  @Get('webhooks/meta/whatsapp')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  verificarWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    if (mode === 'subscribe' && token && token === this.graph.verifyToken() && challenge) {
      return challenge;
    }
    throw Erros.naoAutenticado('Verify token inválido');
  }

  @Publico()
  @Post('webhooks/meta/whatsapp')
  async receberWebhook(@Body() body: Record<string, unknown>) {
    try {
      return await this.meta.processarWebhook(body ?? {});
    } catch (erro) {
      this.meta.marcarWebhookErro((erro as Error).message);
      throw erro;
    }
  }

  @Get('integrations/meta-whatsapp/status')
  status(@EmpresaAtual() empresaId: string) {
    return this.meta.obterStatus(empresaId);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post('integrations/meta-whatsapp/ensure-connection')
  ensure(@EmpresaAtual() empresaId: string) {
    return this.meta.garantirConexaoTeste(empresaId);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post('integrations/meta-whatsapp/test-message')
  testMessage(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(testMessageSchema)) dto: z.infer<typeof testMessageSchema>,
  ) {
    return this.meta.enviarMensagemTeste(empresaId, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post('integrations/meta-whatsapp/send-text')
  sendText(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(sendTextSchema)) dto: z.infer<typeof sendTextSchema>,
  ) {
    return this.meta.enviarTexto(empresaId, dto);
  }

  @Get('integrations/meta-whatsapp/templates')
  templates() {
    return this.meta.listarTemplates();
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post('integrations/meta-whatsapp/templates')
  criarTemplate(
    @Body(new ZodValidationPipe(createTemplateSchema)) dto: z.infer<typeof createTemplateSchema>,
  ) {
    return this.meta.criarTemplate(dto);
  }

  @Get('integrations/meta-whatsapp/webhook-status')
  webhookStatus() {
    return this.meta.statusWebhook();
  }
}
