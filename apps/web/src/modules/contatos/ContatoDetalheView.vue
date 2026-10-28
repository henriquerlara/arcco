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
  HardHat,
  Plus,
  ShoppingBag,
  History,
  Paperclip,
  Wallet,
} from 'lucide-vue-next';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import ModalConfirmacao from '@/components/compartilhados/ModalConfirmacao.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Button from '@/components/ui/Button.vue';
import ContatoFormulario from './ContatoFormulario.vue';
import OportunidadeFormulario from '@/modules/oportunidades/OportunidadeFormulario.vue';
import { servicoArquivos, servicoContatos } from '@/services';
import { formatarTelefone, formatarData, formatarMoeda, iniciais } from '@/composables/formatadores';
import { ROTULO_TIPO_CONTATO } from '@/composables/rotulos';
import { useNotificacao } from '@/composables/useNotificacao';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import {
  PerfilUsuario,
  PersonalizacaoComercial,
  PermissaoComercial,
  TipoParceiro,
} from '@arcco/contratos';

const ROTULO_TIPO_PARCEIRO: Record<string, string> = {
  [TipoParceiro.ARQUITETO_DESIGNER]: 'Arquiteto/Designer',
  [TipoParceiro.INSTALADOR_ELETRICISTA]: 'Instalador/Eletricista',
  [TipoParceiro.CONSTRUTORA]: 'Construtora',
};

const rota = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);
const veioParceiros = computed(() => rota.name === 'parceiro-detalhe');
const podeVerPagamentos = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.VER_PAGAMENTOS),
);
const podeVerComissoes = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.VER_COMISSOES),
);

const ficha = computed(() => (ecolume.value ? data.value?.fichaCliente : undefined));
const mostrarParceria = computed(
  () => ecolume.value && (veioParceiros.value || Boolean(data.value?.ehParceiro)),
);
const extrato = computed(() => data.value?.extratoComissoes ?? []);
const negociosAbertos = computed(() => data.value?.negociosAbertos ?? []);

