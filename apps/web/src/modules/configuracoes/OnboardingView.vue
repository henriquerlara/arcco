<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2,
  Clock,
  KanbanSquare,
  Tags,
  Bot,
  MessageCircle,
} from 'lucide-vue-next';
import { SEGMENTO_ROTULOS } from '@arcco/contratos';
import MarcaArcco from '@/components/marca/MarcaArcco.vue';
import ArcosMarcaAgua from '@/components/marca/ArcosMarcaAgua.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import { servicoEmpresa } from '@/services';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';
import { cn } from '@/composables/cn';

const router = useRouter();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();

const passos = [
  { icone: Sparkles, titulo: 'Boas-vindas' },
  { icone: Building2, titulo: 'Empresa' },
  { icone: Clock, titulo: 'Atendimento' },
  { icone: KanbanSquare, titulo: 'Funil' },
  { icone: Tags, titulo: 'Categorias' },
  { icone: Bot, titulo: 'Chatbot' },
  { icone: MessageCircle, titulo: 'WhatsApp' },
];

const passoAtual = ref(0);
const salvando = ref(false);

const opcoesSegmento = Object.entries(SEGMENTO_ROTULOS).map(([valor, rotulo]) => ({
  valor,
  rotulo,
}));

const empresa = ref({
  segmento: auth.empresa?.segmento ?? 'MATERIAIS_CONSTRUCAO',
  telefone: auth.empresa?.telefone ?? '',
  cidade: auth.empresa?.cidade ?? '',
  estado: auth.empresa?.estado ?? '',
});

const horario = ref({ inicio: '08:00', fim: '18:00' });

const etapasPadrao = ['Novo lead', 'Qualificação', 'Orçamento enviado', 'Negociação', 'Ganho', 'Perdido'];
const categoriasSugeridas = ref(['Residencial', 'Comercial', 'Reforma']);
const novaCategoria = ref('');

const chatbot = ref({
  nome: 'Assistente ARCCO',
  mensagemInicial:
    'Olá! Aqui é o assistente da nossa loja. Para começar, pode me dizer seu nome e o que você procura para sua obra?',
});

const progresso = computed(() => Math.round(((passoAtual.value + 1) / passos.length) * 100));
const ehUltimo = computed(() => passoAtual.value === passos.length - 1);

function avancar() {
  if (!ehUltimo.value) passoAtual.value += 1;
  else void concluir();
}

function voltar() {
  if (passoAtual.value > 0) passoAtual.value -= 1;
}

function adicionarCategoria() {
  const v = novaCategoria.value.trim();
  if (v && !categoriasSugeridas.value.includes(v)) categoriasSugeridas.value.push(v);
  novaCategoria.value = '';
}

