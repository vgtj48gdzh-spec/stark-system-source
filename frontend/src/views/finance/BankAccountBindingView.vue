<template>
  <div class="page-stack">
    <el-alert
      v-if="pageError"
      type="error"
      :closable="false"
      show-icon
      class="page-alert"
      :title="pageError"
    />

    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">财务中心 / 银行账户绑定</div>
            <div class="subtitle">
              先把“银行 + 发送方 + 账户尾号”绑定到“公司 + 虚拟账户”。未绑定短信只留在待绑定池，不进入正式财务统计。
            </div>
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" @click="openCreateDialog">新增绑定</el-button>
            <el-button @click="loadPage">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="12">
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">绑定总数</div>
            <div class="metric-value">{{ pagination.total }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">待绑定短信</div>
            <div class="metric-value warning">{{ pendingPagination.total }}</div>
          </div>
        </el-col>
      </el-row>

      <el-alert type="info" :closable="false" class="page-alert" show-icon>
        <template #title>绑定增强说明</template>
        <div>
          微信商户结算账户通过“微信商户登记 -> 结算银行账户”完成挂接，当前银行账户绑定页继续负责银行维度的主绑定。
        </div>
      </el-alert>
    </el-card>

    <el-card>
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="公司 ID">
          <el-input v-model="filters.companyId" clearable placeholder="例如 7" />
        </el-form-item>
        <el-form-item label="银行">
          <el-input v-model="filters.bankName" clearable placeholder="例如 中国银行" />
        </el-form-item>
        <el-form-item label="发送方">
          <el-input v-model="filters.smsSender" clearable placeholder="例如 95566" />
        </el-form-item>
        <el-form-item label="账户尾号">
          <el-input v-model="filters.accountTail" clearable placeholder="例如 8030" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" clearable placeholder="全部状态" style="width: 140px">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-header">
          <span>绑定列表</span>
          <span class="section-meta">当前页 {{ tableData.length }} 条</span>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无银行账户绑定">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="companyId" label="公司 ID" width="100" />
        <el-table-column prop="bankName" label="银行" width="140" />
        <el-table-column prop="smsSender" label="发送方" width="110" />
        <el-table-column prop="accountTail" label="尾号" width="100" />
        <el-table-column prop="accountAlias" label="账户别名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="virtualLedgerId" label="虚拟账户" width="120" />
        <el-table-column label="设备 / SIM" min-width="160">
          <template #default="{ row }">
            <div>{{ row.deviceId || '-' }}</div>
            <div class="muted-text">SIM {{ row.simSlot ?? '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="action-row">
              <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
              <el-button link type="success" @click="rebindHistory(row.id)">回填历史短信</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          layout="total, sizes, prev, pager, next"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="loadBindings"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-header">
          <span>待绑定银行短信</span>
          <span class="section-meta">未绑定短信不进入正式财务统计</span>
        </div>
      </template>

      <el-table :data="pendingMessages" v-loading="loadingPending" empty-text="暂无待绑定银行短信">
        <el-table-column prop="id" label="流水 ID" width="90" />
        <el-table-column prop="bankName" label="银行" width="140" />
        <el-table-column prop="sender" label="发送方" width="110" />
        <el-table-column prop="accountTail" label="尾号" width="100" />
        <el-table-column prop="deviceId" label="设备" min-width="160" show-overflow-tooltip />
        <el-table-column prop="simSlot" label="SIM" width="80" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="reconcileStatus" label="状态" width="140" />
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pendingPagination.page"
          v-model:page-size="pendingPagination.pageSize"
          layout="total, sizes, prev, pager, next"
          :total="pendingPagination.total"
          :page-sizes="[10, 20, 50]"
          @current-change="loadPendingMessages"
          @size-change="handlePendingSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '新增绑定' : '编辑绑定'" width="720px">
      <el-form :model="formState" label-width="120px">
        <el-form-item label="公司 ID">
          <el-input-number v-model="formState.companyId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="银行">
          <el-input v-model="formState.bankName" />
        </el-form-item>
        <el-form-item label="发送方">
          <el-input v-model="formState.smsSender" />
        </el-form-item>
        <el-form-item label="账户尾号">
          <el-input v-model="formState.accountTail" />
        </el-form-item>
        <el-form-item label="账户别名">
          <el-input v-model="formState.accountAlias" />
        </el-form-item>
        <el-form-item label="账户户名">
          <el-input v-model="formState.accountHolder" />
        </el-form-item>
        <el-form-item label="虚拟账户 ID">
          <el-input-number v-model="formState.virtualLedgerId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="设备 ID">
          <el-input v-model="formState.deviceId" />
        </el-form-item>
        <el-form-item label="SIM 卡槽">
          <el-input-number v-model="formState.simSlot" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="formState.status" style="width: 100%">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存并回填</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import {
  createBankAccountRegistry,
  getBankAccountRegistries,
  getPendingBankAccountMessages,
  rebindBankAccountRegistryHistory,
  updateBankAccountRegistry,
} from '../../api/finance-bank-account';
import { formatMoney } from '../../utils/format';

const silentRequestConfig = {
  headers: {
    'x-suppress-global-error': '1',
  },
};

const loading = ref(false);
const loadingPending = ref(false);
const pageError = ref('');
const tableData = ref<any[]>([]);
const pendingMessages = ref<any[]>([]);
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const editingId = ref<number | null>(null);

const filters = reactive({
  companyId: '',
  bankName: '',
  smsSender: '',
  accountTail: '',
  status: '' as '' | 'active' | 'inactive',
});
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});
const pendingPagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});
const formState = reactive<any>({
  companyId: 7,
  bankName: '中国银行',
  smsSender: '95566',
  accountTail: '',
  accountAlias: '',
  accountHolder: '',
  virtualLedgerId: undefined,
  deviceId: '',
  simSlot: undefined,
  status: 'active',
});

