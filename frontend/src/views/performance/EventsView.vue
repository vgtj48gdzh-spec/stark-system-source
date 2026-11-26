<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">绩效事件列表</div>
          <div class="subtitle">查看来自斯塔克主链与 ABC sync 的可考核事件，支持按周期、来源域和确认状态筛选。</div>
        </div>
        <el-button v-if="canGenerateEvents" type="primary" :loading="generating" @click="handleGenerateEvents">
          重新生成事件
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
      <el-form-item label="事件类型">
        <el-input v-model="filters.eventType" clearable style="width: 200px" />
      </el-form-item>
      <el-form-item label="来源表">
        <el-input v-model="filters.sourceTable" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="确认状态">
        <el-select v-model="filters.confirmedFlag" clearable style="width: 140px">
          <el-option label="已确认" :value="true" />
          <el-option label="待确认" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item label="周期">
        <el-input v-model="filters.periodKey" clearable placeholder="YYYY-MM" style="width: 140px" />
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

    <el-table :data="tableData" v-loading="loading">
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
      <el-table-column label="客户核对" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.customerName || '-' }}</div>
          <div class="subtle-text">{{ row.customerMobile || '-' }}</div>
          <div class="subtle-text">客户ID：{{ row.matchedCustomerId || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="车牌" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.carPlate || '-' }}</template>
      </el-table-column>
      <el-table-column label="项目/套餐" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.packageName || '-' }}</template>
      </el-table-column>
      <el-table-column label="绑定状态" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ formatCustomerBindingStatus(row.customerBinding?.bindingStatus) }}</div>
          <div class="subtle-text">{{ row.customerBinding?.bindingRemark || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="匹配依据" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.matchReason || row.evidenceSummary || '源链暂无稳定手机号/待人工绑定' }}
        </template>
      </el-table-column>
      <el-table-column label="绩效条件" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tag :type="row.performanceReadyFlag ? 'success' : 'warning'">
            {{ row.performanceReadyFlag ? '已具备基础条件' : '暂未具备基础条件' }}
          </el-tag>
          <div class="subtle-text">
            {{
              row.performanceBlockReason
                ? formatPerformanceBlockReason(row.performanceBlockReason)
                : row.performanceDecisionReason || '-'
            }}
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
      <el-table-column prop="periodKey" label="周期" width="100" />
      <el-table-column label="发生时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.occurredAt" />
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="说明" min-width="220" show-overflow-tooltip />
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
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { generatePerformanceEvents, getPerformanceEvents } from '../../api/performance';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatMoney } from '../../utils/format';
import {
  formatCustomerBindingStatus,
  formatPaymentStatus,
  formatPerformanceBlockReason,
  formatReconciliationStatus,
  formatSourceClassification,
} from '../../utils/business-stats';
import { hasAnyRole, hasPermission } from '../../utils/permissions';
import {
  formatConfirmedFlag,
  formatHandlingAction,
  formatPerformanceDomain,
  formatPerformanceEventType,
} from '../../utils/performance';

const sourceDomains = ['work_orders', 'orders', 'funds', 'cards'];
const loading = ref(false);
const generating = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const dateRange = ref<[string, string] | []>([]);
const query = reactive({
  page: 1,
  pageSize: 10,
});
const filters = reactive({
  employeeId: undefined as number | undefined,
  sourceDomain: '',
  eventType: '',
  sourceTable: '',
  confirmedFlag: undefined as boolean | undefined,
  periodKey: '',
});

const canGenerateEvents = computed(() => hasPermission('performance.events.generate'));
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPerformanceEvents({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
      employeeId: filters.employeeId,
      sourceDomain: filters.sourceDomain || undefined,
      eventType: filters.eventType || undefined,
      sourceTable: filters.sourceTable || undefined,
      confirmedFlag: filters.confirmedFlag,
      periodKey: filters.periodKey || undefined,
      dateFrom: dateRange.value[0],
      dateTo: dateRange.value[1],
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
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
  filters.eventType = '';
  filters.sourceTable = '';
  filters.confirmedFlag = undefined;
  filters.periodKey = '';
  dateRange.value = [];
  handleSearch();
}

async function handleGenerateEvents() {
  generating.value = true;
  try {
    const { data } = await generatePerformanceEvents({});
    ElMessage.success(
      `事件已重跑：生成 ${data.data.totalGenerated} 条，新增 ${data.data.totalCreated} 条，更新 ${data.data.totalUpdated} 条`,
    );
    await loadData();
  } finally {
    generating.value = false;
  }
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

.filters {
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.subtle-text {
  font-size: 12px;
  color: #6b7280;
}
</style>
