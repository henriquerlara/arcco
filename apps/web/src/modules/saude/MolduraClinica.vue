<script setup lang="ts">
import MarcaArcco from '@/components/marca/MarcaArcco.vue';

defineProps<{
  titulo: string;
  subtitulo?: string;
}>();
</script>

<template>
  <main class="clinica-auth relative h-dvh overflow-hidden text-[#e7f4f2]">
    <section class="relative grid h-full lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div class="relative hidden h-full flex-col justify-between overflow-hidden px-12 py-10 lg:flex xl:px-16 xl:py-12">
        <header class="relative z-10">
          <MarcaArcco tema="claro" tamanho="xl" />
          <p class="mt-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9ee0d6]">Clínica</p>
        </header>

        <div class="relative z-10 max-w-xl py-8">
          <p class="mb-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#9ee0d6]/80">
            Recepção
          </p>
          <h2 class="fonte-marca text-[clamp(2.5rem,5vw,4.25rem)] leading-[0.98] text-white">
            O dia da clínica, em ordem.
          </h2>
          <p class="mt-7 max-w-md text-[15px] leading-relaxed text-[#e7f4f2]/70">
            Horário, paciente e profissional no mesmo lugar. A equipe confirma, atende e acompanha o estoque sem sair da agenda.
          </p>

          <div class="mt-12 flex max-w-md flex-col gap-3">
            <div class="max-w-[92%] rounded-md border border-white/10 bg-white/10 px-4 py-3 text-sm">
              <p class="font-semibold">09:00 · Helena Duarte</p>
              <p class="mt-1 text-xs text-[#e7f4f2]/70">Cardiologia · Dr. João Silva · Unimed</p>
            </div>
            <p class="border-l-2 border-[#7dcec4] pl-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ee0d6]">
              Confirmada · sala da manhã
            </p>
            <div class="self-end rounded-md bg-[#7dcec4] px-4 py-3 text-sm font-semibold text-[#08343a]">
              Próximo horário livre · 10:00
            </div>
          </div>
        </div>

        <footer class="relative z-10 flex items-center justify-between text-[11px] tracking-wide text-[#e7f4f2]/40">
          <span>© {{ new Date().getFullYear() }} ARCCO</span>
          <span class="uppercase tracking-[0.2em]">Agenda → consulta → cuidado</span>
        </footer>
      </div>

      <div class="relative flex h-full items-center justify-center overflow-hidden bg-[#f4f8f7] px-5 py-8 sm:px-10 lg:px-14">
        <div class="absolute inset-0 bg-[#0b3d45] lg:hidden" aria-hidden="true" />
        <div class="relative z-10 w-full max-w-[440px]">
          <div class="mb-10 flex flex-col items-center lg:hidden">
            <MarcaArcco tema="claro" tamanho="lg" />
            <p class="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9ee0d6]">Clínica</p>
          </div>

          <div class="border border-[#d3e4e1] bg-white p-7 sm:p-9">
            <p class="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-[#148f82]">Recepção</p>
            <h1 class="fonte-marca text-[2.35rem] leading-none text-[#14343a] sm:text-[2.6rem]">{{ titulo }}</h1>
            <p v-if="subtitulo" class="mt-3 max-w-sm text-sm leading-relaxed text-[#5d7578]">{{ subtitulo }}</p>
            <div class="mt-8">
              <slot />
            </div>
          </div>

          <div v-if="$slots.rodape" class="mt-7 text-center text-sm text-[#e7f4f2]/70 lg:text-[#5d7578]">
            <slot name="rodape" />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.clinica-auth {
  background:
    radial-gradient(ellipse 70% 50% at 15% 100%, rgba(28, 155, 138, 0.28), transparent 55%),
    linear-gradient(165deg, #0e5964 0%, #0b3d45 48%, #082f36 100%);
}
</style>
