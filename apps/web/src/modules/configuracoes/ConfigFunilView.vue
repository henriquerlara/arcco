<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { Check, LockKeyhole, Sparkles } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import { servicoFunil } from '@/services';

const query = useQuery({ queryKey: ['etapas-funil'], queryFn: () => servicoFunil.listar() });
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Processo comercial" descricao="Um fluxo curto e estável permite que as automações saibam exatamente o que fazer." />
    <NavConfiguracoes />
    <EstadoErro v-if="query.isError.value" :erro="query.error.value" @tentar-novamente="query.refetch()" />

    <Card v-else class="max-w-3xl overflow-hidden">
      <CardContent class="p-0">
        <div class="flex items-start gap-3 border-b border-borda bg-marfim/70 p-5">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-dourado/15 text-dourado-hover"><Sparkles class="size-4" /></span>
          <div>
            <h2 class="font-semibold text-texto">A ARCCO mantém o processo consistente</h2>
            <p class="mt-1 text-sm text-texto-secundario">Chatbot, envio de orçamento e conclusão de atividades atualizam o negócio automaticamente. Mudanças manuais continuam disponíveis no detalhe apenas para correções.</p>
          </div>
        </div>

        <div v-if="query.isLoading.value" class="space-y-3 p-5">
          <Skeleton v-for="n in 5" :key="n" class="h-14 w-full" />
        </div>
        <ol v-else class="divide-y divide-borda">
          <li v-for="(etapa, indice) in query.data.value" :key="etapa.id" class="flex items-center gap-4 px-5 py-4">
            <span class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold" :class="etapa.tipo === 'GANHA' ? 'bg-sucesso/15 text-sucesso' : etapa.tipo === 'PERDIDA' ? 'bg-erro/12 text-erro' : 'bg-dourado/15 text-dourado-hover'">
              <Check v-if="etapa.tipo !== 'ABERTA'" class="size-4" />
              <template v-else>{{ indice + 1 }}</template>
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-texto">{{ etapa.nome }}</p>
              <p class="text-xs text-texto-secundario">{{ etapa.chaveSistema }}</p>
            </div>
            <LockKeyhole class="size-4 text-texto-secundario/60" aria-label="Etapa protegida" />
          </li>
        </ol>
      </CardContent>
    </Card>
  </div>
</template>
