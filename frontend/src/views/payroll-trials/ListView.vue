<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">工资试算列表</div>
          <div class="subtitle">按周期查看工资试算结果，支持重跑、确认和按维度筛选。</div>
        </div>
        <el-button
          v-if="canGenerate"
          type="primary"
          :loading="generating"
          @click="handleGenerate"
        >
          生成试算
        </el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="周期">
        <el-input v-model="filters.periodKey" clearable placeholder="YYYY-MM" style="width: 120px" />
      </el-form-item>
      <el-form-item label="试算维度">
        <el-select v-model="filters.summaryDomain" clearable style="width: 160px">
          <el-option label="ABC整体" value="abc_overall" />
          <el-option label="公车" value="public_vehicle" />
          <el-option label="私家车" value="private_vehicle" />
          <el-option label="保险理赔" value="insurance_claim" />
        </el-select>
      </el-form-item>
      <el-form-item label="员工 ID">
        <el-input-number v-model="filters.employeeId" :min="1" controls-position="right" />
      </el-form-item>
      <el-form-item label="已确认">
        <el-select v-model="filters.confirmedFlag" clearable style="width: 120px">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item label="仅看待确认">
        <el-switch v-model="filters.pendingOnly" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="periodKey" label="周期" width="100" />
      <el-table-column label="试算维度" min-width="120">
        <template #default="{ row }">
          {{ formatPayrollSummaryDomain(row.summaryDomain) }}
        </template>
      </el-table-column>
      <el-table-column prop="employeeName" label="员工" min-width="120" show-overflow-tooltip />
      <el-table-column prop="sourceSummaryCount" label="汇总来源数" width="100" align="right" />
      <el-table-column prop="sourceEventCount" label="事件来源数" width="100" align="right" />
      <el-table-column prop="rewardPointsTotal" label="奖励点数" width="100" align="right" />
      <el-table-column prop="pendingCount" label="待确认" width="90" align="right" />
      <el-table-column prop="ignoredCount" label="已忽略" width="90" align="right" />
      <el-table-column
        v-if="canViewAmounts"
        label="奖励金额"
        min-width="120"
        align="right"
      >
        <template #default="{ row }">{{ formatMoney(row.rewardAmountTotal) }}</template>
      </el-table-column>
      <el-table-column
        v-if="canViewAmounts"
        label="试算总额"
        min-width="120"
        align="right"
      >
        <template #default="{ row }">{{ formatMoney(row.calculatedTotal) }}</template>
      </el-table-column>
      <el-table-column label="运行状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.runStatus === 'completed' ? 'success' : row.runStatus === 'failed' ? 'danger' : 'warning'">
            {{ formatPayrollRunStatus(row.runStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="已确认" width="90">
        <template #default="{ row }">
          <el-tag :type="row.confirmedFlag ? 'success' : 'warning'">
            {{ row.confirmedFlag ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.updatedAt" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="goToDetail(row.id)">详情</el-button>
          <el-button
            v-if="canConfirm && !row.confirmedFlag"
            link
            type="success"
            @click="handleConfirm(row)"
          >
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
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  confirmPayrollTrial,
  generatePayrollTrials,
  getPayrollTrials,
} from '../../api/payroll-trials';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatMoney } from '../../utils/format';
import { hasAnyRole, hasPermission } from '../../utils/permissions';
import {
  formatPayrollRunStatus,
  formatPayrollSummaryDomain,
} from '../../utils/payroll-trials';

const router = useRouter();
const loading = ref(false);
const generating = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 10,
});

const filters = reactive({
  periodKey: '',
  summaryDomain: '',
  employeeId: undefined as number | undefined,
  confirmedFlag: undefined as boolean | undefined,
  pendingOnly: false,
});

const canGenerate = computed(() => hasPermission('payrollTrials.generate'));
const canConfirm = computed(() => hasPermission('payrollTrials.confirm'));
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPayrollTrials({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      periodKey: filters.periodKey || undefined,
      summaryDomain: filters.summaryDomain || undefined,
      employeeId: filters.employeeId,
      confirmedFlag: filters.confirmedFlag,
      pendingOnly: filters.pendingOnly || undefined,
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
  filters.periodKey = '';
  filters.summaryDomain = '';
  filters.employeeId = undefined;
  filters.confirmedFlag = undefined;
  filters.pendingOnly = false;
  handleSearch();
}

async function handleGenerate() {
  generating.value = true;
  try {
    const targetPeriod = filters.periodKey || new Date().toISOString().slice(0, 7);
    const { data } = await generatePayrollTrials({ periodKey: targetPeriod });
    ElMessage.success(
      `试算已生成：处理 ${data.data.processedItemCount} 条，新增 ${data.data.createdItemCount} 条`,
    );
    await loadData();
  } finally {
    generating.value = false;
  }
}

async function handleConfirm(row: any) {
  await confirmPayrollTrial(row.id, {});
  ElMessage.success('工资试算已确认');
  await loadData();
}

function goToDetail(id: number) {
  router.push(`/payroll-trials/${id}`);
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
</style>