async function concluir(configurarDepois = false) {
  salvando.value = true;
  try {
    if (!configurarDepois) {
      await servicoEmpresa.atualizar({
        segmento: empresa.value.segmento as never,
        telefone: empresa.value.telefone,
        cidade: empresa.value.cidade,
        estado: empresa.value.estado,
      });
      await servicoEmpresa.salvarConfiguracoes({
        chatbot: {
          ativo: true,
          nome: chatbot.value.nome,
          mensagemInicial: chatbot.value.mensagemInicial,
          mensagemForaHorario: '',
          mensagemTransferencia: '',
          mensagemFinal: '',
        },
      });
    }
    await servicoEmpresa.concluirOnboarding();
    auth.marcarOnboardingConcluido();
    sucesso('Tudo pronto!', 'Sua conta está configurada.');
    await router.push({ name: 'dashboard' });
  } catch (e) {
    notificarErro(e, 'Não foi possível concluir o onboarding.');
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-preto text-marfim">
    <!-- Trilha de passos -->
    <aside class="relative hidden w-80 flex-col justify-between overflow-hidden bg-carvao p-10 lg:flex">
      <ArcosMarcaAgua class="absolute -bottom-20 -right-16 h-[440px] w-[440px] text-dourado/10" />
      <div class="relative z-10">
        <MarcaArcco tema="claro" tamanho="md" subtitulo="Configuração inicial" />
        <ol class="mt-10 space-y-1">
          <li
            v-for="(p, i) in passos"
            :key="i"
            :class="
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                i === passoAtual
                  ? 'bg-white/10 text-marfim'
                  : i < passoAtual
                    ? 'text-dourado-claro'
                    : 'text-marfim/40',
              )
            "
          >
            <span
              :class="
                cn(
                  'flex size-7 items-center justify-center rounded-full border text-xs',
                  i < passoAtual
                    ? 'border-dourado bg-dourado text-preto'
                    : i === passoAtual
                      ? 'border-dourado text-dourado-claro'
                      : 'border-white/15',
                )
              "
            >
              <Check v-if="i < passoAtual" class="size-4" />
              <component :is="p.icone" v-else class="size-3.5" />
            </span>
            {{ p.titulo }}
          </li>
        </ol>
      </div>
      <p class="relative z-10 text-xs text-marfim/40">Passo {{ passoAtual + 1 }} de {{ passos.length }}</p>
    </aside>

    <!-- Conteúdo -->
    <div class="flex w-full flex-col">
      <div class="h-1 w-full bg-carvao">
        <div class="h-full bg-dourado transition-all" :style="{ width: `${progresso}%` }" />
      </div>

      <div class="flex flex-1 items-center justify-center px-4 py-10">
        <div class="w-full max-w-xl rounded-lg border border-borda bg-superficie p-8 text-texto shadow-flutuante">
          <!-- Passo 0: Boas-vindas -->
          <div v-if="passoAtual === 0" class="text-center">
            <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-dourado/15 text-dourado-hover">
              <Sparkles class="size-7" />
            </div>
            <h2 class="fonte-marca text-3xl font-semibold">Bem-vindo à ARCCO</h2>
            <p class="mx-auto mt-3 max-w-md text-sm text-texto-secundario">
              Vamos configurar sua central comercial em 7 passos rápidos. Você pode pular
              e ajustar tudo depois nas configurações.
            </p>
          </div>

          <!-- Passo 1: Empresa -->
          <div v-else-if="passoAtual === 1" class="space-y-4">
            <h2 class="text-xl font-semibold">Sobre a empresa</h2>
            <div class="space-y-1.5">
              <Label>Segmento</Label>
              <Select v-model="empresa.segmento" :opcoes="opcoesSegmento" />
            </div>
            <div class="space-y-1.5">
              <Label>Telefone comercial</Label>
              <Input v-model="empresa.telefone" placeholder="(11) 90000-0000" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Cidade</Label>
                <Input v-model="empresa.cidade" />
              </div>
              <div class="space-y-1.5">
                <Label>Estado</Label>
                <Input v-model="empresa.estado" placeholder="UF" />
              </div>
            </div>
          </div>

          <!-- Passo 2: Atendimento -->
          <div v-else-if="passoAtual === 2" class="space-y-4">
            <h2 class="text-xl font-semibold">Horário de atendimento</h2>
            <p class="text-sm text-texto-secundario">
              Fora desse horário, o bot registra a solicitação e avisa que a equipe retorna depois.
            </p>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Abre às</Label>
                <Input v-model="horario.inicio" type="time" />
              </div>
              <div class="space-y-1.5">
                <Label>Fecha às</Label>
                <Input v-model="horario.fim" type="time" />
              </div>
            </div>
          </div>

          <!-- Passo 3: Funil -->
          <div v-else-if="passoAtual === 3" class="space-y-4">
            <h2 class="text-xl font-semibold">Seu funil de vendas</h2>
            <p class="text-sm text-texto-secundario">
              Já criamos um funil padrão. Você poderá renomear e reordenar as etapas depois.
            </p>
            <ul class="space-y-2">
              <li
                v-for="(etapa, i) in etapasPadrao"
                :key="etapa"
                class="flex items-center gap-3 rounded-md border border-borda bg-branco px-3 py-2.5 text-sm"
              >
                <span class="flex size-6 items-center justify-center rounded-full bg-marfim text-xs font-semibold text-texto-secundario">
                  {{ i + 1 }}
                </span>
                {{ etapa }}
              </li>
            </ul>
          </div>

          <!-- Passo 4: Categorias -->
          <div v-else-if="passoAtual === 4" class="space-y-4">
            <h2 class="text-xl font-semibold">Categorias de negócio</h2>
            <p class="text-sm text-texto-secundario">
              Categorias ajudam a segmentar oportunidades. Adicione as que fazem sentido.
            </p>
            <div class="flex gap-2">
              <Input
                v-model="novaCategoria"
                placeholder="Nova categoria"
                @keydown.enter.prevent="adicionarCategoria"
              />
              <Button variante="secundario" @click="adicionarCategoria">Adicionar</Button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="cat in categoriasSugeridas"
                :key="cat"
                class="rounded-full border border-dourado/30 bg-dourado/10 px-3 py-1 text-sm text-[#8a6d24]"
              >
                {{ cat }}
              </span>
            </div>
          </div>

          <!-- Passo 5: Chatbot -->
          <div v-else-if="passoAtual === 5" class="space-y-4">
            <h2 class="text-xl font-semibold">Assistente virtual</h2>
            <div class="space-y-1.5">
              <Label>Nome do assistente</Label>
              <Input v-model="chatbot.nome" />
            </div>
            <div class="space-y-1.5">
              <Label>Mensagem de saudação</Label>
              <Textarea v-model="chatbot.mensagemInicial" :rows="4" />
            </div>
          </div>

          <!-- Passo 6: WhatsApp -->
          <div v-else class="space-y-4 text-center">
            <div class="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-sucesso/12 text-sucesso">
              <MessageCircle class="size-7" />
            </div>
            <h2 class="text-xl font-semibold">Conecte o WhatsApp</h2>
            <p class="mx-auto max-w-md text-sm text-texto-secundario">
              A conexão do WhatsApp é feita nas configurações. Você pode conectar agora ou
              usar o simulador para testar o fluxo antes de ir ao ar.
            </p>
          </div>

          <!-- Navegação -->
          <div class="mt-8 flex items-center justify-between gap-3">
            <Button
              v-if="passoAtual > 0"
              variante="fantasma"
              @click="voltar"
            >
              <ChevronLeft class="size-4" />
              Voltar
            </Button>
            <span v-else />

            <div class="flex items-center gap-2">
              <Button variante="link" :disabled="salvando" @click="concluir(true)">
                Configurar depois
              </Button>
              <Button :carregando="salvando" @click="avancar">
                {{ ehUltimo ? 'Concluir' : 'Continuar' }}
                <ChevronRight v-if="!ehUltimo" class="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
