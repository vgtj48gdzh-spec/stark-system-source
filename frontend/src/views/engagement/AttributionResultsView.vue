<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">归因结果</div>
          <div class="subtitle">将平台互动归到客户、员工、商户或业务记录，所有推断都保留证据与置信度。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openGenerateDialog">生成归因结果</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="归因状态">
        <el-select v-model="filters.attributionStatus" clearable style="width: 130px">
          <el-option label="已确认" value="confirmed" />
          <el-option label="推断" value="inferred" />
          <el-option label="未知" value="unknown" />
        </el-select>
      </el-form-item>
      <el-form-item label="证据状态">
        <el-select v-model="filters.evidenceStatus" clearable style="width: 130px">
          <el-option label="已确认" value="confirmed" />
          <el-option label="推断" value="inferred" />
          <el-option label="待确认" value="uncertain" />
        </el-select>
      </el-form-item>
      <el-form-item label="主体类型">
        <el-select v-model="filters.attributedSubjectType" clearable style="width: 130px">
          <el-option label="客户" value="customer" />
          <el-option label="员工" value="employee" />
        </el-select>
      </el-form-item>
      <el-form-item label="业务类型">
        <el-input v-model="filters.attributedBusinessType" clearable style="width: 150px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="interactionId" label="互动ID" width="90" />
      <el-table-column label="归因状态" width="100">
        <template #default="{ row }">
          <el-tag :type="attributionTagType(row.attributionStatus)">
            {{ formatAttributionStatus(row.attributionStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="证据状态" width="100">
        <template #default="{ row }">
          <el-tag :type="evidenceTagType(row.evidenceStatus)">{{ formatEvidenceStatus(row.evidenceStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="主体" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">
          {{ formatSubjectType(row.attributedSubjectType) }} {{ row.attributedSubjectId || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="merchantId" label="商户ID" width="90" />
      <el-table-column prop="employeeId" label="员工ID" width="90" />
      <el-table-column label="业务对象" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.attributedBusinessType || '-' }} / {{ row.attributedBusinessId || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="命中规则" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tag v-if="row.ruleCode" size="small" effect="plain">{{ row.ruleCode }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="置信度" width="90">
        <template #default="{ row }">{{ formatConfidenceScore(row.confidenceScore) }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column label="更新时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.updatedAt" /></template>
      </el-table-column>
      <el-table-column v-if="canManage" label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openConfirmDialog(row)">确认</el-button>
          <el-button link type="warning" @click="openReassignDialog(row)">改归属</el-button>
          <el-button link type="danger" @click="handleReject(row)">拒绝</el-button>
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

    <el-dialog v-model="generateDialogVisible" title="生成归因结果" width="560px">
      <el-form label-width="110px">
        <el-form-item label="平台">
          <el-input v-model="generateForm.platform" placeholder="可留空" />
        </el-form-item>
        <el-form-item label="账号ID">
          <el-input v-model="generateForm.accountId" placeholder="可留空" />
        </el-form-item>
        <el-form-item label="候选类型">
          <el-select v-model="generateForm.candidateType" clearable style="width: 100%">
            <el-option label="客户候选" value="customer" />
            <el-option label="员工候选" value="employee" />
            <el-option label="商户候选" value="merchant" />
          </el-select>
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

    <el-dialog v-model="editDialogVisible" :title="editMode === 'confirm' ? '确认归因' : '改归属'" width="620px">
      <el-form label-width="120px">
        <el-form-item label="主体类型">
          <el-select v-model="editForm.attributedSubjectType" clearable style="width: 100%">
            <el-option label="客户" value="customer" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>
        <el-form-item label="主体ID">
          <el-input-number v-model="editForm.attributedSubjectId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="商户ID">
          <el-input-number v-model="editForm.merchantId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="员工ID">
          <el-input-number v-model="editForm.employeeId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="业务类型">
          <el-input v-model="editForm.attributedBusinessType" />
        </el-form-item>
        <el-form-item label="业务ID">
          <el-input v-model="editForm.attributedBusinessId" />
        </el-form-item>
        <el-form-item v-if="editMode === 'reassign'" label="归因状态">
          <el-select v-model="editForm.attributionStatus" style="width: 100%">
            <el-option label="已确认" value="confirmed" />
            <el-option label="推断" value="inferred" />
            <el-option label="未知" value="unknown" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editMode === 'reassign'" label="证据状态">
          <el-select v-model="editForm.evidenceStatus" style="width: 100%">
            <el-option label="已确认" value="confirmed" />
            <el-option label="推断" value="inferred" />
            <el-option label="待确认" value="uncertain" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitEdit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  confirmAttribution,
  generateAttributions,
  getAttributions,
  rejectAttribution,
  reassignAttribution,
} from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatAttributionStatus,
  formatConfidenceScore,
  formatEvidenceStatus,
  formatSubjectType,
} from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const generateDialogVisible = ref(false);
const editDialogVisible = ref(false);
const editMode = ref<'confirm' | 'reassign'>('confirm');
const editingId = ref<number | null>(null);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.attributions.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  attributionStatus: '',
  evidenceStatus: '',
  attributedSubjectType: '',
  attributedBusinessType: '',
});
const generateForm = reactive({
  platform: '',
  accountId: '',
  candidateType: '',
  forceRegenerate: false,
});
const editForm = reactive({
  attributedSubjectType: '',
  attributedSubjectId: undefined as number | undefined,
  merchantId: undefined as number | undefined,
  employeeId: undefined as number | undefined,
  attributedBusinessType: '',
  attributedBusinessId: '',
  attributionStatus: 'confirmed',
  evidenceStatus: 'confirmed',
  remark: '',
});

function attributionTagType(status?: string) {
  if (status === 'confirmed') return 'success';
  if (status === 'inferred') return 'warning';
  return 'info';
}

function evidenceTagType(status?: string) {
  if (status === 'confirmed') return 'success';
  if (status === 'inferred') return 'warning';
  return 'info';
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getAttributions({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      attributionStatus: filters.attributionStatus || undefined,
      evidenceStatus: filters.evidenceStatus || undefined,
      attributedSubjectType: filters.attributedSubjectType || undefined,
      attributedBusinessType: filters.attributedBusinessType || undefined,
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
  filters.attributionStatus = '';
  filters.evidenceStatus = '';
  filters.attributedSubjectType = '';
  filters.attributedBusinessType = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function openGenerateDialog() {
  generateForm.platform = '';
  generateForm.accountId = '';
  generateForm.candidateType = '';
  generateForm.forceRegenerate = false;
  generateDialogVisible.value = true;
}

async function handleGenerate() {
  submitting.value = true;
  try {
    const { data } = await generateAttributions({
      platform: generateForm.platform || undefined,
      accountId: generateForm.accountId || undefined,
      candidateType: generateForm.candidateType || undefined,
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

function fillEditForm(row: any) {
  editingId.value = row.id;
  editForm.attributedSubjectType = row.attributedSubjectType || '';
  editForm.attributedSubjectId = row.attributedSubjectId || undefined;
  editForm.merchantId = row.merchantId || undefined;
  editForm.employeeId = row.employeeId || undefined;
  editForm.attributedBusinessType = row.attributedBusinessType || '';
  editForm.attributedBusinessId = row.attributedBusinessId || '';
  editForm.attributionStatus = row.attributionStatus || 'confirmed';
  editForm.evidenceStatus = row.evidenceStatus || 'confirmed';
  editForm.remark = row.remark || '';
}

function openConfirmDialog(row: any) {
  editMode.value = 'confirm';
  fillEditForm(row);
  editDialogVisible.value = true;
}

function openReassignDialog(row: any) {
  editMode.value = 'reassign';
  fillEditForm(row);
  editDialogVisible.value = true;
}

async function handleSubmitEdit() {
  if (!editingId.value) return;
  submitting.value = true;
  try {
    if (editMode.value === 'confirm') {
      await confirmAttribution(editingId.value, {
        attributedSubjectType: editForm.attributedSubjectType || undefined,
        attributedSubjectId: editForm.attributedSubjectId || undefined,
        merchantId: editForm.merchantId || undefined,
        employeeId: editForm.employeeId || undefined,
        attributedBusinessType: editForm.attributedBusinessType || undefined,
        attributedBusinessId: editForm.attributedBusinessId || undefined,
        remark: editForm.remark || undefined,
      });
      ElMessage.success('归因确认成功');
    } else {
      await reassignAttribution(editingId.value, {
        attributedSubjectType: editForm.attributedSubjectType || undefined,
        attributedSubjectId: editForm.attributedSubjectId || undefined,
        merchantId: editForm.merchantId || undefined,
        employeeId: editForm.employeeId || undefined,
        attributedBusinessType: editForm.attributedBusinessType || undefined,
        attributedBusinessId: editForm.attributedBusinessId || undefined,
        attributionStatus: editForm.attributionStatus,
        evidenceStatus: editForm.evidenceStatus,
        remark: editForm.remark || undefined,
      });
      ElMessage.success('归属调整成功');
    }
    editDialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('保存失败，请稍后重试');
  } finally {
    submitting.value = false;
  }
}

async function handleReject(row: any) {
  try {
    const { value } = await ElMessageBox.prompt('请输入拒绝原因', '拒绝归因', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPlaceholder: '可选备注',
    });
    await rejectAttribution(row.id, {
      remark: value || undefined,
    });
    ElMessage.success('归因已拒绝');
    await loadData();
  } catch {
    // user cancelled
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
