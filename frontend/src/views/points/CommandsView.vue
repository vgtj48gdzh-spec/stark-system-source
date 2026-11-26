<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">积点命令</div>
            <div class="subtitle">
              查看积点草稿、人工确认、执行结果与 append-only 账本流水。
            </div>
          </div>
        </div>
      </template>

      <el-form inline class="filters">
        <el-form-item label="状态">
          <el-select v-model="filters.commandStatus" clearable style="width: 160px">
            <el-option label="草稿" value="drafted" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已执行" value="executed" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源类型">
          <el-select v-model="filters.sourceType" clearable style="width: 220px">
            <el-option label="员工月度福利" value="employee_monthly_welfare" />
            <el-option label="人工奖励" value="manual_reward" />
            <el-option label="客服补偿" value="customer_service_compensation" />
            <el-option label="AI 草拟" value="ai_assistant_draft" />
            <el-option label="纠正" value="correction" />
            <el-option label="冲销" value="reversal" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="草拟来源">
          <el-select v-model="filters.requestSource" clearable style="width: 160px">
            <el-option label="人工" value="manual" />
            <el-option label="AI 草拟" value="ai_assistant_draft" />
            <el-option label="批量母单" value="batch_draft" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="filters.ownerMobile" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header><div class="section-title">积点命令队列</div></template>

      <el-table :data="commandTable" v-loading="loading.commands" size="small">
        <el-table-column prop="id" label="命令 ID" width="90" />
        <el-table-column prop="commandStatus" label="状态" width="100" />
        <el-table-column prop="commandType" label="命令类型" width="130" />
        <el-table-column label="对象" min-width="180">
          <template #default="{ row }">
            <div>{{ row.ownerType }} / {{ row.ownerId || '-' }}</div>
            <div class="sub-cell">{{ row.ownerMobile || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="积点变动" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.changeAmount) }}</template>
        </el-table-column>
        <el-table-column prop="sourceType" label="来源类型" min-width="160" show-overflow-tooltip />
        <el-table-column prop="requestSource" label="草拟来源" width="110" />
        <el-table-column prop="providerKey" label="Provider" min-width="150" show-overflow-tooltip />
        <el-table-column label="申请 / 确认 / 执行" min-width="260">
          <template #default="{ row }">
            <div>申请：{{ row.requestedByName || '-' }} / {{ formatDateTime(row.requestedAt) }}</div>
            <div class="sub-cell">确认：{{ row.confirmedByName || '-' }} / {{ formatDateTime(row.confirmedAt) }}</div>
            <div class="sub-cell">执行：{{ row.executedByName || '-' }} / {{ formatDateTime(row.executedAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || row.reasonCode || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleOpenDetail(row)">详情</el-button>
            <el-button
              v-if="row.commandStatus === 'drafted'"
              size="small"
              type="primary"
              @click="handleConfirm(row)"
            >
              确认
            </el-button>
            <el-button
              v-if="row.commandStatus === 'confirmed'"
              size="small"
              type="success"
              @click="handleExecute(row)"
            >
              执行
            </el-button>
            <el-button
              v-if="['drafted', 'confirmed'].includes(row.commandStatus)"
              size="small"
              type="danger"
              plain
              @click="handleCancel(row)"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next"
        :total="commandTotal"
        :page-size="commandQuery.pageSize"
        :current-page="commandQuery.page"
        @current-change="handleCommandPageChange"
      />
    </el-card>

    <el-card>
      <template #header><div class="section-title">积点账本流水</div></template>

      <el-table :data="ledgerTable" v-loading="loading.ledger" size="small">
        <el-table-column prop="id" label="流水 ID" width="90" />
        <el-table-column prop="changeType" label="变动类型" width="120" />
        <el-table-column label="对象" min-width="180">
          <template #default="{ row }">
            <div>{{ row.ownerType }} / {{ row.ownerId || '-' }}</div>
            <div class="sub-cell">{{ row.ownerMobile || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="变动积点" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.changeAmount) }}</template>
        </el-table-column>
        <el-table-column label="余额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.balanceAfter) }}</template>
        </el-table-column>
        <el-table-column prop="sourceType" label="来源类型" min-width="160" show-overflow-tooltip />
        <el-table-column prop="sourceId" label="来源 ID" width="100" />
        <el-table-column label="执行信息" min-width="220">
          <template #default="{ row }">
            <div>{{ row.executedByName || '-' }}</div>
            <div class="sub-cell">{{ formatDateTime(row.executedAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="reasonCode" label="原因短码" width="140" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next"
        :total="ledgerTotal"
        :page-size="ledgerQuery.pageSize"
        :current-page="ledgerQuery.page"
        @current-change="handleLedgerPageChange"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  cancelPointsCommand,
  confirmPointsCommand,
  executePointsCommand,
  getPointsCommands,
  getPointsLedger,
} from '../../api/points';
import { formatDateTime, formatMoney } from '../../utils/format';

const router = useRouter();

const loading = reactive({
  commands: false,
  ledger: false,
});

const filters = reactive({
  commandStatus: '',
  sourceType: '',
  requestSource: '',
  ownerMobile: '',
});

const commandQuery = reactive({
  page: 1,
  pageSize: 10,
});

const ledgerQuery = reactive({
  page: 1,
  pageSize: 10,
});

const commandTable = ref<any[]>([]);
const ledgerTable = ref<any[]>([]);
const commandTotal = ref(0);
const ledgerTotal = ref(0);

function buildCommandParams() {
  return {
    page: commandQuery.page,
    pageSize: commandQuery.pageSize,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    commandStatus: filters.commandStatus || undefined,
    sourceType: filters.sourceType || undefined,
    requestSource: filters.requestSource || undefined,
    ownerMobile: filters.ownerMobile || undefined,
  };
}

function buildLedgerParams() {
  return {
    page: ledgerQuery.page,
    pageSize: ledgerQuery.pageSize,
    sortBy: 'executedAt',
    sortOrder: 'desc',
    ownerMobile: filters.ownerMobile || undefined,
  };
}

async function loadCommands() {
  loading.commands = true;
  try {
    const { data } = await getPointsCommands(buildCommandParams());
    commandTable.value = data.data.list || [];
    commandTotal.value = data.data.total || 0;
  } finally {
    loading.commands = false;
  }
}

async function loadLedger() {
  loading.ledger = true;
  try {
    const { data } = await getPointsLedger(buildLedgerParams());
    ledgerTable.value = data.data.list || [];
    ledgerTotal.value = data.data.total || 0;
  } finally {
    loading.ledger = false;
  }
}

async function loadAll() {
  await Promise.all([loadCommands(), loadLedger()]);
}

async function handleConfirm(row: any) {
  await confirmPointsCommand(row.id, {});
  ElMessage.success(`积点命令 #${row.id} 已确认`);
  await loadAll();
}

async function handleExecute(row: any) {
  await executePointsCommand(row.id, {});
  ElMessage.success(`积点命令 #${row.id} 已执行`);
  await loadAll();
}

async function handleCancel(row: any) {
  await cancelPointsCommand(row.id, {});
  ElMessage.success(`积点命令 #${row.id} 已取消`);
  await loadAll();
}

function handleSearch() {
  commandQuery.page = 1;
  ledgerQuery.page = 1;
  void loadAll();
}

function resetFilters() {
  filters.commandStatus = '';
  filters.sourceType = '';
  filters.requestSource = '';
  filters.ownerMobile = '';
  handleSearch();
}

function handleCommandPageChange(page: number) {
  commandQuery.page = page;
  void loadCommands();
}

function handleLedgerPageChange(page: number) {
  ledgerQuery.page = page;
  void loadLedger();
}

function handleOpenDetail(row: any) {
  void router.push(`/points/commands/${row.id}`);
}

onMounted(() => {
  void loadAll();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.title,
.section-title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle,
.sub-cell {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
