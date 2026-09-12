<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, Check, Sparkles } from 'lucide-vue-next';
import { SEGMENTO_ROTULOS, type SegmentoEmpresa } from '@arcco/contratos';
import MarcaArcco from '@/components/marca/MarcaArcco.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import { servicoEmpresa } from '@/services';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';

const router = useRouter();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);

const opcoesSegmento = Object.entries(SEGMENTO_ROTULOS).map(([valor, rotulo]) => ({ valor, rotulo }));
const segmento = ref(auth.empresa?.segmento ?? 'MATERIAIS_CONSTRUCAO');
const telefone = ref(auth.empresa?.telefone ?? '');
const cidade = ref(auth.empresa?.cidade ?? '');
const estado = ref(auth.empresa?.estado ?? '');

const prontoDeFabrica = [
  'Funil comercial automático',
  'Timeline orientada a eventos',
  'Assistente com respostas seguras',
  'Dados persistidos neste dispositivo',
];

async function concluir() {
  salvando.value = true;
  try {
    const atualizada = await servicoEmpresa.atualizar({
      segmento: segmento.value as SegmentoEmpresa,
      telefone: telefone.value.trim() || null,
      cidade: cidade.value.trim() || null,
      estado: estado.value.trim() || null,
    });
    if (auth.empresa) auth.empresa = { ...auth.empresa, ...atualizada };
    await servicoEmpresa.concluirOnboarding();
    auth.marcarOnboardingConcluido();
    sucesso('Tudo pronto.', 'A ARCCO já organizou o fluxo inicial para você.');
    await router.push({ name: 'dashboard' });
  } catch (erro) {
    notificarErro(erro, 'Não foi possível iniciar sua conta.');
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen bg-preto px-4 py-8 text-marfim sm:px-8 lg:flex lg:items-center lg:py-12">
    <div class="mx-auto grid w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-carvao shadow-flutuante lg:grid-cols-[0.9fr_1.1fr]">
      <section class="relative overflow-hidden p-8 sm:p-12">
        <div class="absolute -right-28 -top-24 size-80 rounded-full bg-dourado/10 blur-3xl" />
        <MarcaArcco tema="claro" tamanho="md" subtitulo="Seu comercial, organizado" />
        <div class="relative mt-16 max-w-md">
          <span class="inline-flex items-center gap-2 rounded-full border border-dourado/25 bg-dourado/10 px-3 py-1 text-xs text-dourado-claro">
            <Sparkles class="size-3.5" /> Configuração inteligente
          </span>
          <h1 class="fonte-marca mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
            Comece trabalhando.<br />O sistema cuida do processo.
          </h1>
          <p class="mt-5 text-sm leading-6 text-marfim/65">
            Escolha seu segmento e a ARCCO aplica padrões confiáveis. Você pode ajustar detalhes depois, quando houver uma necessidade real.
          </p>
          <ul class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <li v-for="item in prontoDeFabrica" :key="item" class="flex items-center gap-3 text-sm text-marfim/80">
              <span class="flex size-6 items-center justify-center rounded-full bg-sucesso/20 text-sucesso"><Check class="size-3.5" /></span>
              {{ item }}
            </li>
          </ul>
        </div>
      </section>

      <section class="bg-superficie p-6 text-texto sm:p-12">
        <div class="mx-auto max-w-lg">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-dourado-hover">Primeiro acesso</p>
          <h2 class="mt-2 text-2xl font-semibold">Só o essencial</h2>
          <p class="mt-2 text-sm text-texto-secundario">Nenhum destes dados, além do segmento, impede você de começar.</p>

          <form class="mt-8 space-y-5" @submit.prevent="concluir">
            <div class="space-y-1.5">
              <Label>Segmento</Label>
              <Select v-model="segmento" :opcoes="opcoesSegmento" />
              <p class="text-xs text-texto-secundario">Usado apenas para escolher categorias e perguntas iniciais.</p>
            </div>
            <div class="space-y-1.5">
              <Label>Telefone comercial <span class="font-normal text-texto-secundario">(opcional)</span></Label>
              <Input v-model="telefone" placeholder="(11) 90000-0000" autocomplete="tel" />
            </div>
            <div class="grid gap-4 sm:grid-cols-[1fr_96px]">
              <div class="space-y-1.5">
                <Label>Cidade <span class="font-normal text-texto-secundario">(opcional)</span></Label>
                <Input v-model="cidade" autocomplete="address-level2" />
              </div>
              <div class="space-y-1.5">
                <Label>UF</Label>
                <Input v-model="estado" maxlength="2" class="uppercase" autocomplete="address-level1" />
              </div>
            </div>
            <Button class="mt-3 w-full" tamanho="lg" :carregando="salvando" type="submit">
              Entrar na ARCCO <ArrowRight class="size-4" />
            </Button>
          </form>
        </div>
      </section>
    </div>
  </main>
</template>
