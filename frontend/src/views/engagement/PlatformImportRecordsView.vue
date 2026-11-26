<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">平台导入记录</div>
          <div class="subtitle">查看每条导入记录的结果、失败原因与写入目标，方便追溯文件导入质量。</div>
        </div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="批次ID">
        <el-input-number v-model="filters.importBatchId" :min="1" style="width: 140px" />
      </el-form-item>
      <el-form-item label="平台">
        <el-input v-model="filters.sourcePlatform" clearable style="width: 140px" />
      </el-form-item>
      <el-form-item label="导入类型">
        <el-select v-model="filters.importType" clearable style="width: 150px">
          <el-option label="平台内容" value="content" />
          <el-option label="平台互动" value="interaction" />
          <el-option label="平台线索" value="lead" />
        </el-select>
      </el-form-item>
      <el-form-item label="记录状态">
        <el-select v-model="filters.importStatus" clearable style="width: 150px">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="id" label="记录ID" width="90" />
      <el-table-column prop="importBatchId" label="批次ID" width="90" />
      <el-table-column label="平台" width="100">
        <template #default="{ row }">{{ formatPlatform(row.sourcePlatform) }}</template>
      </el-table-column>
      <el-table-column label="导入类型" width="110">
        <template #default="{ row }">{{ formatImportType(row.importType) }}</template>
      </el-table-column>
      <el-table-column prop="recordIndex" label="行号" width="90" />
      <el-table-column prop="sourceRecordRef" label="来源记录" min-width="140" show-overflow-tooltip />
      <el-table-column label="来源文件" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.importBatch?.fileName || row.sourceFile || '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ formatImportStatus(row.importStatus) }}</template>
      </el-table-column>
      <el-table-column prop="targetTable" label="目标表" min-width="150" show-overflow-tooltip />
      <el-table-column prop="targetId" label="目标ID" min-width="100" show-overflow-tooltip />
      <el-table-column label="写入摘要" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.normalizedPayload?.title || row.normalizedPayload?.leadValue || row.normalizedPayload?.interactionType || '-' }}</div>
          <div class="sub-cell">
            {{ row.normalizedPayload?.campaignId || row.normalizedPayload?.contentId || row.normalizedPayload?.leadRef || '-' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="errorMessage" label="失败原因" min-width="220" show-overflow-tooltip />
      <el-table-column label="创建时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.createdAt" /></template>
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
import { getPlatformImportRecords } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatImportStatus, formatImportType, formatPlatform } from '../../utils/engagement';

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  importBatchId: undefined as number | undefined,
  sourcePlatform: '',
  importType: '',
  importStatus: '',
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPlatformImportRecords({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'recordIndex',
      sortOrder: 'asc',
      importBatchId: filters.importBatchId,
      sourcePlatform: filters.sourcePlatform || undefined,
      importType: filters.importType || undefined,
      importStatus: filters.importStatus || undefined,
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

function resetFilters() {
  filters.importBatchId = undefined;
  filters.sourcePlatform = '';
  filters.importType = '';
  filters.importStatus = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

onMounted(loadData);
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

.sub-cell {
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
