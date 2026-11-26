<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">员工绑定管理</div>
            <div class="subtitle">
              维护员工主数据与来源绑定，优先按手机号沉淀员工主档，避免后续工资和核对场景重复识别。
            </div>
          </div>
          <el-space>
            <el-button
              v-if="canGenerateEvents"
              type="primary"
              :loading="eventGenerating"
              @click="handleGenerateEvents"
            >
              重新生成绩效事件
            </el-button>
            <el-button
              v-if="canGenerateSummaries"
              type="success"
              :loading="summaryGenerating"
              @click="handleGenerateSummaries"
            >
              重新生成月度汇总
            </el-button>
          </el-space>
        </div>
      </template>

      <el-row :gutter="16">
        <el-col :xs="24" :xl="11">
          <el-card shadow="never">
            <template #header>
              <div class="section-header">
                <div class="section-title">员工列表</div>
                <el-button v-if="canManageBindings" type="primary" @click="openEmployeeDialog()">
                  新增员工
                </el-button>
              </div>
            </template>

            <el-form inline class="filters">
              <el-form-item label="关键词">
                <el-input v-model="employeeFilters.keyword" clearable style="width: 220px" />
              </el-form-item>
              <el-form-item label="状态">
                <el-select v-model="employeeFilters.status" clearable style="width: 140px">
                  <el-option label="启用" :value="1" />
                  <el-option label="停用" :value="0" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="searchEmployees">查询</el-button>
              </el-form-item>
            </el-form>

            <el-table :data="employeeTableData" v-loading="employeeLoading">
              <el-table-column prop="name" label="真实姓名" min-width="120" show-overflow-tooltip />
              <el-table-column prop="nameRemark" label="姓名备注" min-width="120" show-overflow-tooltip />
              <el-table-column prop="mobile" label="员工手机号" min-width="150" show-overflow-tooltip />
              <el-table-column
                prop="companyName"
                label="所属公司"
                min-width="180"
                show-overflow-tooltip
              />
              <el-table-column
                prop="positionName"
                label="岗位"
                min-width="140"
                show-overflow-tooltip
              />
              <el-table-column
                prop="importBatchNo"
                label="导入批次"
                min-width="160"
                show-overflow-tooltip
              />
              <el-table-column prop="linkedUserName" label="关联用户" min-width="140" show-overflow-tooltip />
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag :type="row.status === 1 ? 'success' : 'info'">
                    {{ formatStatusFlag(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                prop="importConflictNote"
                label="冲突说明"
                min-width="220"
                show-overflow-tooltip
              />
              <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
              <el-table-column label="操作" width="90">
                <template #default="{ row }">
                  <el-button v-if="canManageBindings" link type="primary" @click="openEmployeeDialog(row)">
                    编辑
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <el-pagination
              class="pager"
              background
              layout="total, prev, pager, next"
              :total="employeeTotal"
              :page-size="employeeQuery.pageSize"
              :current-page="employeeQuery.page"
              @current-change="handleEmployeePageChange"
            />
          </el-card>
        </el-col>

        <el-col :xs="24" :xl="13">
          <el-card shadow="never">
            <template #header>
              <div class="section-header">
                <div class="section-title">来源绑定列表</div>
                <el-button v-if="canManageBindings" type="primary" @click="openBindingDialog()">
                  新增绑定
                </el-button>
              </div>
            </template>

            <el-form inline class="filters">
              <el-form-item label="来源系统">
                <el-input v-model="bindingFilters.sourceSystem" clearable style="width: 140px" />
              </el-form-item>
              <el-form-item label="来源表">
                <el-input v-model="bindingFilters.sourceTable" clearable style="width: 180px" />
              </el-form-item>
              <el-form-item label="绑定类型">
                <el-select v-model="bindingFilters.bindingType" clearable style="width: 160px">
                  <el-option label="用户" value="user" />
                  <el-option label="商户" value="merchant" />
                  <el-option label="手机号" value="mobile" />
                </el-select>
              </el-form-item>
              <el-form-item label="启用状态">
                <el-select v-model="bindingFilters.isActive" clearable style="width: 140px">
                  <el-option label="启用" :value="true" />
                  <el-option label="停用" :value="false" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="searchBindings">查询</el-button>
              </el-form-item>
            </el-form>

            <el-table :data="bindingTableData" v-loading="bindingLoading">
              <el-table-column label="员工" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">
                  <div>{{ row.employeeName || '-' }}</div>
                  <div class="subtle-text">{{ row.employeeNameRemark || row.employeeDisplayName || '-' }}</div>
                </template>
              </el-table-column>
              <el-table-column
                prop="employeeMobile"
                label="员工手机号"
                min-width="150"
                show-overflow-tooltip
              />
              <el-table-column
                prop="employeeCompanyName"
                label="所属公司"
                min-width="160"
                show-overflow-tooltip
              />
              <el-table-column
                prop="employeePositionName"
                label="岗位"
                min-width="120"
                show-overflow-tooltip
              />
              <el-table-column prop="sourceSystem" label="来源系统" min-width="100" />
              <el-table-column prop="sourceTable" label="来源表" min-width="160" show-overflow-tooltip />
              <el-table-column prop="sourceId" label="来源 ID" min-width="120" show-overflow-tooltip />
              <el-table-column label="绑定类型" width="100">
                <template #default="{ row }">{{ formatBindingType(row.bindingType) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag :type="row.isActive ? 'success' : 'info'">
                    {{ row.isActive ? '启用' : '停用' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
              <el-table-column label="操作" width="90">
                <template #default="{ row }">
                  <el-button v-if="canManageBindings" link type="primary" @click="openBindingDialog(row)">
                    编辑
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <el-pagination
              class="pager"
              background
              layout="total, prev, pager, next"
              :total="bindingTotal"
              :page-size="bindingQuery.pageSize"
              :current-page="bindingQuery.page"
              @current-change="handleBindingPageChange"
            />
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <el-dialog v-model="employeeDialogVisible" :title="employeeForm.id ? '编辑员工' : '新增员工'" width="720px">
      <el-form label-width="110px">
        <el-form-item label="员工姓名">
          <el-input v-model="employeeForm.name" />
        </el-form-item>
        <el-form-item label="姓名备注">
          <el-input v-model="employeeForm.nameRemark" placeholder="如：保洁" />
        </el-form-item>
        <el-form-item label="关联用户 ID">
          <el-input-number v-model="employeeForm.linkedUserId" :min="1" />
        </el-form-item>
        <el-form-item label="员工手机号">
          <el-input v-model="employeeForm.mobile" />
        </el-form-item>
        <el-form-item label="所属公司">
          <el-input v-model="employeeForm.companyName" />
        </el-form-item>
        <el-form-item label="岗位">
          <el-input v-model="employeeForm.positionName" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="employeeForm.status">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="employeeForm.remark" type="textarea" :rows="3" />
        </el-form-item>
        <el-divider content-position="left">导入上下文</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="导入批次">
            {{ employeeForm.importBatchNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="导入时间">
            <ReadableDateTime :value="employeeForm.importedAt" />
          </el-descriptions-item>
          <el-descriptions-item label="来源文件">
            {{ employeeForm.sourceFileName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="来源行号">
            {{ employeeForm.sourceRowIndex || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="冲突说明" :span="2">
            {{ employeeForm.importConflictNote || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-form>
      <template #footer>
        <el-button @click="employeeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="employeeSaving" @click="submitEmployee">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="bindingDialogVisible" :title="bindingForm.id ? '编辑绑定' : '新增绑定'" width="620px">
      <el-form label-width="100px">
        <el-form-item label="员工">
          <el-select v-model="bindingForm.employeeId" filterable style="width: 100%">
            <el-option
              v-for="item in employeeOptions"
              :key="item.id"
              :label="item.displayName || item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="来源系统">
          <el-input v-model="bindingForm.sourceSystem" />
        </el-form-item>
        <el-form-item label="来源表">
          <el-input v-model="bindingForm.sourceTable" />
        </el-form-item>
        <el-form-item label="来源 ID">
          <el-input v-model="bindingForm.sourceId" />
        </el-form-item>
        <el-form-item label="绑定类型">
          <el-select v-model="bindingForm.bindingType">
            <el-option label="用户" value="user" />
            <el-option label="商户" value="merchant" />
            <el-option label="手机号" value="mobile" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="bindingForm.isActive" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="bindingForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindingDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="bindingSaving" @click="submitBinding">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  createEmployee,
  createEmployeeSourceBinding,
  generatePerformanceEvents,
  generatePerformanceSummaries,
  getEmployees,
  getEmployeeSourceBindings,
  updateEmployee,
  updateEmployeeSourceBinding,
} from '../../api/performance';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatBindingType, formatStatusFlag } from '../../utils/performance';
import { hasPermission } from '../../utils/permissions';

const employeeLoading = ref(false);
const employeeSaving = ref(false);
const employeeDialogVisible = ref(false);
const employeeTableData = ref<any[]>([]);
const employeeOptions = ref<any[]>([]);
const employeeTotal = ref(0);
const employeeQuery = reactive({ page: 1, pageSize: 10 });
const employeeFilters = reactive({ keyword: '', status: undefined as number | undefined });
const employeeForm = reactive({
  id: 0,
  name: '',
  nameRemark: '',
  linkedUserId: undefined as number | undefined,
  mobile: '',
  companyName: '',
  positionName: '',
  status: 1,
  remark: '',
  sourceFileName: '',
  sourceRowIndex: undefined as number | undefined,
  importedAt: '',
  importBatchNo: '',
  importConflictNote: '',
});

const bindingLoading = ref(false);
const bindingSaving = ref(false);
const bindingDialogVisible = ref(false);
const bindingTableData = ref<any[]>([]);
const bindingTotal = ref(0);
const bindingQuery = reactive({ page: 1, pageSize: 10 });
const bindingFilters = reactive({
  sourceSystem: '',
  sourceTable: '',
  bindingType: '',
  isActive: undefined as boolean | undefined,
});
const bindingForm = reactive({
  id: 0,
  employeeId: undefined as number | undefined,
  sourceSystem: 'ABC',
  sourceTable: '',
  sourceId: '',
  bindingType: 'user',
  isActive: true,
  remark: '',
});

const eventGenerating = ref(false);
const summaryGenerating = ref(false);
const canManageBindings = computed(() => hasPermission('performance.bindings.manage'));
const canGenerateEvents = computed(() => hasPermission('performance.events.generate'));
const canGenerateSummaries = computed(() => hasPermission('performance.summaries.generate'));

async function loadEmployees() {
  employeeLoading.value = true;
  try {
    const { data } = await getEmployees({
      page: employeeQuery.page,
      pageSize: employeeQuery.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      keyword: employeeFilters.keyword || undefined,
      status: employeeFilters.status,
    });
    employeeTableData.value = data.data.list;
    employeeTotal.value = data.data.total;

    const optionsResponse = await getEmployees({
      page: 1,
      pageSize: 100,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      status: 1,
    });
    employeeOptions.value = optionsResponse.data.data.list;
  } finally {
    employeeLoading.value = false;
  }
}

async function loadBindings() {
  bindingLoading.value = true;
  try {
    const { data } = await getEmployeeSourceBindings({
      page: bindingQuery.page,
      pageSize: bindingQuery.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      sourceSystem: bindingFilters.sourceSystem || undefined,
      sourceTable: bindingFilters.sourceTable || undefined,
      bindingType: bindingFilters.bindingType || undefined,
      isActive: bindingFilters.isActive,
    });
    bindingTableData.value = data.data.list;
    bindingTotal.value = data.data.total;
  } finally {
    bindingLoading.value = false;
  }
}

function searchEmployees() {
  employeeQuery.page = 1;
  loadEmployees();
}

function searchBindings() {
  bindingQuery.page = 1;
  loadBindings();
}

function handleEmployeePageChange(page: number) {
  employeeQuery.page = page;
  loadEmployees();
}

function handleBindingPageChange(page: number) {
  bindingQuery.page = page;
  loadBindings();
}

function resetEmployeeForm() {
  employeeForm.id = 0;
  employeeForm.name = '';
  employeeForm.nameRemark = '';
  employeeForm.linkedUserId = undefined;
  employeeForm.mobile = '';
  employeeForm.companyName = '';
  employeeForm.positionName = '';
  employeeForm.status = 1;
  employeeForm.remark = '';
  employeeForm.sourceFileName = '';
  employeeForm.sourceRowIndex = undefined;
  employeeForm.importedAt = '';
  employeeForm.importBatchNo = '';
  employeeForm.importConflictNote = '';
}

function openEmployeeDialog(row?: any) {
  resetEmployeeForm();
  if (row) {
    employeeForm.id = row.id;
    employeeForm.name = row.name;
    employeeForm.nameRemark = row.nameRemark || '';
    employeeForm.linkedUserId = row.linkedUserId ?? undefined;
    employeeForm.mobile = row.mobile || '';
    employeeForm.companyName = row.companyName || '';
    employeeForm.positionName = row.positionName || '';
    employeeForm.status = row.status;
    employeeForm.remark = row.remark || '';
    employeeForm.sourceFileName = row.sourceFileName || '';
    employeeForm.sourceRowIndex = row.sourceRowIndex ?? undefined;
    employeeForm.importedAt = row.importedAt || '';
    employeeForm.importBatchNo = row.importBatchNo || '';
    employeeForm.importConflictNote = row.importConflictNote || '';
  }
  employeeDialogVisible.value = true;
}

function resetBindingForm() {
  bindingForm.id = 0;
  bindingForm.employeeId = undefined;
  bindingForm.sourceSystem = 'ABC';
  bindingForm.sourceTable = '';
  bindingForm.sourceId = '';
  bindingForm.bindingType = 'user';
  bindingForm.isActive = true;
  bindingForm.remark = '';
}

function openBindingDialog(row?: any) {
  resetBindingForm();
  if (row) {
    bindingForm.id = row.id;
    bindingForm.employeeId = row.employeeId;
    bindingForm.sourceSystem = row.sourceSystem;
    bindingForm.sourceTable = row.sourceTable;
    bindingForm.sourceId = row.sourceId;
    bindingForm.bindingType = row.bindingType;
    bindingForm.isActive = row.isActive;
    bindingForm.remark = row.remark || '';
  }
  bindingDialogVisible.value = true;
}

async function submitEmployee() {
  employeeSaving.value = true;
  try {
    const payload = {
      name: employeeForm.name,
      nameRemark: employeeForm.nameRemark || undefined,
      linkedUserId: employeeForm.linkedUserId,
      mobile: employeeForm.mobile || undefined,
      companyName: employeeForm.companyName || undefined,
      positionName: employeeForm.positionName || undefined,
      status: employeeForm.status,
      remark: employeeForm.remark || undefined,
    };
    if (employeeForm.id) {
      await updateEmployee(employeeForm.id, payload);
      ElMessage.success('员工更新成功');
    } else {
      await createEmployee(payload);
      ElMessage.success('员工创建成功');
    }
    employeeDialogVisible.value = false;
    await loadEmployees();
  } finally {
    employeeSaving.value = false;
  }
}

async function submitBinding() {
  bindingSaving.value = true;
  try {
    const payload = {
      employeeId: bindingForm.employeeId,
      sourceSystem: bindingForm.sourceSystem,
      sourceTable: bindingForm.sourceTable,
      sourceId: bindingForm.sourceId,
      bindingType: bindingForm.bindingType,
      isActive: bindingForm.isActive,
      remark: bindingForm.remark || undefined,
    };
    if (bindingForm.id) {
      await updateEmployeeSourceBinding(bindingForm.id, payload);
      ElMessage.success('绑定更新成功');
    } else {
      await createEmployeeSourceBinding(payload);
      ElMessage.success('绑定创建成功');
    }
    bindingDialogVisible.value = false;
    await loadBindings();
  } finally {
    bindingSaving.value = false;
  }
}

async function handleGenerateEvents() {
  eventGenerating.value = true;
  try {
    const { data } = await generatePerformanceEvents({});
    ElMessage.success(
      `绩效事件已重跑，生成 ${data.data.totalGenerated} 条，新增 ${data.data.totalCreated} 条，更新 ${data.data.totalUpdated} 条`,
    );
  } finally {
    eventGenerating.value = false;
  }
}

async function handleGenerateSummaries() {
  summaryGenerating.value = true;
  try {
    const { data } = await generatePerformanceSummaries({});
    ElMessage.success(`月度汇总已重跑，生成 ${data.data.generatedSummaryCount} 条汇总记录`);
  } finally {
    summaryGenerating.value = false;
  }
}

onMounted(async () => {
  await loadEmployees();
  await loadBindings();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.header-row,
.section-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
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

.subtle-text {
  font-size: 12px;
  color: #6b7280;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
}

.filters {
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
