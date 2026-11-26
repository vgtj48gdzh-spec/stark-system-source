<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">绩效规则</div>
          <div class="subtitle">定义事件归类、是否计入绩效、默认权重系数，以及是否需要人工确认。</div>
        </div>
        <el-button v-if="canManageRules" type="primary" @click="openDialog()">新增规则</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="来源域">
        <el-select v-model="filters.sourceDomain" clearable style="width: 180px">
          <el-option v-for="item in sourceDomains" :key="item" :label="formatPerformanceDomain(item)" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="事件类型">
        <el-input v-model="filters.eventType" clearable style="width: 200px" />
      </el-form-item>
      <el-form-item label="归类键">
        <el-input v-model="filters.classificationKey" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="是否启用">
        <el-select v-model="filters.isActive" clearable style="width: 140px">
          <el-option label="启用" :value="true" />
          <el-option label="停用" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item label="计入绩效">
        <el-select v-model="filters.includeInPerformance" clearable style="width: 140px">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item label="需人工确认">
        <el-select v-model="filters.requiresManualConfirmation" clearable style="width: 140px">
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
      <el-table-column label="来源域" min-width="120">
        <template #default="{ row }">{{ formatPerformanceDomain(row.sourceDomain) }}</template>
      </el-table-column>
      <el-table-column prop="eventType" label="事件类型" min-width="180" show-overflow-tooltip />
      <el-table-column prop="ruleCode" label="规则编码" min-width="170" show-overflow-tooltip />
      <el-table-column prop="ruleName" label="规则名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="classificationKey" label="归类键" min-width="120" show-overflow-tooltip />
      <el-table-column label="计入绩效" width="100">
        <template #default="{ row }">
          <el-tag :type="row.includeInPerformance ? 'success' : 'info'">
            {{ row.includeInPerformance ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="defaultWeight" label="默认权重" width="100" align="right" />
      <el-table-column prop="defaultCoefficient" label="默认系数" width="100" align="right" />
      <el-table-column label="人工确认" width="100">
        <template #default="{ row }">
          <el-tag :type="row.requiresManualConfirmation ? 'warning' : 'success'">
            {{ row.requiresManualConfirmation ? '需要' : '不需要' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'info'">
            {{ row.isActive ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
      <el-table-column label="更新时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.updatedAt" />
        </template>
      </el-table-column>
      <el-table-column v-if="canManageRules" label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-space>
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link :type="row.isActive ? 'warning' : 'success'" @click="toggleRule(row)">
              {{ row.isActive ? '停用' : '启用' }}
            </el-button>
          </el-space>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑规则' : '新增规则'" width="720px">
      <el-form label-width="120px">
        <el-form-item label="来源域">
          <el-select v-model="form.sourceDomain" style="width: 100%">
            <el-option v-for="item in sourceDomains" :key="item" :label="formatPerformanceDomain(item)" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="事件类型">
          <el-input v-model="form.eventType" />
        </el-form-item>
        <el-form-item label="规则编码">
          <el-input v-model="form.ruleCode" />
        </el-form-item>
        <el-form-item label="规则名称">
          <el-input v-model="form.ruleName" />
        </el-form-item>
        <el-form-item label="归类键">
          <el-input v-model="form.classificationKey" />
        </el-form-item>
        <el-form-item label="计入绩效">
          <el-switch v-model="form.includeInPerformance" />
        </el-form-item>
        <el-form-item label="默认权重">
          <el-input v-model="form.defaultWeight" />
        </el-form-item>
        <el-form-item label="默认系数">
          <el-input v-model="form.defaultCoefficient" />
        </el-form-item>
        <el-form-item label="需人工确认">
          <el-switch v-model="form.requiresManualConfirmation" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.isActive" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitRule">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { createPerformanceRule, getPerformanceRules, updatePerformanceRule } from '../../api/performance';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { hasPermission } from '../../utils/permissions';
import { formatPerformanceDomain } from '../../utils/performance';

const sourceDomains = ['work_orders', 'orders', 'funds', 'cards'];
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const query = reactive({
  page: 1,
  pageSize: 10,
});
const filters = reactive({
  sourceDomain: '',
  eventType: '',
  classificationKey: '',
  isActive: undefined as boolean | undefined,
  includeInPerformance: undefined as boolean | undefined,
  requiresManualConfirmation: undefined as boolean | undefined,
});
const form = reactive({
  id: 0,
  sourceDomain: 'orders',
  eventType: '',
  ruleCode: '',
  ruleName: '',
  classificationKey: '',
  includeInPerformance: true,
  defaultWeight: '1.00',
  defaultCoefficient: '1.00',
  requiresManualConfirmation: false,
  isActive: true,
  remark: '',
});

const canManageRules = computed(() => hasPermission('performance.rules.manage'));

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPerformanceRules({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      sourceDomain: filters.sourceDomain || undefined,
      eventType: filters.eventType || undefined,
      classificationKey: filters.classificationKey || undefined,
      isActive: filters.isActive,
      includeInPerformance: filters.includeInPerformance,
      requiresManualConfirmation: filters.requiresManualConfirmation,
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

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function resetFilters() {
  filters.sourceDomain = '';
  filters.eventType = '';
  filters.classificationKey = '';
  filters.isActive = undefined;
  filters.includeInPerformance = undefined;
  filters.requiresManualConfirmation = undefined;
  handleSearch();
}

function resetForm() {
  form.id = 0;
  form.sourceDomain = 'orders';
  form.eventType = '';
  form.ruleCode = '';
  form.ruleName = '';
  form.classificationKey = '';
  form.includeInPerformance = true;
  form.defaultWeight = '1.00';
  form.defaultCoefficient = '1.00';
  form.requiresManualConfirmation = false;
  form.isActive = true;
  form.remark = '';
}

function openDialog(row?: any) {
  resetForm();
  if (row) {
    form.id = row.id;
    form.sourceDomain = row.sourceDomain;
    form.eventType = row.eventType;
    form.ruleCode = row.ruleCode;
    form.ruleName = row.ruleName;
    form.classificationKey = row.classificationKey;
    form.includeInPerformance = row.includeInPerformance;
    form.defaultWeight = row.defaultWeight;
    form.defaultCoefficient = row.defaultCoefficient;
    form.requiresManualConfirmation = row.requiresManualConfirmation;
    form.isActive = row.isActive;
    form.remark = row.remark || '';
  }
  dialogVisible.value = true;
}

async function submitRule() {
  saving.value = true;
  try {
    const payload = {
      sourceDomain: form.sourceDomain,
      eventType: form.eventType,
      ruleCode: form.ruleCode,
      ruleName: form.ruleName,
      classificationKey: form.classificationKey,
      includeInPerformance: form.includeInPerformance,
      defaultWeight: form.defaultWeight,
      defaultCoefficient: form.defaultCoefficient,
      requiresManualConfirmation: form.requiresManualConfirmation,
      isActive: form.isActive,
      remark: form.remark || undefined,
    };

    if (form.id) {
      await updatePerformanceRule(form.id, payload);
      ElMessage.success('绩效规则更新成功');
    } else {
      await createPerformanceRule(payload);
      ElMessage.success('绩效规则创建成功');
    }

    dialogVisible.value = false;
    await loadData();
  } finally {
    saving.value = false;
  }
}

async function toggleRule(row: any) {
  await updatePerformanceRule(row.id, {
    isActive: !row.isActive,
  });
  ElMessage.success(`规则已${row.isActive ? '停用' : '启用'}`);
  await loadData();
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
