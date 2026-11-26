<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">执行方案</div>
          <div class="subtitle">管理 AI 推荐进入人工确认执行层的场景、渠道、默认话术和启停状态。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openDialog()">新增执行方案</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="场景编码">
        <el-input v-model="filters.scenarioCode" clearable style="width: 180px" />
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
      <el-form-item label="业务域">
        <el-input v-model="filters.businessDomain" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="playbookCode" label="方案编码" min-width="160" show-overflow-tooltip />
      <el-table-column prop="playbookName" label="方案名称" min-width="180" show-overflow-tooltip />
      <el-table-column label="场景" min-width="150">
        <template #default="{ row }">{{ formatExecutionScenario(row.scenarioCode, row.scenarioName) }}</template>
      </el-table-column>
      <el-table-column label="推荐类型" min-width="150">
        <template #default="{ row }">{{ formatRecommendationType(row.recommendationType) }}</template>
      </el-table-column>
      <el-table-column prop="targetSubjectType" label="主体类型" width="100">
        <template #default="{ row }">{{ formatSubjectType(row.targetSubjectType) }}</template>
      </el-table-column>
      <el-table-column prop="businessDomain" label="业务域" min-width="120" show-overflow-tooltip />
      <el-table-column prop="merchantId" label="商户ID" width="90" />
      <el-table-column prop="executionChannel" label="执行渠道" min-width="120" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
      <el-table-column label="更新时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.updatedAt" /></template>
      </el-table-column>
      <el-table-column v-if="canManage" label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link :type="row.isActive ? 'warning' : 'success'" @click="toggleRow(row)">
            {{ row.isActive ? '停用' : '启用' }}
          </el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑执行方案' : '新增执行方案'" width="760px">
      <el-form label-width="120px">
        <el-form-item label="方案编码"><el-input v-model="form.playbookCode" /></el-form-item>
        <el-form-item label="方案名称"><el-input v-model="form.playbookName" /></el-form-item>
        <el-form-item label="场景编码"><el-input v-model="form.scenarioCode" /></el-form-item>
        <el-form-item label="场景名称"><el-input v-model="form.scenarioName" /></el-form-item>
        <el-form-item label="推荐类型">
          <el-select v-model="form.recommendationType" style="width: 100%">
            <el-option label="内容推荐" value="content_recommendation" />
            <el-option label="跟进推荐" value="followup_recommendation" />
            <el-option label="话术推荐" value="script_recommendation" />
            <el-option label="福利提醒推荐" value="benefit_reminder_recommendation" />
            <el-option label="客户兴趣推荐" value="customer_interest_recommendation" />
          </el-select>
        </el-form-item>
        <el-form-item label="主体类型">
          <el-select v-model="form.targetSubjectType" clearable style="width: 100%">
            <el-option label="客户" value="customer" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务域"><el-input v-model="form.businessDomain" /></el-form-item>
        <el-form-item label="商户ID"><el-input-number v-model="form.merchantId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="规则ID"><el-input-number v-model="form.recommendationRuleId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="默认模板ID"><el-input-number v-model="form.defaultScriptTemplateId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="执行渠道"><el-input v-model="form.executionChannel" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.isActive" /></el-form-item>
        <el-form-item label="扩展信息">
          <el-input v-model="form.normalizedPayloadText" type="textarea" :rows="4" placeholder="可填 JSON" />
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  createExecutionPlaybook,
  getExecutionPlaybooks,
  toggleExecutionPlaybook,
  updateExecutionPlaybook,
} from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatExecutionScenario,
  formatRecommendationType,
  formatSubjectType,
} from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.executionPlaybooks.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  scenarioCode: '',
  recommendationType: '',
  businessDomain: '',
});
const form = reactive({
  id: 0,
  playbookCode: '',
  playbookName: '',
  scenarioCode: '',
  scenarioName: '',
  recommendationType: 'script_recommendation',
  targetSubjectType: '',
  businessDomain: '',
  merchantId: undefined as number | undefined,
  recommendationRuleId: undefined as number | undefined,
  defaultScriptTemplateId: undefined as number | undefined,
  executionChannel: 'manual_followup',
  description: '',
  isActive: true,
  normalizedPayloadText: '',
});

function parseJson(text: string) {
  if (!text.trim()) return undefined;
  return JSON.parse(text);
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getExecutionPlaybooks({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      scenarioCode: filters.scenarioCode || undefined,
      recommendationType: filters.recommendationType || undefined,
      businessDomain: filters.businessDomain || undefined,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.id = 0;
  form.playbookCode = '';
  form.playbookName = '';
  form.scenarioCode = '';
  form.scenarioName = '';
  form.recommendationType = 'script_recommendation';
  form.targetSubjectType = '';
  form.businessDomain = '';
  form.merchantId = undefined;
  form.recommendationRuleId = undefined;
  form.defaultScriptTemplateId = undefined;
  form.executionChannel = 'manual_followup';
  form.description = '';
  form.isActive = true;
  form.normalizedPayloadText = '';
}

function openDialog(row?: any) {
  resetForm();
  if (row) {
    form.id = row.id;
    form.playbookCode = row.playbookCode;
    form.playbookName = row.playbookName;
    form.scenarioCode = row.scenarioCode;
    form.scenarioName = row.scenarioName;
    form.recommendationType = row.recommendationType;
    form.targetSubjectType = row.targetSubjectType || '';
    form.businessDomain = row.businessDomain || '';
    form.merchantId = row.merchantId || undefined;
    form.recommendationRuleId = row.recommendationRuleId || undefined;
    form.defaultScriptTemplateId = row.defaultScriptTemplateId || undefined;
    form.executionChannel = row.executionChannel || 'manual_followup';
    form.description = row.description || '';
    form.isActive = Boolean(row.isActive);
    form.normalizedPayloadText = row.normalizedPayload ? JSON.stringify(row.normalizedPayload, null, 2) : '';
  }
  dialogVisible.value = true;
}

async function submitForm() {
  submitting.value = true;
  try {
    const payload = {
      playbookCode: form.playbookCode,
      playbookName: form.playbookName,
      scenarioCode: form.scenarioCode,
      scenarioName: form.scenarioName,
      recommendationType: form.recommendationType,
      targetSubjectType: form.targetSubjectType || undefined,
      businessDomain: form.businessDomain || undefined,
      merchantId: form.merchantId,
      recommendationRuleId: form.recommendationRuleId,
      defaultScriptTemplateId: form.defaultScriptTemplateId,
      executionChannel: form.executionChannel || undefined,
      description: form.description || undefined,
      isActive: form.isActive,
      normalizedPayload: parseJson(form.normalizedPayloadText),
    };
    if (form.id) {
      await updateExecutionPlaybook(form.id, payload);
      ElMessage.success('执行方案已更新');
    } else {
      await createExecutionPlaybook(payload);
      ElMessage.success('执行方案已创建');
    }
    dialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('保存失败，请检查输入内容');
  } finally {
    submitting.value = false;
  }
}

async function toggleRow(row: any) {
  await toggleExecutionPlaybook(row.id, { isActive: !row.isActive });
  ElMessage.success(row.isActive ? '执行方案已停用' : '执行方案已启用');
  await loadData();
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.scenarioCode = '';
  filters.recommendationType = '';
  filters.businessDomain = '';
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
