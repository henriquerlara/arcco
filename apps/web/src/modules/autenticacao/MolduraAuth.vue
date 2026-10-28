<script setup lang="ts">
import MarcaArcco from '@/components/marca/MarcaArcco.vue';

defineProps<{
  titulo: string;
  subtitulo?: string;
  frase?: string;
  chamada?: string;
  semRolagem?: boolean;
}>();
</script>

<template>
  <main
    class="auth-shell relative bg-[#041c20] text-marfim"
    :class="semRolagem ? 'h-dvh overflow-hidden' : 'min-h-screen overflow-x-hidden'"
  >
    <div class="auth-beam" aria-hidden="true" />
    <div class="auth-grain" aria-hidden="true" />

    <section
      class="relative grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
      :class="semRolagem ? 'h-full' : 'min-h-screen'"
    >
      <!-- Painel de marca -->
      <div
        class="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16 xl:py-12"
        :class="semRolagem ? 'h-full' : 'min-h-screen'"
      >
        <div class="auth-horizon absolute inset-0" aria-hidden="true" />

        <header class="relative z-10">
          <MarcaArcco tema="claro" tamanho="xl" />
        </header>

        <div class="relative z-10 max-w-xl py-8">
          <p class="mb-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-dourado-claro/70">
            {{ chamada ?? 'Inteligência comercial' }}
          </p>
          <h2 class="auth-heading fonte-marca text-[clamp(2.5rem,5vw,4.25rem)] leading-[0.98] text-white">
            {{ frase ?? 'O comercial que escuta o WhatsApp.' }}
          </h2>
          <p class="mt-7 max-w-md text-[15px] leading-relaxed text-marfim/55">
            Cada mensagem vira contexto, prazo e próxima ação — sem caçar conversa no celular.
          </p>

          <div class="auth-thread mt-12 max-w-md">
            <div class="auth-bubble auth-bubble--in">
              Preciso do orçamento até sexta, obra em Lourdes.
            </div>
            <div class="auth-bubble auth-bubble--meta">
              <span class="text-dourado-claro">Detectado</span>
              · prazo sexta · projeto Lourdes · prioridade alta
            </div>
            <div class="auth-bubble auth-bubble--out">
              OP-0042 criada · retornar amanhã 9h
            </div>
          </div>
        </div>

        <footer class="relative z-10 flex items-center justify-between text-[11px] tracking-wide text-marfim/30">
          <span>© {{ new Date().getFullYear() }} ARCCO</span>
          <span class="uppercase tracking-[0.2em]">Conversa → contexto → ação</span>
        </footer>
      </div>

      <!-- Formulário -->
      <div
        class="relative flex items-center justify-center px-5 py-8 sm:px-10 lg:bg-superficie lg:px-14"
        :class="semRolagem ? 'h-full overflow-hidden' : 'min-h-screen'"
      >
        <div class="absolute inset-0 bg-[#041c20] lg:hidden" aria-hidden="true" />
        <div class="auth-beam auth-beam--mobile lg:hidden" aria-hidden="true" />

        <div class="relative z-10 w-full max-w-[440px]">
          <div class="mb-10 flex justify-center lg:hidden">
            <MarcaArcco tema="claro" tamanho="lg" />
          </div>

          <div class="auth-form-card border border-borda/70 bg-branco p-7 shadow-[0_40px_100px_-40px_rgba(4,28,32,0.55)] sm:p-9">
            <p class="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-dourado-hover">
              Acesso
            </p>
            <h1 class="fonte-marca text-[2.35rem] leading-none text-texto sm:text-[2.6rem]">
              {{ titulo }}
            </h1>
            <p v-if="subtitulo" class="mt-3 max-w-sm text-sm leading-relaxed text-texto-secundario">
              {{ subtitulo }}
            </p>
            <div class="mt-8">
              <slot />
            </div>
          </div>

          <div
            v-if="$slots.rodape"
            class="mt-7 text-center text-sm text-marfim/55 lg:text-texto-secundario"
          >
            <slot name="rodape" />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-shell {
  isolation: isolate;
}

.auth-horizon {
  background:
    radial-gradient(ellipse 80% 50% at 20% 110%, rgba(57, 120, 94, 0.22), transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% -10%, rgba(184, 170, 151, 0.18), transparent 50%),
    linear-gradient(165deg, #062a30 0%, #041c20 45%, #031416 100%);
}

.auth-beam {
  pointer-events: none;
  position: absolute;
  inset: auto auto 0 0;
  width: 70%;
  height: 55%;
  background: linear-gradient(115deg, transparent 20%, rgba(217, 206, 192, 0.07) 48%, transparent 72%);
  filter: blur(2px);
  z-index: 0;
}

.auth-beam--mobile {
  inset: 0;
  width: 100%;
  height: 45%;
  background: radial-gradient(ellipse at 50% 0%, rgba(184, 170, 151, 0.2), transparent 60%);
}

.auth-grain {
  pointer-events: none;
  position: absolute;
  inset: 0;
  opacity: 0.35;
  z-index: 1;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
}

.auth-thread {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  animation: auth-rise 0.8s 0.15s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.auth-bubble {
  max-width: 92%;
  padding: 0.85rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.45;
  animation: auth-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.auth-bubble--in {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(241, 237, 228, 0.88);
  border-radius: 4px 18px 18px 18px;
  animation-delay: 0.25s;
}

.auth-bubble--meta {
  align-self: stretch;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(241, 237, 228, 0.45);
  border-left: 2px solid rgba(184, 170, 151, 0.55);
  padding: 0.5rem 0 0.5rem 0.85rem;
  background: transparent;
  animation-delay: 0.45s;
}

.auth-bubble--out {
  align-self: flex-end;
  background: linear-gradient(135deg, #b8aa97, #9a8b76);
  color: #041c20;
  font-weight: 600;
  border-radius: 18px 4px 18px 18px;
  animation-delay: 0.65s;
}

.auth-form-card {
  animation: auth-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes auth-rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (min-width: 1024px) and (max-height: 820px) {
  .auth-heading {
    font-size: 3rem;
  }
  .auth-thread {
    margin-top: 1.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-form-card,
  .auth-thread,
  .auth-bubble {
    animation: none;
  }
}
</style>
