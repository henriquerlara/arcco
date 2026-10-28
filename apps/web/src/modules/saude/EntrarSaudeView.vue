<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-vue-next';
import { entrarSchema } from '@arcco/contratos';
import MolduraClinica from '@/modules/saude/MolduraClinica.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Button from '@/components/ui/Button.vue';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';

const auth = useAutenticacaoStore();
const router = useRouter();
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
    if (sessao.empresa.ramo !== 'SAUDE') {
      await auth.sair();
      notificarErro(new Error('conta'), 'Esta entrada é só da operação clínica.');
      return;
    }
    await router.push({ name: 'saude-inicio' });
  } catch (e) {
    notificarErro(e, 'Não foi possível entrar. Verifique suas credenciais.');
  } finally {
    enviando.value = false;
  }
});
</script>

<template>
  <MolduraClinica
    titulo="Entrar"
    subtitulo="A agenda do dia, os pacientes e as consultas da clínica."
  >
    <form class="space-y-5" @submit.prevent="aoEnviar">
      <div class="space-y-2">
        <Label for="email-saude" obrigatorio>E-mail</Label>
        <div class="group relative">
          <Mail class="pointer-events-none absolute left-4 top-1/2 z-10 size-[17px] -translate-y-1/2 text-texto-secundario" />
          <Input id="email-saude" v-model="email" v-bind="emailAttrs" type="email" autocomplete="email" placeholder="voce@clinica.com.br" class="h-12 pl-11" :invalido="!!errors.email" />
        </div>
      </div>
      <div class="space-y-2">
        <Label for="senha-saude" obrigatorio>Senha</Label>
        <div class="group relative">
          <LockKeyhole class="pointer-events-none absolute left-4 top-1/2 z-10 size-[17px] -translate-y-1/2 text-texto-secundario" />
          <Input id="senha-saude" v-model="senha" v-bind="senhaAttrs" :type="exibirSenha ? 'text' : 'password'" autocomplete="current-password" placeholder="Sua senha" class="h-12 pl-11 pr-12" :invalido="!!errors.senha" />
          <button type="button" class="absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-texto-secundario" @click="exibirSenha = !exibirSenha">
            <EyeOff v-if="exibirSenha" class="size-4" />
            <Eye v-else class="size-4" />
          </button>
        </div>
      </div>
      <Button type="submit" tamanho="lg" class="h-12 w-full" :carregando="enviando">
        Entrar
        <ArrowRight />
      </Button>
      <div class="flex items-center justify-center gap-2 text-[11px] text-texto-secundario">
        <ShieldCheck class="size-3.5 text-sucesso" />
        Acesso da equipe da recepção
      </div>
    </form>
    <template #rodape>
      <RouterLink to="/entrar" class="font-semibold text-[#9ee0d6] lg:text-[#0f766e]">
        Acesso comercial
      </RouterLink>
    </template>
  </MolduraClinica>
</template>
