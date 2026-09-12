import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { PerfilUsuario } from '@arcco/contratos';
import { WhatsAppService } from './whatsapp.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';

const criarConexaoSchema = z.object({
  nomeInstancia: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-_]+$/i, 'Use apenas letras, numeros, - e _'),
  numero: z.string().optional(),
});

const enviarMensagemSchema = z.object({
  texto: z.string().min(1, 'Informe a mensagem'),
});

const enviarOrcamentoSchema = z.object({
  texto: z.string().min(1, 'Informe a mensagem'),
  valorEstimado: z.coerce
    .number({ invalid_type_error: 'Informe o valor do orçamento' })
    .positive('Informe um valor maior que zero'),
  arquivoId: z.string().uuid().optional(),
});

const simularSchema = z.object({
  nomeInstancia: z.string().optional(),
  telefone: z.string().min(8),
  nome: z.string().optional(),
  texto: z.string().min(1),
});

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly servico: WhatsAppService) {}

  @Get('conexoes')
  listarConexoes(@EmpresaAtual() empresaId: string) {
    return this.servico.listarConexoes(empresaId);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post('conexoes')
  criarConexao(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarConexaoSchema)) dto: z.infer<typeof criarConexaoSchema>,
  ) {
    return this.servico.criarConexao(empresaId, dto.nomeInstancia, dto.numero);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post('conexoes/:id/conectar')
  conectar(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.conectar(empresaId, id);
  }

  @Get('conexoes/:id/status')
  status(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.statusConexao(empresaId, id);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Delete('conexoes/:id')
  desconectar(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.desconectar(empresaId, id);
  }

  /** Envio manual por atendente humano em uma conversa. */
  @Post('conversas/:conversaId/enviar')
  enviar(
    @EmpresaAtual() empresaId: string,
    @Param('conversaId') conversaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(enviarMensagemSchema)) dto: z.infer<typeof enviarMensagemSchema>,
  ) {
    return this.servico.enviarMensagemAtendente(empresaId, conversaId, dto.texto, usuario.id);
  }

  /** Envia orçamento WhatsApp, grava o valor e avança para Negociação. */
  @Post('oportunidades/:oportunidadeId/enviar-orcamento')
  enviarOrcamento(
    @EmpresaAtual() empresaId: string,
    @Param('oportunidadeId') oportunidadeId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(enviarOrcamentoSchema)) dto: z.infer<typeof enviarOrcamentoSchema>,
  ) {
    return this.servico.enviarOrcamento(empresaId, oportunidadeId, dto, usuario.id);
  }

  /** Simula uma mensagem recebida (apenas provedor mock) para testar o chatbot. */
  @Post('simulador/mensagem')
  async simular(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(simularSchema)) dto: z.infer<typeof simularSchema>,
  ) {
    const nomeInstancia = await this.servico.garantirInstanciaSimulada(empresaId, dto.nomeInstancia);
    return this.servico.processarMensagemRecebida({
      nomeInstancia,
      telefone: dto.telefone,
      nome: dto.nome,
      texto: dto.texto,
      idExterno: `sim_${Date.now()}`,
    });
  }
}
