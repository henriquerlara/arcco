import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { FiltroExcecaoGlobal } from './common/erros/filtro-excecao';
import { AuthGuard } from './common/guards/auth.guard';
import { PerfilGuard } from './common/guards/perfil.guard';
import { AutenticacaoModule } from './modules/autenticacao/autenticacao.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { ContatosModule } from './modules/contatos/contatos.module';
import { ObrasModule } from './modules/obras/obras.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { FunilModule } from './modules/funil/funil.module';
import { OportunidadesModule } from './modules/oportunidades/oportunidades.module';
import { AtividadesModule } from './modules/atividades/atividades.module';
import { CamposPersonalizadosModule } from './modules/campos-personalizados/campos-personalizados.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ConversasModule } from './modules/conversas/conversas.module';
import { MensagensModule } from './modules/mensagens/mensagens.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { ArquivosModule } from './modules/arquivos/arquivos.module';
import { IaModule } from './modules/ia/ia.module';
import { EventosModule } from './modules/eventos/eventos.module';
import { ProdutosModule } from './modules/produtos/produtos.module';
import { OrcamentosModule } from './modules/orcamentos/orcamentos.module';
import { FiscalModule } from './modules/fiscal/fiscal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Raiz do monorepo e cwd (apps/api) — permite .env único na raiz.
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    EventosModule,
    IaModule,
    AutenticacaoModule,
    EmpresasModule,
    UsuariosModule,
    CamposPersonalizadosModule,
    ContatosModule,
    ObrasModule,
    CategoriasModule,
    FunilModule,
    OportunidadesModule,
    AtividadesModule,
    DashboardModule,
    ConversasModule,
    MensagensModule,
    ChatbotModule,
    WhatsAppModule,
    ArquivosModule,
    ProdutosModule,
    OrcamentosModule,
    FiscalModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: FiltroExcecaoGlobal },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PerfilGuard },
  ],
})
export class AppModule {}
