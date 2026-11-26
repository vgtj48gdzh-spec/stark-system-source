<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">同步运行记录</div>
        <div class="subtitle">查看 ABC 只读同步的运行批次、检查点和执行状态。</div>
      </div>
    </template>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="运行记录" name="runs">
        <el-form inline class="filters">
          <el-form-item label="来源表">
            <el-select v-model="runFilters.sourceTable" clearable style="width: 180px">
              <el-option
                v-for="item in sourceTableOptions"
                :key="item"
                :label="formatAbcSourceTable(item)"
                :value="item"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="批次号">
            <el-input v-model="runFilters.batchNo" clearable style="width: 220px" />
          </el-form-item>
          <el-form-item label="运行状态">
            <el-select v-model="runFilters.runStatus" clearable style="width: 180px">
              <el-option label="运行中" value="running" />
              <el-option label="成功" value="success" />
              <el-option label="失败" value="failed" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始时间">
            <el-date-picker
              v-model="runDateRange"
              type="daterange"
              value-format="YYYY-MM-DDTHH:mm:ss"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleRunSearch">查询</el-button>
            <el-button @click="resetRunFilters">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="runTableData" v-loading="runLoading">
          <el-table-column label="来源表" min-width="140">
            <template #default="{ row }">{{ formatAbcSourceTable(row.syncJob?.sourceTable) }}</template>
          </el-table-column>
          <el-table-column prop="batchNo" label="批次号" min-width="220" show-overflow-tooltip />
          <el-table-column label="运行状态" min-width="120">
            <template #default="{ row }">{{ formatAbcRunStatus(row.runStatus) }}</template>
          </el-table-column>
          <el-table-column prop="totalRecords" label="总数" min-width="90" />
          <el-table-column prop="importedRecords" label="新增" min-width="90" />
          <el-table-column prop="failedRecords" label="失败" min-width="90" />
          <el-table-column label="开始时间" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <ReadableDateTime :value="row.startedAt" />
            </template>
          </el-table-column>
          <el-table-column label="结束时间" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <ReadableDateTime :value="row.finishedAt" />
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          class="pager"
          background
          layout="total, prev, pager, next"
          :total="runTotal"
          :page-size="runQuery.pageSize"
          :current-page="runQuery.page"
          @current-change="handleRunPageChange"
        />
      </el-tab-pane>

      <el-tab-pane label="检查点" name="checkpoints">
        <el-form inline class="filters">
          <el-form-item label="来源表">
            <el-select v-model="checkpointFilters.sourceTable" clearable style="width: 180px">
              <el-option
                v-for="item in sourceTableOptions"
                :key="item"
                :label="formatAbcSourceTable(item)"
                :value="item"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="批次号">
            <el-input v-model="checkpointFilters.batchNo" clearable style="width: 220px" />
          </el-form-item>
          <el-form-item label="最近同步">
            <el-date-picker
              v-model="checkpointDateRange"
              type="daterange"
              value-format="YYYY-MM-DDTHH:mm:ss"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleCheckpointSearch">查询</el-button>
            <el-button @click="resetCheckpointFilters">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="checkpointTableData" v-loading="checkpointLoading">
          <el-table-column label="来源表" min-width="140">
            <template #default="{ row }">{{ formatAbcSourceTable(row.syncJob?.sourceTable) }}</template>
          </el-table-column>
          <el-table-column prop="checkpointKey" label="检查点键" min-width="180" />
          <el-table-column prop="checkpointValue" label="检查点值" min-width="220" show-overflow-tooltip />
          <el-table-column prop="batchNo" label="批次号" min-width="220" show-overflow-tooltip />
          <el-table-column label="最近同步" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <ReadableDateTime :value="row.lastSyncedAt" />
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
          :total="checkpointTotal"
          :page-size="checkpointQuery.pageSize"
          :current-page="checkpointQuery.page"
          @current-change="handleCheckpointPageChange"
        />
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { getAbcSyncCheckpoints, getAbcSyncJobRuns } from '../../api/abc-sync';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatAbcRunStatus, formatAbcSourceTable } from '../../utils/abc-sync';

const sourceTableOptions = ['order', 'repair_order', 'supermarket_order', 'top_up_order', 'transaction'];
const activeTab = ref<'runs' | 'checkpoints'>('runs');

const runLoading = ref(false);
const runTableData = ref<any[]>([]);
const runTotal = ref(0);
const runDateRange = ref<[string, string] | []>([]);
const runQuery = reactive({ page: 1, pageSize: 10 });
const runFilters = reactive({
  sourceTable: '',
  batchNo: '',
  runStatus: '',
});

const checkpointLoading = ref(false);
const checkpointTableData = ref<any[]>([]);
const checkpointTotal = ref(0);
const checkpointDateRange = ref<[string, string] | []>([]);
const checkpointQuery = reactive({ page: 1, pageSize: 10 });
const checkpointFilters = reactive({
  sourceTable: '',
  batchNo: '',
});

async function loadRuns() {
  runLoading.value = true;
  try {
    const { data } = await getAbcSyncJobRuns({
      page: runQuery.page,
      pageSize: runQuery.pageSize,
      sortBy: 'startedAt',
      sortOrder: 'desc',
      sourceTable: runFilters.sourceTable || undefined,
      batchNo: runFilters.batchNo || undefined,
      runStatus: runFilters.runStatus || undefined,
      dateFrom: runDateRange.value[0],
      dateTo: runDateRange.value[1],
    });
    runTableData.value = data.data.list;
    runTotal.value = data.data.total;
  } finally {
    runLoading.value = false;
  }
}

async function loadCheckpoints() {
  checkpointLoading.value = true;
  try {
    const { data } = await getAbcSyncCheckpoints({
      page: checkpointQuery.page,
      pageSize: checkpointQuery.pageSize,
      sortBy: 'lastSyncedAt',
      sortOrder: 'desc',
      sourceTable: checkpointFilters.sourceTable || undefined,
      batchNo: checkpointFilters.batchNo || undefined,
      dateFrom: checkpointDateRange.value[0],
      dateTo: checkpointDateRange.value[1],
    });
    checkpointTableData.value = data.data.list;
    checkpointTotal.value = data.data.total;
  } finally {
    checkpointLoading.value = false;
  }
}

function handleRunSearch() {
  runQuery.page = 1;
  loadRuns();
}

function handleCheckpointSearch() {
  checkpointQuery.page = 1;
  loadCheckpoints();
}

function handleRunPageChange(page: number) {
  runQuery.page = page;
  loadRuns();
}

function handleCheckpointPageChange(page: number) {
  checkpointQuery.page = page;
  loadCheckpoints();
}

function resetRunFilters() {
  runFilters.sourceTable = '';
  runFilters.batchNo = '';
  runFilters.runStatus = '';
  runDateRange.value = [];
  handleRunSearch();
}

function resetCheckpointFilters() {
  checkpointFilters.sourceTable = '';
  checkpointFilters.batchNo = '';
  checkpointDateRange.value = [];
  handleCheckpointSearch();
}

watch(activeTab, (value) => {
  if (value === 'runs') {
    loadRuns();
    return;
  }

  loadCheckpoints();
});

onMounted(async () => {
  await loadRuns();
  await loadCheckpoints();
});
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
