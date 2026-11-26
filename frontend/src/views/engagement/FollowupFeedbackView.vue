<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">跟进反馈</div>
          <div class="subtitle">记录是否已跟进、使用了哪条建议或话术、客户是否回复、是否成交，以及员工备注。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增反馈</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="实验ID">
        <el-input v-model="filters.scriptExperimentId" clearable style="width: 120px" />
      </el-form-item>
      <el-form-item label="反馈状态">
        <el-select v-model="filters.feedbackStatus" clearable style="width: 140px">
          <el-option label="已记录" value="recorded" />
          <el-option label="已忽略" value="ignored" />
          <el-option label="已复核" value="reviewed" />
        </el-select>
      </el-form-item>
      <el-form-item label="已跟进">
        <el-select v-model="filters.followedUpFlag" clearable style="width: 120px">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item label="已成交">
        <el-select v-model="filters.convertedFlag" clearable style="width: 120px">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="id" label="反馈ID" width="90" />
      <el-table-column prop="scriptExperimentId" label="实验ID" width="90" />
      <el-table-column prop="scriptTemplateId" label="模板ID" width="90" />
      <el-table-column label="主体" min-width="130">
        <template #default="{ row }">{{ formatSubjectType(row.subjectType) }} {{ row.subjectId }}</template>
      </el-table-column>
      <el-table-column prop="merchantId" label="商户ID" width="90" />
      <el-table-column prop="employeeId" label="员工ID" width="90" />
      <el-table-column label="反馈状态" width="110">
        <template #default="{ row }">{{ formatFeedbackStatus(row.feedbackStatus) }}</template>
      </el-table-column>
      <el-table-column label="已跟进" width="80">
        <template #default="{ row }">{{ row.followedUpFlag ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column label="已回复" width="80">
        <template #default="{ row }">{{ row.customerRepliedFlag ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column label="已成交" width="80">
        <template #default="{ row }">{{ row.convertedFlag ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column prop="nonConversionReason" label="未成交原因" min-width="180" show-overflow-tooltip />
      <el-table-column prop="employeeRemark" label="员工备注" min-width="200" show-overflow-tooltip />
      <el-table-column label="跟进时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.followupAt" /></template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.createdAt" /></template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetailDialog(row.id)">详情</el-button>
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

    <el-dialog v-model="createDialogVisible" title="新增跟进反馈" width="760px">
      <el-form label-width="120px">
        <el-form-item label="推荐ID"><el-input-number v-model="createForm.recommendationId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="规则ID"><el-input-number v-model="createForm.recommendationRuleId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="模板ID"><el-input-number v-model="createForm.scriptTemplateId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="实验ID"><el-input-number v-model="createForm.scriptExperimentId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="主体类型">
          <el-select v-model="createForm.subjectType" style="width: 100%">
            <el-option label="客户" value="customer" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>
        <el-form-item label="主体ID"><el-input-number v-model="createForm.subjectId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="商户ID"><el-input-number v-model="createForm.merchantId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="员工ID"><el-input-number v-model="createForm.employeeId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="业务类型"><el-input v-model="createForm.businessType" /></el-form-item>
        <el-form-item label="业务ID"><el-input-number v-model="createForm.businessId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="是否跟进"><el-switch v-model="createForm.followedUpFlag" /></el-form-item>
        <el-form-item label="跟进时间">
          <el-date-picker v-model="createForm.followupAt" type="datetime" style="width: 100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="客户已回复"><el-switch v-model="createForm.customerRepliedFlag" /></el-form-item>
        <el-form-item label="是否成交"><el-switch v-model="createForm.convertedFlag" /></el-form-item>
        <el-form-item label="未成交原因"><el-input v-model="createForm.nonConversionReason" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="员工备注"><el-input v-model="createForm.employeeRemark" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="反馈状态">
          <el-select v-model="createForm.feedbackStatus" style="width: 100%">
            <el-option label="已记录" value="recorded" />
            <el-option label="已忽略" value="ignored" />
            <el-option label="已复核" value="reviewed" />
          </el-select>
        </el-form-item>
        <el-form-item label="扩展信息">
          <el-input v-model="createForm.normalizedPayloadText" type="textarea" :rows="4" placeholder="可填 JSON" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="反馈详情" width="760px">
      <template v-if="detailData">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="反馈ID">{{ detailData.id }}</el-descriptions-item>
          <el-descriptions-item label="反馈状态">{{ formatFeedbackStatus(detailData.feedbackStatus) }}</el-descriptions-item>
          <el-descriptions-item label="主体">{{ formatSubjectType(detailData.subjectType) }} {{ detailData.subjectId }}</el-descriptions-item>
          <el-descriptions-item label="实验/模板">{{ detailData.scriptExperimentId || '-' }} / {{ detailData.scriptTemplateId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="商户ID">{{ detailData.merchantId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="员工ID">{{ detailData.employeeId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="已跟进">{{ detailData.followedUpFlag ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="客户已回复">{{ detailData.customerRepliedFlag ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="是否成交">{{ detailData.convertedFlag ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="跟进时间"><ReadableDateTime :value="detailData.followupAt" /></el-descriptions-item>
          <el-descriptions-item label="未成交原因" :span="2">{{ detailData.nonConversionReason || '-' }}</el-descriptions-item>
          <el-descriptions-item label="员工备注" :span="2">{{ detailData.employeeRemark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { createFollowupFeedback, getFollowupFeedback, getFollowupFeedbackById } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatFeedbackStatus, formatSubjectType } from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const createDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const detailData = ref<any | null>(null);
const canManage = computed(() => hasPermission('engagement.followupFeedback.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  scriptExperimentId: '',
  feedbackStatus: '',
  convertedFlag: undefined as boolean | undefined,
  followedUpFlag: undefined as boolean | undefined,
});
const createForm = reactive({
  recommendationId: undefined as number | undefined,
  recommendationRuleId: undefined as number | undefined,
  scriptTemplateId: undefined as number | undefined,
  scriptExperimentId: undefined as number | undefined,
  subjectType: 'customer',
  subjectId: undefined as number | undefined,
  merchantId: undefined as number | undefined,
  employeeId: undefined as number | undefined,
  businessType: '',
  businessId: undefined as number | undefined,
  followedUpFlag: true,
  followupAt: '',
  customerRepliedFlag: false,
  convertedFlag: false,
  nonConversionReason: '',
  employeeRemark: '',
  feedbackStatus: 'recorded',
  normalizedPayloadText: '',
});

function parseJson(text: string) {
  if (!text.trim()) return undefined;
  return JSON.parse(text);
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getFollowupFeedback({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      scriptExperimentId: filters.scriptExperimentId ? Number(filters.scriptExperimentId) : undefined,
      feedbackStatus: filters.feedbackStatus || undefined,
      convertedFlag: filters.convertedFlag,
      followedUpFlag: filters.followedUpFlag,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function resetCreateForm() {
  createForm.recommendationId = undefined;
  createForm.recommendationRuleId = undefined;
  createForm.scriptTemplateId = undefined;
  createForm.scriptExperimentId = undefined;
  createForm.subjectType = 'customer';
  createForm.subjectId = undefined;
  createForm.merchantId = undefined;
  createForm.employeeId = undefined;
  createForm.businessType = '';
  createForm.businessId = undefined;
  createForm.followedUpFlag = true;
  createForm.followupAt = '';
  createForm.customerRepliedFlag = false;
  createForm.convertedFlag = false;
  createForm.nonConversionReason = '';
  createForm.employeeRemark = '';
  createForm.feedbackStatus = 'recorded';
  createForm.normalizedPayloadText = '';
}

function openCreateDialog() {
  resetCreateForm();
  createDialogVisible.value = true;
}

async function submitCreate() {
  submitting.value = true;
  try {
    await createFollowupFeedback({
      recommendationId: createForm.recommendationId,
      recommendationRuleId: createForm.recommendationRuleId,
      scriptTemplateId: createForm.scriptTemplateId,
      scriptExperimentId: createForm.scriptExperimentId,
      subjectType: createForm.subjectType,
      subjectId: createForm.subjectId,
      merchantId: createForm.merchantId,
      employeeId: createForm.employeeId,
      businessType: createForm.businessType || undefined,
      businessId: createForm.businessId,
      followedUpFlag: createForm.followedUpFlag,
      followupAt: createForm.followupAt || undefined,
      customerRepliedFlag: createForm.customerRepliedFlag,
      convertedFlag: createForm.convertedFlag,
      nonConversionReason: createForm.nonConversionReason || undefined,
      employeeRemark: createForm.employeeRemark || undefined,
      feedbackStatus: createForm.feedbackStatus,
      normalizedPayload: parseJson(createForm.normalizedPayloadText),
    });
    ElMessage.success('跟进反馈创建成功');
    createDialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('保存失败，请检查输入内容');
  } finally {
    submitting.value = false;
  }
}

async function openDetailDialog(id: number) {
  const { data } = await getFollowupFeedbackById(id);
  detailData.value = data.data;
  detailDialogVisible.value = true;
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.scriptExperimentId = '';
  filters.feedbackStatus = '';
  filters.convertedFlag = undefined;
  filters.followedUpFlag = undefined;
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
