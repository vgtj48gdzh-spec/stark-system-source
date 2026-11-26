<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">待绑定 / 待确认清单</div>
        <div class="subtitle">查看未绑定员工、未命中规则或待人工确认的绩效事件，并进行重新绑定、确认或忽略处理。</div>
      </div>
    </template>

    <el-form inline class="filters">
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
      <el-form-item label="来源表">
        <el-input v-model="filters.sourceTable" clearable style="width: 180px" />
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
      <el-form-item label="发生时间">
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
      :title="`当前按 ${formatAiTimeBucket(filters.timeBucket)} / ${formatAiProcessingView(filters.processingView)} 视角查看。若来自 AI 行动看板，暂缓与完成状态请回到 AI 页面重新打开。`"
    />

    <el-table
      :data="tableData"
      v-loading="loading"
      highlight-current-row
      row-key="id"
      @row-click="handleAiRowClick"
    >
      <el-table-column prop="employeeName" label="员工" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.employeeName || '未绑定' }}</template>
      </el-table-column>
      <el-table-column label="来源域" min-width="110">
        <template #default="{ row }">{{ formatPerformanceDomain(row.sourceDomain) }}</template>
      </el-table-column>
      <el-table-column label="事件类型" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ formatPerformanceEventType(row.eventType) }}</template>
      </el-table-column>
      <el-table-column prop="sourceTable" label="来源表" min-width="150" show-overflow-tooltip />
      <el-table-column prop="sourceOrderNo" label="来源单号" min-width="180" show-overflow-tooltip />
      <el-table-column v-if="canViewAmounts" label="金额" min-width="120" align="right">
        <template #default="{ row }">{{ formatMoney(row.amountStandard) }}</template>
      </el-table-column>
      <el-table-column label="数量" min-width="120" align="right">
        <template #default="{ row }">{{ formatMoney(row.quantityStandard) }}</template>
      </el-table-column>
      <el-table-column label="确认状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.confirmedFlag ? 'success' : 'warning'">
            {{ formatConfirmedFlag(row.confirmedFlag) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="处理动作" min-width="120">
        <template #default="{ row }">{{ formatHandlingAction(row.handlingAction) }}</template>
      </el-table-column>
      <el-table-column label="处理时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.handledAt" />
        </template>
      </el-table-column>
      <el-table-column label="发生时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.occurredAt" />
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="说明" min-width="260" show-overflow-tooltip />
      <el-table-column v-if="canProcessPending" label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-space v-if="!row.ignoredFlag">
            <el-button link type="primary" @click="openProcessDialog('rebind', row)">重新绑定</el-button>
            <el-button link type="success" @click="openProcessDialog('confirm', row)">确认</el-button>
            <el-button link type="warning" @click="openProcessDialog('ignore', row)">忽略</el-button>
          </el-space>
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

    <el-dialog v-model="processDialogVisible" :title="processDialogTitle" width="560px">
      <el-form label-width="100px">
        <el-form-item v-if="processMode !== 'ignore'" label="员工">
          <el-select
            v-model="processForm.employeeId"
            filterable
            clearable
            placeholder="请选择员工"
            style="width: 100%"
          >
            <el-option
              v-for="item in employeeOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="处理备注">
          <el-input v-model="processForm.remark" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="processDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="processLoading" @click="submitProcess">提交</el-button>
      </template>
    </el-dialog>
  </el-card>

  <AiSideAssistant
    page-title="绩效待确认清单"
    route-path="/performance/pending"
    :current-filters="aiCurrentFilters"
    :source-action-id="aiSourceActionId"
    :focus-object="aiFocusObject"
  />
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  confirmPendingPerformanceItem,
  getEmployees,
  getPendingPerformanceItems,
  ignorePendingPerformanceItem,
  rebindPendingPerformanceItem,
} from '../../api/performance';
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
import { formatMoney } from '../../utils/format';
import { hasAnyRole, hasPermission } from '../../utils/permissions';
import {
  formatConfirmedFlag,
  formatHandlingAction,
  formatPerformanceDomain,
  formatPerformanceEventType,
} from '../../utils/performance';

type ProcessMode = 'rebind' | 'confirm' | 'ignore';

const sourceDomains = ['work_orders', 'orders', 'funds', 'cards'];
const route = useRoute();
const loading = ref(false);
const processLoading = ref(false);
const processDialogVisible = ref(false);
const processMode = ref<ProcessMode>('confirm');
const tableData = ref<any[]>([]);
const employeeOptions = ref<any[]>([]);
const selectedAiRow = ref<any | null>(null);
const total = ref(0);
const currentRow = ref<any | null>(null);
const dateRange = ref<[string, string] | []>([]);
const query = reactive({
  page: 1,
  pageSize: 10,
});
const filters = reactive({
  sourceDomain: '',
  sourceTable: '',
  periodKey: '',
  performanceBlockReason: '',
  includeResolved: false,
  timeBucket: '',
  processingView: 'current',
  periodMode: 'week',
});
const processForm = reactive({
  employeeId: undefined as number | undefined,
  remark: '',
});

const canProcessPending = computed(() => hasPermission('performance.pending.process'));
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));
const aiSourceActionId = computed(() =>
  typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()
    ? route.query.sourceActionId.trim()
    : null,
);
const aiCurrentFilters = computed(() => ({
  ...route.query,
  sourceDomain: filters.sourceDomain || undefined,
  sourceTable: filters.sourceTable || undefined,
  periodKey: filters.periodKey || undefined,
  performanceBlockReason: filters.performanceBlockReason || undefined,
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
  return {
    entityType: 'performance_pending_item',
    entityId: selectedAiRow.value.id,
  };
});
const processDialogTitle = computed(() => {
  if (processMode.value === 'rebind') return '重新绑定员工';
  if (processMode.value === 'confirm') return '手工确认归属';
  return '标记忽略';
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPendingPerformanceItems({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
      sourceDomain: filters.sourceDomain || undefined,
      sourceTable: filters.sourceTable || undefined,
      periodKey: filters.periodKey || undefined,
      performanceBlockReason: filters.performanceBlockReason || undefined,
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
  filters.sourceDomain = String(route.query.sourceDomain ?? '');
  filters.sourceTable = String(route.query.sourceTable ?? '');
  filters.periodKey = String(route.query.periodKey ?? '');
  filters.performanceBlockReason = String(route.query.performanceBlockReason ?? '');
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

async function loadEmployeeOptions() {
  if (!canProcessPending.value) {
    return;
  }

  const { data } = await getEmployees({
    page: 1,
    pageSize: 100,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    status: 1,
  });
  employeeOptions.value = data.data.list;
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
  filters.sourceDomain = '';
  filters.sourceTable = '';
  filters.periodKey = '';
  filters.performanceBlockReason = '';
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

function openProcessDialog(mode: ProcessMode, row: any) {
  processMode.value = mode;
  currentRow.value = row;
  processForm.employeeId = row.employeeId ?? undefined;
  processForm.remark = '';
  processDialogVisible.value = true;
}

async function submitProcess() {
  if (!currentRow.value) {
    return;
  }

  processLoading.value = true;
  try {
    if (processMode.value === 'rebind') {
      await rebindPendingPerformanceItem(currentRow.value.id, {
        employeeId: processForm.employeeId,
        remark: processForm.remark || undefined,
      });
      ElMessage.success('待确认事件重新绑定成功');
    } else if (processMode.value === 'confirm') {
      await confirmPendingPerformanceItem(currentRow.value.id, {
        employeeId: processForm.employeeId,
        remark: processForm.remark || undefined,
      });
      ElMessage.success('待确认事件已手工确认');
    } else {
      await ignorePendingPerformanceItem(currentRow.value.id, {
        remark: processForm.remark || undefined,
      });
      ElMessage.success('待确认事件已标记忽略');
    }

    processDialogVisible.value = false;
    await loadData();
  } finally {
    processLoading.value = false;
  }
}

watch(
  () => route.query,
  async () => {
    applyRouteFilters(true);
    await loadData();
  },
);

onMounted(async () => {
  applyRouteFilters();
  await Promise.all([loadData(), loadEmployeeOptions()]);
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
