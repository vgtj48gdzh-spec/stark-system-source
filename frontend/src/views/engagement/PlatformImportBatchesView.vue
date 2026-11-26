<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">平台导入批次</div>
          <div class="subtitle">导入 CSV、Excel、JSON 文件，作为平台内容、互动和线索的只读接入批次。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新建导入</el-button>
      </div>
    </template>

    <el-form inline class="filters">
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
      <el-form-item label="批次状态">
        <el-select v-model="filters.importStatus" clearable style="width: 150px">
          <el-option label="处理中" value="processing" />
          <el-option label="已完成" value="completed" />
          <el-option label="部分失败" value="partial" />
          <el-option label="失败" value="failed" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="id" label="批次ID" width="90" />
      <el-table-column label="平台" width="100">
        <template #default="{ row }">{{ formatPlatform(row.sourcePlatform) }}</template>
      </el-table-column>
      <el-table-column prop="accountId" label="账号ID" min-width="140" show-overflow-tooltip />
      <el-table-column label="导入类型" width="110">
        <template #default="{ row }">{{ formatImportType(row.importType) }}</template>
      </el-table-column>
      <el-table-column label="文件格式" width="100">
        <template #default="{ row }">{{ formatImportSourceFormat(row.sourceFormat) }}</template>
      </el-table-column>
      <el-table-column prop="fileName" label="文件名" min-width="180" show-overflow-tooltip />
      <el-table-column label="导入摘要" min-width="220">
        <template #default="{ row }">
          <div class="summary-stack">
            <div>写入 {{ row.successCount || 0 }} / 失败 {{ row.failedCount || 0 }}</div>
            <div class="file-hint">
              线索 {{ row.summaryJson?.downstream?.leadGeneration?.processed ?? 0 }} /
              归因 {{ row.summaryJson?.downstream?.attributionGeneration?.processed ?? 0 }}
            </div>
            <div class="file-hint">
              {{ row.summaryJson?.createdCount ?? 0 }} 新增 / {{ row.summaryJson?.updatedCount ?? 0 }} 更新
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">{{ formatImportStatus(row.importStatus) }}</template>
      </el-table-column>
      <el-table-column prop="recordCount" label="总数" width="90" />
      <el-table-column prop="successCount" label="成功" width="90" />
      <el-table-column prop="failedCount" label="失败" width="90" />
      <el-table-column label="开始时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.startedAt" /></template>
      </el-table-column>
      <el-table-column label="完成时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.finishedAt" /></template>
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

    <el-dialog v-model="dialogVisible" title="新建平台导入批次" width="700px">
      <el-form label-width="110px">
        <el-form-item label="平台">
          <el-input v-model="form.sourcePlatform" placeholder="如 douyin / wechat / custom" />
        </el-form-item>
        <el-form-item label="账号ID">
          <el-input v-model="form.accountId" placeholder="可为空" />
        </el-form-item>
        <el-form-item label="导入类型">
          <el-select v-model="form.importType" style="width: 100%">
            <el-option label="平台内容" value="content" />
            <el-option label="平台互动" value="interaction" />
            <el-option label="平台线索" value="lead" />
          </el-select>
        </el-form-item>
        <el-form-item label="连接器配置ID">
          <el-input-number v-model="form.connectorConfigId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="生成线索候选">
          <el-switch v-model="form.triggerLeadGeneration" />
        </el-form-item>
        <el-form-item label="生成归因结果">
          <el-switch v-model="form.triggerAttributionGeneration" />
        </el-form-item>
        <el-form-item label="同步线索记忆">
          <el-switch v-model="form.syncLeadMemories" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="导入文件">
          <input type="file" accept=".csv,.json,.xlsx,.xls" @change="handleFileChange" />
          <div class="file-hint">{{ selectedFile?.name || '未选择文件' }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">开始导入</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { createPlatformImportBatch, getPlatformImportBatches } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatImportSourceFormat,
  formatImportStatus,
  formatImportType,
  formatPlatform,
} from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const selectedFile = ref<File | null>(null);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.importBatches.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  sourcePlatform: '',
  importType: '',
  importStatus: '',
});
const form = reactive({
  sourcePlatform: '',
  accountId: '',
  importType: 'interaction',
  connectorConfigId: undefined as number | undefined,
  triggerLeadGeneration: true,
  triggerAttributionGeneration: true,
  syncLeadMemories: false,
  remark: '',
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPlatformImportBatches({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
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
  filters.sourcePlatform = '';
  filters.importType = '';
  filters.importStatus = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function openCreateDialog() {
  form.sourcePlatform = '';
  form.accountId = '';
  form.importType = 'interaction';
  form.connectorConfigId = undefined;
  form.triggerLeadGeneration = true;
  form.triggerAttributionGeneration = true;
  form.syncLeadMemories = false;
  form.remark = '';
  selectedFile.value = null;
  dialogVisible.value = true;
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
}

async function handleSubmit() {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择导入文件');
    return;
  }

  submitting.value = true;
  try {
    await createPlatformImportBatch({
      sourcePlatform: form.sourcePlatform,
      accountId: form.accountId || undefined,
      importType: form.importType,
      connectorConfigId: form.connectorConfigId,
      triggerLeadGeneration: form.triggerLeadGeneration,
      triggerAttributionGeneration: form.triggerAttributionGeneration,
      syncLeadMemories: form.syncLeadMemories,
      remark: form.remark || undefined,
      file: selectedFile.value,
    });
    ElMessage.success('平台导入批次创建成功');
    dialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('导入失败，请检查文件内容');
  } finally {
    submitting.value = false;
  }
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

.filters {
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.file-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}

.summary-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
