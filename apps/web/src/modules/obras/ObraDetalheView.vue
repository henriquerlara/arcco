<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { ArrowLeft, Pencil, Trash2, MapPin, Plus, Link2, X, User } from 'lucide-vue-next';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import ModalConfirmacao from '@/components/compartilhados/ModalConfirmacao.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import SeletorContato from '@/components/formularios/SeletorContato.vue';
import ObraFormulario from './ObraFormulario.vue';
import { servicoObras } from '@/services';
import { aplicarMascara, formatarTelefone, iniciais } from '@/composables/formatadores';
import { useNotificacao } from '@/composables/useNotificacao';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { PerfilUsuario } from '@arcco/contratos';

const rota = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();

const podeExcluir = computed(() =>
  auth.temPerfil(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR),
);

const id = computed(() => rota.params.id as string);
const formAberto = ref(false);
const confirmarExclusao = ref(false);
const excluindo = ref(false);
const vinculoAberto = ref(false);
const contatoParaVincular = ref<string | null>(null);
const papelVinculo = ref('');
const salvandoVinculo = ref(false);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['obra', id.value]),
  queryFn: () => servicoObras.obter(id.value),
});
const obra = computed(() => data.value);

const enderecoCompleto = computed(() => {
  const o = obra.value;
  if (!o) return '';
  return [o.endereco, o.bairro, o.cidade && `${o.cidade}/${o.estado ?? ''}`, o.cep && aplicarMascara('cep', o.cep)]
    .filter(Boolean)
    .join(' · ');
});

async function excluir() {
  excluindo.value = true;
  try {
    await servicoObras.excluir(id.value);
    sucesso('Projeto excluído.');
    await queryClient.invalidateQueries({ queryKey: ['obras'] });
    await router.push({ name: 'obras' });
  } catch (e) {
    notificarErro(e);
  } finally {
    excluindo.value = false;
  }
}

async function vincular() {
  if (!contatoParaVincular.value || !papelVinculo.value.trim()) return;
  salvandoVinculo.value = true;
  try {
    await servicoObras.vincularContato(id.value, contatoParaVincular.value, papelVinculo.value);
    sucesso('Pessoa vinculada ao projeto.');
    contatoParaVincular.value = null;
    papelVinculo.value = '';
    vinculoAberto.value = false;
    await refetch();
  } catch (e) {
    notificarErro(e);
  } finally {
    salvandoVinculo.value = false;
  }
}

async function desvincular(vinculoId: string) {
  try {
    await servicoObras.desvincularContato(id.value, vinculoId);
    sucesso('Vínculo removido.');
    await refetch();
  } catch (e) {
    notificarErro(e);
  }
}
</script>

<template>
  <div class="space-y-5">
    <RouterLink to="/app/obras" class="inline-flex items-center gap-1.5 text-sm text-texto-secundario hover:text-texto">
      <ArrowLeft class="size-4" /> Projetos
    </RouterLink>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
    <div v-else-if="isLoading" class="space-y-4">
      <Skeleton class="h-24 w-full" />
      <Skeleton class="h-64 w-full" />
    </div>

    <template v-else-if="obra">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-texto">{{ obra.nome }}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <BadgeStatus familia="statusObra" :valor="obra.status" />
            <span v-if="obra.tipo" class="text-sm text-texto-secundario">{{ obra.tipo }}</span>
          </div>
          <p v-if="enderecoCompleto" class="mt-2 flex items-center gap-1.5 text-sm text-texto-secundario">
            <MapPin class="size-4" /> {{ enderecoCompleto }}
          </p>
        </div>
        <div class="flex gap-2">
          <Button variante="secundario" @click="formAberto = true"><Pencil class="size-4" /> Editar</Button>
          <Button v-if="podeExcluir" variante="contorno" @click="confirmarExclusao = true">
            <Trash2 class="size-4 text-erro" />
          </Button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <!-- Contatos vinculados -->
        <Card class="lg:col-span-2">
          <CardHeader class="flex-row items-center justify-between">
            <CardTitle class="flex items-center gap-2"><Link2 class="size-4 text-dourado-hover" /> Pessoas do projeto</CardTitle>
            <Button variante="secundario" tamanho="sm" @click="vinculoAberto = true">
              <Plus class="size-4" /> Vincular
            </Button>
          </CardHeader>
          <CardContent>
            <ul v-if="obra.contatos?.length" class="divide-y divide-borda">
              <li
                v-for="vinculo in obra.contatos"
                :key="vinculo.id"
                class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <RouterLink
                  :to="`/app/contatos/${vinculo.contato.id}`"
                  class="flex items-center gap-3 hover:text-dourado-hover"
                >
                  <span class="flex size-9 items-center justify-center rounded-full bg-marfim text-xs font-semibold text-texto-secundario">
                    {{ iniciais(vinculo.contato.nome) }}
                  </span>
                  <span>
                    <span class="block text-sm font-medium text-texto">{{ vinculo.contato.nome }}</span>
                    <span class="block text-xs text-texto-secundario">
                      {{ vinculo.papel }} · {{ formatarTelefone(vinculo.contato.telefone) }}
                    </span>
                  </span>
                </RouterLink>
                <button
                  v-if="podeExcluir"
                  class="rounded-md p-1.5 text-texto-secundario hover:bg-marfim hover:text-erro"
                  @click="desvincular(vinculo.id)"
                >
                  <X class="size-4" />
                </button>
              </li>
            </ul>
            <div v-else class="flex flex-col items-center gap-2 py-8 text-center text-sm text-texto-secundario">
              <User class="size-6" />
              Nenhuma pessoa vinculada ainda.
            </div>
          </CardContent>
        </Card>

        <!-- Observações -->
        <Card class="h-fit">
          <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
          <CardContent>
            <p v-if="obra.observacoes" class="whitespace-pre-wrap text-sm text-texto">{{ obra.observacoes }}</p>
            <p v-else class="text-sm text-texto-secundario">Sem observações.</p>
          </CardContent>
        </Card>
      </div>
    </template>

    <ObraFormulario v-model="formAberto" :obra="obra" @salvo="refetch()" />

    <Dialog v-model="vinculoAberto" titulo="Vincular pessoa" descricao="Relacione uma pessoa a este projeto." tamanho="md">
      <div class="space-y-4">
        <div class="space-y-1.5">
          <Label obrigatorio>Pessoa</Label>
          <SeletorContato v-model="contatoParaVincular" />
        </div>
        <div class="space-y-1.5">
          <Label obrigatorio>Papel no projeto</Label>
          <Input v-model="papelVinculo" placeholder="Ex.: Arquiteto responsável, comprador…" />
        </div>
      </div>
      <template #rodape>
        <Button variante="secundario" @click="vinculoAberto = false">Cancelar</Button>
        <Button
          :carregando="salvandoVinculo"
          :disabled="!contatoParaVincular || !papelVinculo.trim()"
          @click="vincular"
        >
          Vincular
        </Button>
      </template>
    </Dialog>

    <ModalConfirmacao
      v-model="confirmarExclusao"
      titulo="Excluir projeto?"
      descricao="Os vínculos com pessoas e negócios serão desfeitos."
      texto-confirmar="Excluir"
      perigo
      :carregando="excluindo"
      @confirmar="excluir"
    />
  </div>
</template>
