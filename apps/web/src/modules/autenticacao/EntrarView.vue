<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { entrarSchema } from '@arcco/contratos';
import MolduraAuth from './MolduraAuth.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Button from '@/components/ui/Button.vue';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';

const auth = useAutenticacaoStore();
const router = useRouter();
const rota = useRoute();
const { notificarErro } = useNotificacao();

const enviando = ref(false);

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(entrarSchema),
  initialValues: { email: '', senha: '' },
});

const [email, emailAttrs] = defineField('email');
const [senha, senhaAttrs] = defineField('senha');

const aoEnviar = handleSubmit(async (valores) => {
  enviando.value = true;
  try {
    const sessao = await auth.entrar(valores);
    const redir = rota.query.redirecionar as string | undefined;
    if (sessao.usuario.precisaTrocarSenha) {
      await router.push({ name: 'trocar-senha' });
    } else if (!sessao.empresa.onboardingConcluido) {
      await router.push({ name: 'onboarding' });
    } else {
      await router.push(redir ?? { name: 'dashboard' });
    }
  } catch (e) {
    notificarErro(e, 'Não foi possível entrar. Verifique suas credenciais.');
  } finally {
    enviando.value = false;
  }
});
</script>

<template>
  <MolduraAuth titulo="Entrar" subtitulo="Acesse o painel comercial da sua empresa.">
    <form class="space-y-4" @submit.prevent="aoEnviar">
      <div class="space-y-1.5">
        <Label for="email" obrigatorio>E-mail</Label>
        <Input
          id="email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          autocomplete="email"
          placeholder="voce@empresa.com.br"
          :invalido="!!errors.email"
        />
        <p v-if="errors.email" class="text-xs text-erro">{{ errors.email }}</p>
      </div>

      <div class="space-y-1.5">
        <Label for="senha" obrigatorio>Senha</Label>
        <Input
          id="senha"
          v-model="senha"
          v-bind="senhaAttrs"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••"
          :invalido="!!errors.senha"
        />
        <p v-if="errors.senha" class="text-xs text-erro">{{ errors.senha }}</p>
      </div>

      <Button type="submit" class="w-full" :carregando="enviando">Entrar</Button>
    </form>

    <template #rodape>
      Ainda não tem conta?
      <RouterLink to="/cadastro" class="font-medium text-dourado-claro hover:underline">
        Criar empresa
      </RouterLink>
    </template>
  </MolduraAuth>
</template>
