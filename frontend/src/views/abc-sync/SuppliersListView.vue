<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">ABC 同步供应商</div>
        <div class="subtitle">查看从 ABC 标准化后的供应商主数据，用于只读查询与异常治理。</div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="来源表">
        <el-select v-model="filters.sourceTable" clearable style="width: 220px">
          <el-option
            v-for="item in sourceTableOptions"
            :key="item"
            :label="formatAbcSourceTable(item)"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="批次号">
        <el-input v-model="filters.batchNo" clearable style="width: 220px" />
      </el-form-item>
      <el-form-item label="标准状态">
        <el-input v-model="filters.statusStandard" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="映射确认">
        <el-select v-model="filters.mappingConfirmed" clearable style="width: 160px">
          <el-option label="已确认" value="true" />
          <el-option label="未确认" value="false" />
        </el-select>
      </el-form-item>
      <el-form-item label="同步时间">
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
      <el-table-column label="来源表" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ formatAbcSourceTable(row.sourceTable) }}</template>
      </el-table-column>
      <el-table-column prop="supplierName" label="供应商名称" min-width="220" show-overflow-tooltip />
      <el-table-column label="标准状态" min-width="120">
        <template #default="{ row }">{{ formatAbcStatus(row.supplierStatusStandard) }}</template>
      </el-table-column>
      <el-table-column prop="contactName" label="联系人" min-width="140" show-overflow-tooltip />
      <el-table-column prop="contactMobile" label="联系电话" min-width="160" show-overflow-tooltip />
      <el-table-column prop="email" label="邮箱" min-width="220" show-overflow-tooltip />
      <el-table-column prop="companySite" label="公司地址" min-width="220" show-overflow-tooltip />
      <el-table-column label="映射确认" min-width="120">
        <template #default="{ row }">
          <el-tag :type="row.mappingConfirmed ? 'success' : 'warning'">
            {{ row.mappingConfirmed ? '已确认' : '未确认' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="mappingNotes" label="映射说明" min-width="260" show-overflow-tooltip />
      <el-table-column prop="syncBatchNo" label="同步批次" min-width="220" show-overflow-tooltip />
      <el-table-column label="同步时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.syncedAt" />
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
import { getAbcSyncSuppliers } from '../../api/abc-sync';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatAbcSourceTable, formatAbcStatus } from '../../utils/abc-sync';

const sourceTableOptions = ['merchant_supplier'];
const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const dateRange = ref<[string, string] | []>([]);
const query = reactive({
  page: 1,
  pageSize: 10,
});
const filters = reactive({
  sourceTable: '',
  batchNo: '',
  statusStandard: '',
  mappingConfirmed: '',
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getAbcSyncSuppliers({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'syncedAt',
      sortOrder: 'desc',
      sourceTable: filters.sourceTable || undefined,
      batchNo: filters.batchNo || undefined,
      statusStandard: filters.statusStandard || undefined,
      mappingConfirmed: filters.mappingConfirmed || undefined,
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
  filters.sourceTable = '';
  filters.batchNo = '';
  filters.statusStandard = '';
  filters.mappingConfirmed = '';
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
