<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">执行任务</div>
          <div class="subtitle">从已验证有效的推荐中生成待执行任务，人工确认后再进入执行与结果回流。</div>
        </div>
        <el-button v-if="canManage" type="primary" @click="openCreateDialog">新增执行任务</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="场景编码">
        <el-input v-model="filters.scenarioCode" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="任务状态">
        <el-select v-model="filters.status" clearable style="width: 140px">
          <el-option label="草稿" value="draft" />
          <el-option label="已确认" value="confirmed" />
          <el-option label="执行中" value="running" />
          <el-option label="已完成" value="completed" />
          <el-option label="已关闭" value="closed" />
        </el-select>
      </el-form-item>
      <el-form-item label="商户ID">
        <el-input-number v-model="filters.merchantId" :min="1" style="width: 150px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="taskCode" label="任务编码" min-width="150" show-overflow-tooltip />
      <el-table-column prop="taskName" label="任务名称" min-width="180" show-overflow-tooltip />
      <el-table-column label="场景" min-width="150">
        <template #default="{ row }">{{ formatExecutionScenario(row.scenarioCode, row.scenarioName) }}</template>
      </el-table-column>
      <el-table-column prop="playbookName" label="执行方案" min-width="180" show-overflow-tooltip />
      <el-table-column label="任务状态" width="100">
        <template #default="{ row }">
          <el-tag
            :type="
              row.status === 'completed'
                ? 'success'
                : row.status === 'running'
                  ? 'warning'
                  : row.status === 'closed'
                    ? 'info'
                    : ''
            "
          >
            {{ formatExecutionTaskStatus(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="assignedTo" label="执行人ID" width="100" />
      <el-table-column prop="merchantId" label="商户ID" width="90" />
      <el-table-column prop="targetCount" label="目标数" width="90" />
      <el-table-column prop="itemCount" label="明细数" width="90" />
      <el-table-column prop="resultCount" label="结果数" width="90" />
      <el-table-column label="更新时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.updatedAt" /></template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="goToDetail(row.id)">详情</el-button>
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

    <el-dialog v-model="createDialogVisible" title="新增执行任务" width="760px">
      <el-form label-width="120px">
        <el-form-item label="任务编码"><el-input v-model="createForm.taskCode" /></el-form-item>
        <el-form-item label="任务名称"><el-input v-model="createForm.taskName" /></el-form-item>
        <el-form-item label="执行方案">
          <el-select v-model="createForm.playbookId" filterable style="width: 100%">
            <el-option
              v-for="item in playbookOptions"
              :key="item.id"
              :label="`${item.playbookCode} / ${item.playbookName}`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="执行人ID"><el-input-number v-model="createForm.assignedTo" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="商户ID"><el-input-number v-model="createForm.merchantId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="模板ID"><el-input-number v-model="createForm.scriptTemplateId" :min="1" style="width: 100%" /></el-form-item>
        <el-form-item label="推荐ID列表">
          <el-input
            v-model="createForm.recommendationIdsText"
            type="textarea"
            :rows="3"
            placeholder="可填英文逗号分隔的推荐 ID；留空时按执行方案自动挑选"
          />
        </el-form-item>
        <el-form-item label="最大数量">
          <el-input-number v-model="createForm.maxItems" :min="1" :max="50" style="width: 100%" />
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
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createExecutionTask, getExecutionPlaybooks, getExecutionTasks } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatExecutionScenario, formatExecutionTaskStatus } from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const createDialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const playbookOptions = ref<any[]>([]);
const canManage = computed(() => hasPermission('engagement.executionTasks.manage'));

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  scenarioCode: '',
  status: '',
  merchantId: undefined as number | undefined,
});
const createForm = reactive({
  taskCode: '',
  taskName: '',
  playbookId: undefined as number | undefined,
  assignedTo: undefined as number | undefined,
  merchantId: undefined as number | undefined,
  scriptTemplateId: undefined as number | undefined,
  recommendationIdsText: '',
  maxItems: 10,
  remark: '',
  normalizedPayloadText: '',
});

function parseJson(text: string) {
  if (!text.trim()) return undefined;
  return JSON.parse(text);
}

function parseIds(text: string) {
  return text
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

async function loadPlaybooks() {
  const { data } = await getExecutionPlaybooks({
    page: 1,
    pageSize: 100,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });
  playbookOptions.value = data.data.list.filter((item: any) => item.isActive);
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getExecutionTasks({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      scenarioCode: filters.scenarioCode || undefined,
      status: filters.status || undefined,
      merchantId: filters.merchantId,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function resetCreateForm() {
  createForm.taskCode = '';
  createForm.taskName = '';
  createForm.playbookId = undefined;
  createForm.assignedTo = undefined;
  createForm.merchantId = undefined;
  createForm.scriptTemplateId = undefined;
  createForm.recommendationIdsText = '';
  createForm.maxItems = 10;
  createForm.remark = '';
  createForm.normalizedPayloadText = '';
}

async function openCreateDialog() {
  resetCreateForm();
  await loadPlaybooks();
  createDialogVisible.value = true;
}

async function submitCreate() {
  submitting.value = true;
  try {
    await createExecutionTask({
      taskCode: createForm.taskCode,
      taskName: createForm.taskName,
      playbookId: createForm.playbookId,
      assignedTo: createForm.assignedTo,
      merchantId: createForm.merchantId,
      scriptTemplateId: createForm.scriptTemplateId,
      recommendationIds: parseIds(createForm.recommendationIdsText),
      maxItems: createForm.maxItems,
      remark: createForm.remark || undefined,
      normalizedPayload: parseJson(createForm.normalizedPayloadText),
    });
    ElMessage.success('执行任务已创建');
    createDialogVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('保存失败，请检查输入内容');
  } finally {
    submitting.value = false;
  }
}

function goToDetail(id: number) {
  router.push(`/engagement/execution-tasks/${id}`);
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.scenarioCode = '';
  filters.status = '';
  filters.merchantId = undefined;
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
