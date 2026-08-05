<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { cadastrarSchema, SEGMENTO_ROTULOS, SegmentoEmpresa } from '@arcco/contratos';
import MolduraAuth from './MolduraAuth.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Button from '@/components/ui/Button.vue';
import Select from '@/components/ui/Select.vue';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { useNotificacao } from '@/composables/useNotificacao';

const auth = useAutenticacaoStore();
const router = useRouter();
const { notificarErro, sucesso } = useNotificacao();

const enviando = ref(false);

const opcoesSegmento = Object.entries(SEGMENTO_ROTULOS).map(([valor, rotulo]) => ({
  valor,
  rotulo,
}));

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(cadastrarSchema),
  initialValues: {
    nomeEmpresa: '',
    segmento: SegmentoEmpresa.MATERIAIS_CONSTRUCAO,
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    cidade: '',
    estado: '',
  },
});

const [nomeEmpresa, nomeEmpresaAttrs] = defineField('nomeEmpresa');
const [segmento] = defineField('segmento');
const [nome, nomeAttrs] = defineField('nome');
const [email, emailAttrs] = defineField('email');
const [senha, senhaAttrs] = defineField('senha');
const [telefone, telefoneAttrs] = defineField('telefone');
const [cidade, cidadeAttrs] = defineField('cidade');
const [estado, estadoAttrs] = defineField('estado');

const aoEnviar = handleSubmit(async (valores) => {
  enviando.value = true;
  try {
    await auth.cadastrar(valores);
    sucesso('Empresa criada!', 'Vamos configurar sua conta.');
    await router.push({ name: 'onboarding' });
  } catch (e) {
    notificarErro(e, 'Não foi possível concluir o cadastro.');
  } finally {
    enviando.value = false;
  }
});
</script>

<template>
  <MolduraAuth
    titulo="Criar empresa"
    subtitulo="Comece a organizar seu comercial em poucos minutos."
    frase="Sua empresa merece um comercial tão sólido quanto as obras que atende."
  >
    <form class="space-y-4" @submit.prevent="aoEnviar">
      <div class="space-y-1.5">
        <Label for="nomeEmpresa" obrigatorio>Nome da empresa</Label>
        <Input
          id="nomeEmpresa"
          v-model="nomeEmpresa"
          v-bind="nomeEmpresaAttrs"
          placeholder="Ex.: Iluminação Prime"
          :invalido="!!errors.nomeEmpresa"
        />
        <p v-if="errors.nomeEmpresa" class="text-xs text-erro">{{ errors.nomeEmpresa }}</p>
      </div>

      <div class="space-y-1.5">
        <Label obrigatorio>Segmento</Label>
        <Select
          :model-value="segmento"
          :opcoes="opcoesSegmento"
          @update:model-value="(v) => (segmento = v as SegmentoEmpresa)"
        />
        <p v-if="errors.segmento" class="text-xs text-erro">{{ errors.segmento }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <Label for="nome" obrigatorio>Seu nome</Label>
          <Input id="nome" v-model="nome" v-bind="nomeAttrs" :invalido="!!errors.nome" />
          <p v-if="errors.nome" class="text-xs text-erro">{{ errors.nome }}</p>
        </div>
        <div class="space-y-1.5">
          <Label for="telefone">Telefone</Label>
          <Input id="telefone" v-model="telefone" v-bind="telefoneAttrs" placeholder="(11) 90000-0000" />
        </div>
      </div>

      <div class="space-y-1.5">
        <Label for="email" obrigatorio>E-mail</Label>
        <Input
          id="email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          autocomplete="email"
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
          autocomplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          :invalido="!!errors.senha"
        />
        <p v-if="errors.senha" class="text-xs text-erro">{{ errors.senha }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <Label for="cidade">Cidade</Label>
          <Input id="cidade" v-model="cidade" v-bind="cidadeAttrs" />
        </div>
        <div class="space-y-1.5">
          <Label for="estado">Estado</Label>
          <Input id="estado" v-model="estado" v-bind="estadoAttrs" placeholder="UF" />
        </div>
      </div>

      <Button type="submit" class="w-full" :carregando="enviando">Criar empresa</Button>
    </form>

    <template #rodape>
      Já tem conta?
      <RouterLink to="/entrar" class="font-medium text-dourado-claro hover:underline">
        Entrar
      </RouterLink>
    </template>
  </MolduraAuth>
</template>
