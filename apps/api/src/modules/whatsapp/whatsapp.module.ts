import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { MetaWhatsAppController } from './meta-whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { MetaWhatsAppService } from './meta-whatsapp.service';
import { MockWhatsAppProvider } from './mock.provider';
import { MetaWhatsAppProvider } from './meta.provider';
import { MetaGraphClient } from './meta.graph';
import { WHATSAPP_PROVIDER } from './whatsapp.provider';
import { ConversasModule } from '../conversas/conversas.module';
import { MensagensModule } from '../mensagens/mensagens.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';
import { ArquivosModule } from '../arquivos/arquivos.module';
import { AtividadesModule } from '../atividades/atividades.module';

/**
 * Canal real: Meta WhatsApp Cloud API (MetaWhatsAppProvider).
 * O token WHATSAPP_PROVIDER fica no mock, usado só pelo simulador local.
 */
@Module({
  imports: [
    ConversasModule,
    MensagensModule,
    ChatbotModule,
    OportunidadesModule,
    ArquivosModule,
    AtividadesModule,
  ],
  controllers: [WhatsAppController, MetaWhatsAppController],
  providers: [
    WhatsAppService,
    MetaWhatsAppService,
    MockWhatsAppProvider,
    MetaWhatsAppProvider,
    MetaGraphClient,
    {
      provide: WHATSAPP_PROVIDER,
      useExisting: MockWhatsAppProvider,
    },
  ],
  exports: [WhatsAppService, MetaWhatsAppService, MetaWhatsAppProvider],
})
export class WhatsAppModule {}
