<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">线索候选</div>
          <div class="subtitle">平台互动进入归因前的候选记录，保留来源引用、证据状态与置信度。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openGenerateDialog">生成线索候选</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="平台">
        <el-input v-model="filters.platform" clearable style="width: 140px" />
      </el-form-item>
      <el-form-item label="候选类型">
        <el-select v-model="filters.candidateType" clearable style="width: 150px">
          <el-option label="客户候选" value="customer" />
          <el-option label="员工候选" value="employee" />
          <el-option label="商户候选" value="merchant" />
          <el-option label="待确认" value="unknown" />
        </el-select>
      </el-form-item>
      <el-form-item label="处理状态">
        <el-select v-model="filters.status" clearable style="width: 120px">
          <el-option label="待处理" value="pending" />
          <el-option label="已处理" value="processed" />
        </el-select>
      </el-form-item>
      <el-form-item label="证据状态">
        <el-select v-model="filters.evidenceStatus" clearable style="width: 120px">
          <el-option label="已确认" value="confirmed" />
          <el-option label="推断" value="inferred" />
          <el-option label="待确认" value="uncertain" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column label="平台" width="90">
        <template #default="{ row }">{{ formatPlatform(row.platform) }}</template>
      </el-table-column>
      <el-table-column prop="accountId" label="账号ID" min-width="140" show-overflow-tooltip />
      <el-table-column prop="contentId" label="内容ID" min-width="140" show-overflow-tooltip />
      <el-table-column label="候选类型" width="110">
        <template #default="{ row }">{{ formatLeadCandidateType(row.candidateType) }}</template>
      </el-table-column>
      <el-table-column prop="candidateRef" label="候选引用" min-width="140" show-overflow-tooltip />
      <el-table-column prop="merchantId" label="商户ID" width="90" />
      <el-table-column prop="employeeId" label="员工ID" width="90" />
      <el-table-column label="处理状态" width="100">
        <template #default="{ row }">{{ formatLeadCandidateStatus(row.status) }}</template>
      </el-table-column>
      <el-table-column label="证据状态" width="100">
        <template #default="{ row }">
          <el-tag :type="evidenceTagType(row.evidenceStatus)">{{ formatEvidenceStatus(row.evidenceStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="置信度" width="90">
        <template #default="{ row }">{{ formatConfidenceScore(row.confidenceScore) }}</template>
      </el-table-column>
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

    <el-dialog v-model="generateDialogVisible" title="生成线索候选" width="560px">
      <el-form label-width="110px">
        <el-form-item label="平台">
          <el-input v-model="generateForm.platform" placeholder="可留空，默认全量" />
        </el-form-item>
        <el-form-item label="账号ID">
          <el-input v-model="generateForm.accountId" placeholder="可留空" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="generateForm.dateFrom"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="generateForm.dateTo"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="强制重跑">
          <el-switch v-model="generateForm.forceRegenerate" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleGenerate">执行</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { generateLeadCandidates, getLeadCandidates } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatConfidenceScore,
  formatEvidenceStatus,
  formatLeadCandidateStatus,
  formatLeadCandidateType,
  formatPlatform,
} from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const generateDialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.leads.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  platform: '',
  candidateType: '',
  status: '',
  evidenceStatus: '',
});
const generateForm = reactive({
  platform: '',
  accountId: '',
  dateFrom: '',
  dateTo: '',
  forceRegenerate: false,
});

function evidenceTagType(status?: string) {
  if (status === 'confirmed') return 'success';
  if (status === 'inferred') return 'warning';
  return 'info';
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getLeadCandidates({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      platform: filters.platform || undefined,
      candidateType: filters.candidateType || undefined,
      status: filters.status || undefined,
      evidenceStatus: filters.evidenceStatus || undefined,
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
  filters.platform = '';
  filters.candidateType = '';
  filters.status = '';
  filters.evidenceStatus = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function openGenerateDialog() {
  generateForm.platform = '';
  generateForm.accountId = '';
  generateForm.dateFrom = '';
  generateForm.dateTo = '';
  generateForm.forceRegenerate = false;
  generateDialogVisible.value = true;
}

async function handleGenerate() {
  submitting.value = true;
  try {
    const { data } = await generateLeadCandidates({
      platform: generateForm.platform || undefined,
      accountId: generateForm.accountId || undefined,
      dateFrom: generateForm.dateFrom || undefined,
      dateTo: generateForm.dateTo || undefined,
      forceRegenerate: generateForm.forceRegenerate,
    });
    ElMessage.success(`生成完成，处理 ${data.data.processed} 条`);
    generateDialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('生成失败，请稍后重试');
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
</style>
