<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { trocarSenhaSchema } from '@arcco/contratos';
import MolduraAuth from './MolduraAuth.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Button from '@/components/ui/Button.vue';
import { servicoAutenticacao } from '@/services';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';

const router = useRouter();
const auth = useAutenticacaoStore();
const { notificarErro, sucesso } = useNotificacao();
const enviando = ref(false);

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(trocarSenhaSchema),
  initialValues: { senhaAtual: '', senhaNova: '' },
});

const [senhaAtual, senhaAtualAttrs] = defineField('senhaAtual');
const [senhaNova, senhaNovaAttrs] = defineField('senhaNova');

const aoEnviar = handleSubmit(async (valores) => {
  enviando.value = true;
  try {
    await servicoAutenticacao.trocarSenha(valores);
    auth.marcarSenhaTrocada();
    sucesso('Senha atualizada com sucesso.');
    if (!auth.onboardingConcluido) await router.push({ name: 'onboarding' });
    else await router.push({ name: 'dashboard' });
  } catch (e) {
    notificarErro(e, 'Não foi possível trocar a senha.');
  } finally {
    enviando.value = false;
  }
});
</script>

<template>
  <MolduraAuth
    titulo="Trocar senha"
    subtitulo="Defina uma nova senha para continuar."
  >
    <form class="space-y-4" @submit.prevent="aoEnviar">
      <div class="space-y-1.5">
        <Label for="senhaAtual" obrigatorio>Senha atual</Label>
        <Input
          id="senhaAtual"
          v-model="senhaAtual"
          v-bind="senhaAtualAttrs"
          type="password"
          autocomplete="current-password"
          :invalido="!!errors.senhaAtual"
        />
        <p v-if="errors.senhaAtual" class="text-xs text-erro">{{ errors.senhaAtual }}</p>
      </div>

      <div class="space-y-1.5">
        <Label for="senhaNova" obrigatorio>Nova senha</Label>
        <Input
          id="senhaNova"
          v-model="senhaNova"
          v-bind="senhaNovaAttrs"
          type="password"
          autocomplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          :invalido="!!errors.senhaNova"
        />
        <p v-if="errors.senhaNova" class="text-xs text-erro">{{ errors.senhaNova }}</p>
      </div>

      <Button type="submit" class="w-full" :carregando="enviando">Salvar nova senha</Button>
    </form>
  </MolduraAuth>
</template>
