<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">关联记录</div>
          <div class="subtitle">记录平台互动与客户、员工或业务记录的关联，保留归因状态和置信度。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增关联</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="互动ID"><el-input v-model="filters.interactionId" clearable style="width: 120px" /></el-form-item>
      <el-form-item label="对象类型">
        <el-select v-model="filters.linkedSubjectType" clearable style="width: 130px">
          <el-option label="客户" value="customer" />
          <el-option label="员工" value="employee" />
        </el-select>
      </el-form-item>
      <el-form-item label="对象ID"><el-input v-model="filters.linkedSubjectId" clearable style="width: 120px" /></el-form-item>
      <el-form-item label="业务类型"><el-input v-model="filters.linkedBusinessType" clearable style="width: 150px" /></el-form-item>
      <el-form-item label="归因状态">
        <el-select v-model="filters.attributionStatus" clearable style="width: 130px">
          <el-option label="已确认" value="confirmed" />
          <el-option label="推断" value="inferred" />
          <el-option label="未知" value="unknown" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="interactionId" label="互动ID" width="90" />
      <el-table-column label="关联对象类型" width="100">
        <template #default="{ row }">{{ formatSubjectType(row.linkedSubjectType) }}</template>
      </el-table-column>
      <el-table-column prop="linkedSubjectId" label="关联对象ID" width="110" />
      <el-table-column prop="linkedBusinessType" label="业务类型" min-width="140" show-overflow-tooltip />
      <el-table-column prop="linkedBusinessId" label="业务ID" width="100" />
      <el-table-column label="归因状态" width="100">
        <template #default="{ row }">
          <el-tag :type="attributionTagType(row.attributionStatus)">{{ formatAttributionStatus(row.attributionStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="置信度" width="90">
        <template #default="{ row }">{{ formatConfidenceScore(row.attributionConfidence) }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
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

    <el-dialog v-model="dialogVisible" title="新增关联记录" width="680px">
      <el-form label-width="110px">
        <el-form-item label="互动ID">
          <el-input-number v-model="form.interactionId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="对象类型">
          <el-select v-model="form.linkedSubjectType" style="width: 100%">
            <el-option label="客户" value="customer" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>
        <el-form-item label="对象ID">
          <el-input-number v-model="form.linkedSubjectId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="业务类型"><el-input v-model="form.linkedBusinessType" /></el-form-item>
        <el-form-item label="业务ID">
          <el-input-number v-model="form.linkedBusinessId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="归因状态">
          <el-select v-model="form.attributionStatus" style="width: 100%">
            <el-option label="已确认" value="confirmed" />
            <el-option label="推断" value="inferred" />
            <el-option label="未知" value="unknown" />
          </el-select>
        </el-form-item>
        <el-form-item label="归因置信度">
          <el-input-number v-model="form.attributionConfidence" :min="0" :max="1" :step="0.1" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" /></el-form-item>
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
import { createInteractionLink, getInteractionLinks } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatAttributionStatus, formatConfidenceScore, formatSubjectType } from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.links.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  interactionId: '',
  linkedSubjectType: '',
  linkedSubjectId: '',
  linkedBusinessType: '',
  attributionStatus: '',
});
const form = reactive({
  interactionId: 1,
  linkedSubjectType: 'customer',
  linkedSubjectId: 1,
  linkedBusinessType: '',
  linkedBusinessId: undefined as number | undefined,
  attributionStatus: 'inferred',
  attributionConfidence: 0.5,
  remark: '',
});

function attributionTagType(status?: string) {
  if (status === 'confirmed') return 'success';
  if (status === 'inferred') return 'warning';
  return 'info';
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getInteractionLinks({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      interactionId: filters.interactionId ? Number(filters.interactionId) : undefined,
      linkedSubjectType: filters.linkedSubjectType || undefined,
      linkedSubjectId: filters.linkedSubjectId ? Number(filters.linkedSubjectId) : undefined,
      linkedBusinessType: filters.linkedBusinessType || undefined,
      attributionStatus: filters.attributionStatus || undefined,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  form.interactionId = 1;
  form.linkedSubjectType = 'customer';
  form.linkedSubjectId = 1;
  form.linkedBusinessType = '';
  form.linkedBusinessId = undefined;
  form.attributionStatus = 'inferred';
  form.attributionConfidence = 0.5;
  form.remark = '';
  dialogVisible.value = true;
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.interactionId = '';
  filters.linkedSubjectType = '';
  filters.linkedSubjectId = '';
  filters.linkedBusinessType = '';
  filters.attributionStatus = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

async function handleSubmit() {
  submitting.value = true;
  try {
    await createInteractionLink({
      interactionId: form.interactionId,
      linkedSubjectType: form.linkedSubjectType,
      linkedSubjectId: form.linkedSubjectId,
      linkedBusinessType: form.linkedBusinessType || undefined,
      linkedBusinessId: form.linkedBusinessId,
      attributionStatus: form.attributionStatus,
      attributionConfidence: form.attributionConfidence,
      remark: form.remark || undefined,
    });
    ElMessage.success('关联记录创建成功');
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
