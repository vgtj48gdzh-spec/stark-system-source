<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">平台互动</div>
          <div class="subtitle">记录浏览、点赞、评论、私信等互动事件，支持后续归因与记忆沉淀。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增互动</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="平台"><el-input v-model="filters.platform" clearable style="width: 140px" /></el-form-item>
      <el-form-item label="账号"><el-input v-model="filters.accountId" clearable style="width: 140px" /></el-form-item>
      <el-form-item label="内容ID"><el-input v-model="filters.contentId" clearable style="width: 140px" /></el-form-item>
      <el-form-item label="互动类型"><el-input v-model="filters.interactionType" clearable style="width: 140px" /></el-form-item>
      <el-form-item label="来源用户"><el-input v-model="filters.sourceUserRef" clearable style="width: 140px" /></el-form-item>
      <el-form-item label="来源联系人"><el-input v-model="filters.sourceContactRef" clearable style="width: 140px" /></el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column label="平台" width="90">
        <template #default="{ row }">{{ formatPlatform(row.platform) }}</template>
      </el-table-column>
      <el-table-column prop="accountId" label="账号ID" min-width="130" show-overflow-tooltip />
      <el-table-column prop="contentId" label="内容ID" min-width="130" show-overflow-tooltip />
      <el-table-column label="互动类型" width="110">
        <template #default="{ row }">{{ formatInteractionType(row.interactionType) }}</template>
      </el-table-column>
      <el-table-column prop="interactionValue" label="互动值" width="110" show-overflow-tooltip />
      <el-table-column prop="sourceUserRef" label="来源用户" min-width="130" show-overflow-tooltip />
      <el-table-column prop="sourceSessionRef" label="来源会话" min-width="130" show-overflow-tooltip />
      <el-table-column prop="sourceContactRef" label="来源联系人" min-width="130" show-overflow-tooltip />
      <el-table-column label="互动时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.interactionTime" /></template>
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

    <el-dialog v-model="dialogVisible" title="新增平台互动" width="680px">
      <el-form label-width="110px">
        <el-form-item label="平台"><el-input v-model="form.platform" /></el-form-item>
        <el-form-item label="账号ID"><el-input v-model="form.accountId" /></el-form-item>
        <el-form-item label="内容ID"><el-input v-model="form.contentId" /></el-form-item>
        <el-form-item label="互动类型"><el-input v-model="form.interactionType" /></el-form-item>
        <el-form-item label="互动值">
          <el-input-number v-model="form.interactionValue" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="互动时间">
          <el-date-picker
            v-model="form.interactionTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="来源用户"><el-input v-model="form.sourceUserRef" /></el-form-item>
        <el-form-item label="来源会话"><el-input v-model="form.sourceSessionRef" /></el-form-item>
        <el-form-item label="来源联系人"><el-input v-model="form.sourceContactRef" /></el-form-item>
        <el-form-item label="扩展数据">
          <el-input v-model="form.normalizedPayloadText" type="textarea" :rows="4" placeholder="可填 JSON" />
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
import { createPlatformInteraction, getPlatformInteractions } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatInteractionType, formatPlatform } from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.interactions.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  platform: '',
  accountId: '',
  contentId: '',
  interactionType: '',
  sourceUserRef: '',
  sourceContactRef: '',
});
const form = reactive({
  platform: '',
  accountId: '',
  contentId: '',
  interactionType: '',
  interactionValue: 0,
  interactionTime: '',
  sourceUserRef: '',
  sourceSessionRef: '',
  sourceContactRef: '',
  normalizedPayloadText: '',
});

function parseJson(text: string) {
  if (!text.trim()) return {};
  return JSON.parse(text);
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPlatformInteractions({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'interactionTime',
      sortOrder: 'desc',
      platform: filters.platform || undefined,
      accountId: filters.accountId || undefined,
      contentId: filters.contentId || undefined,
      interactionType: filters.interactionType || undefined,
      sourceUserRef: filters.sourceUserRef || undefined,
      sourceContactRef: filters.sourceContactRef || undefined,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  form.platform = '';
  form.accountId = '';
  form.contentId = '';
  form.interactionType = '';
  form.interactionValue = 0;
  form.interactionTime = '';
  form.sourceUserRef = '';
  form.sourceSessionRef = '';
  form.sourceContactRef = '';
  form.normalizedPayloadText = '';
  dialogVisible.value = true;
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.platform = '';
  filters.accountId = '';
  filters.contentId = '';
  filters.interactionType = '';
  filters.sourceUserRef = '';
  filters.sourceContactRef = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

async function handleSubmit() {
  submitting.value = true;
  try {
    await createPlatformInteraction({
      platform: form.platform,
      accountId: form.accountId,
      contentId: form.contentId || undefined,
      interactionType: form.interactionType,
      interactionValue: form.interactionValue,
      interactionTime: form.interactionTime,
      sourceUserRef: form.sourceUserRef || undefined,
      sourceSessionRef: form.sourceSessionRef || undefined,
      sourceContactRef: form.sourceContactRef || undefined,
      normalizedPayload: parseJson(form.normalizedPayloadText),
    });
    ElMessage.success('平台互动创建成功');
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
