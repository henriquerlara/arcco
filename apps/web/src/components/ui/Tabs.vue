<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'radix-vue';
import { computed } from 'vue';

export interface AbaItem {
  valor: string;
  rotulo: string;
}

const props = defineProps<{
  modelValue: string;
  itens: AbaItem[];
}>();

const emit = defineEmits<{ (e: 'update:modelValue', valor: string): void }>();

const ativo = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
</script>

<template>
  <TabsRoot v-model="ativo" class="flex flex-col gap-4">
    <TabsList
      class="inline-flex w-fit items-center gap-1 rounded-md border border-borda bg-marfim p-1"
    >
      <TabsTrigger
        v-for="item in itens"
        :key="item.valor"
        :value="item.valor"
        class="rounded-sm px-3 py-1.5 text-sm font-medium text-texto-secundario transition-colors data-[state=active]:bg-branco data-[state=active]:text-texto data-[state=active]:shadow-suave focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {{ item.rotulo }}
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="item in itens"
      :key="item.valor"
      :value="item.valor"
      class="focus:outline-none"
    >
      <slot :name="item.valor" />
    </TabsContent>
  </TabsRoot>
</template>
