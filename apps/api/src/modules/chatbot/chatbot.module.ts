import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ConversasModule } from '../conversas/conversas.module';
import { OportunidadesModule } from '../oportunidades/oportunidades.module';

@Module({
  imports: [ConversasModule, OportunidadesModule],
  providers: [ChatbotService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
