<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">推荐规则</div>
          <div class="subtitle">管理 AI 推荐命中的规则、证据状态、强弱规则和推荐模板。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openDialog()">新增规则</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="推荐类型">
        <el-select v-model="filters.recommendationType" clearable style="width: 180px">
          <el-option label="内容推荐" value="content_recommendation" />
          <el-option label="跟进推荐" value="followup_recommendation" />
          <el-option label="话术推荐" value="script_recommendation" />
          <el-option label="福利提醒推荐" value="benefit_reminder_recommendation" />
          <el-option label="客户兴趣推荐" value="customer_interest_recommendation" />
        </el-select>
      </el-form-item>
      <el-form-item label="主体类型">
        <el-select v-model="filters.subjectType" clearable style="width: 140px">
          <el-option label="客户" value="customer" />
          <el-option label="员工" value="employee" />
        </el-select>
      </el-form-item>
      <el-form-item label="业务域">
        <el-input v-model="filters.businessDomain" clearable style="width: 160px" />
      </el-form-item>
      <el-form-item label="状态">
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
      <el-table-column prop="ruleCode" label="规则编码" min-width="180" show-overflow-tooltip />
      <el-table-column prop="ruleName" label="规则名称" min-width="180" show-overflow-tooltip />
      <el-table-column label="推荐类型" min-width="150">
        <template #default="{ row }">{{ formatRecommendationType(row.recommendationType) }}</template>
      </el-table-column>
      <el-table-column label="主体类型" width="100">
        <template #default="{ row }">{{ formatSubjectType(row.subjectType) }}</template>
      </el-table-column>
      <el-table-column prop="businessDomain" label="业务域" min-width="140" show-overflow-tooltip />
      <el-table-column prop="triggerMemoryType" label="触发记忆类型" min-width="150" show-overflow-tooltip />
      <el-table-column prop="triggerInteractionType" label="触发互动类型" min-width="150" show-overflow-tooltip />
      <el-table-column label="证据状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.evidenceStatus === 'confirmed' ? 'success' : row.evidenceStatus === 'inferred' ? 'warning' : 'info'">
            {{ formatEvidenceStatus(row.evidenceStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="置信度" width="90">
        <template #default="{ row }">{{ formatConfidenceScore(row.confidenceScore) }}</template>
      </el-table-column>
      <el-table-column label="规则强度" width="100">
        <template #default="{ row }">
          <el-tag :type="row.ruleStrength === 'strong' ? 'success' : 'warning'">
            {{ formatRuleStrength(row.ruleStrength) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑推荐规则' : '新增推荐规则'" width="760px">
      <el-form label-width="120px">
        <el-form-item label="规则编码"><el-input v-model="form.ruleCode" /></el-form-item>
        <el-form-item label="规则名称"><el-input v-model="form.ruleName" /></el-form-item>
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
          <el-select v-model="form.subjectType" clearable style="width: 100%">
            <el-option label="客户" value="customer" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务域"><el-input v-model="form.businessDomain" /></el-form-item>
        <el-form-item label="触发记忆类型"><el-input v-model="form.triggerMemoryType" /></el-form-item>
        <el-form-item label="触发互动类型"><el-input v-model="form.triggerInteractionType" /></el-form-item>
        <el-form-item label="证据状态">
          <el-select v-model="form.evidenceStatus" style="width: 100%">
            <el-option label="已确认" value="confirmed" />
            <el-option label="推断" value="inferred" />
            <el-option label="待确认" value="uncertain" />
          </el-select>
        </el-form-item>
        <el-form-item label="置信度">
          <el-input-number
            v-model="form.confidenceScore"
            :min="0"
            :max="1"
            :step="0.1"
            :precision="2"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="规则强度">
          <el-select v-model="form.ruleStrength" style="width: 100%">
            <el-option label="强规则" value="strong" />
            <el-option label="弱规则" value="weak" />
          </el-select>
        </el-form-item>
        <el-form-item label="匹配条件">
          <el-input v-model="form.matchConditionsText" type="textarea" :rows="4" placeholder="可填 JSON" />
        </el-form-item>
        <el-form-item label="推荐模板">
          <el-input v-model="form.recommendationTemplate" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.isActive" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" /></el-form-item>
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
  createRecommendationRule,
  getRecommendationRules,
  toggleRecommendationRule,
  updateRecommendationRule,
} from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatConfidenceScore,
  formatEvidenceStatus,
  formatRecommendationType,
  formatRuleStrength,
  formatSubjectType,
} from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.recommendationRules.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  recommendationType: '',
  subjectType: '',
  businessDomain: '',
  isActive: undefined as boolean | undefined,
});
const form = reactive({
  id: 0,
  ruleCode: '',
  ruleName: '',
  recommendationType: 'followup_recommendation',
  subjectType: '',
  businessDomain: '',
  triggerMemoryType: '',
  triggerInteractionType: '',
  evidenceStatus: 'confirmed',
  confidenceScore: 0.8,
  ruleStrength: 'strong',
  matchConditionsText: '',
  recommendationTemplate: '',
  isActive: true,
  remark: '',
});

function parseJson(text: string) {
  if (!text.trim()) return undefined;
  return JSON.parse(text);
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getRecommendationRules({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      recommendationType: filters.recommendationType || undefined,
      subjectType: filters.subjectType || undefined,
      businessDomain: filters.businessDomain || undefined,
      isActive: filters.isActive,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.id = 0;
  form.ruleCode = '';
  form.ruleName = '';
  form.recommendationType = 'followup_recommendation';
  form.subjectType = '';
  form.businessDomain = '';
  form.triggerMemoryType = '';
  form.triggerInteractionType = '';
  form.evidenceStatus = 'confirmed';
  form.confidenceScore = 0.8;
  form.ruleStrength = 'strong';
  form.matchConditionsText = '';
  form.recommendationTemplate = '';
  form.isActive = true;
  form.remark = '';
}

function openDialog(row?: any) {
  resetForm();
  if (row) {
    form.id = row.id;
    form.ruleCode = row.ruleCode;
    form.ruleName = row.ruleName;
    form.recommendationType = row.recommendationType;
    form.subjectType = row.subjectType || '';
    form.businessDomain = row.businessDomain || '';
    form.triggerMemoryType = row.triggerMemoryType || '';
    form.triggerInteractionType = row.triggerInteractionType || '';
    form.evidenceStatus = row.evidenceStatus;
    form.confidenceScore = Number(row.confidenceScore ?? 0.8);
    form.ruleStrength = row.ruleStrength;
    form.matchConditionsText = row.matchConditions ? JSON.stringify(row.matchConditions, null, 2) : '';
    form.recommendationTemplate = row.recommendationTemplate || '';
    form.isActive = row.isActive;
    form.remark = row.remark || '';
  }
  dialogVisible.value = true;
}

async function submitForm() {
  submitting.value = true;
  try {
    const payload = {
      ruleCode: form.ruleCode,
      ruleName: form.ruleName,
      recommendationType: form.recommendationType,
      subjectType: form.subjectType || undefined,
      businessDomain: form.businessDomain || undefined,
      triggerMemoryType: form.triggerMemoryType || undefined,
      triggerInteractionType: form.triggerInteractionType || undefined,
      evidenceStatus: form.evidenceStatus,
      confidenceScore: form.confidenceScore,
      ruleStrength: form.ruleStrength,
      matchConditions: parseJson(form.matchConditionsText),
      recommendationTemplate: form.recommendationTemplate || undefined,
      isActive: form.isActive,
      remark: form.remark || undefined,
    };

    if (form.id) {
      await updateRecommendationRule(form.id, payload);
      ElMessage.success('推荐规则更新成功');
    } else {
      await createRecommendationRule(payload);
      ElMessage.success('推荐规则创建成功');
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
  await toggleRecommendationRule(row.id, { isActive: !row.isActive });
  ElMessage.success(`规则已${row.isActive ? '停用' : '启用'}`);
  await loadData();
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.recommendationType = '';
  filters.subjectType = '';
  filters.businessDomain = '';
  filters.isActive = undefined;
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
