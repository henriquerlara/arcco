<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { Save } from 'lucide-vue-next';
import { SEGMENTO_ROTULOS } from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import { servicoArquivos, servicoEmpresa } from '@/services';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';

const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();
const salvando = ref(false);
const previewLogo = ref<string | null>(null);
const logoArquivoId = ref<string | null>(null);

const opcoesSegmento = Object.entries(SEGMENTO_ROTULOS).map(([valor, rotulo]) => ({
  valor,
  rotulo,
}));

const { data, isLoading, refetch } = useQuery({
  queryKey: ['empresa'],
  queryFn: () => servicoEmpresa.obter(),
});

const form = reactive({
  nome: '',
  nomeFantasia: '',
  segmento: 'MATERIAIS_CONSTRUCAO',
  telefone: '',
  cidade: '',
  estado: '',
  cnpj: '',
  inscricaoEstadual: '',
  logradouro: '',
  numero: '',
  bairro: '',
  municipio: '',
  uf: '',
  cep: '',
});

watch(
  data,
  async (e) => {
    if (!e) return;
    form.nome = e.nome;
    form.nomeFantasia = e.nomeFantasia ?? '';
    form.segmento = e.segmento;
    form.telefone = e.telefone ?? '';
    form.cidade = e.cidade ?? '';
    form.estado = e.estado ?? '';
    form.cnpj = e.cnpj ?? '';
    form.inscricaoEstadual = e.inscricaoEstadual ?? '';
    form.logradouro = e.enderecoFiscal?.logradouro ?? '';
    form.numero = e.enderecoFiscal?.numero ?? '';
    form.bairro = e.enderecoFiscal?.bairro ?? '';
    form.municipio = e.enderecoFiscal?.municipio ?? e.cidade ?? '';
    form.uf = e.enderecoFiscal?.uf ?? e.estado ?? '';
    form.cep = e.enderecoFiscal?.cep ?? '';
    logoArquivoId.value = e.logoArquivoId ?? null;
    if (e.logoArquivoId) {
      try {
        const blob = await servicoArquivos.blob(e.logoArquivoId);
        previewLogo.value = URL.createObjectURL(blob);
      } catch {
        previewLogo.value = null;
      }
    } else {
      previewLogo.value = null;
    }
  },
  { immediate: true },
);

async function aoEscolherLogo(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const arquivo = input.files?.[0];
  if (!arquivo) return;
  try {
    const enviado = await servicoArquivos.enviar(arquivo, 'LOGO_EMPRESA');
    logoArquivoId.value = enviado.id;
    previewLogo.value = URL.createObjectURL(arquivo);
    await servicoEmpresa.atualizar({ logoArquivoId: enviado.id });
    sucesso('Logo atualizada.');
    await refetch();
  } catch (e) {
    notificarErro(e);
  } finally {
    input.value = '';
  }
}

async function salvar() {
  salvando.value = true;
  try {
    const atualizada = await servicoEmpresa.atualizar({
      nome: form.nome,
      nomeFantasia: form.nomeFantasia || null,
      segmento: form.segmento as never,
      telefone: form.telefone || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      logoArquivoId: logoArquivoId.value,
      cnpj: form.cnpj || null,
      inscricaoEstadual: form.inscricaoEstadual || null,
      enderecoFiscal: {
        logradouro: form.logradouro || undefined,
        numero: form.numero || undefined,
        bairro: form.bairro || undefined,
        municipio: form.municipio || undefined,
        uf: form.uf || undefined,
        cep: form.cep || undefined,
      },
    });
    if (auth.empresa) auth.empresa = { ...auth.empresa, ...atualizada };
    sucesso('Dados da empresa atualizados.');
    await refetch();
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Empresa" descricao="Dados cadastrais e fiscais da sua empresa." />
    <NavConfiguracoes />

    <Card class="max-w-2xl">
      <CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader>
      <CardContent>
        <div v-if="isLoading" class="space-y-3">
          <Skeleton v-for="n in 4" :key="n" class="h-10 w-full" />
        </div>
        <form v-else class="grid gap-4 sm:grid-cols-2" @submit.prevent="salvar">
          <div class="space-y-1.5 sm:col-span-2">
            <Label>Logo no orçamento</Label>
            <div class="flex flex-wrap items-center gap-3">
              <img
                v-if="previewLogo"
                :src="previewLogo"
                alt="Logo da empresa"
                class="h-14 w-auto max-w-[180px] rounded-md border border-borda bg-branco object-contain p-1"
              />
              <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" @change="aoEscolherLogo" />
            </div>
            <p class="text-xs text-texto-secundario">Aparece no PDF do orçamento gerado pela ARCCO.</p>
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label obrigatorio>Razão social</Label>
            <Input v-model="form.nome" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label>Nome fantasia</Label>
            <Input v-model="form.nomeFantasia" />
          </div>
          <div class="space-y-1.5">
            <Label>Segmento</Label>
            <Select v-model="form.segmento" :opcoes="opcoesSegmento" />
            <p
              v-if="data && form.segmento !== data.segmento"
              class="text-xs text-alerta"
            >
              Trocar o segmento não recria categorias, campos nem funil. O que já existe permanece.
            </p>
          </div>
          <div class="space-y-1.5">
            <Label>Telefone</Label>
            <Input v-model="form.telefone" mascara="telefone" placeholder="(11) 90000-0000" autocomplete="tel" />
          </div>
          <div class="space-y-1.5">
            <Label>Cidade</Label>
            <Input v-model="form.cidade" />
          </div>
          <div class="space-y-1.5">
            <Label>Estado</Label>
            <Input v-model="form.estado" mascara="uf" placeholder="UF" />
          </div>
          <div class="space-y-1.5 sm:col-span-2 border-t border-borda pt-4">
            <p class="text-sm font-medium text-texto">Dados fiscais (NF-e)</p>
            <p class="text-xs text-texto-secundario">
              Necessários para emitir nota a partir de orçamentos convertidos.
            </p>
          </div>
          <div class="space-y-1.5">
            <Label>CNPJ</Label>
            <Input v-model="form.cnpj" mascara="cnpj" placeholder="00.000.000/0000-00" />
          </div>
          <div class="space-y-1.5">
            <Label>Inscrição estadual</Label>
            <Input v-model="form.inscricaoEstadual" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label>Logradouro</Label>
            <Input v-model="form.logradouro" />
          </div>
          <div class="space-y-1.5">
            <Label>Número</Label>
            <Input v-model="form.numero" />
          </div>
          <div class="space-y-1.5">
            <Label>Bairro</Label>
            <Input v-model="form.bairro" />
          </div>
          <div class="space-y-1.5">
            <Label>Município</Label>
            <Input v-model="form.municipio" />
          </div>
          <div class="space-y-1.5">
            <Label>UF fiscal</Label>
            <Input v-model="form.uf" mascara="uf" placeholder="UF" />
          </div>
          <div class="space-y-1.5">
            <Label>CEP</Label>
            <Input v-model="form.cep" mascara="cep" placeholder="00000-000" />
          </div>
          <div class="sm:col-span-2">
            <Button :carregando="salvando" @click="salvar">
              <Save class="size-4" /> Salvar alterações
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
