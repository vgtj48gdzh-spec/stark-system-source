<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <div>
          <div class="title">库存流水</div>
          <div class="subtitle">统一查看入库、出库以及与工单、备料关联的库存变动日志。</div>
        </div>
        <div class="toolbar-actions">
          <el-button v-if="canCreateInbound" @click="router.push('/inventory-transactions/inbound/create')">
            新增入库
          </el-button>
          <el-button
            v-if="canCreateOutbound"
            type="primary"
            @click="router.push('/inventory-transactions/outbound/create')"
          >
            新增出库
          </el-button>
        </div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="类型">
        <el-select v-model="query.transactionType" clearable style="width: 180px" @change="handleSearch">
          <el-option label="入库" value="inbound" />
          <el-option label="出库" value="outbound" />
        </el-select>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="transactionNo" label="流水编号" min-width="170" />
      <el-table-column label="类型" min-width="120">
        <template #default="{ row }">
          <el-tag :type="inventoryTransactionTypeMap[row.transactionType]?.type || 'info'">
            {{ inventoryTransactionTypeMap[row.transactionType]?.label || row.transactionType }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="库房" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">
          {{ warehouseMap[row.warehouseId]?.name || `库房 #${row.warehouseId}` }}
        </template>
      </el-table-column>
      <el-table-column label="材料" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ materialMap[row.materialId]?.name || `材料 #${row.materialId}` }}
        </template>
      </el-table-column>
      <el-table-column prop="quantity" label="数量" min-width="100" />
      <el-table-column prop="unitPrice" label="单价" min-width="100" />
      <el-table-column prop="totalPrice" label="总价" min-width="100" />
      <el-table-column prop="relatedWorkOrderId" label="工单 ID" min-width="100" />
      <el-table-column prop="relatedPreparationId" label="备料 ID" min-width="100" />
      <el-table-column label="创建时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.createdAt" />
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
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getInventoryTransactions } from '../../api/inventory-transactions';
import { getMaterials } from '../../api/materials';
import { getWarehouses } from '../../api/warehouses';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formalActorIdentityBound, hasPermission } from '../../utils/permissions';
import { inventoryTransactionTypeMap } from '../../utils/status-tag';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const warehouseOptions = ref<any[]>([]);
const materialOptions = ref<any[]>([]);
const query = reactive({
  page: 1,
  pageSize: 10,
  transactionType: '',
});

const canCreateInbound = computed(
  () => formalActorIdentityBound.value && hasPermission('inventory.inbound'),
);
const canCreateOutbound = computed(
  () => formalActorIdentityBound.value && hasPermission('inventory.outbound'),
);
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
    const { data } = await getInventoryTransactions({
      page: query.page,
      pageSize: query.pageSize,
      transactionType: query.transactionType || undefined,
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

onMounted(async () => {
  await loadOptions();
  await loadData();
});
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.toolbar-actions {
  display: flex;
  gap: 12px;
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
