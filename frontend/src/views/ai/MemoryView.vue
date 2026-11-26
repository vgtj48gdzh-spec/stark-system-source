<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">AI 记忆库</div>
            <div class="subtitle">
              管理创始人记忆、岗位规则和可引用的记忆块，供页面内 AI 助手回答前检索。
            </div>
          </div>
          <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增记忆</el-button>
        </div>
      </template>

      <el-form inline class="filters">
        <el-form-item label="记忆类型">
          <el-select v-model="filters.memoryType" clearable style="width: 180px">
            <el-option label="创始人原则" value="founder_principle" />
            <el-option label="创始人偏好" value="founder_preference" />
            <el-option label="岗位规则" value="role_playbook" />
            <el-option label="推理模式" value="reasoning_pattern" />
            <el-option label="规则例外" value="rule_exception" />
            <el-option label="不可泛化案例" value="do_not_generalize_case" />
            <el-option label="语言风格" value="language_style" />
            <el-option label="术语定义" value="term_definition" />
          </el-select>
        </el-form-item>
        <el-form-item label="作用范围">
          <el-select v-model="filters.scopeType" clearable style="width: 140px">
            <el-option label="创始人" value="founder" />
            <el-option label="岗位" value="role" />
            <el-option label="全局" value="global" />
            <el-option label="场景" value="scene" />
            <el-option label="页面" value="route" />
            <el-option label="对象类型" value="entity_type" />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位">
          <el-select v-model="filters.roleScope" clearable style="width: 140px">
            <el-option label="创始人" value="founder" />
            <el-option label="财务" value="finance" />
            <el-option label="管理员" value="admin" />
            <el-option label="审批人" value="approver" />
            <el-option label="操作员" value="operator" />
            <el-option label="客服" value="customer_service" />
            <el-option label="门店负责人" value="store_manager" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-select v-model="filters.enabledFlag" clearable style="width: 120px">
            <el-option label="启用" :value="true" />
            <el-option label="停用" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="tableData" v-loading="loading">
        <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
        <el-table-column prop="memoryType" label="记忆类型" width="150" />
        <el-table-column prop="scopeType" label="作用范围" width="110" />
        <el-table-column label="岗位" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ formatArray(row.roleScope) }}</template>
        </el-table-column>
        <el-table-column prop="priorityLevel" label="优先级" width="90" />
        <el-table-column prop="generalizationMode" label="泛化模式" width="140" />
        <el-table-column prop="aiUsageMode" label="AI 使用模式" width="150" />
        <el-table-column label="启用" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabledFlag ? 'success' : 'info'">
              {{ row.enabledFlag ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canManage" link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button
              v-if="canManage"
              link
              :type="row.enabledFlag ? 'danger' : 'success'"
              @click="handleToggle(row)"
            >
              {{ row.enabledFlag ? '停用' : '启用' }}
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
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑 AI 记忆' : '新增 AI 记忆'" width="760px">
      <el-form label-width="120px">
        <el-form-item label="记忆类型">
          <el-select v-model="form.memoryType" style="width: 100%">
            <el-option label="创始人原则" value="founder_principle" />
            <el-option label="创始人偏好" value="founder_preference" />
            <el-option label="岗位规则" value="role_playbook" />
            <el-option label="推理模式" value="reasoning_pattern" />
            <el-option label="规则例外" value="rule_exception" />
            <el-option label="不可泛化案例" value="do_not_generalize_case" />
            <el-option label="语言风格" value="language_style" />
            <el-option label="术语定义" value="term_definition" />
          </el-select>
        </el-form-item>
        <el-form-item label="作用范围">
          <el-select v-model="form.scopeType" style="width: 100%">
            <el-option label="创始人" value="founder" />
            <el-option label="岗位" value="role" />
            <el-option label="全局" value="global" />
            <el-option label="场景" value="scene" />
            <el-option label="页面" value="route" />
            <el-option label="对象类型" value="entity_type" />
          </el-select>
        </el-form-item>
        <el-form-item label="作用键">
          <el-input v-model="form.scopeKey" placeholder="例如 founder / finance / /performance/summaries" />
        </el-form-item>
        <el-form-item label="岗位范围">
          <el-select v-model="form.roleScope" multiple collapse-tags style="width: 100%">
            <el-option label="创始人" value="founder" />
            <el-option label="财务" value="finance" />
            <el-option label="管理员" value="admin" />
            <el-option label="审批人" value="approver" />
            <el-option label="操作员" value="operator" />
            <el-option label="客服" value="customer_service" />
            <el-option label="门店负责人" value="store_manager" />
          </el-select>
        </el-form-item>
        <el-form-item label="场景范围">
          <el-select v-model="form.sceneScope" multiple collapse-tags style="width: 100%">
            <el-option label="全局" value="global" />
            <el-option label="客户绑定" value="customer_binding" />
            <el-option label="台账补录" value="sheet_repair" />
            <el-option label="绩效确认" value="performance_confirmation" />
            <el-option label="数据清洗" value="data_cleanup" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tagsText" placeholder="逗号分隔，例如 phone_primary,closed_loop" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priorityLevel" :min="0" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="来源类型">
          <el-input v-model="form.sourceType" />
        </el-form-item>
        <el-form-item label="泛化模式">
          <el-select v-model="form.generalizationMode" style="width: 100%">
            <el-option label="仅当前案例" value="case_only" />
            <el-option label="同类模式" value="same_pattern" />
            <el-option label="仅本岗位" value="role_only" />
            <el-option label="全局参考" value="global_reference" />
            <el-option label="不可套用" value="do_not_apply" />
          </el-select>
        </el-form-item>
        <el-form-item label="AI 使用模式">
          <el-select v-model="form.aiUsageMode" style="width: 100%">
            <el-option label="必须考虑" value="must_consider" />
            <el-option label="仅建议" value="suggest_only" />
            <el-option label="相关时引用" value="cite_when_relevant" />
            <el-option label="永不自动套用" value="never_auto_apply" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabledFlag" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  createAiMemoryEntry,
  getAiMemoryEntries,
  toggleAiMemoryEntry,
  updateAiMemoryEntry,
} from '../../api/ai';
import { formatDateTime } from '../../utils/format';
import { hasAnyRole } from '../../utils/permissions';

const canManage = computed(() => hasAnyRole(['admin', 'finance']));
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const tableData = ref<any[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 10,
});

