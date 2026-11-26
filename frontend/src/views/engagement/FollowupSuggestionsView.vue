<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">跟进建议</div>
          <div class="subtitle">展示平台互动归因后的 AI 跟进建议，当前只做存储与展示，不自动执行。</div>
        </div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="主体类型">
        <el-select v-model="filters.subjectType" clearable style="width: 130px">
          <el-option label="客户" value="customer" />
          <el-option label="员工" value="employee" />
        </el-select>
      </el-form-item>
      <el-form-item label="主体ID">
        <el-input v-model="filters.subjectId" clearable style="width: 130px" />
      </el-form-item>
      <el-form-item label="证据状态">
        <el-select v-model="filters.evidenceStatus" clearable style="width: 130px">
          <el-option label="已确认" value="confirmed" />
          <el-option label="推断" value="inferred" />
          <el-option label="待确认" value="uncertain" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" clearable style="width: 120px">
          <el-option label="草稿" value="draft" />
          <el-option label="生效中" value="active" />
          <el-option label="已归档" value="archived" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="主体" min-width="130">
        <template #default="{ row }">{{ formatSubjectType(row.subjectType) }} {{ row.subjectId }}</template>
      </el-table-column>
      <el-table-column label="建议类型" width="110">
        <template #default="{ row }">{{ formatFollowupRecommendationType(row.recommendationType) }}</template>
      </el-table-column>
      <el-table-column prop="recommendationText" label="建议内容" min-width="260" show-overflow-tooltip />
      <el-table-column prop="recommendationReason" label="建议原因" min-width="220" show-overflow-tooltip />
      <el-table-column label="证据状态" width="100">
        <template #default="{ row }">{{ formatEvidenceStatus(row.evidenceStatus) }}</template>
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
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { getFollowupSuggestions } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatConfidenceScore,
  formatEvidenceStatus,
  formatFollowupRecommendationType,
  formatRecommendationStatus,
  formatSubjectType,
} from '../../utils/engagement';

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  subjectType: '',
  subjectId: '',
  evidenceStatus: '',
  status: '',
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getFollowupSuggestions({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      subjectType: filters.subjectType || undefined,
      subjectId: filters.subjectId ? Number(filters.subjectId) : undefined,
      evidenceStatus: filters.evidenceStatus || undefined,
      status: filters.status || undefined,
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
  filters.subjectType = '';
  filters.subjectId = '';
  filters.evidenceStatus = '';
  filters.status = '';
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
.filters {
  margin-bottom: 8px;
}
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
