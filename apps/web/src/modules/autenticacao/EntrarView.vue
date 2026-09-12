<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-vue-next';
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
const exibirSenha = ref(false);

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
    if (sessao.usuario.precisaTrocarSenha) await router.push({ name: 'trocar-senha' });
    else if (!sessao.empresa.onboardingConcluido) await router.push({ name: 'onboarding' });
    else await router.push(redir ?? { name: 'dashboard' });
  } catch (e) {
    notificarErro(e, 'Não foi possível entrar. Verifique suas credenciais.');
  } finally {
    enviando.value = false;
  }
});
</script>

<template>
  <MolduraAuth
    titulo="Entrar"
    subtitulo="Sua operação comercial, do WhatsApp ao funil — em um só lugar."
    frase="O comercial que escuta o WhatsApp."
    sem-rolagem
  >
    <form class="space-y-5" @submit.prevent="aoEnviar">
      <div class="space-y-2">
        <Label for="email" obrigatorio>E-mail</Label>
        <div class="group relative">
          <Mail class="pointer-events-none absolute left-4 top-1/2 z-10 size-[17px] -translate-y-1/2 text-texto-secundario transition-colors group-focus-within:text-dourado-hover" />
          <Input id="email" v-model="email" v-bind="emailAttrs" type="email" autocomplete="email" placeholder="voce@empresa.com.br" class="h-12 pl-11 pr-4 shadow-none" :invalido="!!errors.email" />
        </div>
        <p v-if="errors.email" class="text-xs font-medium text-erro">{{ errors.email }}</p>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label for="senha" obrigatorio>Senha</Label>
          <span class="text-[11px] text-texto-secundario">mínimo de 8 caracteres</span>
        </div>
        <div class="group relative">
          <LockKeyhole class="pointer-events-none absolute left-4 top-1/2 z-10 size-[17px] -translate-y-1/2 text-texto-secundario transition-colors group-focus-within:text-dourado-hover" />
          <Input id="senha" v-model="senha" v-bind="senhaAttrs" :type="exibirSenha ? 'text' : 'password'" autocomplete="current-password" placeholder="Sua senha" class="h-12 pl-11 pr-12 shadow-none" :invalido="!!errors.senha" />
          <button type="button" class="absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-texto-secundario transition-colors hover:bg-marfim hover:text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado" :aria-label="exibirSenha ? 'Ocultar senha' : 'Mostrar senha'" @click="exibirSenha = !exibirSenha">
            <EyeOff v-if="exibirSenha" class="size-4" />
            <Eye v-else class="size-4" />
          </button>
        </div>
        <p v-if="errors.senha" class="text-xs font-medium text-erro">{{ errors.senha }}</p>
      </div>

      <Button type="submit" tamanho="lg" class="group mt-1 h-12 w-full" :carregando="enviando">
        Acessar minha operação
        <ArrowRight class="transition-transform group-hover:translate-x-1" />
      </Button>

      <div class="flex items-center justify-center gap-2 pt-1 text-[11px] text-texto-secundario">
        <ShieldCheck class="size-3.5 text-sucesso" />
        Sessão privada e dados protegidos
      </div>
    </form>

    <template #rodape>
      Ainda não usa a ARCCO?
      <RouterLink to="/cadastro" class="ml-1 font-semibold text-dourado-claro transition-colors hover:text-white lg:text-dourado-hover lg:hover:text-texto">
        Criar empresa →
      </RouterLink>
    </template>
  </MolduraAuth>
</template>
