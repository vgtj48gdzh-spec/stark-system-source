<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">话术模板</div>
          <div class="subtitle">沉淀价格型、体验型、福利型、省钱型、服务型话术模板，用于后续实验与反馈。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openDialog()">新增模板</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="模板分组">
        <el-select v-model="filters.templateGroup" clearable style="width: 150px">
          <el-option label="价格型" value="price" />
          <el-option label="体验型" value="experience" />
          <el-option label="福利型" value="benefit" />
          <el-option label="省钱型" value="saving" />
          <el-option label="服务型" value="service" />
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
      <el-table-column prop="templateCode" label="模板编码" min-width="160" show-overflow-tooltip />
      <el-table-column prop="templateName" label="模板名称" min-width="180" show-overflow-tooltip />
      <el-table-column label="模板分组" width="110">
        <template #default="{ row }">{{ formatScriptTemplateGroup(row.templateGroup) }}</template>
      </el-table-column>
      <el-table-column label="推荐类型" min-width="150">
        <template #default="{ row }">{{ formatRecommendationType(row.recommendationType) }}</template>
      </el-table-column>
      <el-table-column prop="channel" label="适用渠道" width="120" />
      <el-table-column prop="openingText" label="开场语" min-width="180" show-overflow-tooltip />
      <el-table-column prop="scriptContent" label="核心话术" min-width="260" show-overflow-tooltip />
      <el-table-column prop="closingText" label="收尾语" min-width="180" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑话术模板' : '新增话术模板'" width="760px">
      <el-form label-width="120px">
        <el-form-item label="模板编码"><el-input v-model="form.templateCode" /></el-form-item>
        <el-form-item label="模板名称"><el-input v-model="form.templateName" /></el-form-item>
        <el-form-item label="模板分组">
          <el-select v-model="form.templateGroup" style="width: 100%">
            <el-option label="价格型" value="price" />
            <el-option label="体验型" value="experience" />
            <el-option label="福利型" value="benefit" />
            <el-option label="省钱型" value="saving" />
            <el-option label="服务型" value="service" />
          </el-select>
        </el-form-item>
        <el-form-item label="推荐类型">
          <el-select v-model="form.recommendationType" clearable style="width: 100%">
            <el-option label="内容推荐" value="content_recommendation" />
            <el-option label="跟进推荐" value="followup_recommendation" />
            <el-option label="话术推荐" value="script_recommendation" />
            <el-option label="福利提醒推荐" value="benefit_reminder_recommendation" />
            <el-option label="客户兴趣推荐" value="customer_interest_recommendation" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用渠道"><el-input v-model="form.channel" /></el-form-item>
        <el-form-item label="开场语"><el-input v-model="form.openingText" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="核心话术"><el-input v-model="form.scriptContent" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="收尾语"><el-input v-model="form.closingText" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="扩展信息">
          <el-input v-model="form.normalizedPayloadText" type="textarea" :rows="4" placeholder="可填 JSON" />
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
  createScriptTemplate,
  getScriptTemplates,
  toggleScriptTemplate,
  updateScriptTemplate,
} from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatRecommendationType, formatScriptTemplateGroup } from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const canManage = computed(() => hasPermission('engagement.scriptTemplates.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  templateGroup: '',
  recommendationType: '',
  isActive: undefined as boolean | undefined,
});
const form = reactive({
  id: 0,
  templateCode: '',
  templateName: '',
  templateGroup: 'service',
  recommendationType: '',
  channel: '',
  openingText: '',
  scriptContent: '',
  closingText: '',
  normalizedPayloadText: '',
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
    const { data } = await getScriptTemplates({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      templateGroup: filters.templateGroup || undefined,
      recommendationType: filters.recommendationType || undefined,
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
  form.templateCode = '';
  form.templateName = '';
  form.templateGroup = 'service';
  form.recommendationType = '';
  form.channel = '';
  form.openingText = '';
  form.scriptContent = '';
  form.closingText = '';
  form.normalizedPayloadText = '';
  form.isActive = true;
  form.remark = '';
}

function openDialog(row?: any) {
  resetForm();
  if (row) {
    form.id = row.id;
    form.templateCode = row.templateCode;
    form.templateName = row.templateName;
    form.templateGroup = row.templateGroup;
    form.recommendationType = row.recommendationType || '';
    form.channel = row.channel || '';
    form.openingText = row.openingText || '';
    form.scriptContent = row.scriptContent || '';
    form.closingText = row.closingText || '';
    form.normalizedPayloadText = row.normalizedPayload ? JSON.stringify(row.normalizedPayload, null, 2) : '';
    form.isActive = row.isActive;
    form.remark = row.remark || '';
  }
  dialogVisible.value = true;
}

async function submitForm() {
  submitting.value = true;
  try {
    const payload = {
      templateCode: form.templateCode,
      templateName: form.templateName,
      templateGroup: form.templateGroup,
      recommendationType: form.recommendationType || undefined,
      channel: form.channel || undefined,
      openingText: form.openingText || undefined,
      scriptContent: form.scriptContent,
      closingText: form.closingText || undefined,
      normalizedPayload: parseJson(form.normalizedPayloadText),
      isActive: form.isActive,
      remark: form.remark || undefined,
    };

    if (form.id) {
      await updateScriptTemplate(form.id, payload);
      ElMessage.success('话术模板更新成功');
    } else {
      await createScriptTemplate(payload);
      ElMessage.success('话术模板创建成功');
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
  await toggleScriptTemplate(row.id, { isActive: !row.isActive });
  ElMessage.success(`模板已${row.isActive ? '停用' : '启用'}`);
  await loadData();
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.templateGroup = '';
  filters.recommendationType = '';
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
