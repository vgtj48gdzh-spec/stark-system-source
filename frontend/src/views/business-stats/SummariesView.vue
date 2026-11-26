<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">月度统计汇总</div>
          <div class="subtitle">按月查看业务统计标签、奖励事件、工资准入状态与核对信息</div>
        </div>
        <el-button v-if="canGenerate" type="primary" :loading="generating" @click="handleGenerate">
          生成汇总
        </el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="汇总域">
        <el-select v-model="filters.summaryDomain" clearable style="width: 160px">
          <el-option label="ABC整体" value="abc_overall" />
          <el-option label="公车" value="public_vehicle" />
          <el-option label="私家车" value="private_vehicle" />
          <el-option label="保险理赔" value="insurance_claim" />
        </el-select>
      </el-form-item>
      <el-form-item label="周期">
        <el-input v-model="filters.periodKey" clearable placeholder="YYYY-MM" style="width: 120px" />
      </el-form-item>
      <el-form-item label="已确认">
        <el-select v-model="filters.confirmedFlag" clearable style="width: 120px">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item label="业务分类">
        <el-select v-model="filters.businessCategory" clearable style="width: 180px">
          <el-option label="A端销售" value="a_sales" />
          <el-option label="A+C联动销售" value="a_plus_c_linked_sale" />
          <el-option label="B端购物卡" value="b_shopping_card" />
          <el-option label="员工福利购物卡" value="employee_welfare_card" />
          <el-option label="C端积分兑换" value="c_points_redemption" />
          <el-option label="特殊业务" value="special_business_case" />
          <el-option label="待复核" value="needs_review" />
        </el-select>
      </el-form-item>
      <el-form-item label="工资准入">
        <el-select v-model="filters.payrollDecision" clearable style="width: 180px">
          <el-option label="待人工确认" value="pending_confirmation" />
          <el-option label="白名单纳入" value="included_whitelist" />
          <el-option label="仅参考" value="reference_only" />
        </el-select>
      </el-form-item>
      <el-form-item label="支付/来源">
        <el-select v-model="filters.paymentStatus" clearable style="width: 180px">
          <el-option label="未支付" value="unpaid" />
          <el-option label="测试数据" value="test_data" />
          <el-option label="未知" value="unknown" />
          <el-option label="内部管理员" value="internal_admin" />
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
      <el-table-column label="汇总域" min-width="120">
        <template #default="{ row }">{{ formatRewardSummaryDomain(row.summaryDomain) }}</template>
      </el-table-column>
      <el-table-column prop="periodKey" label="周期" width="100" />
      <el-table-column prop="responsibleEmployeeName" label="责任员工" min-width="120" show-overflow-tooltip />
      <el-table-column label="客户核对" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.customerName || '无可追溯客户信息' }}</div>
          <div class="subtle-text">{{ row.customerMobile || '无可追溯手机号' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="车牌" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.carPlate || '无可追溯车牌' }}</template>
      </el-table-column>
      <el-table-column label="购买时间" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.purchaseTime || '无可追溯购买时间' }}</template>
      </el-table-column>
      <el-table-column label="套餐/业务" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.packageName || '-' }}</template>
      </el-table-column>
      <el-table-column label="商户核对" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.merchantName || '-' }}</div>
          <div class="subtle-text">{{ row.merchantContact || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="来源" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.sourceTableDisplay || '-' }} / {{ row.sourceIdDisplay || '-' }}</template>
      </el-table-column>
      <el-table-column label="业务分类" min-width="140">
        <template #default="{ row }">
          <el-tag v-if="row.businessCategory" type="info">
            {{ formatSummaryBusinessCategory(row.businessCategory) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="福利口径" min-width="160">
        <template #default="{ row }">
          <el-tag
            v-if="row.welfareSourceType"
            :type="row.welfareSourceType === 'formal_employee_benefit' ? 'success' : 'warning'"
          >
            {{ formatWelfareSourceType(row.welfareSourceType) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="B端购物卡" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div>发放：{{ formatMoney(row.bCardIssuedAmount) }} / 消费：{{ formatMoney(row.bCardConsumedAmount) }}</div>
          <div class="subtle-text">
            剩余：{{ formatMoney(row.bCardRemainingAmount) }}，{{ formatBCardSourceType(row.bCardSourceType) }}
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
      <el-table-column label="工资准入" min-width="140">
        <template #default="{ row }">
          <el-tag v-if="row.payrollDecision" :type="getPayrollDecisionTagType(row.payrollDecision)">
            {{ formatPayrollDecision(row.payrollDecision) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="阻塞原因" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ formatPayrollBlockReason(row.payrollBlockReason) }}</div>
          <div class="subtle-text">{{ row.payrollDecisionReason || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="异常标记" min-width="120">
        <template #default="{ row }">
          <el-tag
            v-if="row.anomalyClassification"
            :type="
              row.anomalyClassification === 'suspected_test_data'
                ? 'danger'
                : row.anomalyClassification === 'needs_review'
                  ? 'warning'
                  : 'info'
            "
          >
            {{ formatSummaryAnomalyClassification(row.anomalyClassification) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="tagCount" label="标签数" width="90" align="right" />
      <el-table-column prop="rewardEventCount" label="事件数" width="90" align="right" />
      <el-table-column prop="confirmedRewardEventCount" label="已确认" width="90" align="right" />
      <el-table-column prop="pendingRewardEventCount" label="待确认" width="90" align="right" />
      <el-table-column v-if="canViewAmounts" label="金额汇总" min-width="120" align="right">
        <template #default="{ row }">{{ formatMoney(row.amountTotal) }}</template>
      </el-table-column>
      <el-table-column label="数量汇总" min-width="120" align="right">
        <template #default="{ row }">{{ formatMoney(row.quantityTotal) }}</template>
      </el-table-column>
      <el-table-column label="已确认" width="90">
        <template #default="{ row }">
          <el-tag :type="row.confirmedFlag ? 'success' : 'warning'">
            {{ row.confirmedFlag ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.updatedAt" /></template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="goToDetail(row.id)">详情</el-button>
          <el-button v-if="canConfirm && !row.confirmedFlag" link type="success" @click="handleConfirm(row)">
            确认
          </el-button>
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
    page-title="业务统计汇总"
    route-path="/business-stats/summaries"
    :current-filters="aiCurrentFilters"
    :source-action-id="aiSourceActionId"
    :focus-object="aiFocusObject"
  />
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { confirmStatSummary, generateStatSummaries, getStatSummaries } from '../../api/business-stats';
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
  formatBCardSourceType,
  formatPayrollBlockReason,
  formatPayrollDecision,
  formatPaymentStatus,
  formatReconciliationStatus,
  formatRewardSummaryDomain,
  formatSourceClassification,
  formatSummaryAnomalyClassification,
  formatSummaryBusinessCategory,
  formatWelfareSourceType,
} from '../../utils/business-stats';
import { formatMoney } from '../../utils/format';
import { hasAnyRole, hasPermission } from '../../utils/permissions';

const router = useRouter();
const route = useRoute();
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
  summaryDomain: '',
  periodKey: '',
  confirmedFlag: undefined as boolean | undefined,
  businessCategory: '',
  payrollDecision: '',
  paymentStatus: '',
  sourceClassification: '',
  reconciliationStatus: '',
  timeBucket: '',
  processingView: 'current',
  periodMode: 'month',
});

const canGenerate = computed(() => hasPermission('businessStats.summaries.generate'));
const canConfirm = computed(() => hasPermission('businessStats.summaries.confirm'));
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));
const aiSourceActionId = computed(() =>
  typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()
    ? route.query.sourceActionId.trim()
    : null,
);
const aiCurrentFilters = computed(() => ({
  ...route.query,
  summaryDomain: filters.summaryDomain || undefined,
  periodKey: filters.periodKey || undefined,
  confirmedFlag: filters.confirmedFlag,
  businessCategory: filters.businessCategory || undefined,
  payrollDecision: filters.payrollDecision || undefined,
  paymentStatus: filters.paymentStatus || undefined,
  sourceClassification: filters.sourceClassification || undefined,
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
    entityType: 'business_stat_summary',
    entityId: selectedAiRow.value.id,
  };
});

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

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getStatSummaries({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      summaryDomain: filters.summaryDomain || undefined,
      periodKey: filters.periodKey || undefined,
      confirmedFlag: filters.confirmedFlag,
      businessCategory: filters.businessCategory || undefined,
      payrollDecision: filters.payrollDecision || undefined,
      dateFrom: dateRange.value[0],
      dateTo: dateRange.value[1],
      paymentStatus: filters.paymentStatus || undefined,
      sourceClassification: filters.sourceClassification || undefined,
      reconciliationStatus: filters.reconciliationStatus || undefined,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function parseBooleanQuery(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function applyRouteFilters(resetPage = false) {
  filters.summaryDomain = String(route.query.summaryDomain ?? '');
  filters.periodKey = String(route.query.periodKey ?? '');
  filters.confirmedFlag = parseBooleanQuery(route.query.confirmedFlag);
  filters.businessCategory = String(route.query.businessCategory ?? '');
  filters.payrollDecision = String(route.query.payrollDecision ?? '');
  filters.paymentStatus = String(route.query.paymentStatus ?? '');
  filters.sourceClassification = String(route.query.sourceClassification ?? '');
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
  filters.summaryDomain = '';
  filters.periodKey = '';
  filters.confirmedFlag = undefined;
  filters.businessCategory = '';
  filters.payrollDecision = '';
  filters.paymentStatus = '';
  filters.sourceClassification = '';
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

async function handleGenerate() {
  generating.value = true;
  try {
    const { data } = await generateStatSummaries({});
    ElMessage.success(`已处理 ${data.data.processedRecords} 条统计汇总`);
    await loadData();
  } finally {
    generating.value = false;
  }
}

async function handleConfirm(row: any) {
  await confirmStatSummary(row.id, {});
  ElMessage.success('统计汇总已确认');
  await loadData();
}

function goToDetail(id: number) {
  router.push(`/business-stats/summaries/${id}`);
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

.filters {
  margin-bottom: 8px;
}

.state-hint {
  margin-bottom: 12px;
}

.subtle-text {
  font-size: 12px;
  color: #6b7280;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
