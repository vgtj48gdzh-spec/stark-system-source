<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">供应商材料使用统计</div>
        <div class="subtitle">从工单材料明细统计供应商材料使用量和金额，辅助采购复盘。</div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="供应商">
        <el-select v-model="filters.supplierId" clearable filterable style="width: 220px">
          <el-option v-for="item in supplierOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="材料">
        <el-select v-model="filters.materialId" clearable filterable style="width: 220px">
          <el-option
            v-for="item in materialOptions"
            :key="item.id"
            :label="`${item.name}${item.specification ? ` / ${item.specification}` : ''}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="分类">
        <el-input v-model="filters.category" clearable />
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
      <el-table-column prop="supplierName" label="供应商" min-width="180" show-overflow-tooltip />
      <el-table-column label="材料" min-width="220">
        <template #default="{ row }">
          <div>{{ row.materialName }}</div>
          <div class="cell-subtitle">{{ row.specification || row.unit || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" min-width="120" show-overflow-tooltip />
      <el-table-column prop="usageCount" label="使用次数" min-width="100" />
      <el-table-column prop="workOrderCount" label="涉及工单数" min-width="100" />
      <el-table-column prop="totalQuantity" label="使用数量" min-width="100" />
      <el-table-column prop="totalAmount" label="使用金额" min-width="120" />
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
import { getMaterials } from '../../api/materials';
import { getSupplierMaterialUsageReport } from '../../api/reports';
import { getSuppliers } from '../../api/suppliers';

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const materialOptions = ref<any[]>([]);
const supplierOptions = ref<any[]>([]);
const dateRange = ref<[string, string] | []>([]);
const query = reactive({
  page: 1,
  pageSize: 10,
});
const filters = reactive({
  supplierId: undefined as number | undefined,
  materialId: undefined as number | undefined,
  category: '',
});

async function loadOptions() {
  const [materialsResponse, suppliersResponse] = await Promise.all([getMaterials(), getSuppliers()]);
  materialOptions.value = materialsResponse.data.data;
  supplierOptions.value = suppliersResponse.data.data;
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getSupplierMaterialUsageReport({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'totalAmount',
      sortOrder: 'desc',
      ...filters,
      category: filters.category || undefined,
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
  filters.supplierId = undefined;
  filters.materialId = undefined;
  filters.category = '';
  dateRange.value = [];
  handleSearch();
}

onMounted(async () => {
  await loadOptions();
  await loadData();
});
</script>

<style scoped>
.title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle,
.cell-subtitle {
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
