import { Global, Module } from '@nestjs/common';
import { carregarEnv } from '../../config/env';
import { AI_PROVIDER } from './ia.provider';
import { RuleBasedAIProvider } from './rule-based.provider';
import { OpenAIProvider } from './openai.provider';

@Global()
@Module({
  providers: [
    RuleBasedAIProvider,
    OpenAIProvider,
    {
      provide: AI_PROVIDER,
      inject: [RuleBasedAIProvider, OpenAIProvider],
      useFactory: (regras: RuleBasedAIProvider, openai: OpenAIProvider) => {
        const env = carregarEnv();
        if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
          return openai;
        }
        return regras;
      },
    },
  ],
  exports: [AI_PROVIDER],
})
export class IaModule {}
