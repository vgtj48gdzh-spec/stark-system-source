<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">月度绩效汇总</div>
          <div class="subtitle">按月汇总订单、资金、卡和工单事件，支持查看汇总明细与重跑汇总。</div>
        </div>
        <el-button
          v-if="canGenerateSummaries"
          type="primary"
          :loading="generating"
          @click="handleGenerateSummaries"
        >
          重新生成月度汇总
        </el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="员工 ID">
        <el-input-number v-model="filters.employeeId" :min="1" controls-position="right" />
      </el-form-item>
      <el-form-item label="来源域">
        <el-select v-model="filters.sourceDomain" clearable style="width: 180px">
          <el-option
            v-for="item in sourceDomains"
            :key="item"
            :label="formatPerformanceDomain(item)"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="周期">
        <el-input v-model="filters.periodKey" clearable placeholder="YYYY-MM" style="width: 140px" />
      </el-form-item>
      <el-form-item label="阻塞原因">
        <el-select v-model="filters.performanceBlockReason" clearable style="width: 200px">
          <el-option label="缺客户绑定" value="missing_customer_binding" />
          <el-option label="待人工确认" value="awaiting_manual_review" />
          <el-option label="缺员工绑定" value="missing_employee_binding" />
        </el-select>
      </el-form-item>
      <el-form-item label="对账状态">
        <el-select v-model="filters.reconciliationStatus" clearable style="width: 180px">
          <el-option label="台账漏记" value="sheet_missing" />
          <el-option label="已匹配台账" value="matched_sheet" />
          <el-option label="待复核" value="needs_review" />
        </el-select>
      </el-form-item>
      <el-form-item label="时间分桶">
        <el-select v-model="filters.timeBucket" clearable style="width: 160px">
          <el-option v-for="item in AI_TIME_BUCKET_OPTIONS" :key="item.value || 'all-time'" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态视图">
        <el-select v-model="filters.processingView" style="width: 160px">
          <el-option v-for="item in AI_PROCESSING_VIEW_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DDTHH:mm:ss"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="filters.timeBucket || filters.processingView !== 'current'"
      class="state-hint"
      type="info"
      :closable="false"
      show-icon
      :title="`当前按 ${formatAiTimeBucket(filters.timeBucket)} / ${formatAiProcessingView(filters.processingView)} 视角查看。若任务已暂缓或已完成，请回到 AI 页面重新打开。`"
    />

    <el-table
      :data="tableData"
      v-loading="loading"
      highlight-current-row
      row-key="id"
      @row-click="handleAiRowClick"
    >
      <el-table-column prop="periodKey" label="周期" width="100" />
      <el-table-column prop="employeeName" label="员工" min-width="140" show-overflow-tooltip />
      <el-table-column label="来源域" min-width="120">
        <template #default="{ row }">{{ formatPerformanceDomain(row.sourceDomain) }}</template>
      </el-table-column>
      <el-table-column label="客户核对" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.customerName || '源链暂无稳定手机号/待人工绑定' }}</div>
          <div class="subtle-text">{{ row.customerMobile || '-' }}</div>
          <div class="subtle-text">客户ID：{{ row.matchedCustomerId || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="项目/套餐" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">{{ row.packageName || '-' }}</template>
      </el-table-column>
      <el-table-column label="客户绑定" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ formatCustomerBindingStatus(row.customerBinding?.bindingStatus) }}</div>
          <div class="subtle-text">
            {{ row.matchReason || row.evidenceSummary || row.customerBindingSummary?.note || '-' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="绩效条件" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tag v-if="row.performanceReadyFlag !== null" :type="row.performanceReadyFlag ? 'success' : 'warning'">
            {{ row.performanceReadyFlag ? '已具备基础条件' : '暂未具备基础条件' }}
          </el-tag>
          <span v-else>-</span>
          <div class="subtle-text">
            {{ row.performanceDecisionReason || formatPerformanceBlockReason(row.performanceBlockReason) }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="支付/对账" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ formatPaymentStatus(row.paymentStatus) }} / {{ formatSourceClassification(row.sourceClassification) }}</div>
          <div class="subtle-text">
            {{ formatReconciliationStatus(row.reconciliationStatus) }}：{{ row.reconciliationReason || '-' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="套餐证据" min-width="210" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tag :type="row.missingCItemSuspected ? 'warning' : row.bundleEvidenceStrong ? 'success' : 'info'">
            {{ row.missingCItemSuspected ? '疑似缺C端' : row.bundleEvidenceStrong ? '强证据' : '待核对' }}
          </el-tag>
          <div class="subtle-text">
            A {{ formatMoney(row.linkedPaidAAmount) }} / B {{ formatMoney(row.linkedBCardAmount) }}
          </div>
          <div class="subtle-text">{{ row.bundleInferenceReason || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="eventCount" label="事件数" width="100" align="right" />
      <el-table-column prop="confirmedEventCount" label="已确认" width="100" align="right" />
      <el-table-column prop="pendingEventCount" label="待确认" width="100" align="right" />
      <el-table-column v-if="canViewAmounts" label="金额汇总" min-width="130" align="right">
        <template #default="{ row }">{{ formatMoney(row.amountTotal) }}</template>
      </el-table-column>
      <el-table-column label="数量汇总" min-width="130" align="right">
        <template #default="{ row }">{{ formatMoney(row.quantityTotal) }}</template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.updatedAt" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="goToDetail(row.id)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pager"
      background
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="handlePageChange"
    />
  </el-card>

  <AiSideAssistant
    page-title="绩效汇总"
    route-path="/performance/summaries"
    :current-filters="aiCurrentFilters"
    :source-action-id="aiSourceActionId"
    :focus-object="aiFocusObject"
  />
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { generatePerformanceSummaries, getPerformanceSummaries } from '../../api/performance';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  AI_PROCESSING_VIEW_OPTIONS,
  AI_TIME_BUCKET_OPTIONS,
  buildTimeBucketPreset,
  formatAiProcessingView,
  formatAiTimeBucket,
  resolveAiRouteBucketState,
} from '../../utils/ai-task-filters';
import {
  formatCustomerBindingStatus,
  formatPaymentStatus,
  formatPerformanceBlockReason,
  formatReconciliationStatus,
  formatSourceClassification,
} from '../../utils/business-stats';
import { formatMoney } from '../../utils/format';
import { hasAnyRole, hasPermission } from '../../utils/permissions';
import { formatPerformanceDomain } from '../../utils/performance';

const router = useRouter();
const route = useRoute();
const sourceDomains = ['work_orders', 'orders', 'funds', 'cards'];
const loading = ref(false);
const generating = ref(false);
const tableData = ref<any[]>([]);
const selectedAiRow = ref<any | null>(null);
const total = ref(0);
const dateRange = ref<[string, string] | []>([]);
const query = reactive({
  page: 1,
  pageSize: 10,
});
const filters = reactive({
  employeeId: undefined as number | undefined,
  sourceDomain: '',
  periodKey: '',
  performanceBlockReason: '',
  reconciliationStatus: '',
  timeBucket: '',
  processingView: 'current',
  periodMode: 'month',
});

const canGenerateSummaries = computed(() => hasPermission('performance.summaries.generate'));
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));
const aiSourceActionId = computed(() =>
  typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()
    ? route.query.sourceActionId.trim()
    : null,
);
const aiCurrentFilters = computed(() => ({
  ...route.query,
  employeeId: filters.employeeId,
  sourceDomain: filters.sourceDomain || undefined,
  periodKey: filters.periodKey || undefined,
  performanceBlockReason: filters.performanceBlockReason || undefined,
  reconciliationStatus: filters.reconciliationStatus || undefined,
  timeBucket: filters.timeBucket || undefined,
  processingView: filters.processingView,
  periodMode: filters.periodMode,
  dateFrom: dateRange.value[0] || undefined,
  dateTo: dateRange.value[1] || undefined,
}));
const aiFocusObject = computed(() => {
  if (!selectedAiRow.value?.id) {
    return null;
  }
  return {
    entityType: 'performance_summary',
    entityId: selectedAiRow.value.id,
  };
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPerformanceSummaries({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'periodKey',
      sortOrder: 'desc',
      employeeId: filters.employeeId,
      sourceDomain: filters.sourceDomain || undefined,
      periodKey: filters.periodKey || undefined,
      dateFrom: dateRange.value[0],
      dateTo: dateRange.value[1],
      performanceBlockReason: filters.performanceBlockReason || undefined,
      reconciliationStatus: filters.reconciliationStatus || undefined,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function applyRouteFilters(resetPage = false) {
  filters.employeeId = route.query.employeeId ? Number(route.query.employeeId) : undefined;
  filters.sourceDomain = String(route.query.sourceDomain ?? '');
  filters.periodKey = String(route.query.periodKey ?? '');
  filters.performanceBlockReason = String(route.query.performanceBlockReason ?? '');
  filters.reconciliationStatus = String(route.query.reconciliationStatus ?? '');
  const routeBucketState = resolveAiRouteBucketState(route.query, {
    defaultPeriodMode: 'month',
    defaultProcessingView: 'current',
  });
  filters.timeBucket = routeBucketState.timeBucket;
  filters.processingView = routeBucketState.processingView;
  filters.periodMode = routeBucketState.periodMode;
  dateRange.value = routeBucketState.dateRange;
  if (!dateRange.value.length) {
    const preset = buildTimeBucketPreset(filters.timeBucket, filters.periodMode);
    if (preset.periodKey && !filters.periodKey) {
      filters.periodKey = preset.periodKey;
    }
  }
  if (resetPage) {
    query.page = 1;
  }
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function resetFilters() {
  filters.employeeId = undefined;
  filters.sourceDomain = '';
  filters.periodKey = '';
  filters.performanceBlockReason = '';
  filters.reconciliationStatus = '';
  filters.timeBucket = '';
  filters.processingView = 'current';
  filters.periodMode = 'month';
  dateRange.value = [];
  handleSearch();
}

function handleAiRowClick(row: any) {
  selectedAiRow.value = row;
}

async function handleGenerateSummaries() {
  generating.value = true;
  try {
    const { data } = await generatePerformanceSummaries({});
    ElMessage.success(`月度汇总已重跑，生成 ${data.data.generatedSummaryCount} 条汇总记录`);
    await loadData();
  } finally {
    generating.value = false;
  }
}

function goToDetail(id: number) {
  router.push(`/performance/summaries/${id}`);
}

watch(
  () => route.query,
  () => {
    applyRouteFilters(true);
    loadData();
  },
);

onMounted(() => {
  applyRouteFilters();
  loadData();
});
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

.filters {
  margin-bottom: 8px;
}

.state-hint {
  margin-bottom: 12px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
