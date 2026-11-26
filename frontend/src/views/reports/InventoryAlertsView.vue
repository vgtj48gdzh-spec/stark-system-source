<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">当前库存预警</div>
        <div class="subtitle">基于材料预警库存阈值，查看当前库存不足或临近不足的项目。</div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="库房">
        <el-select v-model="filters.warehouseId" clearable filterable style="width: 220px">
          <el-option
            v-for="item in warehouseOptions"
            :key="item.id"
            :label="`${item.name} (${item.code})`"
            :value="item.id"
          />
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
      <el-form-item label="供应商">
        <el-select v-model="filters.supplierId" clearable filterable style="width: 220px">
          <el-option v-for="item in supplierOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="分类">
        <el-input v-model="filters.category" clearable />
      </el-form-item>
      <el-form-item label="只看预警">
        <el-switch v-model="filters.onlyAlerts" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="warehouseName" label="库房" min-width="160" show-overflow-tooltip />
      <el-table-column label="材料" min-width="220">
        <template #default="{ row }">
          <div>{{ row.materialName }}</div>
          <div class="cell-subtitle">{{ row.specification || row.unit || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="supplierName" label="供应商" min-width="180" show-overflow-tooltip />
      <el-table-column prop="category" label="分类" min-width="120" show-overflow-tooltip />
      <el-table-column prop="currentQuantity" label="当前库存" min-width="100" />
      <el-table-column prop="warningQuantity" label="预警库存" min-width="100" />
      <el-table-column label="差值" min-width="120">
        <template #default="{ row }">
          <el-tag :type="Number(row.shortageQuantity) > 0 ? 'danger' : 'success'">
            {{ row.shortageQuantity }}
          </el-tag>
        </template>
      </el-table-column>
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
import { getMaterials } from '../../api/materials';
import { getInventoryAlertsReport } from '../../api/reports';
import { getSuppliers } from '../../api/suppliers';
import { getWarehouses } from '../../api/warehouses';
import ReadableDateTime from '../../components/ReadableDateTime.vue';

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const materialOptions = ref<any[]>([]);
const supplierOptions = ref<any[]>([]);
const warehouseOptions = ref<any[]>([]);
const query = reactive({
  page: 1,
  pageSize: 10,
});
const filters = reactive({
  warehouseId: undefined as number | undefined,
  materialId: undefined as number | undefined,
  supplierId: undefined as number | undefined,
  category: '',
  onlyAlerts: true,
});

async function loadOptions() {
  const [materialsResponse, suppliersResponse, warehousesResponse] = await Promise.all([
    getMaterials(),
    getSuppliers(),
    getWarehouses(),
  ]);
  materialOptions.value = materialsResponse.data.data;
  supplierOptions.value = suppliersResponse.data.data;
  warehouseOptions.value = warehousesResponse.data.data;
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getInventoryAlertsReport({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      ...filters,
      category: filters.category || undefined,
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
  filters.warehouseId = undefined;
  filters.materialId = undefined;
  filters.supplierId = undefined;
  filters.category = '';
  filters.onlyAlerts = true;
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