const filters = reactive({
  memoryType: '',
  scopeType: '',
  roleScope: '',
  enabledFlag: undefined as boolean | undefined,
  keyword: '',
});

const form = reactive({
  memoryType: 'founder_principle',
  scopeType: 'founder',
  scopeKey: '',
  roleScope: [] as string[],
  sceneScope: ['global'] as string[],
  title: '',
  summary: '',
  content: '',
  tagsText: '',
  priorityLevel: 80,
  enabledFlag: true,
  sourceType: 'manual_memory',
  generalizationMode: 'case_only',
  aiUsageMode: 'cite_when_relevant',
});

function formatArray(value?: unknown) {
  return Array.isArray(value) && value.length ? value.join('、') : '-';
}

function buildPayload() {
  return {
    memoryType: form.memoryType,
    scopeType: form.scopeType,
    scopeKey: form.scopeKey || undefined,
    roleScope: form.roleScope.length ? form.roleScope : undefined,
    sceneScope: form.sceneScope.length ? form.sceneScope : undefined,
    title: form.title,
    summary: form.summary,
    content: form.content,
    tags: form.tagsText
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    priorityLevel: form.priorityLevel,
    enabledFlag: form.enabledFlag,
    sourceType: form.sourceType || undefined,
    generalizationMode: form.generalizationMode,
    aiUsageMode: form.aiUsageMode,
  };
}

function resetForm() {
  editingId.value = null;
  form.memoryType = 'founder_principle';
  form.scopeType = 'founder';
  form.scopeKey = '';
  form.roleScope = [];
  form.sceneScope = ['global'];
  form.title = '';
  form.summary = '';
  form.content = '';
  form.tagsText = '';
  form.priorityLevel = 80;
  form.enabledFlag = true;
  form.sourceType = 'manual_memory';
  form.generalizationMode = 'case_only';
  form.aiUsageMode = 'cite_when_relevant';
}

async function loadData() {
  loading.value = true;
  try {
    const response = await getAiMemoryEntries({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'priorityLevel',
      sortOrder: 'DESC',
      memoryType: filters.memoryType || undefined,
      scopeType: filters.scopeType || undefined,
      roleScope: filters.roleScope || undefined,
      enabledFlag: filters.enabledFlag,
      keyword: filters.keyword || undefined,
    });
    tableData.value = response.data.data.list || [];
    total.value = response.data.data.total || 0;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.page = 1;
  void loadData();
}

function resetFilters() {
  filters.memoryType = '';
  filters.scopeType = '';
  filters.roleScope = '';
  filters.enabledFlag = undefined;
  filters.keyword = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  void loadData();
}

function openCreateDialog() {
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(row: any) {
  editingId.value = Number(row.id);
  form.memoryType = row.memoryType;
  form.scopeType = row.scopeType;
  form.scopeKey = row.scopeKey || '';
  form.roleScope = Array.isArray(row.roleScope) ? [...row.roleScope] : [];
  form.sceneScope = Array.isArray(row.sceneScope) ? [...row.sceneScope] : ['global'];
  form.title = row.title || '';
  form.summary = row.summary || '';
  form.content = row.content || '';
  form.tagsText = Array.isArray(row.tags) ? row.tags.join(', ') : '';
  form.priorityLevel = Number(row.priorityLevel ?? 80);
  form.enabledFlag = Boolean(row.enabledFlag);
  form.sourceType = row.sourceType || 'manual_memory';
  form.generalizationMode = row.generalizationMode || 'case_only';
  form.aiUsageMode = row.aiUsageMode || 'cite_when_relevant';
  dialogVisible.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAiMemoryEntry(editingId.value, buildPayload());
      ElMessage.success('AI 记忆已更新');
    } else {
      await createAiMemoryEntry(buildPayload());
      ElMessage.success('AI 记忆已创建');
    }
    dialogVisible.value = false;
    await loadData();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

async function handleToggle(row: any) {
  const nextEnabled = !row.enabledFlag;
  await ElMessageBox.confirm(
    nextEnabled ? '确认启用这条 AI 记忆吗？' : '确认停用这条 AI 记忆吗？',
    '状态确认',
    { type: 'warning' },
  );
  await toggleAiMemoryEntry(row.id, {
    enabledFlag: nextEnabled,
    remark: nextEnabled ? '手动重新启用' : '手动停用',
  });
  ElMessage.success(nextEnabled ? '已启用' : '已停用');
  await loadData();
}

onMounted(() => {
  void loadData();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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
  margin-bottom: -8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
