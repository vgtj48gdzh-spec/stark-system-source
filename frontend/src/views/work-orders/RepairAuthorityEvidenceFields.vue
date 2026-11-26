<template>
  <div class="evidence-fields">
    <el-form-item :label="`${label}引用`"><el-input :model-value="modelValue.evidenceRef" placeholder="evidence:已有证据的不透明 64 位引用" @update:model-value="update('evidenceRef', $event)" /></el-form-item>
    <el-form-item :label="`${label} SHA-256`"><el-input :model-value="modelValue.evidenceHash" placeholder="已有证据的 64 位小写摘要；不得编造" @update:model-value="update('evidenceHash', $event)" /></el-form-item>
  </div>
</template>
<script setup lang="ts">
import type { Evidence } from '../../utils/repair-authority-capture';
const props = withDefaults(defineProps<{ modelValue: Evidence; label?: string }>(), { label: '证据' });
const emit = defineEmits<{ 'update:modelValue': [value: Evidence] }>();
function update(key: keyof Evidence, value: string) { emit('update:modelValue', { ...props.modelValue, [key]: value }); }
</script>
