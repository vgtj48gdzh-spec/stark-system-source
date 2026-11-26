<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">平台线索</div>
          <div class="subtitle">记录导入后的平台线索主体、归因状态、证据等级与关联业务上下文。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增线索</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="平台">
        <el-input v-model="filters.platform" clearable style="width: 140px" />
      </el-form-item>
      <el-form-item label="账号ID">
        <el-input v-model="filters.accountId" clearable style="width: 150px" />
      </el-form-item>
      <el-form-item label="线索状态">
        <el-select v-model="filters.leadStatus" clearable style="width: 150px">
          <el-option label="已确认" value="confirmed" />
          <el-option label="推断" value="inferred" />
          <el-option label="待确认" value="unknown" />
        </el-select>
      </el-form-item>
      <el-form-item label="证据状态">
        <el-select v-model="filters.evidenceStatus" clearable style="width: 150px">
          <el-option label="已确认" value="confirmed" />
          <el-option label="推断" value="inferred" />
          <el-option label="待确认" value="uncertain" />
        </el-select>
      </el-form-item>
      <el-form-item label="主体类型">
        <el-select v-model="filters.subjectType" clearable style="width: 140px">
          <el-option label="客户" value="customer" />
          <el-option label="员工" value="employee" />
        </el-select>
      </el-form-item>
      <el-form-item label="活动ID">
        <el-input v-model="filters.campaignId" clearable style="width: 150px" />
      </el-form-item>
      <el-form-item label="内容ID">
        <el-input v-model="filters.contentId" clearable style="width: 150px" />
      </el-form-item>
      <el-form-item label="商户ID">
        <el-input-number v-model="filters.merchantId" :min="1" style="width: 140px" />
      </el-form-item>
      <el-form-item label="导入批次">
        <el-input-number v-model="filters.importBatchId" :min="1" style="width: 140px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="id" label="线索ID" width="90" />
      <el-table-column label="平台" width="100">
        <template #default="{ row }">{{ formatPlatform(row.platform) }}</template>
      </el-table-column>
      <el-table-column prop="accountId" label="账号ID" min-width="140" show-overflow-tooltip />
      <el-table-column prop="leadRef" label="线索引用" min-width="140" show-overflow-tooltip />
      <el-table-column prop="leadType" label="线索类型" min-width="120" show-overflow-tooltip />
      <el-table-column label="归因状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.leadStatus === 'confirmed' ? 'success' : row.leadStatus === 'inferred' ? 'warning' : 'info'">
            {{ formatPlatformLeadStatus(row.leadStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="证据状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.evidenceStatus === 'confirmed' ? 'success' : row.evidenceStatus === 'inferred' ? 'warning' : 'info'">
            {{ formatEvidenceStatus(row.evidenceStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="置信度" width="100">
        <template #default="{ row }">{{ formatConfidenceScore(row.confidenceScore) }}</template>
      </el-table-column>
      <el-table-column prop="subjectType" label="主体类型" width="100">
        <template #default="{ row }">{{ formatSubjectType(row.subjectType) }}</template>
      </el-table-column>
      <el-table-column prop="subjectId" label="主体ID" width="90" />
      <el-table-column prop="merchantId" label="商户ID" width="90" />
      <el-table-column prop="employeeId" label="员工ID" width="90" />
      <el-table-column label="来源内容" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.campaignId || '-' }} / {{ row.contentId || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="业务归属" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.linkedBusinessType || '-' }} / {{ row.linkedBusinessId || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="追溯" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          批次 {{ row.importBatchId || '-' }}
          <div class="sub-cell">{{ row.sourceFile || '-' }}</div>
        </template>
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

    <el-dialog v-model="dialogVisible" title="新增平台线索" width="720px">
      <el-form label-width="110px">
        <el-form-item label="平台"><el-input v-model="form.platform" /></el-form-item>
        <el-form-item label="账号ID"><el-input v-model="form.accountId" /></el-form-item>
        <el-form-item label="线索引用"><el-input v-model="form.leadRef" /></el-form-item>
        <el-form-item label="活动ID"><el-input v-model="form.campaignId" /></el-form-item>
        <el-form-item label="内容ID"><el-input v-model="form.contentId" /></el-form-item>
        <el-form-item label="互动ID"><el-input-number v-model="form.interactionId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="线索类型"><el-input v-model="form.leadType" /></el-form-item>
        <el-form-item label="线索状态">
          <el-select v-model="form.leadStatus" style="width: 100%">
            <el-option label="已确认" value="confirmed" />
            <el-option label="推断" value="inferred" />
            <el-option label="待确认" value="unknown" />
          </el-select>
        </el-form-item>
        <el-form-item label="线索内容"><el-input v-model="form.leadValue" /></el-form-item>
        <el-form-item label="联系方式"><el-input v-model="form.sourceContactRef" /></el-form-item>
        <el-form-item label="主体类型">
          <el-select v-model="form.subjectType" clearable style="width: 100%">
            <el-option label="客户" value="customer" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>
        <el-form-item label="主体ID"><el-input-number v-model="form.subjectId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="商户ID"><el-input-number v-model="form.merchantId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="员工ID"><el-input-number v-model="form.employeeId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="业务类型"><el-input v-model="form.linkedBusinessType" /></el-form-item>
        <el-form-item label="业务ID"><el-input v-model="form.linkedBusinessId" /></el-form-item>
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
        <el-form-item label="规则编码"><el-input v-model="form.ruleCode" /></el-form-item>
        <el-form-item label="匹配字段">
          <el-input v-model="form.matchedFieldsText" type="textarea" :rows="3" placeholder="可填 JSON" />
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
import { createPlatformLeadEntry, getPlatformLeads } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatConfidenceScore,
  formatEvidenceStatus,
  formatPlatform,
  formatPlatformLeadStatus,
  formatSubjectType,
} from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.platformLeads.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  platform: '',
  accountId: '',
  leadStatus: '',
  evidenceStatus: '',
  subjectType: '',
  campaignId: '',
  contentId: '',
  merchantId: undefined as number | undefined,
  importBatchId: undefined as number | undefined,
});
const form = reactive({
  platform: '',
  accountId: '',
  leadRef: '',
  campaignId: '',
  contentId: '',
  interactionId: undefined as number | undefined,
  leadType: '',
  leadStatus: 'unknown',
  leadValue: '',
  sourceContactRef: '',
  subjectType: '',
  subjectId: undefined as number | undefined,
  merchantId: undefined as number | undefined,
  employeeId: undefined as number | undefined,
  customerId: undefined as number | undefined,
  linkedBusinessType: '',
  linkedBusinessId: '',
  evidenceStatus: 'uncertain',
  confidenceScore: 0.5,
  ruleCode: '',
  matchedFieldsText: '',
  remark: '',
});

function parseJson(text: string) {
  if (!text.trim()) return undefined;
  return JSON.parse(text);
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPlatformLeads({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      platform: filters.platform || undefined,
      accountId: filters.accountId || undefined,
      leadStatus: filters.leadStatus || undefined,
      evidenceStatus: filters.evidenceStatus || undefined,
      subjectType: filters.subjectType || undefined,
      campaignId: filters.campaignId || undefined,
      contentId: filters.contentId || undefined,
      merchantId: filters.merchantId,
      importBatchId: filters.importBatchId,
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
  filters.accountId = '';
  filters.leadStatus = '';
  filters.evidenceStatus = '';
  filters.subjectType = '';
  filters.campaignId = '';
  filters.contentId = '';
  filters.merchantId = undefined;
  filters.importBatchId = undefined;
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function openCreateDialog() {
  form.platform = '';
  form.accountId = '';
  form.leadRef = '';
  form.campaignId = '';
  form.contentId = '';
  form.interactionId = undefined;
  form.leadType = '';
  form.leadStatus = 'unknown';
  form.leadValue = '';
  form.sourceContactRef = '';
  form.subjectType = '';
  form.subjectId = undefined;
  form.merchantId = undefined;
  form.employeeId = undefined;
  form.customerId = undefined;
  form.linkedBusinessType = '';
  form.linkedBusinessId = '';
  form.evidenceStatus = 'uncertain';
  form.confidenceScore = 0.5;
  form.ruleCode = '';
  form.matchedFieldsText = '';
  form.remark = '';
  dialogVisible.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    await createPlatformLeadEntry({
      platform: form.platform,
      accountId: form.accountId,
      leadRef: form.leadRef,
      campaignId: form.campaignId || undefined,
      contentId: form.contentId || undefined,
      interactionId: form.interactionId,
      leadType: form.leadType || undefined,
      leadStatus: form.leadStatus,
      leadValue: form.leadValue || undefined,
      sourceContactRef: form.sourceContactRef || undefined,
      subjectType: form.subjectType || undefined,
      subjectId: form.subjectId,
      merchantId: form.merchantId,
      employeeId: form.employeeId,
      customerId: form.customerId,
      linkedBusinessType: form.linkedBusinessType || undefined,
      linkedBusinessId: form.linkedBusinessId || undefined,
      evidenceStatus: form.evidenceStatus,
      confidenceScore: form.confidenceScore.toFixed(4),
      ruleCode: form.ruleCode || undefined,
      matchedFields: parseJson(form.matchedFieldsText),
      remark: form.remark || undefined,
    });
    ElMessage.success('平台线索创建成功');
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
