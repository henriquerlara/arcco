<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  MessageSquare,
  Users,
  X,
} from 'lucide-vue-next';
import { PerfilUsuario, StatusConexaoWhatsApp } from '@arcco/contratos';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import { servicoEquipe, servicoMetaWhatsApp } from '@/services';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { cn } from '@/composables/cn';

const STORAGE_KEY = 'arcco-checklist-setup-dismiss';

const auth = useAutenticacaoStore();
const dismissed = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1',
);

const podeGerirEquipe = computed(() => {
  const perfil = auth.usuario?.perfil;
  return perfil === PerfilUsuario.PROPRIETARIO || perfil === PerfilUsuario.GESTOR;
});

const waQuery = useQuery({
  queryKey: ['setup', 'whatsapp'],
  queryFn: () => servicoMetaWhatsApp.status().catch(() => null),
  staleTime: 60_000,
});

const equipeQuery = useQuery({
  queryKey: ['setup', 'equipe'],
  queryFn: () => servicoEquipe.listar(),
  enabled: podeGerirEquipe,
  staleTime: 60_000,
  retry: false,
});

const whatsappOk = computed(
  () => waQuery.data.value?.conexao?.status === StatusConexaoWhatsApp.CONECTADO,
);

const equipeOk = computed(() => {
  if (!podeGerirEquipe.value) return true;
  const lista = equipeQuery.data.value ?? [];
  return lista.filter((u) => u.ativo !== false).length >= 2;
});

const itens = computed(() => {
  const lista: {
    id: string;
    titulo: string;
    descricao: string;
    ok: boolean;
    to: { name: 'config-whatsapp' | 'config-equipe' };
    icone: typeof MessageSquare;
  }[] = [
    {
      id: 'whatsapp',
      titulo: 'Conectar WhatsApp',
      descricao: 'WhatsApp Cloud API para receber leads.',
      ok: whatsappOk.value,
      to: { name: 'config-whatsapp' },
      icone: MessageSquare,
    },
  ];

  if (podeGerirEquipe.value) {
    lista.push({
      id: 'equipe',
      titulo: 'Convidar a equipe',
      descricao: 'Pelo menos mais uma pessoa além de você.',
      ok: equipeOk.value,
      to: { name: 'config-equipe' as const },
      icone: Users,
    });
  }

  return lista;
});

const concluidos = computed(() => itens.value.filter((i) => i.ok).length);
const todosOk = computed(() => itens.value.every((i) => i.ok));

const visivel = computed(
  () => auth.onboardingConcluido && !dismissed.value && !todosOk.value,
);

function dispensar() {
  dismissed.value = true;
  localStorage.setItem(STORAGE_KEY, '1');
}
</script>

<template>
  <Card v-if="visivel" class="border-dourado/30 bg-dourado/5">
    <CardHeader class="flex-row items-start justify-between gap-3">
      <div>
        <CardTitle>Configure sua conta</CardTitle>
        <p class="mt-1 text-sm text-texto-secundario">
          {{ concluidos }}/{{ itens.length }} passos essenciais — complete para o funil
          WhatsApp → orçamento funcionar de ponta a ponta.
        </p>
      </div>
      <Button variante="contorno" tamanho="sm" title="Dispensar" @click="dispensar">
        <X class="size-4" />
      </Button>
    </CardHeader>
    <CardContent class="space-y-2">
      <RouterLink
        v-for="item in itens"
        :key="item.id"
        :to="item.to"
        :class="
          cn(
            'flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
            item.ok
              ? 'border-borda/60 bg-branco/50 text-texto-secundario'
              : 'border-borda bg-branco hover:border-dourado/50',
          )
        "
      >
        <CheckCircle2 v-if="item.ok" class="size-5 shrink-0 text-sucesso" />
        <Circle v-else class="size-5 shrink-0 text-dourado-hover" />
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 text-sm font-medium text-texto">
            <component :is="item.icone" class="size-3.5 text-texto-secundario" />
            {{ item.titulo }}
          </span>
          <span class="block text-xs text-texto-secundario">{{ item.descricao }}</span>
        </span>
        <ChevronRight class="size-4 shrink-0 text-texto-secundario" />
      </RouterLink>
      <p class="pt-1 text-xs text-texto-secundario">
        Também vale revisar o
        <RouterLink to="/app/configuracoes/chatbot" class="text-dourado-hover hover:underline">
          horário do chatbot
        </RouterLink>
        em Automação.
      </p>
    </CardContent>
  </Card>
</template>