async function loadBindings() {
  loading.value = true;
  try {
    const { data } = await getBankAccountRegistries(
      {
        page: pagination.page,
        pageSize: pagination.pageSize,
        companyId: filters.companyId ? Number(filters.companyId) : undefined,
        bankName: filters.bankName || undefined,
        smsSender: filters.smsSender || undefined,
        accountTail: filters.accountTail || undefined,
        status: filters.status || undefined,
      },
      silentRequestConfig,
    );

    tableData.value = data.data.list || [];
    pagination.total = data.data.total || 0;
  } catch (error: any) {
    pageError.value = error.response?.data?.message || '银行账户绑定页加载失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function loadPendingMessages() {
  loadingPending.value = true;
  try {
    const { data } = await getPendingBankAccountMessages(
      {
        page: pendingPagination.page,
        pageSize: pendingPagination.pageSize,
        bankName: filters.bankName || undefined,
        smsSender: filters.smsSender || undefined,
        accountTail: filters.accountTail || undefined,
      },
      silentRequestConfig,
    );
    pendingMessages.value = data.data.list || [];
    pendingPagination.total = data.data.total || 0;
  } catch (error: any) {
    pageError.value = error.response?.data?.message || '待绑定银行短信加载失败，请稍后重试。';
  } finally {
    loadingPending.value = false;
  }
}

async function loadPage() {
  pageError.value = '';
  await Promise.all([loadBindings(), loadPendingMessages()]);
}

function openCreateDialog() {
  dialogMode.value = 'create';
  editingId.value = null;
  Object.assign(formState, {
    companyId: 7,
    bankName: '中国银行',
    smsSender: '95566',
    accountTail: '',
    accountAlias: '',
    accountHolder: '',
    virtualLedgerId: undefined,
    deviceId: '',
    simSlot: undefined,
    status: 'active',
  });
  dialogVisible.value = true;
}

function openEditDialog(row: any) {
  dialogMode.value = 'edit';
  editingId.value = row.id;
  Object.assign(formState, {
    companyId: row.companyId,
    bankName: row.bankName,
    smsSender: row.smsSender,
    accountTail: row.accountTail,
    accountAlias: row.accountAlias,
    accountHolder: row.accountHolder,
    virtualLedgerId: row.virtualLedgerId || undefined,
    deviceId: row.deviceId || '',
    simSlot: row.simSlot ?? undefined,
    status: row.status,
  });
  dialogVisible.value = true;
}

async function submitForm() {
  const payload = {
    companyId: Number(formState.companyId),
    bankName: formState.bankName,
    smsSender: formState.smsSender,
    accountTail: formState.accountTail,
    accountAlias: formState.accountAlias,
    accountHolder: formState.accountHolder || undefined,
    virtualLedgerId: formState.virtualLedgerId || undefined,
    deviceId: formState.deviceId || undefined,
    simSlot: formState.simSlot ?? undefined,
    status: formState.status,
  };

  if (dialogMode.value === 'create') {
    await createBankAccountRegistry(payload as any);
    ElMessage.success('银行账户绑定已创建，并已尝试回填历史短信。');
  } else if (editingId.value) {
    await updateBankAccountRegistry(editingId.value, payload as any);
    ElMessage.success('银行账户绑定已更新，并已尝试回填历史短信。');
  }

  dialogVisible.value = false;
  await loadPage();
}

async function rebindHistory(id: number) {
  const { data } = await rebindBankAccountRegistryHistory(id);
  ElMessage.success(`已回填 ${data.data.affectedCount || 0} 条历史短信。`);
  await loadPage();
}

function handleSearch() {
  pagination.page = 1;
  pendingPagination.page = 1;
  void loadPage();
}

function handleReset() {
  filters.companyId = '';
  filters.bankName = '';
  filters.smsSender = '';
  filters.accountTail = '';
  filters.status = '';
  pagination.page = 1;
  pendingPagination.page = 1;
  void loadPage();
}

function handleSizeChange(size: number) {
  pagination.pageSize = size;
  pagination.page = 1;
  void loadBindings();
}

function handlePendingSizeChange(size: number) {
  pendingPagination.pageSize = size;
  pendingPagination.page = 1;
  void loadPendingMessages();
}

onMounted(() => {
  void loadPage();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #172033;
}

.subtitle {
  margin-top: 6px;
  color: #667085;
  line-height: 1.6;
}

.metric-card {
  height: 100%;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #f8fafc, #eef2ff);
  border: 1px solid #e2e8f0;
}

.metric-label {
  font-size: 12px;
  color: #64748b;
}

.metric-value {
  margin-top: 10px;
  font-size: 24px;
  font-weight: 700;
  color: #172033;
}

.metric-value.warning {
  color: #c2410c;
}

.page-alert {
  margin-top: 0;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-meta,
.muted-text {
  color: #667085;
  font-size: 12px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
