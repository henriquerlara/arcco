<script setup lang="ts">
import { computed } from 'vue';
import { TipoCampoPersonalizado } from '@arcco/contratos';
import type { CampoPersonalizado } from '@/types';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Switch from '@/components/ui/Switch.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import Label from '@/components/ui/Label.vue';

const props = defineProps<{
  campo: CampoPersonalizado;
  modelValue: unknown;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', valor: unknown): void }>();

const T = TipoCampoPersonalizado;

const texto = computed<string>({
  get: () => (props.modelValue == null ? '' : String(props.modelValue)),
  set: (v: string) => emit('update:modelValue', v),
});

const numeroTexto = computed({
  get: () =>
    props.modelValue === null || props.modelValue === undefined
      ? ''
      : String(props.modelValue),
  set: (v: string) => emit('update:modelValue', v === '' ? null : Number(v)),
});

const booleano = computed({
  get: () => Boolean(props.modelValue),
  set: (v: boolean) => emit('update:modelValue', v),
});

const selecionados = computed<string[]>(() =>
  Array.isArray(props.modelValue) ? (props.modelValue as string[]) : [],
);

const opcoesSelect = computed(() =>
  (props.campo.opcoes ?? []).map((o) => ({ valor: o, rotulo: o })),
);

function alternarMulti(opcao: string, marcado: boolean) {
  const atual = new Set(selecionados.value);
  if (marcado) atual.add(opcao);
  else atual.delete(opcao);
  emit('update:modelValue', [...atual]);
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Label
      v-if="campo.tipo !== T.BOOLEANO"
      :for="`campo-${campo.chave}`"
      :obrigatorio="campo.obrigatorio"
    >
      {{ campo.rotulo }}
    </Label>

    <Textarea
      v-if="campo.tipo === T.TEXTO_LONGO"
      :id="`campo-${campo.chave}`"
      v-model="texto"
      :placeholder="campo.descricao ?? ''"
    />

    <Input
      v-else-if="campo.tipo === T.TEXTO"
      :id="`campo-${campo.chave}`"
      v-model="texto"
      :placeholder="campo.descricao ?? ''"
    />

    <Input
      v-else-if="campo.tipo === T.NUMERO || campo.tipo === T.MOEDA"
      :id="`campo-${campo.chave}`"
      v-model="numeroTexto"
      type="number"
      :placeholder="campo.tipo === T.MOEDA ? 'R$ 0,00' : '0'"
    />

    <Input
      v-else-if="campo.tipo === T.DATA"
      :id="`campo-${campo.chave}`"
      v-model="texto"
      type="date"
    />

    <Select
      v-else-if="campo.tipo === T.SELECAO"
      :id="`campo-${campo.chave}`"
      v-model="texto"
      :opcoes="opcoesSelect"
      :placeholder="campo.descricao ?? 'Selecione'"
    />

    <div
      v-else-if="campo.tipo === T.MULTISSELECAO"
      class="flex flex-wrap gap-3 rounded-md border border-borda bg-branco p-3"
    >
      <label
        v-for="op in campo.opcoes ?? []"
        :key="op"
        class="flex items-center gap-2 text-sm"
      >
        <Checkbox
          :model-value="selecionados.includes(op)"
          @update:model-value="(v) => alternarMulti(op, v)"
        />
        {{ op }}
      </label>
    </div>

    <div v-else-if="campo.tipo === T.BOOLEANO" class="flex items-center gap-2 py-1">
      <Switch :id="`campo-${campo.chave}`" v-model="booleano" />
      <Label :for="`campo-${campo.chave}`">{{ campo.rotulo }}</Label>
    </div>

    <p v-if="campo.descricao && campo.tipo !== T.TEXTO && campo.tipo !== T.TEXTO_LONGO" class="text-xs text-texto-secundario">
      {{ campo.descricao }}
    </p>
  </div>
</template>
