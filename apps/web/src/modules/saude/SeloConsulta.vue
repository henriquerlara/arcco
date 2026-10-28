<script setup lang="ts">
import { classeStatus, ROTULO_STATUS, type ConsultaClinica } from '@/services/saude';

defineProps<{ status: ConsultaClinica['status'] }>();
</script>

<template>
  <span
    class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
    :class="classeStatus(status)"
  >
    {{ ROTULO_STATUS[status] }}
  </span>
</template>
