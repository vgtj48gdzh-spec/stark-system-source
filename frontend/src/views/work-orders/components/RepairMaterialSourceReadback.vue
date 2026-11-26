<template>
  <section class="material-readback" aria-label="材料来源、成本与付款核对">
    <header>
      <h3>材料来源、成本与付款核对</h3>
      <p>付款规则：同一张采购单分到多张工单，不重复付款；已付款库存再次领用不产生新应付款。</p>
    </header>
    <p class="boundary" role="status">
      {{ collection?.ready === true ? '收款记录已覆盖报价，但尚不允许分成。' : '收款尚未核实或未覆盖报价，不能分成。' }}
      仍须核实实际成本、人员归因和分配额度，不能重复分配。
    </p>
    <p v-if="!rows.length" class="empty">暂无正式工单材料来源。报价里填写名称不会自动生成采购、库存或付款记录。</p>
    <article v-for="row in rows" :key="row.workOrderMaterialId" class="material-card">
      <h4>{{ row.materialName }} <small>工单材料 #{{ row.workOrderMaterialId }}</small></h4>
      <p class="muted">{{ row.specification || '规格待核对' }} · {{ row.unit || '单位待核对' }}</p>
      <dl class="amount-grid">
        <div><dt>工单用量</dt><dd>{{ row.quantity ?? '待核实' }}</dd></div>
        <div><dt>已关联来源用量</dt><dd>{{ row.linkedQuantity ?? '待核实' }}</dd></div>
        <div><dt>来源状态</dt><dd>{{ linkLabel(row.linkState) }}</dd></div>
        <div><dt>工单材料账面金额</dt><dd>{{ money(row.recordedMaterialAmount) }}（非核实成本）</dd></div>
        <div><dt>已核实实际成本</dt><dd>待核实，不能按零计算利润</dd></div>
      </dl>
      <p v-if="!row.sources?.length" class="boundary">请在下方“安装 / 售后”选择原收货记录和此工单材料，关联已有来源；不要按名称猜供应商。</p>
      <div v-for="source in row.sources || []" :key="source.allocationId" class="source-card">
        <p v-if="source.state !== 'source_linked'" class="boundary">来源关联不完整或不一致，供应商、采购金额和付款状态暂不采用。请复核原采购、收货与材料。</p>
        <template v-else>
          <h5>{{ source.supplierName }}</h5>
          <p class="muted">采购单 {{ source.purchaseOrderNo }} · 收货单 {{ source.receiptNo }}</p>
          <dl class="amount-grid">
            <div><dt>本工单关联数量</dt><dd>{{ source.allocatedQuantity }}</dd></div>
            <div><dt>采购单价</dt><dd>{{ money(source.purchaseUnitPrice) }}</dd></div>
            <div><dt>本次领用采购参考金额</dt><dd>{{ money(source.purchaseReferenceAmount) }}（未含费用分摊）</dd></div>
          </dl>
          <p class="muted">本行仅显示材料来源和采购参考成本；付款记录统一见下方“按采购单核对付款”，不按材料行重复计算。</p>
        </template>
      </div>
    </article>
    <section class="purchase-summary" aria-label="按采购单核对付款">
      <h4>按采购单核对付款 · 同一采购单只显示一次</h4>
      <p class="muted">以下按原采购单内部编号分组，不按材料名称或供应商名称合并。只回读本工单已关联来源，不是全部供应商欠款清单。</p>
      <p v-if="purchaseReadback.unresolvedSourceCount" class="boundary" role="status">有 {{ purchaseReadback.unresolvedSourceCount }} 条来源缺失或不完整，未纳入付款汇总；这不表示没有欠款。</p>
      <p v-if="!purchaseReadback.groups.length" class="empty">暂无可识别的原采购单付款记录；未知不能按未付款或零成本处理。</p>
      <article v-for="group in purchaseReadback.groups" :key="group.purchaseOrderId" class="source-card">
        <h5>采购单内部编号 #{{ group.purchaseOrderId }}</h5>
        <p class="muted">本工单关联材料 {{ group.materialIds.length }} 项；整单付款金额不按材料项数累加。</p>
        <p v-if="group.issue" class="boundary" role="status">{{ group.issue === 'conflict' ? '关联冲突待核对' : '来源信息不完整，待核对' }}：已隐藏该采购单的付款金额，请核对原采购、收货和付款记录，不能据此再次付款。</p>
        <template v-else>
          <p>{{ group.supplierName }} · 采购单 {{ group.purchaseOrderNo }}</p>
          <dl class="amount-grid">
            <div><dt>供应商付款状态</dt><dd>{{ repairPaymentReadbackLabel(group.payment?.state) }}</dd></div>
            <div><dt>整张采购单金额</dt><dd>{{ money(group.payment?.purchaseTotal) }}</dd></div>
            <div><dt>整张采购单实际付款核验</dt><dd>待核验（本区未复核实际回执）</dd></div>
            <div><dt>整张采购单登记已付</dt><dd>{{ money(group.payment?.registeredPaidAmount) }}（以核验为准）</dd></div>
            <div><dt>整张采购单账面剩余</dt><dd>{{ money(group.payment?.recordedRemainingAmount) }}（不是付款许可）</dd></div>
          </dl>
          <p class="muted">“已记录对账”仅表示原财务记录的状态，不等于本区已核实实际付款；待核验也不表示尚未付款。已登记付款或结果未知时先核对，不能再次付款。</p>
        </template>
      </article>
    </section>
    <p class="muted">本区只回读已有记录，不确认收付款、不改库存、不分配或发放工资。供应商未收款不代表材料没有成本，后续付款也不能再次扣同一成本。</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { groupRepairPurchasePaymentReadback, repairPaymentReadbackLabel } from '../repair-payment-readback';

const props = defineProps<{ rows: any[]; collection: { ready?: boolean } | null }>();
const purchaseReadback = computed(() => groupRepairPurchasePaymentReadback(props.rows));

function money(value: unknown) {
  return typeof value === 'string' && /^(0|[1-9]\d*)\.\d{2}$/.test(value) ? `¥${value}` : '待核实';
}
function linkLabel(value: unknown) {
  const labels: Record<string, string> = { unlinked: '未关联', linked: '来源已关联（成本仍待核实）', partially_linked: '部分关联', incomplete: '关联待复核' };
  return typeof value === 'string' ? labels[value] || '待复核' : '待复核';
}
</script>

<style scoped>
.material-readback { min-width: 0; border: 1px solid #dcdfe6; border-radius: 8px; padding: 16px; background: white; color: #303133; overflow-wrap: anywhere; }
h3, h4, h5 { margin: 0 0 8px; }
h4 small { color: #606266; font-weight: normal; }
p { margin: 8px 0; line-height: 1.6; }
.material-card { margin: 16px 0; padding: 14px; border: 1px solid #dcdfe6; border-radius: 8px; }
.source-card { margin-top: 12px; padding: 12px; background: #f5f7fa; border-radius: 6px; }
.purchase-summary { margin-top: 20px; padding-top: 16px; border-top: 1px solid #dcdfe6; }
.amount-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 12px 0; }
dt, .muted, .empty { color: #606266; font-size: 13px; }
dd { margin: 4px 0 0; line-height: 1.5; }
.boundary { padding: 12px; border-left: 3px solid #d59c32; background: #fff7e6; color: #725014; }
@media (max-width: 600px) { .amount-grid { grid-template-columns: minmax(0, 1fr); } .material-readback, .material-card { padding: 12px; } }
</style>
