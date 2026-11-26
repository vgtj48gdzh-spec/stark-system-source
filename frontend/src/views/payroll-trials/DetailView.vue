<template>
  <el-card v-loading="loading">
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">工资试算详情</div>
          <div class="subtitle">查看试算结果由哪些事件和汇总构成，并追溯到来源记录。</div>
        </div>
        <div class="header-actions">
          <el-button v-if="canConfirm && item && !item.confirmedFlag" type="success" @click="handleConfirm">
            确认试算
          </el-button>
          <el-button @click="goBack">返回</el-button>
        </div>
      </div>
    </template>

    <el-descriptions v-if="item" :column="2" border class="summary-box">
      <el-descriptions-item label="周期">{{ item.periodKey }}</el-descriptions-item>
      <el-descriptions-item label="试算维度">
        {{ formatPayrollSummaryDomain(item.summaryDomain) }}
      </el-descriptions-item>
      <el-descriptions-item label="员工">{{ item.employeeName || '-' }}</el-descriptions-item>
      <el-descriptions-item label="批次号">{{ item.batchNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="汇总来源数">{{ item.sourceSummaryCount }}</el-descriptions-item>
      <el-descriptions-item label="事件来源数">{{ item.sourceEventCount }}</el-descriptions-item>
      <el-descriptions-item label="奖励点数">{{ item.rewardPointsTotal }}</el-descriptions-item>
      <el-descriptions-item label="待确认">{{ item.pendingCount }}</el-descriptions-item>
      <el-descriptions-item label="已忽略">{{ item.ignoredCount }}</el-descriptions-item>
      <el-descriptions-item label="运行状态">
        <el-tag :type="item.runStatus === 'completed' ? 'success' : item.runStatus === 'failed' ? 'danger' : 'warning'">
          {{ formatPayrollRunStatus(item.runStatus) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="已确认">
        <el-tag :type="item.confirmedFlag ? 'success' : 'warning'">
          {{ item.confirmedFlag ? '是' : '否' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="确认时间">
        <ReadableDateTime :value="item.confirmedAt" />
      </el-descriptions-item>
      <el-descriptions-item label="更新时间">
        <ReadableDateTime :value="item.updatedAt" />
      </el-descriptions-item>
      <el-descriptions-item label="备注" :span="2">
        {{ item.remark || '-' }}
      </el-descriptions-item>
      <el-descriptions-item v-if="canViewAmounts" label="奖励金额">
        {{ formatMoney(item.rewardAmountTotal) }}
      </el-descriptions-item>
      <el-descriptions-item v-if="canViewAmounts" label="试算总额">
        {{ formatMoney(item.calculatedTotal) }}
      </el-descriptions-item>
    </el-descriptions>

    <el-table :data="detailList" class="detail-table">
      <el-table-column label="明细类型" min-width="120">
        <template #default="{ row }">{{ formatPayrollDetailType(row.detailType) }}</template>
      </el-table-column>
      <el-table-column prop="sourceTable" label="来源表" min-width="150" show-overflow-tooltip />
      <el-table-column prop="sourceOrderNo" label="来源编号" min-width="160" show-overflow-tooltip />
      <el-table-column prop="employeeName" label="员工" min-width="120" show-overflow-tooltip />
      <el-table-column label="发生时间" width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.occurredAt" />
        </template>
      </el-table-column>
      <el-table-column label="数量" width="110" align="right">
        <template #default="{ row }">{{ row.quantityStandard || '-' }}</template>
      </el-table-column>
      <el-table-column label="奖励点数" width="100" align="right">
        <template #default="{ row }">{{ row.rewardPoints || '0.00' }}</template>
      </el-table-column>
      <el-table-column v-if="canViewAmounts" label="来源金额" width="120" align="right">
        <template #default="{ row }">{{ row.amountStandard ? formatMoney(row.amountStandard) : '-' }}</template>
      </el-table-column>
      <el-table-column v-if="canViewAmounts" label="奖励金额" width="120" align="right">
        <template #default="{ row }">{{ row.rewardAmount ? formatMoney(row.rewardAmount) : '-' }}</template>
      </el-table-column>
      <el-table-column v-if="canViewAmounts" label="试算金额" width="120" align="right">
        <template #default="{ row }">{{ row.calculatedAmount ? formatMoney(row.calculatedAmount) : '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.ignoredFlag" type="info">已忽略</el-tag>
          <el-tag v-else-if="row.pendingFlag" type="warning">待确认</el-tag>
          <el-tag v-else type="success">已确认</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="纳入结果" width="110">
        <template #default="{ row }">
          <el-tag
            :type="
              row.ignoredFlag ? 'info' : row.includedFlag ? 'success' : row.pendingFlag ? 'warning' : ''
            "
          >
            {{ formatPayrollInclusionResult(row.includedFlag, row.pendingFlag, row.ignoredFlag) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="匹配规则" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.matchedRule || '-' }}</template>
      </el-table-column>
      <el-table-column label="规则强度" width="100">
        <template #default="{ row }">{{ formatPayrollRuleStrength(row.ruleStrength) }}</template>
      </el-table-column>
      <el-table-column label="证据状态" width="100">
        <template #default="{ row }">{{ formatPayrollEvidenceStatus(row.evidenceStatus) }}</template>
      </el-table-column>
      <el-table-column label="解释说明" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.includedReason || row.excludedReason || '-' }}
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pager"
      background
      layout="total, prev, pager, next"
      :total="detailTotal"
      :page-size="detailQuery.pageSize"
      :current-page="detailQuery.page"
      @current-change="handlePageChange"
    />
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  confirmPayrollTrial,
  getPayrollTrialDetail,
} from '../../api/payroll-trials';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatMoney } from '../../utils/format';
import { hasAnyRole, hasPermission } from '../../utils/permissions';
import {
  formatPayrollEvidenceStatus,
  formatPayrollDetailType,
  formatPayrollInclusionResult,
  formatPayrollRunStatus,
  formatPayrollRuleStrength,
  formatPayrollSummaryDomain,
} from '../../utils/payroll-trials';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const item = ref<any>(null);
const detailList = ref<any[]>([]);
const detailTotal = ref(0);

const detailQuery = reactive({
  page: 1,
  pageSize: 20,
});

const canConfirm = computed(() => hasPermission('payrollTrials.confirm'));
const canViewAmounts = computed(() => hasAnyRole(['admin', 'finance']));

async function loadData() {
  loading.value = true;
  try {
    const id = Number(route.params.id);
    const { data } = await getPayrollTrialDetail(id, {
      page: detailQuery.page,
      pageSize: detailQuery.pageSize,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
    });
    item.value = data.data.item;
    detailList.value = data.data.detail.list;
    detailTotal.value = data.data.detail.total;
  } finally {
    loading.value = false;
  }
}

async function handleConfirm() {
  if (!item.value) return;
  await confirmPayrollTrial(item.value.id, {});
  ElMessage.success('工资试算已确认');
  await loadData();
}

function handlePageChange(page: number) {
  detailQuery.page = page;
  loadData();
}

function goBack() {
  router.push('/payroll-trials');
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

.header-actions {
  display: flex;
  gap: 8px;
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

.summary-box {
  margin-bottom: 16px;
}

.detail-table {
  margin-top: 12px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
