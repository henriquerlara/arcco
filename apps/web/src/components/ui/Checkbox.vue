<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
  id?: string;
  class?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', valor: boolean): void }>();

const classes = computed(() =>
  cn(
    'inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    props.modelValue ? 'border-dourado bg-dourado text-preto' : 'border-borda bg-branco',
    props.disabled && 'opacity-50 cursor-not-allowed',
    props.class,
  ),
);
</script>

<template>
  <button
    :id="id"
    type="button"
    role="checkbox"
    :aria-checked="modelValue"
    :disabled="disabled"
    :class="classes"
    @click="emit('update:modelValue', !modelValue)"
  >
    <Check v-if="modelValue" class="size-3" stroke-width="3" />
  </button>
</template>
