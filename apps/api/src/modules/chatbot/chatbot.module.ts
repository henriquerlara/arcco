import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ConversasModule } from '../conversas/conversas.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';
import { AtividadesModule } from '../atividades/atividades.module';

@Module({
  imports: [ConversasModule, OportunidadesModule, AtividadesModule],
  providers: [ChatbotService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
