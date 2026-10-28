<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { ExternalLink } from 'lucide-vue-next';
import { PersonalizacaoComercial } from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import { servicoNotasFiscais } from '@/services';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const auth = useAutenticacaoStore();
const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);

const { data, isLoading, isError } = useQuery({
  queryKey: ['focus-nfe-status'],
  queryFn: () => servicoNotasFiscais.statusIntegracao(),
});

const { data: homolog } = useQuery({
  queryKey: ['fiscal', 'status-homologacao'],
  queryFn: () => servicoNotasFiscais.statusHomologacao(),
  enabled: ecolume,
  retry: false,
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
            <Badge variante="neutro">
              Ambiente: {{ data.ambiente === 'producao' ? 'produção' : 'homologação' }}
            </Badge>
            <Badge v-if="homolog" :variante="homolog.p3Completo ? 'sucesso' : 'alerta'">
              Parâmetros fiscais (P3): {{ homolog.p3Completo ? 'completos' : 'pendentes' }}
            </Badge>
          </div>
          <p class="text-texto-secundario">{{ data.mensagem }}</p>

          <div
            class="space-y-1 rounded border border-borda bg-superficie p-3"
            data-testid="certificado-a1"
          >
            <p class="font-medium text-texto">Certificado digital A1</p>
            <p class="text-texto-secundario">
              {{
                data.certificado?.mensagem ??
                'O certificado A1 e a senha são gerenciados no painel da Focus NFe.'
              }}
            </p>
            <p class="text-xs text-texto-secundario">
              O ARCCO não pede arquivo .pfx nem senha de certificado. Apenas o token da API fica em
              variável de ambiente do servidor (<code class="text-texto">FOCUS_NFE_TOKEN</code>).
            </p>
          </div>

          <div v-if="homolog" class="space-y-1 text-texto-secundario">
            <p>
              Emissão real:
              <strong class="text-texto">
                {{ homolog.emissaoRealHabilitada ? 'habilitada' : 'bloqueada' }}
              </strong>
              · Carta de correção: {{ homolog.cartaCorrecaoReal ? 'Focus' : 'simulada (sem token)' }}
              · E-mail DANFE/XML: {{ homolog.emailDanfeReal ? 'Focus' : 'simulado (sem token)' }}
            </p>
            <p v-if="homolog.p3Faltando.length" class="text-xs">
              A preencher pelo contador (ECOL-02/P3):
              <span class="text-texto">{{ homolog.p3Faltando.join(', ') }}</span>
            </p>
            <p class="text-xs">
              Produção nunca é habilitada automaticamente; a homologação Sefaz real depende de
              token, parâmetros P3 e validação do contador.
            </p>
          </div>

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
