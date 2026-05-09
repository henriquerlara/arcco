<template>
  <main class="min-h-screen overflow-hidden bg-[#030303] text-stone-100 selection:bg-[#d7b35f]/30">
    <div class="pointer-events-none fixed inset-0 opacity-80">
      <div class="blob-float-a absolute left-1/2 top-[-18rem] h-[44rem] w-[44rem] -translate-x-1/2 rounded-full bg-[#d7b35f]/10 blur-3xl" />
      <div class="blob-float-b absolute right-[-14rem] top-[20rem] h-[34rem] w-[34rem] rounded-full bg-[#9f7b35]/10 blur-3xl" />
      <div class="blob-float-c absolute bottom-[-18rem] left-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#d7b35f]/8 blur-3xl" />
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_38%,#030303_75%)]" />
    </div>

    <nav class="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
      <a href="#" class="group flex items-center gap-4">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d7b35f]/25 bg-black p-2 shadow-[0_0_35px_rgba(215,179,95,.18)] transition group-hover:shadow-[0_0_45px_rgba(215,179,95,.32)]">
          <ArccoMark />
        </div>
        <div>
          <p class="font-serif text-2xl font-light leading-none tracking-[0.5em] text-[#d7b35f]">
            ARCCO
          </p>
          <p class="mt-1.5 text-[10px] uppercase tracking-[0.42em] text-stone-400">
            Inteligência Comercial
          </p>
        </div>
      </a>

      <a href="#contato" class="hidden rounded-full border border-[#d7b35f]/30 px-5 py-2 text-sm text-[#e6cf91] transition hover:border-[#d7b35f] hover:bg-[#d7b35f]/10 hover:shadow-[0_0_24px_rgba(215,179,95,.18)] md:block">
        Agendar apresentação
      </a>
    </nav>

    <section class="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-14 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pb-32 lg:pt-20">
      <div class="animate-fade-up">
        <div class="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d7b35f]/20 bg-[#d7b35f]/10 px-4 py-2 text-sm text-[#e6cf91] shadow-[0_0_30px_rgba(215,179,95,.08)]">
          <Sparkles class="h-4 w-4" />
          Tecnologia comercial para construção civil
        </div>

        <h1 class="max-w-4xl font-serif text-5xl leading-[0.98] tracking-tight text-white md:text-7xl lg:text-8xl">
          Dados da obra.
          <span class="title-shimmer block bg-[linear-gradient(110deg,#f4dc98_0%,#d7b35f_35%,#f4dc98_55%,#8f6c2e_75%,#f4dc98_100%)] bg-clip-text text-transparent">
            Fluxos no controle.
          </span>
        </h1>

        <p class="mt-7 max-w-2xl text-lg leading-8 text-stone-300 md:text-xl">
          A ARCCO transforma conversas, pedidos e prazos em uma operação comercial inteligente para construtoras, arquitetos e empresas de materiais de construção.
        </p>

        <div class="mt-10 flex flex-col gap-4 sm:flex-row">
          <a href="#contato" class="cta-glow group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#f1d98c] to-[#b98d3b] px-7 py-4 font-medium text-black shadow-[0_18px_70px_rgba(215,179,95,.25)] transition hover:scale-[1.02]">
            Quero modernizar minha operação
            <ArrowRight class="h-5 w-5 transition group-hover:translate-x-1" />
          </a>
          <a href="#solucao" class="inline-flex items-center justify-center rounded-full border border-white/10 px-7 py-4 font-medium text-stone-200 transition hover:border-[#d7b35f]/40 hover:bg-white/5">
            Ver solução
          </a>
        </div>
      </div>

      <div class="relative mx-auto w-full max-w-xl animate-scale-in">
        <div class="absolute inset-0 rounded-[3rem] bg-[#d7b35f]/20 blur-3xl" />
        <div class="panel-float relative overflow-hidden rounded-[3rem] border border-[#d7b35f]/20 bg-[#090806]/80 p-6 shadow-2xl backdrop-blur-xl">
          <div class="pointer-events-none absolute left-1/2 top-2 w-72 -translate-x-1/2 md:w-80">
            <ArccoMark decorative />
          </div>

          <div class="relative mt-44 rounded-[2.2rem] border border-white/10 bg-black/65 p-6">
            <div class="mb-5 flex items-center justify-between">
              <div>
                <p class="text-xs uppercase tracking-[0.34em] text-[#d7b35f]">Painel ARCCO</p>
                <h2 class="mt-2 text-2xl font-semibold">Obras em andamento</h2>
              </div>
              <div class="pulse-dot rounded-full bg-emerald-400/10 py-1 pl-5 pr-3 text-xs text-emerald-300">online</div>
            </div>

            <div class="space-y-3">
              <div
                v-for="(item, idx) in dashboardItems"
                :key="item.label"
                class="rounded-2xl border border-white/8 bg-white/[0.035] p-4 transition hover:border-[#d7b35f]/30 hover:bg-[#d7b35f]/5"
                data-reveal
                :data-reveal-delay="idx * 120"
              >
                <div class="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-stone-500">
                  <span>{{ item.label }}</span>
                  <CheckCircle2 class="h-4 w-4 text-[#d7b35f]" />
                </div>
                <p class="text-base text-stone-100">{{ item.value }}</p>
                <p class="mt-1 text-sm text-stone-500">{{ item.sub }}</p>
              </div>
            </div>

            <div class="mt-5 grid grid-cols-3 gap-3">
              <div
                v-for="(stat, idx) in stats"
                :key="stat.label"
                class="rounded-2xl bg-[#d7b35f]/10 p-4 text-center transition hover:bg-[#d7b35f]/20"
                data-reveal="zoom"
                :data-reveal-delay="400 + idx * 110"
              >
                <p class="font-serif text-2xl text-[#f1d98c]">{{ stat.number }}</p>
                <p class="mt-1 text-xs text-stone-400">{{ stat.label }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="solucao" class="relative z-10 py-24">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.018] to-transparent" />
      <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d7b35f]/25 to-transparent" />
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d7b35f]/25 to-transparent" />

      <div class="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div class="mx-auto max-w-3xl text-center">
          <p class="text-sm uppercase tracking-[0.34em] text-[#d7b35f]" data-reveal>O que entregamos</p>
          <h2 class="mt-4 font-serif text-4xl text-white md:text-6xl" data-reveal data-reveal-delay="120">
            Uma camada de inteligência sobre sua operação
          </h2>
          <p class="mt-5 text-lg leading-8 text-stone-400" data-reveal data-reveal-delay="220">
            Criamos automações e sistemas comerciais sob medida para empresas que precisam transformar atendimento em dados, e dados em decisão.
          </p>
        </div>

        <div class="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="(service, idx) in services"
            :key="service.title"
            class="card-lift group rounded-[2rem] border border-white/10 bg-[#080808]/80 p-6 hover:border-[#d7b35f]/35 hover:bg-[#0d0b06]"
            data-reveal
            :data-reveal-delay="idx * 130"
          >
            <div class="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d7b35f]/10 text-[#f1d98c] ring-1 ring-[#d7b35f]/20 transition group-hover:bg-[#d7b35f]/20 group-hover:ring-[#d7b35f]/40">
              <component :is="service.icon" class="h-6 w-6" />
            </div>
            <h3 class="text-xl font-semibold text-white">{{ service.title }}</h3>
            <p class="mt-3 leading-7 text-stone-400">{{ service.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
      <div>
        <p class="text-sm uppercase tracking-[0.34em] text-[#d7b35f]" data-reveal="left">Método ARCCO</p>
        <h2 class="mt-4 font-serif text-4xl text-white md:text-6xl" data-reveal="left" data-reveal-delay="100">
          Da conversa ao controle operacional
        </h2>
        <p class="mt-6 text-lg leading-8 text-stone-400" data-reveal="left" data-reveal-delay="200">
          Nossa estética comunica precisão, sofisticação e autoridade. Nossa tecnologia entrega o que a construção precisa: clareza, velocidade e rastreabilidade.
        </p>
      </div>

      <div class="rounded-[2.6rem] border border-white/10 bg-[#080808]/80 p-5 md:p-8" data-reveal="right">
        <div class="space-y-4">
          <div
            v-for="(step, index) in steps"
            :key="step"
            class="flex gap-5 rounded-[1.6rem] border border-white/8 bg-white/[0.035] p-5 transition hover:border-[#d7b35f]/30 hover:bg-[#0d0b06]"
            data-reveal="right"
            :data-reveal-delay="index * 140 + 200"
          >
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f1d98c] to-[#9b742e] font-serif text-xl text-black shadow-[0_0_24px_rgba(215,179,95,.4)]">
              {{ index + 1 }}
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">{{ step }}</h3>
              <p class="mt-1 text-stone-500">Processo simples, visual e pensado para virar rotina dentro da empresa.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative z-10 mx-auto max-w-7xl px-6 pb-24 lg:px-8">
      <div class="grid overflow-hidden rounded-[3rem] border border-[#d7b35f]/20 bg-gradient-to-br from-[#100d07] to-[#030303] lg:grid-cols-3">
        <div
          v-for="(item, idx) in highlights"
          :key="item.title"
          class="border-white/10 p-8 transition hover:bg-[#d7b35f]/5 lg:border-r last:border-r-0"
          data-reveal
          :data-reveal-delay="idx * 150"
        >
          <component :is="item.icon" class="h-8 w-8 text-[#d7b35f]" />
          <h3 class="mt-6 text-2xl font-semibold text-white">{{ item.title }}</h3>
          <p class="mt-3 leading-7 text-stone-400">{{ item.text }}</p>
        </div>
      </div>
    </section>

    <section id="contato" class="relative z-10 mx-auto max-w-5xl px-6 pb-28 text-center lg:px-8">
      <div class="rounded-[3rem] border border-[#d7b35f]/25 bg-[#070604]/90 p-10 shadow-[0_0_90px_rgba(215,179,95,.12)] md:p-16" data-reveal="zoom">
        <div class="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#d7b35f]/10 text-[#f1d98c] ring-1 ring-[#d7b35f]/25">
          <Users class="h-8 w-8" />
        </div>
        <p class="text-sm uppercase tracking-[0.34em] text-[#d7b35f]">Pronto para escalar?</p>
        <h2 class="mt-4 font-serif text-4xl text-white md:text-6xl">Transforme atendimento em inteligência comercial</h2>
        <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-stone-400">
          Fale com a ARCCO e veja como automatizar coleta de dados, acompanhamento de obras, relacionamento com clientes e gestão comercial.
        </p>
        <a :href="whatsappLink" class="cta-glow mt-10 inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#f1d98c] to-[#b98d3b] px-8 py-4 font-medium text-black shadow-[0_18px_70px_rgba(215,179,95,.25)] transition hover:scale-[1.02]">
          Chamar no WhatsApp
          <ArrowRight class="h-5 w-5" />
        </a>
      </div>
    </section>

    <footer class="relative z-10 px-6 py-10 text-center text-xs uppercase tracking-[0.42em] text-stone-500 lg:px-8">
      © {{ new Date().getFullYear() }} ARCCO · Inteligência Comercial
    </footer>
  </main>
</template>

<script setup>
import {
  ArrowRight,
  Building2,
  Bot,
  CheckCircle2,
  DatabaseZap,
  Gauge,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-vue-next'

import ArccoMark from '@/components/ArccoMark.vue'
import { useScrollReveal } from '@/composables/useScrollReveal'

useScrollReveal()

const whatsappLink = 'https://wa.me/5500000000000'

const dashboardItems = [
  {
    label: 'Cliente',
    value: 'Construtora Horizonte',
    sub: 'Atualizado via WhatsApp',
  },
  {
    label: 'Entrega',
    value: 'Porcelanato — 22/05',
    sub: 'Confirmação pendente',
  },
  {
    label: 'Projeto',
    value: 'Residencial Alto Jardim',
    sub: 'Etapa: acabamento',
  },
]

const stats = [
  { number: '24/7', label: 'coleta ativa' },
  { number: '100%', label: 'dados organizados' },
  { number: '+obra', label: 'menos ruído' },
]

const services = [
  {
    icon: MessageCircle,
    title: 'Coleta automática pelo WhatsApp',
    text: 'Fluxos inteligentes perguntam, organizam e atualizam dados de clientes, entregas, prazos e obras sem depender de planilhas soltas.',
  },
  {
    icon: DatabaseZap,
    title: 'Banco de dados comercial vivo',
    text: 'Cada resposta vira informação estruturada: cliente, projeto, etapa, status, histórico e próximos passos prontos para consulta.',
  },
  {
    icon: Workflow,
    title: 'Gestão do fluxo da obra',
    text: 'Construtoras, arquitetos e distribuidores acompanham múltiplos projetos com clareza sobre pedidos, entregas e pendências.',
  },
  {
    icon: Bot,
    title: 'Automação com inteligência',
    text: 'Assistentes digitais reduzem retrabalho, padronizam o atendimento e mantêm o time comercial sempre informado.',
  },
]

const steps = [
  'Mapeamos o processo atual da empresa',
  'Criamos o fluxo de atendimento e coleta',
  'Integramos WhatsApp, banco de dados e painel',
  'Otimizamos a rotina comercial e operacional',
]

const highlights = [
  {
    icon: Building2,
    title: 'Construção civil',
    text: 'Linguagem, processos e dores reais do setor.',
  },
  {
    icon: Gauge,
    title: 'Operação rápida',
    text: 'Menos mensagens perdidas, mais previsibilidade.',
  },
  {
    icon: ShieldCheck,
    title: 'Dados confiáveis',
    text: 'Histórico estruturado para decisões comerciais.',
  },
]
</script>

<style scoped>
.animate-fade-up {
  animation: fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.animate-scale-in {
  animation: scale-in 1s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(28px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-fade-up,
  .animate-scale-in {
    animation: none;
  }
}
</style>