const ROTULO_STATUS: Record<string, string> = {
  A_PAGAR: 'A pagar',
  PAGA: 'Paga',
  CANCELADA: 'Cancelada',
};
function rotuloStatus(status: string): string {
  if (ROTULO_STATUS[status]) return ROTULO_STATUS[status];
  const texto = status.toLowerCase().replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
function varianteStatus(status: string): 'sucesso' | 'alerta' | 'erro' | 'info' | 'neutro' {
  if (['FINALIZADO', 'PAGA', 'ACEITO', 'CONVERTIDO'].includes(status)) return 'sucesso';
  if (['CONFIRMADO', 'A_PAGAR', 'ENVIADO'].includes(status)) return 'alerta';
  if (['CANCELADO', 'CANCELADA', 'RECUSADO'].includes(status)) return 'erro';
  return 'neutro';
}
function resumoChecklist(
  checklist: Array<{ concluido: boolean; aplicavel: boolean }>,
): string | null {
  const aplicaveis = checklist.filter((i) => i.aplicavel);
  if (!aplicaveis.length) return null;
  return `Checklist ${aplicaveis.filter((i) => i.concluido).length}/${aplicaveis.length}`;
}
async function abrirArquivo(arquivoId: string) {
  try {
    await servicoArquivos.abrir(arquivoId);
  } catch (e) {
    notificarErro(e);
  }
}

const podeExcluir = computed(() =>
  auth.temPerfil(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR),
);

const id = computed(() => rota.params.id as string);
const formAberto = ref(false);
const negocioAberto = ref(false);
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
    sucesso(
      veioParceiros.value
        ? 'Parceiro excluído.'
        : ecolume.value
          ? 'Cliente excluído.'
          : 'Pessoa excluída.',
    );
    await queryClient.invalidateQueries({ queryKey: ['contatos'] });
    await router.push({
      name: veioParceiros.value ? 'parceiros' : ecolume.value ? 'clientes' : 'contatos',
    });
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
      :to="veioParceiros ? '/app/parceiros' : ecolume ? '/app/clientes' : '/app/contatos'"
      class="inline-flex items-center gap-1.5 text-sm text-texto-secundario hover:text-texto"
    >
      <ArrowLeft class="size-4" />
      {{ veioParceiros ? 'Parceiros' : ecolume ? 'Clientes' : 'Pessoas' }}
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
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <Badge v-if="ecolume && contato.natureza" variante="dourado">
                {{ contato.natureza === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física' }}
              </Badge>
              <Badge v-else variante="dourado">{{ ROTULO_TIPO_CONTATO[contato.tipo] }}</Badge>
              <Badge v-if="contato.ehParceiro" variante="neutro">Parceiro</Badge>
              <span
                v-if="contato.nomeFantasia || contato.empresaNome"
                class="text-sm text-texto-secundario"
              >
                {{ contato.nomeFantasia || contato.empresaNome }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <Button variante="secundario" @click="negocioAberto = true">
            <Plus class="size-4" /> Novo negócio
          </Button>
          <Button variante="secundario" @click="formAberto = true">
            <Pencil class="size-4" /> Editar
          </Button>
          <Button v-if="podeExcluir" variante="contorno" @click="confirmarExclusao = true">
            <Trash2 class="size-4 text-erro" />
          </Button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
          <Card v-if="ficha">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <ShoppingBag class="size-4 text-dourado-hover" />
                Resumo do cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div v-if="ficha.resumo.totalComprado != null">
                  <dt class="text-xs text-texto-secundario">Total comprado</dt>
                  <dd class="text-lg font-semibold text-texto">
                    {{ formatarMoeda(ficha.resumo.totalComprado) }}
                  </dd>
                </div>
                <div v-if="ficha.resumo.quantidadePedidos != null">
                  <dt class="text-xs text-texto-secundario">Pedidos</dt>
                  <dd class="text-lg font-semibold text-texto">
                    {{ ficha.resumo.quantidadePedidos }}
                  </dd>
                </div>
                <div v-if="ficha.resumo.quantidadePedidos != null">
                  <dt class="text-xs text-texto-secundario">Última compra</dt>
                  <dd class="text-sm font-medium text-texto">
                    {{ ficha.resumo.ultimaCompraEm ? formatarData(ficha.resumo.ultimaCompraEm) : '—' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-texto-secundario">Parceiro de origem</dt>
                  <dd class="text-sm font-medium text-texto">
                    <RouterLink
                      v-if="ficha.resumo.parceiroOrigem"
                      :to="`/app/parceiros/${ficha.resumo.parceiroOrigem.id}`"
                      class="hover:text-dourado-hover"
                    >
                      {{ ficha.resumo.parceiroOrigem.nome }}
                    </RouterLink>
                    <span v-else class="text-texto-secundario">—</span>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card v-if="ficha">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <History class="size-4 text-dourado-hover" />
                Histórico
                <span class="text-xs font-normal text-texto-secundario">
                  ({{ ficha.historico.length }} negócios)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul v-if="ficha.historico.length" class="divide-y divide-borda">
                <li v-for="neg in ficha.historico" :key="neg.id" class="space-y-2 py-3 first:pt-0 last:pb-0">
                  <RouterLink
                    :to="`/app/oportunidades/${neg.id}`"
                    class="flex items-center justify-between gap-3 hover:text-dourado-hover"
                  >
                    <span>
                      <span class="block text-sm font-medium text-texto">{{ neg.titulo }}</span>
                      <span class="block text-xs text-texto-secundario">
                        {{ neg.codigo }} · {{ neg.etapa.nome }} · {{ formatarData(neg.criadoEm) }}
                      </span>
                    </span>
                    <Badge variante="neutro">Negócio</Badge>
                  </RouterLink>
                  <ul v-if="neg.orcamentos.length || neg.pedidos.length" class="space-y-1 pl-4 text-sm">
                    <li
                      v-for="orc in neg.orcamentos"
                      :key="orc.id"
                      class="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span class="text-texto-secundario">
                        Orçamento {{ orc.numero }} · {{ formatarData(orc.criadoEm) }}
                      </span>
                      <span class="flex items-center gap-2">
                        <span class="text-texto">{{ formatarMoeda(orc.total) }}</span>
                        <Badge :variante="varianteStatus(orc.status)">{{ rotuloStatus(orc.status) }}</Badge>
                      </span>
                    </li>
                    <li
                      v-for="pedido in neg.pedidos"
                      :key="pedido.id"
                      class="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span class="text-texto-secundario">
                        Pedido {{ pedido.numero }} · {{ formatarData(pedido.finalizadoEm ?? pedido.criadoEm) }}
                        <span v-if="resumoChecklist(pedido.checklist)" class="text-xs">
                          · {{ resumoChecklist(pedido.checklist) }}
                        </span>
                      </span>
                      <span class="flex items-center gap-2">
                        <span class="text-texto">{{ formatarMoeda(pedido.total) }}</span>
                        <Badge :variante="varianteStatus(pedido.status)">
                          {{ rotuloStatus(pedido.status) }}
                        </Badge>
                      </span>
                    </li>
                  </ul>
                </li>
              </ul>
              <p v-else class="text-sm text-texto-secundario">Nenhum negócio vinculado a este cliente.</p>
            </CardContent>
          </Card>

          <Card v-if="ficha">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Paperclip class="size-4 text-dourado-hover" />
                Arquivos
                <span class="text-xs font-normal text-texto-secundario">
                  ({{ ficha.anexos.length }})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul v-if="ficha.anexos.length" class="divide-y divide-borda">
                <li
                  v-for="anexo in ficha.anexos"
                  :key="anexo.id"
                  class="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <button
                    type="button"
                    class="min-w-0 truncate text-left text-sm font-medium text-texto hover:text-dourado-hover"
                    @click="abrirArquivo(anexo.id)"
                  >
                    {{ anexo.nome }}
                  </button>
                  <span class="shrink-0 text-right text-xs text-texto-secundario">
                    {{ formatarData(anexo.criadoEm) }} ·
                    <RouterLink
                      :to="`/app/oportunidades/${anexo.oportunidadeId}`"
                      class="hover:text-dourado-hover"
                    >
                      {{ anexo.negocioCodigo }}
                    </RouterLink>
                  </span>
                </li>
              </ul>
              <p v-else class="text-sm text-texto-secundario">Nenhum arquivo nos negócios deste cliente.</p>
            </CardContent>
          </Card>

          <Card v-if="mostrarParceria && podeVerComissoes">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Wallet class="size-4 text-dourado-hover" />
                Extrato de comissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div v-if="extrato.length" class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-texto-secundario">
                      <th class="py-2 pr-3 font-medium">Data</th>
                      <th class="py-2 pr-3 font-medium">Pedido</th>
                      <th class="py-2 pr-3 font-medium">Cliente</th>
                      <th class="py-2 pr-3 text-right font-medium">Venda</th>
                      <th class="py-2 pr-3 text-center font-medium">RT</th>
                      <th class="py-2 pr-3 text-right font-medium">Comissão</th>
                      <th class="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-borda">
                    <tr v-for="linha in extrato" :key="linha.pedidoId">
                      <td class="py-2 pr-3">{{ formatarData(linha.data) }}</td>
                      <td class="py-2 pr-3">{{ linha.pedidoNumero }}</td>
                      <td class="py-2 pr-3">{{ linha.clienteNome }}</td>
                      <td class="py-2 pr-3 text-right">{{ formatarMoeda(linha.valorVenda) }}</td>
                      <td class="py-2 pr-3 text-center">{{ linha.rtPercentual }}%</td>
                      <td class="py-2 pr-3 text-right font-medium">
                        {{ formatarMoeda(linha.valorComissao) }}
                      </td>
                      <td class="py-2">
                        <Badge :variante="varianteStatus(linha.status)">{{ rotuloStatus(linha.status) }}</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="text-sm text-texto-secundario">
                Nenhuma comissão gerada para este parceiro.
              </p>
            </CardContent>
          </Card>

          <Card v-if="mostrarParceria && podeVerComissoes">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Target class="size-4 text-dourado-hover" />
                Negócios em aberto indicados
                <span class="text-xs font-normal text-texto-secundario">
                  ({{ negociosAbertos.length }})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul v-if="negociosAbertos.length" class="divide-y divide-borda">
                <li v-for="neg in negociosAbertos" :key="neg.id" class="py-3 first:pt-0 last:pb-0">
                  <RouterLink
                    :to="`/app/oportunidades/${neg.id}`"
                    class="flex items-center justify-between gap-3 hover:text-dourado-hover"
                  >
                    <span>
                      <span class="block text-sm font-medium text-texto">{{ neg.titulo }}</span>
                      <span class="block text-xs text-texto-secundario">
                        {{ neg.codigo }} · {{ neg.clienteNome }} · {{ formatarData(neg.criadoEm) }}
                      </span>
                    </span>
                    <Badge variante="neutro">{{ neg.etapa }}</Badge>
                  </RouterLink>
                </li>
              </ul>
              <p v-else class="text-sm text-texto-secundario">Nenhum negócio em aberto.</p>
            </CardContent>
          </Card>

          <Card v-if="!ficha">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Target class="size-4 text-dourado-hover" />
                Negócios
                <span class="text-xs font-normal text-texto-secundario">
                  ({{ contato.totalOportunidades ?? contato.oportunidades?.length ?? 0 }})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul v-if="contato.oportunidades?.length" class="divide-y divide-borda">
                <li
                  v-for="op in contato.oportunidades"
                  :key="op.id"
                  class="py-3 first:pt-0 last:pb-0"
                >
                  <RouterLink
                    :to="`/app/oportunidades/${op.id}`"
                    class="flex items-center justify-between gap-3 hover:text-dourado-hover"
                  >
                    <span>
                      <span class="block text-sm font-medium text-texto">{{ op.titulo }}</span>
                      <span class="block text-xs text-texto-secundario">{{ op.codigo }}</span>
                    </span>
                    <span v-if="op.valorEstimado != null" class="text-sm text-texto-secundario">
                      {{ formatarMoeda(Number(op.valorEstimado)) }}
                    </span>
                  </RouterLink>
                </li>
              </ul>
              <p v-else class="text-sm text-texto-secundario">
                Nenhum negócio vinculado a esta pessoa.
              </p>
            </CardContent>
          </Card>

          <Card v-if="!ecolume">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <HardHat class="size-4 text-dourado-hover" />
                Projetos
                <span class="text-xs font-normal text-texto-secundario">
                  ({{ contato.totalObras ?? contato.obras?.length ?? 0 }})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul v-if="contato.obras?.length" class="divide-y divide-borda">
                <li
                  v-for="vinculo in contato.obras"
                  :key="vinculo.id"
                  class="py-3 first:pt-0 last:pb-0"
                >
                  <RouterLink
                    :to="`/app/obras/${vinculo.obra.id}`"
                    class="flex items-center justify-between gap-3 hover:text-dourado-hover"
                  >
                    <span>
                      <span class="block text-sm font-medium text-texto">{{ vinculo.obra.nome }}</span>
                      <span class="block text-xs text-texto-secundario">{{ vinculo.papel }}</span>
                    </span>
                    <BadgeStatus familia="statusObra" :valor="vinculo.obra.status" />
                  </RouterLink>
                </li>
              </ul>
              <p v-else class="text-sm text-texto-secundario">
                Nenhum projeto vinculado a esta pessoa.
              </p>
            </CardContent>
          </Card>

          <Card v-if="contato.observacoes">
            <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
            <CardContent>
              <p class="whitespace-pre-wrap text-sm text-texto">{{ contato.observacoes }}</p>
            </CardContent>
          </Card>

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

        <Card class="h-fit">
          <CardHeader>
            <CardTitle>{{ ecolume ? 'Dados do cliente' : 'Dados da pessoa' }}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <p class="flex items-center gap-2">
              <Phone class="size-4 text-texto-secundario" />
              {{ formatarTelefone(contato.telefone) }}
            </p>
            <p v-if="contato.email" class="flex items-center gap-2">
              <Mail class="size-4 text-texto-secundario" />
              {{ contato.email }}
            </p>
            <p v-if="contato.documento" class="text-texto-secundario">
              {{ contato.natureza === 'PJ' ? 'CNPJ' : 'CPF/CNPJ' }}: {{ contato.documento }}
            </p>
            <p v-if="ecolume && contato.natureza === 'PJ'">
              IE:
              {{ contato.ieIsento ? 'Isento' : contato.inscricaoEstadual || '—' }}
            </p>
            <template v-if="ecolume && (contato.logradouro || contato.cidade)">
              <p class="pt-1 text-xs font-medium text-texto">Endereço do cliente</p>
              <p class="text-texto-secundario">
                {{
                  [
                    contato.logradouro,
                    contato.numero,
                    contato.complemento,
                    contato.bairro,
                    contato.cidade,
                    contato.uf,
                    contato.cep,
                  ]
                    .filter(Boolean)
                    .join(', ')
                }}
              </p>
            </template>
            <p v-if="contato.origem" class="flex items-center gap-2">
              <MessageSquare class="size-4 text-texto-secundario" />
              {{ ecolume ? 'Chegou por' : 'Origem' }}: {{ contato.origem }}
            </p>
            <p v-if="contato.responsavel" class="flex items-center gap-2">
              <Building2 class="size-4 text-texto-secundario" />
              Responsável: {{ contato.responsavel.nome }}
            </p>
            <div
              v-if="ecolume && contato.pessoasEmpresa?.length"
              class="space-y-1 border-t border-borda pt-2"
            >
              <p class="text-xs font-medium text-texto">Contatos da empresa</p>
              <p
                v-for="(pessoa, i) in contato.pessoasEmpresa"
                :key="i"
                class="text-texto-secundario"
              >
                {{ pessoa.nome }}
                <span v-if="pessoa.cargo"> — {{ pessoa.cargo }}</span>
              </p>
            </div>
            <div
              v-if="ecolume && contato.ehParceiro"
              class="space-y-2 border-t border-borda pt-2"
            >
              <p class="text-xs font-medium text-texto">Parceria</p>
              <p v-if="contato.tipoParceiro" class="text-texto-secundario">
                Tipo: {{ ROTULO_TIPO_PARCEIRO[contato.tipoParceiro] || contato.tipoParceiro }}
              </p>
              <p v-if="podeVerComissoes && contato.rtPadrao != null" class="text-texto-secundario">
                RT padrão: {{ Number(contato.rtPadrao) }}%
              </p>
              <template v-if="podeVerPagamentos">
                <p v-if="contato.chavePix" class="text-texto-secundario">Pix: {{ contato.chavePix }}</p>
                <p v-if="contato.banco || contato.agencia || contato.conta" class="text-texto-secundario">
                  Banco: {{ [contato.banco, contato.agencia, contato.conta].filter(Boolean).join(' · ') }}
                </p>
                <p v-if="contato.titularNome" class="text-texto-secundario">
                  Titular: {{ contato.titularNome }}
                  <span v-if="contato.titularDocumento"> ({{ contato.titularDocumento }})</span>
                </p>
              </template>
              <p
                v-if="contato.observacoesParceria"
                class="whitespace-pre-wrap text-texto-secundario"
              >
                {{ contato.observacoesParceria }}
              </p>
            </div>
            <p class="pt-2 text-xs text-texto-secundario">
              Criado em {{ formatarData(contato.criadoEm) }}
            </p>
          </CardContent>
        </Card>
      </div>
    </template>

    <ContatoFormulario v-model="formAberto" :contato="contato" @salvo="refetch()" />
    <OportunidadeFormulario
      v-if="contato"
      v-model="negocioAberto"
      :contato-id="contato.id"
    />
    <ModalConfirmacao
      v-model="confirmarExclusao"
      :titulo="ecolume ? 'Excluir cliente?' : 'Excluir pessoa?'"
      descricao="Esta ação não poderá ser desfeita."
      texto-confirmar="Excluir"
      perigo
      :carregando="excluindo"
      @confirmar="excluir"
    />
  </div>
</template>
