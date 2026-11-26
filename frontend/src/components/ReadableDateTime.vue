<template>
  <el-tooltip v-if="formattedValue !== '-'" :content="formattedValue" placement="top">
    <span class="date-time-text">{{ formattedValue }}</span>
  </el-tooltip>
  <span v-else class="date-time-text">{{ formattedValue }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatDateTime } from '../utils/format';

const props = defineProps<{
  value?: string | null;
}>();

const formattedValue = computed(() => formatDateTime(props.value));
</script>

<style scoped>
.date-time-text {
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}
</style>
