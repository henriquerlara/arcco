<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'radix-vue';

export interface AbaItem {
  valor: string;
  rotulo: string;
}

const props = defineProps<{
  modelValue: string;
  itens: AbaItem[];
}>();

const emit = defineEmits<{ (e: 'update:modelValue', valor: string): void }>();

function aoMudar(valor: string | number) {
  emit('update:modelValue', String(valor));
}
</script>

<template>
  <TabsRoot
    :model-value="props.modelValue"
    class="flex flex-col gap-4"
    @update:model-value="aoMudar"
  >
    <TabsList
      class="inline-flex w-fit items-center gap-0 border-b border-borda"
    >
      <TabsTrigger
        v-for="item in itens"
        :key="item.valor"
        :value="item.valor"
        class="-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-texto-secundario transition-colors data-[state=active]:border-carvao data-[state=active]:text-carvao focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carvao/20"
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
