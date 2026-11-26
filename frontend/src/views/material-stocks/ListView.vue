<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">当前库存</div>
        <div class="subtitle">查看各库房材料当前结存数量，可按库房或材料筛选。</div>
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
      <el-form-item>
        <el-button type="primary" @click="loadData">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column label="库房" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ warehouseMap[row.warehouseId]?.name || `库房 #${row.warehouseId}` }}
        </template>
      </el-table-column>
      <el-table-column label="材料" min-width="220">
        <template #default="{ row }">
          <div>{{ materialMap[row.materialId]?.name || `材料 #${row.materialId}` }}</div>
          <div class="cell-subtitle">
            {{ materialMap[row.materialId]?.specification || materialMap[row.materialId]?.unit || '-' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="currentQuantity" label="当前数量" min-width="120" />
      <el-table-column label="更新时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.updatedAt" />
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { getMaterialStocks } from '../../api/material-stocks';
import { getMaterials } from '../../api/materials';
import { getWarehouses } from '../../api/warehouses';
import ReadableDateTime from '../../components/ReadableDateTime.vue';

const loading = ref(false);
const tableData = ref<any[]>([]);
const warehouseOptions = ref<any[]>([]);
const materialOptions = ref<any[]>([]);
const filters = reactive({
  warehouseId: undefined as number | undefined,
  materialId: undefined as number | undefined,
});

const warehouseMap = computed(() => Object.fromEntries(warehouseOptions.value.map((item) => [item.id, item])));
const materialMap = computed(() => Object.fromEntries(materialOptions.value.map((item) => [item.id, item])));

async function loadOptions() {
  const [warehousesResponse, materialsResponse] = await Promise.all([getWarehouses(), getMaterials()]);
  warehouseOptions.value = warehousesResponse.data.data;
  materialOptions.value = materialsResponse.data.data;
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getMaterialStocks(filters);
    tableData.value = data.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.warehouseId = undefined;
  filters.materialId = undefined;
  loadData();
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
</style>
