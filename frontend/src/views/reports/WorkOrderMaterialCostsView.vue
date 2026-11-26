<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">工单材料成本汇总</div>
        <div class="subtitle">按工单查看材料成本和材料明细数量，辅助经营核算。</div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="工单编号">
        <el-input v-model="filters.workOrderNo" clearable />
      </el-form-item>
      <el-form-item label="客户">
        <el-input v-model="filters.customerName" clearable />
      </el-form-item>
      <el-form-item label="工单状态">
        <el-select v-model="filters.status" clearable style="width: 180px">
          <el-option label="草稿" value="draft" />
          <el-option label="待付款" value="pending_payment" />
          <el-option label="已付款" value="paid" />
          <el-option label="进行中" value="in_progress" />
          <el-option label="已完成" value="completed" />
          <el-option label="已关闭" value="closed" />
        </el-select>
      </el-form-item>
      <el-form-item label="创建时间">
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
      <el-table-column prop="workOrderNo" label="工单编号" min-width="160" />
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
      <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
      <el-table-column label="状态" min-width="120">
        <template #default="{ row }">
          <el-tag :type="workOrderStatusMap[row.status]?.type || 'info'">
            {{ workOrderStatusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="materialLineCount" label="材料行数" min-width="100" />
      <el-table-column prop="materialCostTotal" label="材料成本" min-width="120" />
      <el-table-column prop="amountDue" label="应收金额" min-width="120" />
      <el-table-column prop="amountReceived" label="已收金额" min-width="120" />
      <el-table-column label="更新时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.updatedAt" />
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
import { onMounted, reactive, ref } from 'vue';
import { getWorkOrderMaterialCostReport } from '../../api/reports';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { workOrderStatusMap } from '../../utils/status-tag';

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const dateRange = ref<[string, string] | []>([]);
const query = reactive({
  page: 1,
  pageSize: 10,
});
const filters = reactive({
  workOrderNo: '',
  customerName: '',
  status: '',
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getWorkOrderMaterialCostReport({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      workOrderNo: filters.workOrderNo || undefined,
      customerName: filters.customerName || undefined,
      status: filters.status || undefined,
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
  filters.workOrderNo = '';
  filters.customerName = '';
  filters.status = '';
  dateRange.value = [];
  handleSearch();
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
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
