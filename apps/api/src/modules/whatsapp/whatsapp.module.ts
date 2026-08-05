import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WebhookController } from './webhook.controller';
import { WhatsAppService } from './whatsapp.service';
import { MockWhatsAppProvider } from './mock.provider';
import { EvolutionWhatsAppProvider } from './evolution.provider';
import { EvolutionPollerService } from './evolution.poller';
import { WHATSAPP_PROVIDER } from './whatsapp.provider';
import { carregarEnv } from '../../config/env';
import { ConversasModule } from '../conversas/conversas.module';
import { MensagensModule } from '../mensagens/mensagens.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';

@Module({
  imports: [ConversasModule, MensagensModule, ChatbotModule, OportunidadesModule],
  controllers: [WhatsAppController, WebhookController],
  providers: [
    WhatsAppService,
    MockWhatsAppProvider,
    EvolutionWhatsAppProvider,
    EvolutionPollerService,
    {
      provide: WHATSAPP_PROVIDER,
      inject: [MockWhatsAppProvider, EvolutionWhatsAppProvider],
      useFactory: (mock: MockWhatsAppProvider, evolution: EvolutionWhatsAppProvider) => {
        const env = carregarEnv();
        return env.WHATSAPP_PROVIDER === 'evolution' ? evolution : mock;
      },
    },
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
