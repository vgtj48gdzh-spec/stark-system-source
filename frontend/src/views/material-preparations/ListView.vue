<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <div>
          <div class="title">{{ pageTitle }}</div>
          <div class="subtitle">支持按责任人、供应商、材料、库房和日期筛选，超时未绑定会高亮提醒。</div>
        </div>
        <el-button
          v-if="canCreatePreparation"
          type="primary"
          @click="router.push('/material-preparations/create')"
        >
          新建备料
        </el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="责任人 ID">
        <el-input-number v-model="filters.responsibleUserId" :min="1" />
      </el-form-item>
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
      <el-form-item label="业务日期">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DDTHH:mm:ss"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
      </el-form-item>
      <el-form-item label="只看超时">
        <el-switch v-model="filters.isOverdue" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadData">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="preparationNo" label="备料编号" min-width="170" />
      <el-table-column label="材料" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ materialMap[row.materialId]?.name || `材料 #${row.materialId}` }}
        </template>
      </el-table-column>
      <el-table-column label="供应商" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          {{ supplierMap[row.supplierId]?.name || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="库房" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.warehouseId ? warehouseMap[row.warehouseId]?.name || `库房 #${row.warehouseId}` : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="quantity" label="数量" min-width="100" />
      <el-table-column prop="unitPrice" label="单价" min-width="100" />
      <el-table-column prop="totalPrice" label="总价" min-width="100" />
      <el-table-column prop="linkedWorkOrderId" label="绑定工单" min-width="100" />
      <el-table-column prop="responsibleUserId" label="责任人 ID" min-width="100" />
      <el-table-column label="绑定状态" min-width="150">
        <template #default="{ row }">
          <el-tag :type="preparationBindStatusMap[row.bindStatus]?.type || 'info'">
            {{ preparationBindStatusMap[row.bindStatus]?.label || row.bindStatus }}
          </el-tag>
          <el-tag v-if="row.isOverdue" type="danger" class="extra-tag">已超时</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="绑定截止" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.bindDeadlineAt" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/material-preparations/${row.id}`)">
            {{ canViewPreparationAudit ? '详情 / 审计' : '详情' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getMaterialPreparations } from '../../api/material-preparations';
import { getMaterials } from '../../api/materials';
import { getSuppliers } from '../../api/suppliers';
import { getWarehouses } from '../../api/warehouses';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { hasPermission } from '../../utils/permissions';
import { preparationBindStatusMap } from '../../utils/status-tag';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);
const materialOptions = ref<any[]>([]);
const supplierOptions = ref<any[]>([]);
const warehouseOptions = ref<any[]>([]);
const dateRange = ref<[string, string] | []>([]);
const filters = reactive({
  responsibleUserId: undefined as number | undefined,
  supplierId: undefined as number | undefined,
  materialId: undefined as number | undefined,
  warehouseId: undefined as number | undefined,
  isOverdue: false,
});

const canCreatePreparation = computed(() => hasPermission('materialPreparation.create'));
const canViewPreparationAudit = computed(() => hasPermission('materialPreparation.audit'));
const pageTitle = computed(() => (canCreatePreparation.value ? '备料列表' : '备料审计'));

const materialMap = computed(() => Object.fromEntries(materialOptions.value.map((item) => [item.id, item])));
const supplierMap = computed(() => Object.fromEntries(supplierOptions.value.map((item) => [item.id, item])));
const warehouseMap = computed(() => Object.fromEntries(warehouseOptions.value.map((item) => [item.id, item])));

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
    const { data } = await getMaterialPreparations({
      ...filters,
      dateFrom: dateRange.value[0],
      dateTo: dateRange.value[1],
      isOverdue: filters.isOverdue || undefined,
    });
    tableData.value = data.data;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.responsibleUserId = undefined;
  filters.supplierId = undefined;
  filters.materialId = undefined;
  filters.warehouseId = undefined;
  filters.isOverdue = false;
  dateRange.value = [];
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

.extra-tag {
  margin-left: 8px;
}
</style>
