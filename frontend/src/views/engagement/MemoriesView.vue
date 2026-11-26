<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">记忆条目</div>
          <div class="subtitle">沉淀客户与员工的事实、推断与待确认记忆，支持停用与追溯。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增记忆</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="对象类型">
        <el-select v-model="filters.subjectType" clearable style="width: 130px">
          <el-option label="客户" value="customer" />
          <el-option label="员工" value="employee" />
        </el-select>
      </el-form-item>
      <el-form-item label="对象ID">
        <el-input v-model="filters.subjectId" clearable style="width: 120px" />
      </el-form-item>
      <el-form-item label="记忆类型">
        <el-input v-model="filters.memoryType" clearable style="width: 150px" />
      </el-form-item>
      <el-form-item label="证据状态">
        <el-select v-model="filters.evidenceStatus" clearable style="width: 130px">
          <el-option label="已确认" value="confirmed" />
          <el-option label="推断" value="inferred" />
          <el-option label="待确认" value="uncertain" />
        </el-select>
      </el-form-item>
      <el-form-item label="启用状态">
        <el-select v-model="filters.isActive" clearable style="width: 120px">
          <el-option label="启用" :value="true" />
          <el-option label="停用" :value="false" />
        </el-select>
      </el-form-item>
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
      <el-table-column prop="memoryType" label="记忆类型" min-width="120" show-overflow-tooltip />
      <el-table-column prop="content" label="记忆内容" min-width="260" show-overflow-tooltip />
      <el-table-column prop="sourceType" label="来源类型" min-width="120" show-overflow-tooltip />
      <el-table-column prop="sourceId" label="来源ID" width="100" />
      <el-table-column label="证据状态" width="100">
        <template #default="{ row }">
          <el-tag :type="evidenceTagType(row.evidenceStatus)">{{ formatEvidenceStatus(row.evidenceStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="置信度" width="90">
        <template #default="{ row }">{{ formatConfidenceScore(row.confidenceScore) }}</template>
      </el-table-column>
      <el-table-column label="启用" width="80">
        <template #default="{ row }">{{ formatBoolean(row.isActive) }}</template>
      </el-table-column>
      <el-table-column label="失效时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.expiresAt" /></template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.createdAt" /></template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canManage" link type="primary" @click="openEditDialog(row)">编辑</el-button>
          <el-button v-if="canManage && row.isActive" link type="danger" @click="handleDeactivate(row)">停用</el-button>
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

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑记忆' : '新增记忆'" width="720px">
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
        <el-form-item label="记忆类型"><el-input v-model="form.memoryType" /></el-form-item>
        <el-form-item label="记忆内容"><el-input v-model="form.content" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="来源类型"><el-input v-model="form.sourceType" /></el-form-item>
        <el-form-item label="来源ID">
          <el-input-number v-model="form.sourceId" :min="1" style="width: 100%" />
        </el-form-item>
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
        <el-form-item label="失效时间">
          <el-date-picker
            v-model="form.expiresAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.isActive" /></el-form-item>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { createMemoryEntry, deactivateMemoryEntry, getMemoryEntries, updateMemoryEntry } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatBoolean, formatConfidenceScore, formatEvidenceStatus, formatSubjectType } from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.memories.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  subjectType: '',
  subjectId: '',
  memoryType: '',
  evidenceStatus: '',
  isActive: undefined as boolean | undefined,
});
const form = reactive({
  subjectType: 'customer',
  subjectId: 1,
  memoryType: '',
  content: '',
  sourceType: '',
  sourceId: undefined as number | undefined,
  evidenceStatus: 'uncertain',
  confidenceScore: 0.5,
  expiresAt: '',
  isActive: true,
  normalizedPayloadText: '',
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
    const { data } = await getMemoryEntries({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      subjectType: filters.subjectType || undefined,
      subjectId: filters.subjectId ? Number(filters.subjectId) : undefined,
      memoryType: filters.memoryType || undefined,
      evidenceStatus: filters.evidenceStatus || undefined,
      isActive: filters.isActive,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingId.value = null;
  form.subjectType = 'customer';
  form.subjectId = 1;
  form.memoryType = '';
  form.content = '';
  form.sourceType = '';
  form.sourceId = undefined;
  form.evidenceStatus = 'uncertain';
  form.confidenceScore = 0.5;
  form.expiresAt = '';
  form.isActive = true;
  form.normalizedPayloadText = '';
}

function openCreateDialog() {
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(row: any) {
  editingId.value = row.id;
  form.subjectType = row.subjectType;
  form.subjectId = row.subjectId;
  form.memoryType = row.memoryType;
  form.content = row.content;
  form.sourceType = row.sourceType;
  form.sourceId = row.sourceId ?? undefined;
  form.evidenceStatus = row.evidenceStatus;
  form.confidenceScore = Number(row.confidenceScore ?? 0);
  form.expiresAt = row.expiresAt ?? '';
  form.isActive = row.isActive;
  form.normalizedPayloadText = JSON.stringify(row.normalizedPayload ?? {}, null, 2);
  dialogVisible.value = true;
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.subjectType = '';
  filters.subjectId = '';
  filters.memoryType = '';
  filters.evidenceStatus = '';
  filters.isActive = undefined;
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

async function handleSubmit() {
  submitting.value = true;
  try {
    const payload = {
      subjectType: form.subjectType,
      subjectId: form.subjectId,
      memoryType: form.memoryType,
      content: form.content,
      sourceType: form.sourceType,
      sourceId: form.sourceId,
      evidenceStatus: form.evidenceStatus,
      confidenceScore: form.confidenceScore,
      expiresAt: form.expiresAt || undefined,
      isActive: form.isActive,
      normalizedPayload: parseJson(form.normalizedPayloadText),
    };
    if (editingId.value) {
      await updateMemoryEntry(editingId.value, payload);
      ElMessage.success('记忆条目更新成功');
    } else {
      await createMemoryEntry(payload);
      ElMessage.success('记忆条目创建成功');
    }
    dialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('保存失败，请检查输入内容');
  } finally {
    submitting.value = false;
  }
}

async function handleDeactivate(row: any) {
  await ElMessageBox.confirm(`确认停用记忆条目「${row.memoryType}」吗？`, '停用确认', { type: 'warning' });
  await deactivateMemoryEntry(row.id, { reason: '手工停用' });
  ElMessage.success('记忆条目已停用');
  await loadData();
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
