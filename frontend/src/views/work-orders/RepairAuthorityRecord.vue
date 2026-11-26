<template>
  <section class="record-detail" aria-label="复核记录详情">
    <dl>
      <dt>记录引用</dt><dd>{{ record.ref }}</dd>
      <dt>状态</dt><dd>{{ labels[record.status] || record.status }}</dd>
      <dt>工单</dt><dd>{{ record.workOrderRef }}</dd>
      <template v-if="record.authorityVersion"><dt>权威版本 / 内容摘要</dt><dd>{{ record.authorityVersion }} / {{ record.contentHash }}</dd></template>
      <template v-if="record.authorityVersion"><dt>替代旧版本</dt><dd>{{ record.supersedesAuthorityRef || '无' }}<span v-if="record.supersedesAuthorityRef"> / v{{ record.supersedesAuthorityVersion }}</span></dd></template>
      <template v-if="record.relationType">
        <dt>经济事实关系</dt><dd>{{ record.relationType === 'origin' ? '首次登记' : '撤销后重建同一经济事实' }}</dd>
        <dt>前序工单 / 版本</dt><dd>{{ record.predecessorWorkOrderRef || '无' }} / {{ record.expectedPredecessorVersion ?? '无' }}</dd>
        <dt>目标版本 / 证据摘要</dt><dd>{{ record.expectedTargetVersion }} / {{ record.evidenceHash }}</dd>
      </template>
      <template v-if="record.details?.responsibilityEmployeeRef">
        <dt>责任员工</dt><dd>{{ record.details.responsibilityEmployeeRef }}</dd>
        <dt>责任有效期（UTC）</dt><dd>{{ record.details.responsibilityEffectiveFrom }} → {{ record.details.responsibilityEffectiveTo || '未设结束时间' }}</dd>
        <dt>责任证据摘要</dt><dd>{{ record.details.responsibilityEvidenceHash }}</dd>
      </template>
      <template v-if="record.details?.declarations">
        <dt>绑定的责任归因</dt><dd>{{ record.details.assignmentAuthorityRef }} / v{{ record.details.assignmentAuthorityVersion }} / {{ record.details.assignmentContentHash }}</dd>
        <dt>声明成本合计（整数分）</dt><dd>{{ record.details.totalDirectCostCents }}</dd>
        <dt>零外部成本资料条件</dt><dd>{{ record.details.profileEligibility === 'eligible' ? '满足该项资料条件；不是工资可用结论' : '有外部成本，首批路径仍被阻断' }}</dd>
      </template>
    </dl>
    <div v-for="(line, index) in record.details?.attributions || []" :key="index" class="line-detail">
      <strong>{{ labels[line.role] }} · {{ line.employeeRef }} · {{ line.shareBps }} bps</strong>
      <p>{{ line.effectiveFrom }} → {{ line.effectiveTo || '未设结束时间' }}（UTC）</p>
      <p>证据摘要：{{ line.evidenceHash }}</p>
    </div>
    <div v-for="line in record.details?.declarations || []" :key="line.category" class="line-detail">
      <strong>{{ labels[line.category] }} · {{ labels[line.disposition] }} · {{ line.amountCents }} 分</strong>
      <p>发生时间（UTC）：{{ line.occurredAt || '不适用' }}</p><p>证据摘要：{{ line.evidenceHash }}</p>
    </div>
  </section>
</template>
<script setup lang="ts">
import type { CaptureRecord } from '../../utils/repair-authority-capture';
defineProps<{ record: CaptureRecord }>();
const labels: Record<string, string> = { draft: '草稿', submitted: '待独立复核', approved: '已通过', rejected: '已驳回', superseded: '已由新版本替代', accepted: '经济事实关联已接受', pending_checker_approval: '待独立复核', lead_originator: '线索来源人', business_owner: '业务负责人', service_owner: '服务负责人', parts: '配件', outsourced: '外协', other_direct: '其他直接成本', refund: '退款', rework: '返工', confirmed_cost: '已确认成本声明', not_applicable: '不适用声明' };
</script>
<style scoped>
.record-detail { padding: 16px; background: #f7f9fc; border: 1px solid #dce3ed; border-radius: 8px; overflow-wrap: anywhere; }
dl { display: grid; grid-template-columns: minmax(100px, 160px) minmax(0, 1fr); gap: 10px; margin: 0; }
dt { color: #58677d; } dd { margin: 0; } .line-detail { border-top: 1px solid #dce3ed; padding-top: 12px; margin-top: 12px; } p { margin: 6px 0; }
@media (max-width: 600px) { dl { grid-template-columns: 1fr; gap: 5px; } dd { margin-bottom: 10px; } }
</style>
