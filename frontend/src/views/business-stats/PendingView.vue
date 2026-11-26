<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">待处理清单</div>
        <div class="subtitle">集中查看未确认统计标签和奖励事件，便于人工核对客户手机号。</div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="类型">
        <el-select v-model="filters.type" clearable style="width: 140px">
          <el-option label="统计标签" value="tag" />
          <el-option label="奖励事件" value="reward" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源表">
        <el-input v-model="filters.sourceTable" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="周期">
        <el-input
          v-model="filters.periodKey"
          clearable
          placeholder="YYYY-MM"
          style="width: 120px"
        />
      </el-form-item>
      <el-form-item label="阻塞原因">
        <el-select v-model="filters.performanceBlockReason" clearable style="width: 180px">
          <el-option label="缺客户绑定" value="missing_customer_binding" />
          <el-option label="待人工确认" value="awaiting_manual_review" />
        </el-select>
      </el-form-item>
      <el-form-item label="对账状态">
        <el-select v-model="filters.reconciliationStatus" clearable style="width: 180px">
          <el-option label="台账漏记" value="sheet_missing" />
          <el-option label="已匹配台账" value="matched_sheet" />
          <el-option label="待复核" value="needs_review" />
        </el-select>
      </el-form-item>
      <el-form-item label="包含已处理">
        <el-switch v-model="filters.includeResolved" />
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
      <el-table-column label="类型" width="100">
        <template #default="{ row }">{{ formatPendingItemType(row.itemType) }}</template>
      </el-table-column>
      <el-table-column label="编码/类型" min-width="160">
        <template #default="{ row }">
          <span v-if="row.itemType === 'tag'">{{ formatBusinessStatTag(row.payload.tagCode) }}</span>
          <span v-else>{{ formatRewardEventType(row.payload.eventType) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="payload.customerName" label="客户" min-width="120" show-overflow-tooltip />
      <el-table-column
        prop="payload.customerMobile"
        label="客户手机号"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="客户ID" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.payload.matchedCustomerId || row.payload.customerId || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="项目/套餐" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.payload.packageName || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="客户绑定状态" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ formatCustomerBindingStatus(row.payload.customerBinding?.bindingStatus) }}
        </template>
      </el-table-column>
      <el-table-column label="绑定备注" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.payload.customerBinding?.bindingRemark || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="绩效条件" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div>
            {{
              row.payload.customerBinding?.performanceReadyFlag
                ? '已具备基础条件'
                : '未具备基础条件'
            }}
          </div>
          <div class="subtle-text">
            {{
              row.payload.customerBinding?.performanceDecisionReason ||
              formatPerformanceBlockReason(row.payload.customerBinding?.performanceBlockReason)
            }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="匹配依据" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.payload.matchReason || row.payload.evidenceSummary || '源链暂无稳定手机号/待人工绑定' }}
        </template>
      </el-table-column>
      <el-table-column prop="payload.carPlate" label="车牌" min-width="120" show-overflow-tooltip />
      <el-table-column prop="payload.sourceTable" label="来源表" min-width="140" show-overflow-tooltip />
      <el-table-column
        prop="payload.sourceOrderNo"
        label="来源编号"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        prop="payload.responsibleEmployeeName"
        label="责任员工"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column label="发生时间" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.occurredAt" />
        </template>
      </el-table-column>
      <el-table-column label="金额" min-width="120" align="right">
        <template #default="{ row }">
          <span v-if="row.itemType === 'reward' && canViewAmounts">
            {{ formatMoney(row.payload.amountStandard) }}
          </span>
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
      <el-table-column prop="payload.remark" label="备注" min-width="220" show-overflow-tooltip />
      <el-table-column v-if="canProcess" label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <template v-if="row.itemType === 'reward'">
            <el-button link type="primary" @click="handleConfirm(row)">确认</el-button>
            <el-button link type="warning" @click="handleIgnore(row)">忽略</el-button>
            <el-button link type="success" @click="handleReassign(row)">改归属</el-button>
          </template>
          <template v-else>
            <el-button link type="primary" @click="handleConfirmTag(row)">确认</el-button>
          </template>
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
    page-title="业务统计待确认清单"
    route-path="/business-stats/pending"
    :current-filters="aiCurrentFilters"
    :source-action-id="aiSourceActionId"
    :focus-object="aiFocusObject"
  />
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  confirmRewardEvent,
  getStatPendingItems,
  ignoreRewardEvent,
  reassignRewardEvent,
  updateStatTag,
} from '../../api/business-stats';
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
  formatBusinessStatTag,
  formatCustomerBindingStatus,
  formatPaymentStatus,
  formatPendingItemType,
  formatPerformanceBlockReason,
  formatReconciliationStatus,
  formatRewardEventType,
  formatSourceClassification,
} from '../../utils/business-stats';
import { formatMoney } from '../../utils/format';
import { hasAnyRole, hasPermission } from '../../utils/permissions';

