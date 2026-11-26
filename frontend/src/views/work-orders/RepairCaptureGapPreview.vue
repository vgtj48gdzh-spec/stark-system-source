<template>
  <details class="capture-gap-panel">
    <summary>
      <span class="capture-gap-title">工资统计准备 · 工单采集检查</span>
      <span class="capture-gap-counts">{{ preview.attentionCount }} 项待补录或复核 · {{ preview.unverifiedCount }} 项未验证</span>
      <span class="capture-gap-hint">展开查看缺口与现有处理入口</span>
    </summary>
    <p class="capture-gap-boundary" role="note">
      只读参考：仅检查本次工作区响应中的记录，不校验正式权威、不生成贡献或工资。
      “有记录”不代表已通过结算审核；工时费、工单报价不等于员工收入。
    </p>
    <ul class="capture-gap-list">
      <li v-for="item in preview.items" :key="item.key" :data-gap="item.key">
        <div class="capture-gap-copy">
          <div class="capture-gap-row-heading">
            <strong>{{ item.label }}</strong>
            <span class="capture-gap-state" :data-state="item.state">{{ stateLabels[item.state] }}</span>
          </div>
          <p>{{ item.detail }}</p>
        </div>
        <button v-if="item.tab" type="button" class="capture-gap-link" @click="emit('navigate', item.tab)">
          查看{{ tabLabels[item.tab] }}
        </button>
      </li>
    </ul>
    <p class="capture-gap-footer">未验证的权威项目不能靠补录猜测值解决；须由后续正式接入与人工审核完成。</p>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { projectRepairCaptureGaps, type RepairCaptureState, type RepairCaptureTab } from '../../utils/repair-capture-gap-preview';

const props = defineProps<{ workspace: unknown; workOrderId: string }>();
const emit = defineEmits<{ navigate: [tab: RepairCaptureTab] }>();
const preview = computed(() => projectRepairCaptureGaps(props.workspace, props.workOrderId));
const stateLabels: Record<RepairCaptureState, string> = {
  recorded: '有记录', missing: '待补录', review: '需复核', unverified: '未验证',
};
const tabLabels: Record<RepairCaptureTab, string> = {
  documents: '方案报价', confirmation: '客户确认', execution: '维修施工', completion: '质检交付',
};
</script>

<style scoped>
.capture-gap-panel { border: 1px solid #d7e2ed; border-radius: 8px; background: #fff; color: #303133; min-width: 0; }
summary { cursor: pointer; padding: 16px 20px; line-height: 1.6; }
summary:focus-visible, button:focus-visible { outline: 3px solid #409eff; outline-offset: 2px; }
.capture-gap-title { font-size: 16px; font-weight: 650; margin-right: 16px; }
.capture-gap-counts { font-size: 13px; color: #665122; white-space: normal; }
.capture-gap-hint { display: block; font-size: 12px; color: #606266; margin-top: 4px; }
.capture-gap-boundary { margin: 0 20px 16px; padding: 12px; background: #f4f7fb; border-radius: 4px; color: #4b5867; line-height: 1.7; font-size: 13px; }
.capture-gap-list { margin: 0 20px; padding: 0; list-style: none; }
.capture-gap-list li { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 0; border-top: 1px solid #ebeef5; }
.capture-gap-copy { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.capture-gap-row-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 14px; }
.capture-gap-state { border: 1px solid #d5d9df; border-radius: 4px; padding: 2px 7px; font-size: 12px; color: #4f5965; }
.capture-gap-state[data-state='missing'], .capture-gap-state[data-state='review'] { color: #785308; background: #fff8e8; border-color: #ebd5a3; }
.capture-gap-copy p { margin: 6px 0 0; color: #606266; font-size: 13px; line-height: 1.65; }
.capture-gap-link { flex-shrink: 0; border: 1px solid #b9d8f8; background: #f0f7ff; color: #235e96; border-radius: 4px; padding: 8px 10px; cursor: pointer; font: inherit; font-size: 13px; }
.capture-gap-footer { margin: 14px 20px 18px; color: #606266; line-height: 1.65; font-size: 12px; }
@media (max-width: 600px) {
  .capture-gap-title, .capture-gap-counts { display: block; }
  .capture-gap-list li { flex-direction: column; align-items: flex-start; gap: 10px; }
}
</style>
