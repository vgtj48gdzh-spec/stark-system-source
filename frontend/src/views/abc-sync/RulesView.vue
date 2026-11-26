<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">映射规则管理</div>
          <div class="subtitle">
            维护状态映射与金额规则，并支持按来源表手动重跑标准化任务。
          </div>
        </div>
        <el-button v-if="returnToPath" type="primary" plain @click="goBack">
          返回异常页
        </el-button>
      </div>
    </template>

    <el-alert
      v-if="activeGovernanceSourceTable"
      class="governance-alert"
      type="warning"
      :closable="false"
      :title="`当前治理来源表：${formatAbcSourceTable(activeGovernanceSourceTable)}`"
      description="保存规则后可直接重跑当前来源表；如果本页由异常清单跳转而来，重跑成功后会自动返回异常页并刷新结果。"
    />

    <el-card shadow="never" class="rerun-card">
      <template #header>
        <div class="section-title">手动重跑标准化</div>
      </template>
      <el-form inline>
        <el-form-item label="来源表">
          <el-select v-model="rerunForm.sourceTables" multiple clearable style="width: 380px">
            <el-option
              v-for="item in sourceTableOptions"
              :key="item"
              :label="formatAbcSourceTable(item)"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标域">
          <el-select v-model="rerunForm.targetDomains" multiple style="width: 280px">
            <el-option label="订单域" value="orders" />
            <el-option label="资金域" value="funds" />
            <el-option label="卡域" value="cards" />
            <el-option label="库存域" value="inventory" />
          </el-select>
        </el-form-item>
        <el-form-item label="批次号">
          <el-input v-model="rerunForm.batchNo" clearable style="width: 260px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="rerunLoading" @click="handleRerun">执行重跑</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="状态映射" name="status">
        <el-form inline class="filters">
          <el-form-item label="来源表">
            <el-select v-model="statusFilters.sourceTable" clearable style="width: 240px">
              <el-option
                v-for="item in sourceTableOptions"
                :key="item"
                :label="formatAbcSourceTable(item)"
                :value="item"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="目标域">
            <el-input v-model="statusFilters.targetDomain" clearable style="width: 220px" />
          </el-form-item>
          <el-form-item label="启用状态">
            <el-select v-model="statusFilters.isActive" clearable style="width: 180px">
              <el-option label="启用" value="true" />
              <el-option label="停用" value="false" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleStatusSearch">查询</el-button>
            <el-button @click="resetStatusFilters">重置</el-button>
            <el-button type="success" @click="openStatusDialog()">新增映射</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="statusTableData" v-loading="statusLoading">
          <el-table-column label="来源表" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ formatAbcSourceTable(row.sourceTable) }}</template>
          </el-table-column>
          <el-table-column prop="sourceField" label="来源字段" min-width="140" />
          <el-table-column prop="sourceValue" label="来源值" min-width="140" show-overflow-tooltip />
          <el-table-column label="目标域" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ formatAbcTargetDomain(row.targetDomain) }}</template>
          </el-table-column>
          <el-table-column prop="targetValue" label="目标值" min-width="160" show-overflow-tooltip />
          <el-table-column label="置信度" min-width="120">
            <template #default="{ row }">{{ formatAbcConfidence(row.confidenceLevel) }}</template>
          </el-table-column>
          <el-table-column label="启用状态" min-width="100">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'info'">
                {{ row.isActive ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" min-width="240" show-overflow-tooltip />
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-space>
                <el-button link type="primary" @click="openStatusDialog(row)">编辑</el-button>
                <el-button link type="warning" @click="toggleStatus(row)">
                  {{ row.isActive ? '停用' : '启用' }}
                </el-button>
                <el-button link type="success" @click="rerunForSourceTable(row.sourceTable)">
                  重跑
                </el-button>
              </el-space>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          class="pager"
          background
          layout="total, prev, pager, next"
          :total="statusTotal"
          :page-size="statusQuery.pageSize"
          :current-page="statusQuery.page"
          @current-change="handleStatusPageChange"
        />
      </el-tab-pane>

      <el-tab-pane label="金额规则" name="amount">
        <el-form inline class="filters">
          <el-form-item label="来源表">
            <el-select v-model="amountFilters.sourceTable" clearable style="width: 240px">
              <el-option
                v-for="item in sourceTableOptions"
                :key="item"
                :label="formatAbcSourceTable(item)"
                :value="item"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="金额字段">
            <el-input v-model="amountFilters.amountField" clearable style="width: 220px" />
          </el-form-item>
          <el-form-item label="启用状态">
            <el-select v-model="amountFilters.isActive" clearable style="width: 180px">
              <el-option label="启用" value="true" />
              <el-option label="停用" value="false" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleAmountSearch">查询</el-button>
            <el-button @click="resetAmountFilters">重置</el-button>
            <el-button type="success" @click="openAmountDialog()">新增规则</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="amountTableData" v-loading="amountLoading">
          <el-table-column label="来源表" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ formatAbcSourceTable(row.sourceTable) }}</template>
          </el-table-column>
          <el-table-column prop="amountField" label="金额字段" min-width="140" />
          <el-table-column prop="amountUnitRaw" label="原始单位" min-width="120" />
          <el-table-column label="标准单位" min-width="120">
            <template #default="{ row }">{{ formatAbcAmountUnit(row.standardUnit) }}</template>
          </el-table-column>
          <el-table-column prop="conversionRate" label="换算倍率" min-width="120" />
          <el-table-column prop="standardScale" label="小数位数" min-width="100" />
          <el-table-column label="置信度" min-width="120">
            <template #default="{ row }">{{ formatAbcConfidence(row.confidenceLevel) }}</template>
          </el-table-column>
          <el-table-column label="启用状态" min-width="100">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'info'">
                {{ row.isActive ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" min-width="240" show-overflow-tooltip />
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-space>
                <el-button link type="primary" @click="openAmountDialog(row)">编辑</el-button>
                <el-button link type="warning" @click="toggleAmount(row)">
                  {{ row.isActive ? '停用' : '启用' }}
                </el-button>
                <el-button link type="success" @click="rerunForSourceTable(row.sourceTable)">
                  重跑
                </el-button>
              </el-space>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          class="pager"
          background
          layout="total, prev, pager, next"
          :total="amountTotal"
          :page-size="amountQuery.pageSize"
          :current-page="amountQuery.page"
          @current-change="handleAmountPageChange"
        />
      </el-tab-pane>
    </el-tabs>
  </el-card>

  <el-dialog v-model="statusDialogVisible" :title="statusForm.id ? '编辑状态映射' : '新增状态映射'" width="720px">
    <el-form label-width="120px">
      <el-form-item label="来源表"><el-input v-model="statusForm.sourceTable" /></el-form-item>
      <el-form-item label="来源字段"><el-input v-model="statusForm.sourceField" /></el-form-item>
      <el-form-item label="来源值"><el-input v-model="statusForm.sourceValue" /></el-form-item>
      <el-form-item label="目标域"><el-input v-model="statusForm.targetDomain" /></el-form-item>
      <el-form-item label="目标值"><el-input v-model="statusForm.targetValue" /></el-form-item>
      <el-form-item label="置信度">
        <el-select v-model="statusForm.confidenceLevel">
          <el-option label="文档确认" value="documented" />
          <el-option label="推断" value="inferred" />
        </el-select>
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="statusForm.isActive" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="statusForm.notes" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="statusDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="statusSaving" @click="submitStatusForm(false)">保存</el-button>
      <el-button type="success" :loading="statusSaving" @click="submitStatusForm(true)">
        保存并重跑
      </el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="amountDialogVisible" :title="amountForm.id ? '编辑金额规则' : '新增金额规则'" width="720px">
    <el-form label-width="120px">
      <el-form-item label="来源表"><el-input v-model="amountForm.sourceTable" /></el-form-item>
      <el-form-item label="金额字段"><el-input v-model="amountForm.amountField" /></el-form-item>
      <el-form-item label="原始单位"><el-input v-model="amountForm.amountUnitRaw" /></el-form-item>
      <el-form-item label="标准单位"><el-input v-model="amountForm.standardUnit" /></el-form-item>
      <el-form-item label="换算倍率"><el-input v-model="amountForm.conversionRate" /></el-form-item>
      <el-form-item label="小数位数">
        <el-input-number v-model="amountForm.standardScale" :min="0" :max="6" />
      </el-form-item>
      <el-form-item label="置信度">
        <el-select v-model="amountForm.confidenceLevel">
          <el-option label="文档确认" value="documented" />
          <el-option label="推断" value="inferred" />
        </el-select>
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="amountForm.isActive" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="amountForm.notes" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="amountDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="amountSaving" @click="submitAmountForm(false)">保存</el-button>
      <el-button type="success" :loading="amountSaving" @click="submitAmountForm(true)">
        保存并重跑
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  createAbcAmountRule,
  createAbcStatusMapping,
  getAbcAmountRules,
  getAbcStatusMappings,
  rerunAbcNormalization,
  toggleAbcAmountRule,
  toggleAbcStatusMapping,
  updateAbcAmountRule,
  updateAbcStatusMapping,
} from '../../api/abc-sync';
import {
  formatAbcAmountUnit,
  formatAbcConfidence,
  formatAbcSourceTable,
  formatAbcTargetDomain,
} from '../../utils/abc-sync';

const route = useRoute();
const router = useRouter();

const sourceTableOptions = [
  'order',
  'repair_order',
  'supermarket_order',
  'top_up_order',
  'transaction',
  'shopping_card',
  'user_shopping_card',
  'user_shopping_card_money',
  'user_shopping_card_recharge',
  'merchant_material',
  'merchant_supplier',
  'merchant_warehouse',
  'merchant_warehouse_out',
];

const activeTab = ref<'status' | 'amount'>('status');
const rerunLoading = ref(false);
const rerunForm = reactive({
  sourceTables: [] as string[],
  targetDomains: ['orders', 'funds'] as string[],
  batchNo: '',
});

const statusLoading = ref(false);
const statusTableData = ref<any[]>([]);
const statusTotal = ref(0);
const statusQuery = reactive({ page: 1, pageSize: 10 });
const statusFilters = reactive({
  sourceTable: '',
  targetDomain: '',
  isActive: '',
});
const statusDialogVisible = ref(false);
const statusSaving = ref(false);
const statusForm = reactive({
  id: 0,
  sourceTable: '',
  sourceField: '',
  sourceValue: '',
  targetDomain: '',
  targetValue: '',
  confidenceLevel: 'inferred',
  isActive: true,
  notes: '',
});

const amountLoading = ref(false);
const amountTableData = ref<any[]>([]);
const amountTotal = ref(0);
const amountQuery = reactive({ page: 1, pageSize: 10 });
const amountFilters = reactive({
  sourceTable: '',
  amountField: '',
  isActive: '',
});
const amountDialogVisible = ref(false);
const amountSaving = ref(false);
const amountForm = reactive({
  id: 0,
  sourceTable: '',
  amountField: '',
  amountUnitRaw: '',
  standardUnit: 'yuan',
  conversionRate: '1.000000',
  standardScale: 2,
  confidenceLevel: 'inferred',
  isActive: true,
  notes: '',
});

const activeGovernanceSourceTable = computed(() => String(route.query.sourceTable ?? ''));
const returnTo = computed(() => String(route.query.returnTo ?? ''));
const returnToPath = computed(() => {
  if (returnTo.value === 'mapping-exceptions') {
    return '/abc-sync/mapping-exceptions';
  }
  if (returnTo.value === 'card-mapping-exceptions') {
    return '/abc-sync/card-mapping-exceptions';
  }
  if (returnTo.value === 'inventory-mapping-exceptions') {
    return '/abc-sync/inventory-mapping-exceptions';
  }
  return '';
});

function resolveTargetDomains(sourceTable: string) {
  if (sourceTable === 'transaction') {
    return ['funds'];
  }

  if (sourceTable === 'top_up_order') {
    return ['orders', 'funds'];
  }

  if (
    sourceTable === 'shopping_card' ||
    sourceTable === 'user_shopping_card' ||
    sourceTable === 'user_shopping_card_money' ||
    sourceTable === 'user_shopping_card_recharge'
  ) {
    return ['cards'];
  }

  if (
    sourceTable === 'merchant_material' ||
    sourceTable === 'merchant_supplier' ||
    sourceTable === 'merchant_warehouse' ||
    sourceTable === 'merchant_warehouse_out'
  ) {
    return ['inventory'];
  }

  return ['orders'];
}

function applyGovernanceQuery() {
  const sourceTable = activeGovernanceSourceTable.value;

  if (!sourceTable) {
    return;
  }

  rerunForm.sourceTables = [sourceTable];
  rerunForm.targetDomains = resolveTargetDomains(sourceTable);
  statusFilters.sourceTable = sourceTable;
  amountFilters.sourceTable = sourceTable;
}

async function loadStatusMappings() {
  statusLoading.value = true;
  try {
    const { data } = await getAbcStatusMappings({
      page: statusQuery.page,
      pageSize: statusQuery.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      sourceTable: statusFilters.sourceTable || undefined,
      targetDomain: statusFilters.targetDomain || undefined,
      isActive: statusFilters.isActive || undefined,
    });
    statusTableData.value = data.data.list;
    statusTotal.value = data.data.total;
  } finally {
    statusLoading.value = false;
  }
}

async function loadAmountRules() {
  amountLoading.value = true;
  try {
    const { data } = await getAbcAmountRules({
      page: amountQuery.page,
      pageSize: amountQuery.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      sourceTable: amountFilters.sourceTable || undefined,
      amountField: amountFilters.amountField || undefined,
      isActive: amountFilters.isActive || undefined,
    });
    amountTableData.value = data.data.list;
    amountTotal.value = data.data.total;
  } finally {
    amountLoading.value = false;
  }
}

async function rerunForSourceTable(sourceTable: string, navigateBack = false) {
  if (!sourceTable) {
    return;
  }

  rerunLoading.value = true;
  try {
    await rerunAbcNormalization({
      sourceSystemCode: 'ABC',
      sourceTables: [sourceTable],
      targetDomains: resolveTargetDomains(sourceTable),
    });
    ElMessage.success(`已完成 ${formatAbcSourceTable(sourceTable)} 的标准化重跑`);

    if (navigateBack && returnToPath.value) {
      goBack(sourceTable);
      return;
    }

    await Promise.all([loadStatusMappings(), loadAmountRules()]);
  } finally {
    rerunLoading.value = false;
  }
}

function goBack(sourceTable?: string) {
  if (!returnToPath.value) {
    return;
  }

  router.push({
    path: returnToPath.value,
    query: {
      sourceTable: sourceTable || activeGovernanceSourceTable.value || undefined,
      batchNo: String(route.query.batchNo ?? '') || undefined,
      statusStandard: String(route.query.statusStandard ?? '') || undefined,
      refreshedAt: String(Date.now()),
    },
  });
}

async function handleRerun() {
  rerunLoading.value = true;
  try {
    await rerunAbcNormalization({
      sourceSystemCode: 'ABC',
      sourceTables: rerunForm.sourceTables.length ? rerunForm.sourceTables : undefined,
      targetDomains: rerunForm.targetDomains,
      batchNo: rerunForm.batchNo || undefined,
    });
    ElMessage.success('已提交标准化重跑任务');
    await Promise.all([loadStatusMappings(), loadAmountRules()]);
  } finally {
    rerunLoading.value = false;
  }
}

function handleStatusSearch() {
  statusQuery.page = 1;
  loadStatusMappings();
}

function handleAmountSearch() {
  amountQuery.page = 1;
  loadAmountRules();
}

function handleStatusPageChange(page: number) {
  statusQuery.page = page;
  loadStatusMappings();
}

function handleAmountPageChange(page: number) {
  amountQuery.page = page;
  loadAmountRules();
}

function resetStatusFilters() {
  statusFilters.sourceTable = activeGovernanceSourceTable.value || '';
  statusFilters.targetDomain = '';
  statusFilters.isActive = '';
  handleStatusSearch();
}

function resetAmountFilters() {
  amountFilters.sourceTable = activeGovernanceSourceTable.value || '';
  amountFilters.amountField = '';
  amountFilters.isActive = '';
  handleAmountSearch();
}

function openStatusDialog(row?: any) {
  statusForm.id = row?.id ?? 0;
  statusForm.sourceTable = row?.sourceTable ?? activeGovernanceSourceTable.value ?? '';
  statusForm.sourceField = row?.sourceField ?? '';
  statusForm.sourceValue = row?.sourceValue ?? '';
  statusForm.targetDomain = row?.targetDomain ?? '';
  statusForm.targetValue = row?.targetValue ?? '';
  statusForm.confidenceLevel = row?.confidenceLevel ?? 'inferred';
  statusForm.isActive = row?.isActive ?? true;
  statusForm.notes = row?.notes ?? '';
  statusDialogVisible.value = true;
}

function openAmountDialog(row?: any) {
  amountForm.id = row?.id ?? 0;
  amountForm.sourceTable = row?.sourceTable ?? activeGovernanceSourceTable.value ?? '';
  amountForm.amountField = row?.amountField ?? '';
  amountForm.amountUnitRaw = row?.amountUnitRaw ?? '';
  amountForm.standardUnit = row?.standardUnit ?? 'yuan';
  amountForm.conversionRate = row?.conversionRate ?? '1.000000';
  amountForm.standardScale = row?.standardScale ?? 2;
  amountForm.confidenceLevel = row?.confidenceLevel ?? 'inferred';
  amountForm.isActive = row?.isActive ?? true;
  amountForm.notes = row?.notes ?? '';
  amountDialogVisible.value = true;
}

async function submitStatusForm(rerunAfterSave: boolean) {
  statusSaving.value = true;
  try {
    const payload = {
      sourceTable: statusForm.sourceTable,
      sourceField: statusForm.sourceField,
      sourceValue: statusForm.sourceValue,
      targetDomain: statusForm.targetDomain,
      targetValue: statusForm.targetValue,
      confidenceLevel: statusForm.confidenceLevel,
      isActive: statusForm.isActive,
      notes: statusForm.notes || undefined,
    };

    if (statusForm.id) {
      await updateAbcStatusMapping(statusForm.id, payload);
    } else {
      await createAbcStatusMapping(payload);
    }

    ElMessage.success('状态映射已保存');
    statusDialogVisible.value = false;
    await loadStatusMappings();

    if (rerunAfterSave) {
      await rerunForSourceTable(statusForm.sourceTable, true);
    }
  } finally {
    statusSaving.value = false;
  }
}

async function submitAmountForm(rerunAfterSave: boolean) {
  amountSaving.value = true;
  try {
    const payload = {
      sourceTable: amountForm.sourceTable,
      amountField: amountForm.amountField,
      amountUnitRaw: amountForm.amountUnitRaw,
      standardUnit: amountForm.standardUnit,
      conversionRate: amountForm.conversionRate,
      standardScale: amountForm.standardScale,
      confidenceLevel: amountForm.confidenceLevel,
      isActive: amountForm.isActive,
      notes: amountForm.notes || undefined,
    };

    if (amountForm.id) {
      await updateAbcAmountRule(amountForm.id, payload);
    } else {
      await createAbcAmountRule(payload);
    }

    ElMessage.success('金额规则已保存');
    amountDialogVisible.value = false;
    await loadAmountRules();

    if (rerunAfterSave) {
      await rerunForSourceTable(amountForm.sourceTable, true);
    }
  } finally {
    amountSaving.value = false;
  }
}

async function toggleStatus(row: any) {
  await toggleAbcStatusMapping(row.id, !row.isActive);
  ElMessage.success('状态映射已更新');
  await loadStatusMappings();
}

async function toggleAmount(row: any) {
  await toggleAbcAmountRule(row.id, !row.isActive);
  ElMessage.success('金额规则已更新');
  await loadAmountRules();
}

watch(
  () => route.query,
  () => {
    applyGovernanceQuery();
  },
);

onMounted(async () => {
  applyGovernanceQuery();
  await loadStatusMappings();
  await loadAmountRules();
});
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

.section-title {
  font-size: 14px;
  font-weight: 600;
}

.governance-alert,
.rerun-card {
  margin-bottom: 16px;
}

.filters {
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
