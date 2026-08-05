<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Building2,
  Target,
  MessageSquare,
} from 'lucide-vue-next';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import ModalConfirmacao from '@/components/compartilhados/ModalConfirmacao.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import ContatoFormulario from './ContatoFormulario.vue';
import { servicoContatos } from '@/services';
import { formatarTelefone, formatarData, iniciais } from '@/composables/formatadores';
import { ROTULO_TIPO_CONTATO } from '@/composables/rotulos';
import { useNotificacao } from '@/composables/useNotificacao';

const rota = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const id = computed(() => rota.params.id as string);
const formAberto = ref(false);
const confirmarExclusao = ref(false);
const excluindo = ref(false);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['contato', id.value]),
  queryFn: () => servicoContatos.obter(id.value),
});

const contato = computed(() => data.value);

const dadosPersonalizados = computed(() =>
  Object.entries(contato.value?.dadosPersonalizados ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  ),
);

async function excluir() {
  excluindo.value = true;
  try {
    await servicoContatos.excluir(id.value);
    sucesso('Contato excluído.');
    await queryClient.invalidateQueries({ queryKey: ['contatos'] });
    await router.push({ name: 'contatos' });
  } catch (e) {
    notificarErro(e);
  } finally {
    excluindo.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <RouterLink
      to="/app/contatos"
      class="inline-flex items-center gap-1.5 text-sm text-texto-secundario hover:text-texto"
    >
      <ArrowLeft class="size-4" /> Contatos
    </RouterLink>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />

    <div v-else-if="isLoading" class="space-y-4">
      <Skeleton class="h-24 w-full" />
      <div class="grid gap-4 lg:grid-cols-3">
        <Skeleton class="h-64 lg:col-span-2" />
        <Skeleton class="h-64" />
      </div>
    </div>

    <template v-else-if="contato">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-4">
          <span class="flex size-14 items-center justify-center rounded-full bg-carvao text-lg font-semibold text-dourado-claro">
            {{ iniciais(contato.nome) }}
          </span>
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-texto">{{ contato.nome }}</h1>
            <div class="mt-1 flex items-center gap-2">
              <Badge variante="dourado">{{ ROTULO_TIPO_CONTATO[contato.tipo] }}</Badge>
              <span v-if="contato.empresaNome" class="text-sm text-texto-secundario">
                {{ contato.empresaNome }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <Button variante="secundario" @click="formAberto = true">
            <Pencil class="size-4" /> Editar
          </Button>
          <Button variante="contorno" @click="confirmarExclusao = true">
            <Trash2 class="size-4 text-erro" />
          </Button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
          <!-- Oportunidades -->
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Target class="size-4 text-dourado-hover" /> Oportunidades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-sm text-texto-secundario">
                {{ contato.totalOportunidades ?? 0 }} oportunidade(s) vinculada(s) a este contato.
              </p>
            </CardContent>
          </Card>

          <!-- Observações -->
          <Card v-if="contato.observacoes">
            <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
            <CardContent>
              <p class="whitespace-pre-wrap text-sm text-texto">{{ contato.observacoes }}</p>
            </CardContent>
          </Card>

          <!-- Campos personalizados -->
          <Card v-if="dadosPersonalizados.length">
            <CardHeader><CardTitle>Informações adicionais</CardTitle></CardHeader>
            <CardContent>
              <dl class="grid gap-3 sm:grid-cols-2">
                <div v-for="[chave, valor] in dadosPersonalizados" :key="chave">
                  <dt class="text-xs text-texto-secundario">{{ chave }}</dt>
                  <dd class="text-sm font-medium text-texto">{{ valor }}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <!-- Coluna lateral -->
        <Card class="h-fit">
          <CardHeader><CardTitle>Dados de contato</CardTitle></CardHeader>
          <CardContent class="space-y-3 text-sm">
            <p class="flex items-center gap-2">
              <Phone class="size-4 text-texto-secundario" />
              {{ formatarTelefone(contato.telefone) }}
            </p>
            <p v-if="contato.email" class="flex items-center gap-2">
              <Mail class="size-4 text-texto-secundario" />
              {{ contato.email }}
            </p>
            <p v-if="contato.origem" class="flex items-center gap-2">
              <MessageSquare class="size-4 text-texto-secundario" />
              Origem: {{ contato.origem }}
            </p>
            <p v-if="contato.responsavel" class="flex items-center gap-2">
              <Building2 class="size-4 text-texto-secundario" />
              Responsável: {{ contato.responsavel.nome }}
            </p>
            <p class="pt-2 text-xs text-texto-secundario">
              Criado em {{ formatarData(contato.criadoEm) }}
            </p>
          </CardContent>
        </Card>
      </div>
    </template>

    <ContatoFormulario v-model="formAberto" :contato="contato" @salvo="refetch()" />
    <ModalConfirmacao
      v-model="confirmarExclusao"
      titulo="Excluir contato?"
      descricao="Esta ação não poderá ser desfeita."
      texto-confirmar="Excluir"
      perigo
      :carregando="excluindo"
      @confirmar="excluir"
    />
  </div>
</template>