const loading = ref(false);
const route = useRoute();
const tableData = ref<any[]>([]);
const selectedAiRow = ref<any | null>(null);
const total = ref(0);
const dateRange = ref<[string, string] | []>([]);

const query = reactive({
  page: 1,
  pageSize: 10,
});

const filters = reactive({
  type: '',
  sourceTable: '',
  periodKey: '',
  performanceBlockReason: '',
  paymentStatus: '',
  sourceClassification: '',
  reconciliationStatus: '',
  includeResolved: false,
  timeBucket: '',
  processingView: 'current',
  periodMode: 'week',
});

const canProcess = computed(() => hasPermission('businessStats.events.process'));
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));
const aiSourceActionId = computed(() =>
  typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()
    ? route.query.sourceActionId.trim()
    : null,
);
const aiCurrentFilters = computed(() => ({
  ...route.query,
  type: filters.type || undefined,
  sourceTable: filters.sourceTable || undefined,
  periodKey: filters.periodKey || undefined,
  performanceBlockReason: filters.performanceBlockReason || undefined,
  paymentStatus: filters.paymentStatus || undefined,
  sourceClassification: filters.sourceClassification || undefined,
  reconciliationStatus: filters.reconciliationStatus || undefined,
  includeResolved: filters.includeResolved,
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

  const entityType =
    selectedAiRow.value?.itemType === 'reward' ? 'reward_event' : 'stat_tag';

  return {
    entityType,
    entityId: selectedAiRow.value.id,
  };
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getStatPendingItems({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
      type: filters.type || undefined,
      sourceTable: filters.sourceTable || undefined,
      periodKey: filters.periodKey || undefined,
      performanceBlockReason: filters.performanceBlockReason || undefined,
      paymentStatus: filters.paymentStatus || undefined,
      sourceClassification: filters.sourceClassification || undefined,
      reconciliationStatus: filters.reconciliationStatus || undefined,
      includeResolved: filters.includeResolved,
      dateFrom: dateRange.value[0],
      dateTo: dateRange.value[1],
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function parseBooleanQuery(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function applyRouteFilters(resetPage = false) {
  filters.type = String(route.query.type ?? '');
  filters.sourceTable = String(route.query.sourceTable ?? '');
  filters.periodKey = String(route.query.periodKey ?? '');
  filters.performanceBlockReason = String(route.query.performanceBlockReason ?? '');
  filters.paymentStatus = String(route.query.paymentStatus ?? '');
  filters.sourceClassification = String(route.query.sourceClassification ?? '');
  filters.reconciliationStatus = String(route.query.reconciliationStatus ?? '');
  filters.includeResolved = parseBooleanQuery(route.query.includeResolved, false);
  const routeBucketState = resolveAiRouteBucketState(route.query, {
    defaultPeriodMode: 'week',
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
  filters.type = '';
  filters.sourceTable = '';
  filters.periodKey = '';
  filters.performanceBlockReason = '';
  filters.paymentStatus = '';
  filters.sourceClassification = '';
  filters.reconciliationStatus = '';
  filters.includeResolved = false;
  filters.timeBucket = '';
  filters.processingView = 'current';
  filters.periodMode = 'week';
  dateRange.value = [];
  handleSearch();
}

function handleAiRowClick(row: any) {
  selectedAiRow.value = row;
}

async function handleConfirm(row: any) {
  await confirmRewardEvent(row.id, {});
  ElMessage.success('奖励事件已确认');
  await loadData();
}

async function handleIgnore(row: any) {
  await ignoreRewardEvent(row.id, {});
  ElMessage.success('奖励事件已忽略');
  await loadData();
}

async function handleReassign(row: any) {
  const { value } = await ElMessageBox.prompt('请输入新的责任员工 ID', '改归属', {
    inputPattern: /^[1-9]\d*$/,
    inputErrorMessage: '请输入有效员工 ID',
  });
  await reassignRewardEvent(row.id, { responsibleEmployeeId: Number(value) });
  ElMessage.success('奖励事件归属已更新');
  await loadData();
}

async function handleConfirmTag(row: any) {
  await updateStatTag(row.id, { confirmedFlag: true });
  ElMessage.success('统计标签已确认');
  await loadData();
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
  margin: 12px 0 8px;
}

.state-hint {
  margin-bottom: 12px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
