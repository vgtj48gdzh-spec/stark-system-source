<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">映射异常清单</div>
          <div class="subtitle">集中查看未确认映射、缺少规则和仍待人工确认的同步记录。</div>
        </div>
        <el-button v-if="canManageRules" type="primary" @click="router.push('/abc-sync/rules')">
          映射规则管理
        </el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="业务域">
        <el-select v-model="filters.targetDomain" clearable style="width: 160px">
          <el-option label="订单" value="orders" />
          <el-option label="资金" value="funds" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源表">
        <el-select v-model="filters.sourceTable" clearable style="width: 180px">
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
      title="规则重跑后已返回异常页，请查看当前异常是否已收敛。"
    />

    <el-table :data="tableData" v-loading="loading">
      <el-table-column label="业务域" min-width="100">
        <template #default="{ row }">{{ formatAbcTargetDomain(row.targetDomain) }}</template>
      </el-table-column>
      <el-table-column label="来源表" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ formatAbcSourceTable(row.sourceTable) }}</template>
      </el-table-column>
      <el-table-column prop="sourceOrderNo" label="来源单号" min-width="180" show-overflow-tooltip />
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
            <el-tag
              v-for="item in row.exceptionTypes"
              :key="item"
              type="danger"
            >
              {{ formatAbcExceptionType(item) }}
            </el-tag>
          </el-space>
        </template>
      </el-table-column>
      <el-table-column label="治理建议" min-width="260" show-overflow-tooltip>
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
import { getAbcSyncMappingExceptions } from '../../api/abc-sync';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { hasPermission } from '../../utils/permissions';
import {
  formatAbcExceptionType,
  formatAbcSourceTable,
  formatAbcStatus,
  formatAbcTargetDomain,
} from '../../utils/abc-sync';

const route = useRoute();
const router = useRouter();
const sourceTableOptions = ['order', 'repair_order', 'supermarket_order', 'top_up_order', 'transaction'];
const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const dateRange = ref<[string, string] | []>([]);
const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  targetDomain: '',
  sourceTable: '',
  batchNo: '',
  statusStandard: '',
});

const canManageRules = computed(() => hasPermission('abcSync.rules.manage'));

function applyRouteFilters(resetPage = false) {
  filters.targetDomain = String(route.query.targetDomain ?? '');
  filters.sourceTable = String(route.query.sourceTable ?? '');
  filters.batchNo = String(route.query.batchNo ?? '');
  filters.statusStandard = String(route.query.statusStandard ?? '');

  const routeDateFrom = String(route.query.dateFrom ?? '');
  const routeDateTo = String(route.query.dateTo ?? '');
  dateRange.value =
    routeDateFrom && routeDateTo ? [routeDateFrom, routeDateTo] : [];

  if (resetPage) {
    query.page = 1;
  }
}

function syncRouteFilters() {
  router.replace({
    path: route.path,
    query: {
      targetDomain: filters.targetDomain || undefined,
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
    const { data } = await getAbcSyncMappingExceptions({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      targetDomain: filters.targetDomain || undefined,
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
  filters.targetDomain = '';
  filters.sourceTable = '';
  filters.batchNo = '';
  filters.statusStandard = '';
  dateRange.value = [];
  handleSearch();
}

function getGovernanceSuggestion(row: any) {
  if (row.sourceTable === 'repair_order') {
    return '优先确认 repair_order.order_status=4 的业务含义，并补齐 amount 单位口径。';
  }

  if (row.sourceTable === 'supermarket_order') {
    return '优先确认 take_status=1 对应的订单阶段，再决定是否转为文档确认。';
  }

  if (row.sourceTable === 'transaction') {
    return '优先确认 type=FREEZE 的标准资金状态口径，再决定是否保留 recorded。';
  }

  if (row.exceptionTypes.includes('missing_amount_rule')) {
    return '当前未命中金额规则，建议先补金额单位与换算倍率。';
  }

  if (row.exceptionTypes.includes('missing_status_mapping')) {
    return '当前未命中状态映射，建议先补标准状态规则。';
  }

  return '当前记录仍需人工复核映射说明，再决定是否转为已确认。';
}

function goToGovernance(row: any) {
  router.push({
    path: '/abc-sync/rules',
    query: {
      sourceTable: row.sourceTable,
      targetDomain: row.targetDomain,
      batchNo: filters.batchNo || undefined,
      statusStandard: filters.statusStandard || undefined,
      returnTo: 'mapping-exceptions',
    },
  });
}

watch(
  () => route.query,
  () => {
    applyRouteFilters();
    loadData();
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
