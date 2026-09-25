<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BadgeCheck, Send } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Button from '@/components/ui/Button.vue';
import MetaWhatsAppConnect from '@/integrations/meta-whatsapp/MetaWhatsAppConnect.vue';
import MetaCloudApiPanel from '@/integrations/meta-whatsapp/MetaCloudApiPanel.vue';
import { servicoWhatsApp } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';

const router = useRouter();
const { notificarErro, sucesso } = useNotificacao();

const simulando = ref(false);
const simulador = reactive({
  telefone: '5511999990000',
  nome: 'Cliente Teste',
  texto: 'Olá! Preciso de um orçamento de porcelanato para minha obra.',
});

async function simular() {
  if (!simulador.telefone || !simulador.texto.trim()) return;
  simulando.value = true;
  try {
    const { conversaId } = await servicoWhatsApp.simularMensagem({
      ...simulador,
      telefone: simulador.telefone.replace(/\D/g, ''),
    });
    sucesso('Mensagem simulada recebida!', 'Abrindo a conversa gerada.');
    await router.push({ name: 'conversas', query: { c: conversaId } });
  } catch (e) {
    notificarErro(e);
  } finally {
    simulando.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina
      titulo="WhatsApp"
      descricao="WhatsApp oficial pela Cloud API da Meta."
    />
    <NavConfiguracoes />

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <BadgeCheck class="size-5 text-info" /> WhatsApp Oficial (Meta)
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-6">
        <MetaCloudApiPanel />
        <div class="border-t border-borda pt-4">
          <p class="mb-3 text-xs font-medium uppercase tracking-wide text-texto-secundario">
            Embedded Signup (futuro · Coexistence)
          </p>
          <MetaWhatsAppConnect />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Send class="size-5 text-info" /> Simulador de mensagem
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-sm text-texto-secundario">
          Testa o fluxo do chatbot sem enviar mensagem de verdade pelo WhatsApp.
        </p>
        <form class="space-y-4" @submit.prevent="simular">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label obrigatorio>Telefone do cliente</Label>
              <Input v-model="simulador.telefone" mascara="telefone" placeholder="(11) 99999-0000" />
            </div>
            <div class="space-y-1.5">
              <Label>Nome</Label>
              <Input v-model="simulador.nome" />
            </div>
          </div>
          <div class="space-y-1.5">
            <Label obrigatorio>Mensagem recebida</Label>
            <Textarea v-model="simulador.texto" :rows="3" />
          </div>
          <Button
            :carregando="simulando"
            :disabled="!simulador.telefone || !simulador.texto.trim()"
            @click="simular"
          >
            <Send class="size-4" /> Simular recebimento
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
