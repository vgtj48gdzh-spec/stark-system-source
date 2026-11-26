<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">员工福利发放单</div>
          <div class="subtitle">通过系统流程创建、确认并发放员工福利，不再依赖数据库直写。</div>
        </div>
        <el-button v-if="canCreate" type="primary" @click="openCreateDialog">新建发放单</el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="员工ID">
        <el-input-number v-model="filters.employeeId" :min="1" controls-position="right" />
      </el-form-item>
      <el-form-item label="周期">
        <el-input v-model="filters.periodKey" clearable placeholder="YYYY-MM" style="width: 120px" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" clearable style="width: 140px">
          <el-option label="草稿" value="draft" />
          <el-option label="已确认" value="confirmed" />
          <el-option label="已发放" value="issued" />
        </el-select>
      </el-form-item>
      <el-form-item label="已确认">
        <el-select v-model="filters.confirmedFlag" clearable style="width: 120px">
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
      <el-table-column prop="issueNo" label="发放单号" min-width="220" show-overflow-tooltip />
      <el-table-column prop="employeeName" label="员工" min-width="120" show-overflow-tooltip />
      <el-table-column prop="periodKey" label="周期" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="issueStatusTagType(row.status)">{{ formatIssueStatus(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="总金额" width="120" align="right">
        <template #default="{ row }">{{ formatMoney(row.totalAmount) }}</template>
      </el-table-column>
      <el-table-column prop="totalItemCount" label="明细数" width="90" align="right" />
      <el-table-column label="已确认" width="90">
        <template #default="{ row }">
          <el-tag :type="row.confirmedFlag ? 'success' : 'warning'">
            {{ row.confirmedFlag ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发放时间" width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.issuedAt" />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.createdAt" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="goToDetail(row.id)">详情</el-button>
          <el-button
            v-if="canConfirm && row.status === 'draft'"
            link
            type="success"
            @click="handleConfirm(row)"
          >
            确认
          </el-button>
          <el-button
            v-if="canIssue && row.status === 'confirmed'"
            link
            type="warning"
            @click="handleIssue(row)"
          >
            发放
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

    <el-dialog v-model="dialogVisible" title="新建福利发放单" width="900px">
      <el-form label-width="110px">
        <el-form-item label="员工">
          <el-select v-model="form.employeeId" filterable style="width: 100%">
            <el-option
              v-for="item in employeeOptions"
              :key="item.id"
              :label="`${item.name}（${item.id}）`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="周期">
          <el-input v-model="form.periodKey" placeholder="YYYY-MM" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <div class="section-header">
        <div class="section-title">福利明细</div>
        <el-button type="primary" link @click="addItem">新增明细</el-button>
      </div>

      <el-table :data="form.items" border>
        <el-table-column label="类型" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.itemType" placeholder="benefit_card" />
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.itemName" placeholder="员工福利购物卡" />
          </template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.amountStandard" :min="0" :precision="2" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="数量" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.quantityStandard" :min="1" :precision="2" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="有效天数" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.validityDays" :min="1" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="来源表" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.sourceTable" placeholder="payroll_trials" />
          </template>
        </el-table-column>
        <el-table-column label="来源ID" width="120">
          <template #default="{ row }">
            <el-input v-model="row.sourceId" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ $index }">
            <el-button link type="danger" @click="removeItem($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

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
import { useRouter } from 'vue-router';
import {
  confirmEmployeeBenefitIssue,
  createEmployeeBenefitIssue,
  getEmployeeBenefitIssues,
  issueEmployeeBenefitIssue,
} from '../../api/employee-benefits';
import { getEmployees } from '../../api/performance';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatIssueStatus, issueStatusTagType } from '../../utils/employee-benefits';
import { formatMoney } from '../../utils/format';
import { hasPermission } from '../../utils/permissions';

const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const employeeOptions = ref<any[]>([]);

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  employeeId: undefined as number | undefined,
  periodKey: '',
  status: '',
  confirmedFlag: undefined as boolean | undefined,
});

const form = reactive({
  employeeId: undefined as number | undefined,
  periodKey: new Date().toISOString().slice(0, 7),
  remark: '',
  items: [] as Array<Record<string, any>>,
});

const canCreate = computed(() => hasPermission('employeeBenefits.issues.create'));
const canConfirm = computed(() => hasPermission('employeeBenefits.issues.confirm'));
const canIssue = computed(() => hasPermission('employeeBenefits.issues.issue'));

function newItem() {
  return {
    itemType: 'benefit_card',
    itemName: '员工福利购物卡',
    amountStandard: 200,
    quantityStandard: 1,
    validityDays: 180,
    sourceSystem: 'stark',
    sourceTable: 'payroll_trials',
    sourceId: '',
    sourceOrderNo: '',
    remark: '',
  };
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getEmployeeBenefitIssues({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      employeeId: filters.employeeId,
      periodKey: filters.periodKey || undefined,
      status: filters.status || undefined,
      confirmedFlag: filters.confirmedFlag,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

async function loadEmployees() {
  const { data } = await getEmployees({
    page: 1,
    pageSize: 200,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    status: 1,
  });
  employeeOptions.value = data.data.list;
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.employeeId = undefined;
  filters.periodKey = '';
  filters.status = '';
  filters.confirmedFlag = undefined;
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function resetForm() {
  form.employeeId = undefined;
  form.periodKey = new Date().toISOString().slice(0, 7);
  form.remark = '';
  form.items = [newItem()];
}

function openCreateDialog() {
  resetForm();
  dialogVisible.value = true;
}

function addItem() {
  form.items.push(newItem());
}

function removeItem(index: number) {
  form.items.splice(index, 1);
}

async function handleSubmit() {
  submitting.value = true;
  try {
    await createEmployeeBenefitIssue({
      employeeId: form.employeeId,
      periodKey: form.periodKey,
      remark: form.remark || undefined,
      items: form.items.map((item) => ({
        ...item,
        sourceId: item.sourceId || undefined,
        sourceOrderNo: item.sourceOrderNo || undefined,
        remark: item.remark || undefined,
      })),
    });
    ElMessage.success('福利发放单创建成功');
    dialogVisible.value = false;
    await loadData();
  } finally {
    submitting.value = false;
  }
}

async function handleConfirm(row: any) {
  await confirmEmployeeBenefitIssue(row.id, {});
  ElMessage.success('福利发放单已确认');
  await loadData();
}

async function handleIssue(row: any) {
  await issueEmployeeBenefitIssue(row.id, {});
  ElMessage.success('福利已发放');
  await loadData();
}

function goToDetail(id: number) {
  router.push(`/employee-benefits/issues/${id}`);
}

onMounted(async () => {
  await Promise.all([loadEmployees(), loadData()]);
});
</script>

<style scoped>
.header-row,
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
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

.section-title {
  margin: 12px 0 8px;
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
