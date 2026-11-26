<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">AI 推荐</div>
          <div class="subtitle">记录 AI 生成的推荐和提醒，当前仅用于存储、展示和追溯。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增推荐</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="对象类型">
        <el-select v-model="filters.subjectType" clearable style="width: 130px">
          <el-option label="客户" value="customer" />
          <el-option label="员工" value="employee" />
        </el-select>
      </el-form-item>
      <el-form-item label="对象ID"><el-input v-model="filters.subjectId" clearable style="width: 120px" /></el-form-item>
      <el-form-item label="推荐类型"><el-input v-model="filters.recommendationType" clearable style="width: 150px" /></el-form-item>
      <el-form-item label="证据状态">
        <el-select v-model="filters.evidenceStatus" clearable style="width: 130px">
          <el-option label="已确认" value="confirmed" />
          <el-option label="推断" value="inferred" />
          <el-option label="待确认" value="uncertain" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态"><el-input v-model="filters.status" clearable style="width: 130px" /></el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column label="对象类型" width="90">
        <template #default="{ row }">{{ formatSubjectType(row.subjectType) }}</template>
      </el-table-column>
      <el-table-column prop="subjectId" label="对象ID" width="100" />
      <el-table-column prop="recommendationType" label="推荐类型" min-width="140" show-overflow-tooltip />
      <el-table-column prop="recommendationText" label="推荐内容" min-width="260" show-overflow-tooltip />
      <el-table-column prop="recommendationReason" label="推荐原因" min-width="220" show-overflow-tooltip />
      <el-table-column label="证据状态" width="100">
        <template #default="{ row }">
          <el-tag :type="evidenceTagType(row.evidenceStatus)">{{ formatEvidenceStatus(row.evidenceStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="置信度" width="90">
        <template #default="{ row }">{{ formatConfidenceScore(row.confidenceScore) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ formatRecommendationStatus(row.status) }}</template>
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

    <el-dialog v-model="dialogVisible" title="新增 AI 推荐" width="720px">
      <el-form label-width="110px">
        <el-form-item label="对象类型">
          <el-select v-model="form.subjectType" style="width: 100%">
            <el-option label="客户" value="customer" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>
        <el-form-item label="对象ID">
          <el-input-number v-model="form.subjectId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="推荐类型"><el-input v-model="form.recommendationType" /></el-form-item>
        <el-form-item label="推荐内容"><el-input v-model="form.recommendationText" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="推荐原因"><el-input v-model="form.recommendationReason" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="证据状态">
          <el-select v-model="form.evidenceStatus" style="width: 100%">
            <el-option label="已确认" value="confirmed" />
            <el-option label="推断" value="inferred" />
            <el-option label="待确认" value="uncertain" />
          </el-select>
        </el-form-item>
        <el-form-item label="置信度">
          <el-input-number v-model="form.confidenceScore" :min="0" :max="1" :step="0.1" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态"><el-input v-model="form.status" placeholder="draft / active / archived" /></el-form-item>
        <el-form-item label="上下文">
          <el-input v-model="form.sourceContextText" type="textarea" :rows="4" placeholder="可填 JSON" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { createAiRecommendation, getAiRecommendations } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatConfidenceScore, formatEvidenceStatus, formatRecommendationStatus, formatSubjectType } from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.recommendations.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  subjectType: '',
  subjectId: '',
  recommendationType: '',
  evidenceStatus: '',
  status: '',
});
const form = reactive({
  subjectType: 'customer',
  subjectId: 1,
  recommendationType: '',
  recommendationText: '',
  recommendationReason: '',
  evidenceStatus: 'inferred',
  confidenceScore: 0.5,
  status: 'draft',
  sourceContextText: '',
});

function evidenceTagType(status?: string) {
  if (status === 'confirmed') return 'success';
  if (status === 'inferred') return 'warning';
  return 'info';
}

function parseJson(text: string) {
  if (!text.trim()) return {};
  return JSON.parse(text);
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getAiRecommendations({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      subjectType: filters.subjectType || undefined,
      subjectId: filters.subjectId ? Number(filters.subjectId) : undefined,
      recommendationType: filters.recommendationType || undefined,
      evidenceStatus: filters.evidenceStatus || undefined,
      status: filters.status || undefined,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  form.subjectType = 'customer';
  form.subjectId = 1;
  form.recommendationType = '';
  form.recommendationText = '';
  form.recommendationReason = '';
  form.evidenceStatus = 'inferred';
  form.confidenceScore = 0.5;
  form.status = 'draft';
  form.sourceContextText = '';
  dialogVisible.value = true;
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.subjectType = '';
  filters.subjectId = '';
  filters.recommendationType = '';
  filters.evidenceStatus = '';
  filters.status = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

async function handleSubmit() {
  submitting.value = true;
  try {
    await createAiRecommendation({
      subjectType: form.subjectType,
      subjectId: form.subjectId,
      recommendationType: form.recommendationType,
      recommendationText: form.recommendationText,
      recommendationReason: form.recommendationReason || undefined,
      sourceContext: parseJson(form.sourceContextText),
      evidenceStatus: form.evidenceStatus,
      confidenceScore: form.confidenceScore,
      status: form.status,
    });
    ElMessage.success('AI 推荐创建成功');
    dialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('保存失败，请检查输入内容');
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
