<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">库存域映射异常</div>
          <div class="subtitle">集中查看库存域同步中的未确认映射、缺规则和待治理记录。</div>
        </div>
        <el-button v-if="canManageRules" type="primary" @click="router.push('/abc-sync/rules')">
          映射规则管理
        </el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="记录类型">
        <el-select v-model="filters.recordType" clearable style="width: 180px">
          <el-option label="材料主数据" value="materials" />
          <el-option label="供应商主数据" value="suppliers" />
          <el-option label="库房来源快照" value="warehouses" />
          <el-option label="库存流水" value="inventory_ledger" />
        </el-select>
      </el-form-item>
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

    <el-alert
      v-if="route.query.refreshedAt"
      class="refresh-alert"
      type="success"
      :closable="false"
      title="规则重跑后已返回库存域异常页，请查看当前异常是否已经收敛。"
    />

    <el-table :data="tableData" v-loading="loading">
      <el-table-column label="记录类型" min-width="120">
        <template #default="{ row }">{{ formatAbcRecordType(row.recordType) }}</template>
      </el-table-column>
      <el-table-column label="来源表" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ formatAbcSourceTable(row.sourceTable) }}</template>
      </el-table-column>
      <el-table-column prop="sourceOrderNo" label="来源单号" min-width="160" show-overflow-tooltip />
      <el-table-column label="标准状态" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ formatAbcStatus(row.statusStandard) }}</template>
      </el-table-column>
      <el-table-column label="映射确认" min-width="120">
        <template #default="{ row }">
          <el-tag :type="row.mappingConfirmed ? 'success' : 'warning'">
            {{ row.mappingConfirmed ? '已确认' : '未确认' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="异常类型" min-width="220">
        <template #default="{ row }">
          <el-space wrap>
            <el-tag v-for="item in row.exceptionTypes" :key="item" type="danger">
              {{ formatAbcExceptionType(item) }}
            </el-tag>
          </el-space>
        </template>
      </el-table-column>
      <el-table-column label="治理建议" min-width="280" show-overflow-tooltip>
        <template #default="{ row }">{{ getGovernanceSuggestion(row) }}</template>
      </el-table-column>
      <el-table-column prop="mappingNotes" label="映射说明" min-width="260" show-overflow-tooltip />
      <el-table-column prop="syncBatchNo" label="同步批次" min-width="220" show-overflow-tooltip />
      <el-table-column label="同步时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.syncedAt" />
        </template>
      </el-table-column>
      <el-table-column v-if="canManageRules" label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="goToGovernance(row)">去治理</el-button>
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getAbcSyncInventoryMappingExceptions } from '../../api/abc-sync';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { hasPermission } from '../../utils/permissions';
import {
  formatAbcExceptionType,
  formatAbcRecordType,
  formatAbcSourceTable,
  formatAbcStatus,
} from '../../utils/abc-sync';

const route = useRoute();
const router = useRouter();
const sourceTableOptions = [
  'merchant_material',
  'merchant_supplier',
  'merchant_warehouse',
  'merchant_warehouse_out',
];
const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const dateRange = ref<[string, string] | []>([]);
const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  recordType: '',
  sourceTable: '',
  batchNo: '',
  statusStandard: '',
});

const canManageRules = computed(() => hasPermission('abcSync.rules.manage'));

function applyRouteFilters(resetPage = false) {
  filters.recordType = String(route.query.recordType ?? '');
  filters.sourceTable = String(route.query.sourceTable ?? '');
  filters.batchNo = String(route.query.batchNo ?? '');
  filters.statusStandard = String(route.query.statusStandard ?? '');

  const routeDateFrom = String(route.query.dateFrom ?? '');
  const routeDateTo = String(route.query.dateTo ?? '');
  dateRange.value = routeDateFrom && routeDateTo ? [routeDateFrom, routeDateTo] : [];

  if (resetPage) {
    query.page = 1;
  }
}

function syncRouteFilters() {
  router.replace({
    path: route.path,
    query: {
      recordType: filters.recordType || undefined,
      sourceTable: filters.sourceTable || undefined,
      batchNo: filters.batchNo || undefined,
      statusStandard: filters.statusStandard || undefined,
      dateFrom: dateRange.value[0] || undefined,
      dateTo: dateRange.value[1] || undefined,
      refreshedAt: route.query.refreshedAt,
    },
  });
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getAbcSyncInventoryMappingExceptions({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      recordType: filters.recordType || undefined,
      sourceTable: filters.sourceTable || undefined,
      batchNo: filters.batchNo || undefined,
      statusStandard: filters.statusStandard || undefined,
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
  syncRouteFilters();
  loadData();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function resetFilters() {
  filters.recordType = '';
  filters.sourceTable = '';
  filters.batchNo = '';
  filters.statusStandard = '';
  dateRange.value = [];
  handleSearch();
}

function getGovernanceSuggestion(row: any) {
  if (row.sourceTable === 'merchant_material') {
    return '优先确认材料状态口径，以及 storage_price / price / min_stock_warning 的标准单位。';
  }

  if (row.sourceTable === 'merchant_supplier') {
    return '优先确认 deleted_at 导出的供应商状态语义，必要时补充 supplier_status 映射。';
  }

  if (row.sourceTable === 'merchant_warehouse') {
    return '优先确认 status 的业务含义，以及 create_name / storeroom_id 对库房名称的映射规则。';
  }

  if (row.sourceTable === 'merchant_warehouse_out') {
    return '优先确认 type 的出库类型口径，以及 goods_list 中数量和金额字段的标准单位。';
  }

  if (row.exceptionTypes.includes('missing_amount_rule')) {
    return '当前未命中金额规则，建议先补齐金额单位与换算倍率。';
  }

  if (row.exceptionTypes.includes('missing_status_mapping')) {
    return '当前未命中状态映射，建议先补齐标准状态规则。';
  }

  return '当前记录仍需人工确认，建议先从对应来源表的规则入手治理。';
}

function goToGovernance(row: any) {
  router.push({
    path: '/abc-sync/rules',
    query: {
      returnTo: 'inventory-mapping-exceptions',
      sourceTable: row.sourceTable,
      batchNo: filters.batchNo || undefined,
      statusStandard: filters.statusStandard || undefined,
    },
  });
}

watch(
  () => route.query,
  () => {
    applyRouteFilters();
  },
);

onMounted(() => {
  applyRouteFilters();
  loadData();
});
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

.refresh-alert {
  margin-bottom: 16px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
