<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { ExternalLink } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import { servicoNotasFiscais } from '@/services';

const { data, isLoading, isError } = useQuery({
  queryKey: ['focus-nfe-status'],
  queryFn: () => servicoNotasFiscais.statusIntegracao(),
});
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina
      titulo="Nota fiscal"
      descricao="Integração Focus NFe para emissão de NF-e a partir de orçamentos convertidos."
    />
    <NavConfiguracoes />

    <Card>
      <CardHeader>
        <CardTitle>Focus NFe</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4 text-sm">
        <template v-if="isLoading">
          <Skeleton class="h-4 w-48" />
          <Skeleton class="h-4 w-64" />
        </template>
        <template v-else-if="isError">
          <p class="text-erro">Não foi possível consultar o status da integração.</p>
        </template>
        <template v-else-if="data">
          <div class="flex flex-wrap items-center gap-2">
            <Badge :variante="data.configurado ? 'sucesso' : 'alerta'">
              {{ data.modo === 'mock' ? 'Modo mock' : 'Focus conectado' }}
            </Badge>
            <Badge variante="neutro">Ambiente: {{ data.ambiente }}</Badge>
          </div>
          <p class="text-texto-secundario">{{ data.mensagem }}</p>
          <ul class="list-disc space-y-1 pl-5 text-texto-secundario">
            <li>
              Configure <code class="text-texto">FOCUS_NFE_TOKEN</code> e
              <code class="text-texto">FOCUS_NFE_ENV</code> no <code class="text-texto">.env</code> da
              API.
            </li>
            <li>Cadastre CNPJ/IE da empresa e endereço fiscal em Empresa.</li>
            <li>Cadastre NCM nos produtos e CPF/CNPJ na pessoa do negócio.</li>
            <li>
              Emita pelo detalhe do negócio (etapa Ganha + orçamento convertido).
            </li>
          </ul>
          <a
            href="https://focusnfe.com.br/doc/"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm font-medium text-carvao underline-offset-2 hover:underline"
          >
            Documentação Focus NFe
            <ExternalLink class="size-3.5" />
          </a>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
