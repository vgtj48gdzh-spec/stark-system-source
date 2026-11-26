<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">试算待确认清单</div>
        <div class="subtitle">集中查看待确认、未归属或仍需人工处理的工资试算记录。</div>
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
      <el-table-column prop="pendingCount" label="待确认" width="100" align="right" />
      <el-table-column prop="ignoredCount" label="已忽略" width="100" align="right" />
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
      <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
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
  getPayrollTrialPendingItems,
} from '../../api/payroll-trials';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatMoney } from '../../utils/format';
import { hasAnyRole, hasPermission } from '../../utils/permissions';
import { formatPayrollSummaryDomain } from '../../utils/payroll-trials';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 10,
});

const filters = reactive({
  periodKey: '',
  summaryDomain: '',
});

const canConfirm = computed(() => hasPermission('payrollTrials.confirm'));
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPayrollTrialPendingItems({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      periodKey: filters.periodKey || undefined,
      summaryDomain: filters.summaryDomain || undefined,
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
  handleSearch();
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
  margin: 12px 0 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
