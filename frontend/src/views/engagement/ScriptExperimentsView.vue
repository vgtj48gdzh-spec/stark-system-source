<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">话术实验</div>
          <div class="subtitle">记录不同话术模板的实验分组、样本量、回复率和转化率，形成可回溯闭环。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增实验</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="实验类型">
        <el-select v-model="filters.experimentType" clearable style="width: 170px">
          <el-option label="手工跟进实验" value="manual_followup" />
          <el-option label="福利提醒实验" value="benefit_notice" />
          <el-option label="内容跟进实验" value="content_followup" />
        </el-select>
      </el-form-item>
      <el-form-item label="推荐类型">
        <el-select v-model="filters.recommendationType" clearable style="width: 180px">
          <el-option label="内容推荐" value="content_recommendation" />
          <el-option label="跟进推荐" value="followup_recommendation" />
          <el-option label="话术推荐" value="script_recommendation" />
          <el-option label="福利提醒推荐" value="benefit_reminder_recommendation" />
          <el-option label="客户兴趣推荐" value="customer_interest_recommendation" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" clearable style="width: 130px">
          <el-option label="草稿" value="draft" />
          <el-option label="进行中" value="running" />
          <el-option label="已完成" value="completed" />
          <el-option label="已暂停" value="paused" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="experimentCode" label="实验编码" min-width="150" show-overflow-tooltip />
      <el-table-column prop="experimentName" label="实验名称" min-width="180" show-overflow-tooltip />
      <el-table-column label="实验类型" width="150">
        <template #default="{ row }">{{ formatScriptExperimentType(row.experimentType) }}</template>
      </el-table-column>
      <el-table-column label="推荐类型" min-width="150">
        <template #default="{ row }">{{ formatRecommendationType(row.recommendationType) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'completed' ? 'success' : row.status === 'running' ? 'warning' : 'info'">
            {{ formatScriptExperimentStatus(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="templateCount" label="模板数" width="90" />
      <el-table-column prop="businessDomain" label="业务域" min-width="120" show-overflow-tooltip />
      <el-table-column prop="hypothesis" label="实验假设" min-width="220" show-overflow-tooltip />
      <el-table-column label="时间范围" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.startAt" /> ~ <ReadableDateTime :value="row.endAt" />
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.updatedAt" /></template>
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

    <el-dialog v-model="createDialogVisible" title="新增话术实验" width="760px">
      <el-form label-width="120px">
        <el-form-item label="实验编码"><el-input v-model="createForm.experimentCode" /></el-form-item>
        <el-form-item label="实验名称"><el-input v-model="createForm.experimentName" /></el-form-item>
        <el-form-item label="实验类型">
          <el-select v-model="createForm.experimentType" style="width: 100%">
            <el-option label="手工跟进实验" value="manual_followup" />
            <el-option label="福利提醒实验" value="benefit_notice" />
            <el-option label="内容跟进实验" value="content_followup" />
          </el-select>
        </el-form-item>
        <el-form-item label="推荐类型">
          <el-select v-model="createForm.recommendationType" clearable style="width: 100%">
            <el-option label="内容推荐" value="content_recommendation" />
            <el-option label="跟进推荐" value="followup_recommendation" />
            <el-option label="话术推荐" value="script_recommendation" />
            <el-option label="福利提醒推荐" value="benefit_reminder_recommendation" />
            <el-option label="客户兴趣推荐" value="customer_interest_recommendation" />
          </el-select>
        </el-form-item>
        <el-form-item label="主体类型">
          <el-select v-model="createForm.subjectType" clearable style="width: 100%">
            <el-option label="客户" value="customer" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务域"><el-input v-model="createForm.businessDomain" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="createForm.status" style="width: 100%">
            <el-option label="草稿" value="draft" />
            <el-option label="进行中" value="running" />
            <el-option label="已完成" value="completed" />
            <el-option label="已暂停" value="paused" />
          </el-select>
        </el-form-item>
        <el-form-item label="实验假设"><el-input v-model="createForm.hypothesis" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="createForm.startAt" type="datetime" style="width: 100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="createForm.endAt" type="datetime" style="width: 100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="话术模板">
          <el-select v-model="createForm.templateIds" multiple filterable style="width: 100%">
            <el-option
              v-for="item in templateOptions"
              :key="item.id"
              :label="`${item.templateCode} / ${item.templateName}`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="扩展信息">
          <el-input v-model="createForm.normalizedPayloadText" type="textarea" :rows="4" placeholder="可填 JSON" />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="createForm.remark" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="实验详情" width="980px">
      <template v-if="detailData">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="实验编码">{{ detailData.experimentCode }}</el-descriptions-item>
          <el-descriptions-item label="实验名称">{{ detailData.experimentName }}</el-descriptions-item>
          <el-descriptions-item label="实验类型">{{ formatScriptExperimentType(detailData.experimentType) }}</el-descriptions-item>
          <el-descriptions-item label="推荐类型">{{ formatRecommendationType(detailData.recommendationType) }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ formatScriptExperimentStatus(detailData.status) }}</el-descriptions-item>
          <el-descriptions-item label="模板数">{{ detailData.templateCount }}</el-descriptions-item>
          <el-descriptions-item label="实验假设" :span="2">{{ detailData.hypothesis || '-' }}</el-descriptions-item>
          <el-descriptions-item label="开始时间"><ReadableDateTime :value="detailData.startAt" /></el-descriptions-item>
          <el-descriptions-item label="结束时间"><ReadableDateTime :value="detailData.endAt" /></el-descriptions-item>
        </el-descriptions>

        <div class="section-title">实验结果</div>
        <el-table :data="detailData.results || []">
          <el-table-column prop="templateCode" label="模板编码" min-width="140" show-overflow-tooltip />
          <el-table-column prop="templateName" label="模板名称" min-width="180" show-overflow-tooltip />
          <el-table-column label="模板分组" width="110">
            <template #default="{ row }">{{ formatScriptTemplateGroup(row.templateGroup) }}</template>
          </el-table-column>
          <el-table-column prop="sampleCount" label="样本数" width="90" />
          <el-table-column prop="followedUpCount" label="已跟进" width="90" />
          <el-table-column prop="repliedCount" label="已回复" width="90" />
          <el-table-column prop="convertedCount" label="已成交" width="90" />
          <el-table-column prop="ignoredCount" label="忽略数" width="90" />
          <el-table-column label="回复率" width="90">
            <template #default="{ row }">{{ formatConfidenceScore(row.replyRate) }}</template>
          </el-table-column>
          <el-table-column label="转化率" width="90">
            <template #default="{ row }">{{ formatConfidenceScore(row.conversionRate) }}</template>
          </el-table-column>
        </el-table>

        <div class="section-title">最近反馈</div>
        <el-table :data="detailData.recentFeedback || []">
          <el-table-column prop="id" label="反馈ID" width="90" />
          <el-table-column label="主体" min-width="130">
            <template #default="{ row }">{{ formatSubjectType(row.subjectType) }} {{ row.subjectId }}</template>
          </el-table-column>
          <el-table-column label="反馈状态" width="110">
            <template #default="{ row }">{{ formatFeedbackStatus(row.feedbackStatus) }}</template>
          </el-table-column>
          <el-table-column label="已回复" width="90">
            <template #default="{ row }">{{ row.customerRepliedFlag ? '是' : '否' }}</template>
          </el-table-column>
          <el-table-column label="已成交" width="90">
            <template #default="{ row }">{{ row.convertedFlag ? '是' : '否' }}</template>
          </el-table-column>
          <el-table-column prop="employeeRemark" label="员工备注" min-width="200" show-overflow-tooltip />
          <el-table-column label="跟进时间" min-width="200" show-overflow-tooltip>
            <template #default="{ row }"><ReadableDateTime :value="row.followupAt || row.createdAt" /></template>
          </el-table-column>
        </el-table>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { createScriptExperiment, getScriptExperiment, getScriptExperiments, getScriptTemplates } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatConfidenceScore,
  formatFeedbackStatus,
  formatRecommendationType,
  formatScriptExperimentStatus,
  formatScriptExperimentType,
  formatScriptTemplateGroup,
  formatSubjectType,
} from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const createDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const templateOptions = ref<any[]>([]);
const detailData = ref<any | null>(null);
const canManage = computed(() => hasPermission('engagement.scriptExperiments.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  experimentType: '',
  recommendationType: '',
  status: '',
});
const createForm = reactive({
  experimentCode: '',
  experimentName: '',
  experimentType: 'manual_followup',
  recommendationType: 'script_recommendation',
  subjectType: '',
  businessDomain: '',
  status: 'draft',
  hypothesis: '',
  startAt: '',
  endAt: '',
  templateIds: [] as number[],
  normalizedPayloadText: '',
  remark: '',
});

function parseJson(text: string) {
  if (!text.trim()) return undefined;
  return JSON.parse(text);
}

async function loadTemplates() {
  const { data } = await getScriptTemplates({
    page: 1,
    pageSize: 200,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    isActive: true,
  });
  templateOptions.value = data.data.list;
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getScriptExperiments({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      experimentType: filters.experimentType || undefined,
      recommendationType: filters.recommendationType || undefined,
      status: filters.status || undefined,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function resetCreateForm() {
  createForm.experimentCode = '';
  createForm.experimentName = '';
  createForm.experimentType = 'manual_followup';
  createForm.recommendationType = 'script_recommendation';
  createForm.subjectType = '';
  createForm.businessDomain = '';
  createForm.status = 'draft';
  createForm.hypothesis = '';
  createForm.startAt = '';
  createForm.endAt = '';
  createForm.templateIds = [];
  createForm.normalizedPayloadText = '';
  createForm.remark = '';
}

async function openCreateDialog() {
  resetCreateForm();
  await loadTemplates();
  createDialogVisible.value = true;
}

async function submitCreate() {
  submitting.value = true;
  try {
    await createScriptExperiment({
      experimentCode: createForm.experimentCode,
      experimentName: createForm.experimentName,
      experimentType: createForm.experimentType,
      recommendationType: createForm.recommendationType || undefined,
      subjectType: createForm.subjectType || undefined,
      businessDomain: createForm.businessDomain || undefined,
      status: createForm.status,
      hypothesis: createForm.hypothesis || undefined,
      startAt: createForm.startAt || undefined,
      endAt: createForm.endAt || undefined,
      templateIds: createForm.templateIds,
      normalizedPayload: parseJson(createForm.normalizedPayloadText),
      remark: createForm.remark || undefined,
    });
    ElMessage.success('话术实验创建成功');
    createDialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('保存失败，请检查输入内容');
  } finally {
    submitting.value = false;
  }
}

async function openDetailDialog(id: number) {
  const { data } = await getScriptExperiment(id);
  detailData.value = data.data;
  detailDialogVisible.value = true;
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.experimentType = '';
  filters.recommendationType = '';
  filters.status = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

onMounted(async () => {
  await loadData();
  await loadTemplates();
});
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

.section-title {
  margin: 20px 0 10px;
  font-size: 14px;
  font-weight: 600;
}
</style>
