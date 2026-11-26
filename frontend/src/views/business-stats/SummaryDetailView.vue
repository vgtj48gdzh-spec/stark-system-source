<template>
  <el-card v-loading="loading">
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">统计汇总详情</div>
          <div class="subtitle">查看汇总构成、工资准入状态、客户核对与福利来源</div>
        </div>
        <el-button @click="goBack">返回</el-button>
      </div>
    </template>

    <el-descriptions v-if="summary" :column="2" border class="summary-box">
      <el-descriptions-item label="汇总域">
        {{ formatRewardSummaryDomain(summary.summaryDomain) }}
      </el-descriptions-item>
      <el-descriptions-item label="周期">{{ summary.periodKey }}</el-descriptions-item>
      <el-descriptions-item label="责任员工">{{ summary.responsibleEmployeeName || '-' }}</el-descriptions-item>
      <el-descriptions-item label="客户标识">{{ summary.customerId || '-' }}</el-descriptions-item>
      <el-descriptions-item label="业务分类">
        {{ formatSummaryBusinessCategory(summary.businessCategory) }}
      </el-descriptions-item>
      <el-descriptions-item label="福利口径">
        {{ formatWelfareSourceType(summary.welfareSourceType) }}
      </el-descriptions-item>
      <el-descriptions-item label="标签数">{{ summary.tagCount }}</el-descriptions-item>
      <el-descriptions-item label="事件数">{{ summary.rewardEventCount }}</el-descriptions-item>
      <el-descriptions-item label="已确认事件">{{ summary.confirmedRewardEventCount }}</el-descriptions-item>
      <el-descriptions-item label="待确认事件">{{ summary.pendingRewardEventCount }}</el-descriptions-item>
      <el-descriptions-item label="金额汇总">{{ canViewAmounts ? formatMoney(summary.amountTotal) : '-' }}</el-descriptions-item>
      <el-descriptions-item label="数量汇总">{{ formatMoney(summary.quantityTotal) }}</el-descriptions-item>
      <el-descriptions-item label="确认状态">
        <el-tag :type="summary.confirmedFlag ? 'success' : 'warning'">
          {{ summary.confirmedFlag ? '已确认' : '未确认' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="确认时间">
        <ReadableDateTime :value="summary.confirmedAt" />
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions v-if="summary" :column="2" border class="summary-box">
      <el-descriptions-item label="是否可入工资">
        <el-tag v-if="summary.payrollDecision" :type="getPayrollDecisionTagType(summary.payrollDecision)">
          {{ formatPayrollDecision(summary.payrollDecision) }}
        </el-tag>
        <span v-else>-</span>
      </el-descriptions-item>
      <el-descriptions-item label="阻塞原因">
        {{ formatPayrollBlockReason(summary.payrollBlockReason) }}
      </el-descriptions-item>
      <el-descriptions-item label="判定说明">
        {{ summary.payrollDecisionReason || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="主识别键">
        {{ summary.customerMobile || summary.carPlate || summary.customerId || '无可追溯主识别键' }}
      </el-descriptions-item>
      <el-descriptions-item label="员工绑定状态">
        <el-tag :type="summary.responsibleEmployeeId ? 'success' : 'warning'">
          {{ summary.responsibleEmployeeId ? '已绑定员工' : '未绑定员工' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="福利来源类型">
        {{ formatWelfareSourceType(summary.welfareSourceType) }}
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions v-if="summary?.verificationContext" :column="2" border class="summary-box">
      <el-descriptions-item label="客户姓名">
        {{ summary.verificationContext.customerName || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="客户手机号">
        {{ summary.verificationContext.customerMobile || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="车牌号">
        {{ summary.verificationContext.carPlate || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="购买时间">
        {{ summary.verificationContext.purchaseTime || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="来源单号">
        {{ summary.verificationContext.sourceOrderNo || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="套餐/业务">
        {{ summary.verificationContext.packageName || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="商户名称">
        {{ summary.verificationContext.merchantName || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="商户联系人">
        {{ summary.verificationContext.merchantContact || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="来源表">
        {{ summary.verificationContext.sourceTable || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="来源ID">
        {{ summary.verificationContext.sourceId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="办卡明细姓名">
        {{ summary.verificationContext.sourceCustomerNameAlias || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="办卡明细手机号">
        {{ summary.verificationContext.sourceCustomerMobile || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="匹配客户ID">
        {{ summary.verificationContext.matchedCustomerId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="匹配客户姓名">
        {{ summary.verificationContext.matchedCustomerName || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="匹配客户手机号">
        {{ summary.verificationContext.matchedCustomerMobile || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="匹配订单">
        {{
          summary.verificationContext.matchedOrderNo ||
          summary.verificationContext.matchedOrderId ||
          '-'
        }}
      </el-descriptions-item>
      <el-descriptions-item label="匹配来源表">
        {{ summary.verificationContext.matchedSourceTable || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="匹配置信度">
        {{ summary.verificationContext.matchConfidence || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="匹配依据" :span="2">
        {{ summary.verificationContext.matchReason || summary.verificationContext.evidenceSummary || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="异常标记">
        <el-tag
          v-if="summary.verificationContext.anomalyClassification"
          :type="
            summary.verificationContext.anomalyClassification === 'suspected_test_data'
              ? 'danger'
              : summary.verificationContext.anomalyClassification === 'needs_review'
                ? 'warning'
                : 'info'
          "
        >
          {{ formatSummaryAnomalyClassification(summary.verificationContext.anomalyClassification) }}
        </el-tag>
        <span v-else>-</span>
      </el-descriptions-item>
      <el-descriptions-item label="核对说明">
        {{ summary.verificationContext.anomalyReason || '-' }}
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions :column="2" border class="summary-box">
      <el-descriptions-item label="客户绑定状态">
        <el-tag v-if="primaryCustomerBinding?.bindingStatus" :type="getCustomerBindingTagType(primaryCustomerBinding.bindingStatus)">
          {{ formatCustomerBindingStatus(primaryCustomerBinding.bindingStatus) }}
        </el-tag>
        <span v-else>源链暂无稳定手机号/待人工绑定</span>
      </el-descriptions-item>
      <el-descriptions-item label="绩效识别基础">
        <el-tag
          v-if="primaryCustomerBinding"
          :type="primaryCustomerBinding.performanceReadyFlag ? 'success' : 'warning'"
        >
          {{ primaryCustomerBinding.performanceReadyFlag ? '已具备基础条件' : '暂未具备基础条件' }}
        </el-tag>
        <span v-else>源链暂无稳定手机号/待人工绑定</span>
      </el-descriptions-item>
      <el-descriptions-item label="阻塞原因">
        {{
          primaryCustomerBinding?.performanceBlockReason
            ? formatPerformanceBlockReason(primaryCustomerBinding.performanceBlockReason)
            : '源链暂无稳定手机号/待人工绑定'
        }}
      </el-descriptions-item>
      <el-descriptions-item label="判定说明">
        {{ primaryCustomerBinding?.performanceDecisionReason || '源链暂无稳定手机号/待人工绑定' }}
      </el-descriptions-item>
      <el-descriptions-item label="匹配客户">
        {{ primaryCustomerBinding?.matchedCustomerName || '源链暂无稳定手机号/待人工绑定' }}
      </el-descriptions-item>
      <el-descriptions-item label="匹配手机号">
        {{ primaryCustomerBinding?.matchedCustomerMobile || '源链暂无稳定手机号/待人工绑定' }}
      </el-descriptions-item>
      <el-descriptions-item label="绑定备注" :span="2">
        {{ primaryCustomerBinding?.bindingRemark || '源链暂无稳定手机号/待人工绑定' }}
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions
      v-if="summary?.benefitIssueNo || summary?.welfareSourceType === 'legacy_welfare_candidate'"
      :column="2"
      border
      class="summary-box"
    >
      <el-descriptions-item label="福利来源">{{ formatWelfareSourceType(summary.welfareSourceType) }}</el-descriptions-item>
      <el-descriptions-item label="福利单号">{{ summary.benefitIssueNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="福利周期">{{ summary.benefitPeriodKey || '-' }}</el-descriptions-item>
      <el-descriptions-item label="福利类型">{{ summary.benefitIssueType || '-' }}</el-descriptions-item>
      <el-descriptions-item label="福利状态">{{ summary.benefitIssueStatus || '-' }}</el-descriptions-item>
      <el-descriptions-item label="福利金额">{{ canViewAmounts ? formatMoney(summary.benefitAmount) : '-' }}</el-descriptions-item>
      <el-descriptions-item label="有效期天数">{{ summary.benefitValidityDays ?? '-' }}</el-descriptions-item>
      <el-descriptions-item label="已确认">
        {{ summary.benefitConfirmedFlag === null ? '-' : summary.benefitConfirmedFlag ? '是' : '否' }}
      </el-descriptions-item>
      <el-descriptions-item label="已发放">
        {{ summary.benefitIssuedFlag === null ? '-' : summary.benefitIssuedFlag ? '是' : '否' }}
      </el-descriptions-item>
      <el-descriptions-item label="已通知">
        {{ summary.benefitNotifiedFlag === null ? '-' : summary.benefitNotifiedFlag ? '是' : '否' }}
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions v-if="summary" :column="2" border class="summary-box">
      <el-descriptions-item label="B端购物卡发放金额">
        {{ formatMoney(summary.bCardIssuedAmount) }}
      </el-descriptions-item>
      <el-descriptions-item label="B端购物卡消费金额">
        {{ formatMoney(summary.bCardConsumedAmount) }}
      </el-descriptions-item>
      <el-descriptions-item label="B端购物卡剩余金额">
        {{ formatMoney(summary.bCardRemainingAmount) }}
      </el-descriptions-item>
      <el-descriptions-item label="B端购物卡发放/消费次数">
        {{ summary.bCardIssueCount ?? 0 }} / {{ summary.bCardConsumeCount ?? 0 }}
      </el-descriptions-item>
      <el-descriptions-item label="B端购物卡来源分类">
        {{ formatBCardSourceType(summary.bCardSourceType) }}
      </el-descriptions-item>
      <el-descriptions-item label="B端购物卡统计说明">
        {{ summary.bCardSourceReason || '独立统计，不计入现金收入' }}
      </el-descriptions-item>
      <el-descriptions-item label="支付状态">
        {{ formatPaymentStatus(summary.paymentStatus) }} / {{ formatSourceClassification(summary.sourceClassification) }}
      </el-descriptions-item>
      <el-descriptions-item label="对账状态">
        {{ formatReconciliationStatus(summary.reconciliationStatus) }}：{{ summary.reconciliationReason || '-' }}
      </el-descriptions-item>
    </el-descriptions>

    <el-descriptions v-if="summary" :column="2" border class="summary-box">
      <el-descriptions-item label="套餐证据">
        <el-tag :type="summary.bundleEvidenceStrong ? 'success' : 'info'">
          {{ summary.bundleEvidenceStrong ? '强证据命中' : '证据不足/待核对' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="疑似缺失C端">
        <el-tag :type="summary.missingCItemSuspected ? 'warning' : 'info'">
          {{ summary.missingCItemSuspected ? '高度疑似' : '未命中' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="A端已支付金额">
        {{ formatMoney(summary.linkedPaidAAmount) }}
      </el-descriptions-item>
      <el-descriptions-item label="B卡已发放金额">
        {{ formatMoney(summary.linkedBCardAmount) }}
      </el-descriptions-item>
      <el-descriptions-item label="B卡来源">
        {{ formatBCardSourceType(summary.linkedBCardSourceType) }}
      </el-descriptions-item>
      <el-descriptions-item label="证据窗口">
        {{ summary.linkedBundleWindowDays === null || summary.linkedBundleWindowDays === undefined ? '-' : `${summary.linkedBundleWindowDays} 天` }}
      </el-descriptions-item>
      <el-descriptions-item label="推断理由" :span="2">
        {{ summary.bundleInferenceReason || '仅作只读证据，不自动补单、不进入正式工资结论' }}
      </el-descriptions-item>
    </el-descriptions>

    <el-table :data="detailList" class="detail-table">
      <el-table-column label="类型" width="100">
        <template #default="{ row }">{{ formatPendingItemType(row.itemType) }}</template>
      </el-table-column>
      <el-table-column label="编码/类型" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.itemType === 'tag'">{{ formatBusinessStatTag(row.payload.tagCode) }}</span>
          <span v-else>{{ formatRewardEventType(row.payload.eventType) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="payload.sourceTable" label="来源表" min-width="140" show-overflow-tooltip />
      <el-table-column prop="payload.sourceOrderNo" label="来源编号" min-width="150" show-overflow-tooltip />
      <el-table-column label="客户核对" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.payload.customerName || '-' }}</div>
          <div class="subtle-text">{{ row.payload.customerMobile || '-' }}</div>
          <div class="subtle-text">客户ID：{{ row.payload.matchedCustomerId || row.payload.customerId || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="车牌" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.payload.carPlate || '-' }}</template>
      </el-table-column>
      <el-table-column label="套餐/业务" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.payload.packageName || '-' }}</template>
      </el-table-column>
      <el-table-column label="匹配状态" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ formatCustomerBindingStatus(row.payload.customerBinding?.bindingStatus) }}</div>
          <div class="subtle-text">{{ row.payload.matchConfidence || '待人工复核' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="匹配依据" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.payload.matchReason || row.payload.evidenceSummary || '源链暂无稳定手机号/待人工绑定' }}
        </template>
      </el-table-column>
      <el-table-column label="商户核对" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.payload.merchantName || '-' }}</div>
          <div class="subtle-text">{{ row.payload.merchantContact || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="payload.sourceId" label="来源ID" min-width="100" show-overflow-tooltip />
      <el-table-column label="发生时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.occurredAt" /></template>
      </el-table-column>
      <el-table-column label="购买时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ row.payload.purchaseTime || '-' }}</template>
      </el-table-column>
      <el-table-column label="金额" min-width="120" align="right">
        <template #default="{ row }">
          <span v-if="row.itemType === 'reward' && canViewAmounts">{{ formatMoney(row.payload.amountStandard) }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="异常标记" min-width="120">
        <template #default="{ row }">
          <el-tag
            v-if="row.payload.anomalyClassification"
            :type="
              row.payload.anomalyClassification === 'suspected_test_data'
                ? 'danger'
                : row.payload.anomalyClassification === 'needs_review'
                  ? 'warning'
                  : 'info'
            "
          >
            {{ formatSummaryAnomalyClassification(row.payload.anomalyClassification) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="支付/对账" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ formatPaymentStatus(row.payload.paymentStatus) }} / {{ formatSourceClassification(row.payload.sourceClassification) }}</div>
          <div class="subtle-text">
            {{ formatReconciliationStatus(row.payload.reconciliationStatus) }}：{{ row.payload.reconciliationReason || '-' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="payload.remark" label="备注" min-width="200" show-overflow-tooltip />
    </el-table>
  </el-card>

  <AiSideAssistant
    page-title="业务统计汇总详情"
    route-path="/business-stats/summaries/:id"
    :current-filters="aiCurrentFilters"
    :source-action-id="aiSourceActionId"
    entity-type="business_stat_summary"
    :entity-id="summaryId"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getStatSummaryDetail } from '../../api/business-stats';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatBCardSourceType,
  formatBusinessStatTag,
  formatCustomerBindingStatus,
  formatPayrollBlockReason,
  formatPayrollDecision,
  formatPaymentStatus,
  formatPendingItemType,
  formatPerformanceBlockReason,
  formatReconciliationStatus,
  formatRewardEventType,
  formatRewardSummaryDomain,
  formatSourceClassification,
  formatSummaryAnomalyClassification,
  formatSummaryBusinessCategory,
  formatWelfareSourceType,
} from '../../utils/business-stats';
import { formatMoney } from '../../utils/format';
import { hasAnyRole } from '../../utils/permissions';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const summary = ref<any>(null);
const detailList = ref<any[]>([]);
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));
const summaryId = computed(() => Number(route.params.id));
const aiSourceActionId = computed(() =>
  typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()
    ? route.query.sourceActionId.trim()
    : null,
);
const aiCurrentFilters = computed(() => ({
  ...route.query,
  summaryId: summaryId.value,
}));
const primaryCustomerBinding = computed(
  () =>
    detailList.value.find((row) => row?.payload?.customerBinding)?.payload?.customerBinding ??
    null,
);

function getPayrollDecisionTagType(value?: string | null) {
  switch (value) {
    case 'included_whitelist':
      return 'success';
    case 'pending_confirmation':
      return 'warning';
    case 'reference_only':
      return 'info';
    default:
      return 'info';
  }
}

function getCustomerBindingTagType(value?: string | null) {
  switch (value) {
    case 'auto_matched':
    case 'manually_bound':
      return 'success';
    case 'conflict':
      return 'danger';
    case 'manual_pending':
    default:
      return 'warning';
  }
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getStatSummaryDetail(Number(route.params.id), {
      sortBy: 'occurredAt',
      sortOrder: 'desc',
      page: 1,
      pageSize: 100,
    });
    summary.value = data.data.summary;
    detailList.value = data.data.detail.list;
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push('/business-stats/summaries');
}

onMounted(loadData);
</script>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.subtle-text {
  font-size: 12px;
  color: #6b7280;
}

.summary-box {
  margin-bottom: 16px;
}

.detail-table {
  margin-top: 12px;
}
</style>
