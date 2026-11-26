<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">奖励事件</div>
          <div class="subtitle">查看奖励资格事件，并支持确认、忽略、改归属。</div>
        </div>
        <el-button
          v-if="canGenerate"
          type="primary"
          :loading="generating"
          @click="handleGenerate"
        >
          生成事件
        </el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="事件类型">
        <el-select v-model="filters.eventType" clearable style="width: 180px">
          <el-option label="A端订单完成" value="a_order_completed" />
          <el-option label="组合成交" value="combo_success" />
          <el-option label="发卡成功" value="card_issue" />
          <el-option label="公车完成" value="public_vehicle_completed" />
          <el-option label="私家车复购" value="private_vehicle_repurchase" />
          <el-option label="保险转化" value="insurance_conversion" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源表">
        <el-input v-model="filters.sourceTable" clearable style="width: 160px" />
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
      <el-form-item label="已忽略">
        <el-select v-model="filters.ignoredFlag" clearable style="width: 120px">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column label="事件类型" min-width="140">
        <template #default="{ row }">{{ formatRewardEventType(row.eventType) }}</template>
      </el-table-column>
      <el-table-column label="业务域" min-width="120">
        <template #default="{ row }">{{ formatBusinessStatDomain(row.businessDomain) }}</template>
      </el-table-column>
      <el-table-column prop="sourceTable" label="来源表" min-width="130" show-overflow-tooltip />
      <el-table-column prop="sourceOrderNo" label="来源编号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="responsibleEmployeeName" label="责任员工" min-width="120" show-overflow-tooltip />
      <el-table-column label="客户核对" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.customerName || '-' }}</div>
          <div class="subtle-text">{{ row.customerMobile || '-' }}</div>
          <div class="subtle-text">客户ID：{{ row.matchedCustomerId || row.customerId || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="项目/套餐" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.packageName || '-' }}</template>
      </el-table-column>
      <el-table-column label="购买时间" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.purchaseTime || '-' }}</template>
      </el-table-column>
      <el-table-column label="匹配状态" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ formatCustomerBindingStatus(row.customerBinding?.bindingStatus) }}</div>
          <div class="subtle-text">{{ row.matchConfidence || '待人工复核' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="匹配依据" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.matchReason || row.evidenceSummary || '源链暂无稳定手机号/待人工绑定' }}
        </template>
      </el-table-column>
      <el-table-column v-if="canViewAmounts" label="金额" min-width="110" align="right">
        <template #default="{ row }">{{ formatMoney(row.amountStandard) }}</template>
      </el-table-column>
      <el-table-column label="支付/对账" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ formatPaymentStatus(row.paymentStatus) }} / {{ formatSourceClassification(row.sourceClassification) }}</div>
          <div class="subtle-text">
            {{ formatReconciliationStatus(row.reconciliationStatus) }}：{{ row.reconciliationReason || '-' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="已确认" width="90">
        <template #default="{ row }">
          <el-tag :type="row.confirmedFlag ? 'success' : 'warning'">{{ row.confirmedFlag ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="已忽略" width="90">
        <template #default="{ row }">
          <el-tag :type="row.ignoredFlag ? 'info' : 'primary'">{{ row.ignoredFlag ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发生时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.occurredAt" /></template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column v-if="canProcess" label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="!row.confirmedFlag && !row.ignoredFlag"
            link
            type="primary"
            @click="handleConfirm(row)"
          >
            确认
          </el-button>
          <el-button
            v-if="!row.confirmedFlag && !row.ignoredFlag"
            link
            type="warning"
            @click="handleIgnore(row)"
          >
            忽略
          </el-button>
          <el-button link type="primary" @click="handleReassign(row)">改归属</el-button>
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
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  confirmRewardEvent,
  generateRewardEvents,
  getRewardEvents,
  ignoreRewardEvent,
  reassignRewardEvent,
} from '../../api/business-stats';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatBusinessStatDomain,
  formatCustomerBindingStatus,
  formatPaymentStatus,
  formatReconciliationStatus,
  formatRewardEventType,
  formatSourceClassification,
} from '../../utils/business-stats';
import { formatMoney } from '../../utils/format';
import { hasAnyRole, hasPermission } from '../../utils/permissions';

const loading = ref(false);
const generating = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 10,
});

const filters = reactive({
  eventType: '',
  sourceTable: '',
  periodKey: '',
  confirmedFlag: undefined as boolean | undefined,
  ignoredFlag: undefined as boolean | undefined,
});

const canGenerate = computed(() => hasPermission('businessStats.events.generate'));
const canProcess = computed(() => hasPermission('businessStats.events.process'));
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getRewardEvents({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
      eventType: filters.eventType || undefined,
      sourceTable: filters.sourceTable || undefined,
      periodKey: filters.periodKey || undefined,
      confirmedFlag: filters.confirmedFlag,
      ignoredFlag: filters.ignoredFlag,
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
  filters.eventType = '';
  filters.sourceTable = '';
  filters.periodKey = '';
  filters.confirmedFlag = undefined;
  filters.ignoredFlag = undefined;
  handleSearch();
}

async function handleGenerate() {
  generating.value = true;
  try {
    const { data } = await generateRewardEvents({});
    ElMessage.success(`已处理 ${data.data.processedRecords} 条奖励事件`);
    await loadData();
  } finally {
    generating.value = false;
  }
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

.filters {
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
