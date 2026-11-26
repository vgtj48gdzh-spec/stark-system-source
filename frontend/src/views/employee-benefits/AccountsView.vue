<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">员工福利账户</div>
            <div class="subtitle">查看到账、余额、临期、过期以及 AI 上下文。</div>
          </div>
        </div>
      </template>

      <el-form inline>
        <el-form-item label="员工">
          <el-select v-model="employeeId" filterable clearable style="width: 260px" @change="loadAll">
            <el-option
              v-for="item in employeeOptions"
              :key="item.id"
              :label="`${item.name}（${item.id}）`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadAll">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="16">
      <el-col :xs="24" :xl="10">
        <el-card v-loading="loading.summary">
          <template #header><div class="section-title">账户概览</div></template>
          <el-descriptions v-if="summary" :column="1" border>
            <el-descriptions-item label="员工">{{ summary.employeeName }}</el-descriptions-item>
            <el-descriptions-item label="卡记录数">{{ summary.cardRecordCount }}</el-descriptions-item>
            <el-descriptions-item label="累计到账">{{ formatMoney(summary.totalAmount) }}</el-descriptions-item>
            <el-descriptions-item label="当前剩余">{{ formatMoney(summary.remainingAmount) }}</el-descriptions-item>
            <el-descriptions-item label="累计消费">{{ formatMoney(summary.consumedAmount) }}</el-descriptions-item>
            <el-descriptions-item label="30天内临期">{{ formatMoney(summary.expiringAmount) }}</el-descriptions-item>
            <el-descriptions-item label="已过期金额">{{ formatMoney(summary.expiredAmount) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :xs="24" :xl="14">
        <el-card v-loading="loading.aiContext">
          <template #header><div class="section-title">AI 上下文</div></template>
          <div v-if="aiContext" class="context-stack">
            <el-alert title="AI 仅做上下文展示，不自动执行" type="info" :closable="false" />
            <div>
              <div class="mini-title">最新福利记忆</div>
              <el-empty v-if="!aiContext.memories?.length" description="暂无记忆条目" />
              <el-timeline v-else>
                <el-timeline-item
                  v-for="item in aiContext.memories"
                  :key="item.id"
                  :timestamp="formatDateTime(item.createdAt)"
                >
                  {{ item.content }}
                </el-timeline-item>
              </el-timeline>
            </div>
            <div>
              <div class="mini-title">AI 推荐</div>
              <el-empty v-if="!aiContext.recommendations?.length" description="暂无推荐" />
              <el-card v-for="item in aiContext.recommendations" :key="item.id" shadow="never" class="recommendation-card">
                <div class="recommendation-type">{{ item.recommendationType }}</div>
                <div>{{ item.recommendationText }}</div>
                <div class="recommendation-reason">{{ item.recommendationReason || '无补充说明' }}</div>
              </el-card>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-loading="loading.ledger">
      <template #header><div class="section-title">福利账户流水</div></template>
      <el-table :data="ledger.list || []">
        <el-table-column prop="issueNo" label="发放单号" min-width="200" show-overflow-tooltip />
        <el-table-column prop="itemName" label="福利项" min-width="160" show-overflow-tooltip />
        <el-table-column label="到账金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.amountTotal) }}</template>
        </el-table-column>
        <el-table-column label="剩余金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.amountRemaining) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ formatCardRecordStatus(row.status) }}</template>
        </el-table-column>
        <el-table-column label="生效时间" width="200">
          <template #default="{ row }"><ReadableDateTime :value="row.effectiveAt" /></template>
        </el-table-column>
        <el-table-column label="到期时间" width="200">
          <template #default="{ row }"><ReadableDateTime :value="row.expiresAt" /></template>
        </el-table-column>
        <el-table-column prop="daysToExpire" label="距到期天数" width="110" align="right" />
      </el-table>
    </el-card>

    <el-card v-loading="loading.expiring">
      <template #header><div class="section-title">临期/过期明细</div></template>
      <el-table :data="expiring.list || []">
        <el-table-column prop="issueNo" label="发放单号" min-width="200" show-overflow-tooltip />
        <el-table-column prop="itemName" label="福利项" min-width="160" show-overflow-tooltip />
        <el-table-column label="剩余金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.amountRemaining) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ formatCardRecordStatus(row.status) }}</template>
        </el-table-column>
        <el-table-column prop="daysToExpire" label="距到期天数" width="110" align="right" />
        <el-table-column label="到期时间" width="200">
          <template #default="{ row }"><ReadableDateTime :value="row.expiresAt" /></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import {
  getEmployeeBenefitAccountExpiring,
  getEmployeeBenefitAccountLedger,
  getEmployeeBenefitAccountSummary,
  getEmployeeBenefitAiContext,
} from '../../api/employee-benefits';
import { getEmployees } from '../../api/performance';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatCardRecordStatus } from '../../utils/employee-benefits';
import { formatDateTime, formatMoney } from '../../utils/format';

const employeeId = ref<number | undefined>();
const employeeOptions = ref<any[]>([]);
const summary = ref<any>(null);
const ledger = ref<any>({ list: [] });
const expiring = ref<any>({ list: [] });
const aiContext = ref<any>(null);
const loading = reactive({
  summary: false,
  ledger: false,
  expiring: false,
  aiContext: false,
});

async function loadEmployees() {
  const { data } = await getEmployees({
    page: 1,
    pageSize: 200,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    status: 1,
  });
  employeeOptions.value = data.data.list;
  if (!employeeId.value && employeeOptions.value.length > 0) {
    employeeId.value = employeeOptions.value[0].id;
  }
}

async function loadAll() {
  if (!employeeId.value) {
    ElMessage.warning('请先选择员工');
    return;
  }

  loading.summary = true;
  loading.ledger = true;
  loading.expiring = true;
  loading.aiContext = true;
  try {
    const [summaryRes, ledgerRes, expiringRes, aiRes] = await Promise.all([
      getEmployeeBenefitAccountSummary(employeeId.value),
      getEmployeeBenefitAccountLedger(employeeId.value, {
        page: 1,
        pageSize: 50,
        sortBy: 'expiresAt',
        sortOrder: 'asc',
      }),
      getEmployeeBenefitAccountExpiring(employeeId.value, {
        page: 1,
        pageSize: 50,
        days: 30,
        includeExpired: true,
      }),
      getEmployeeBenefitAiContext(employeeId.value),
    ]);
    summary.value = summaryRes.data.data;
    ledger.value = ledgerRes.data.data;
    expiring.value = expiringRes.data.data;
    aiContext.value = aiRes.data.data;
  } finally {
    loading.summary = false;
    loading.ledger = false;
    loading.expiring = false;
    loading.aiContext = false;
  }
}

onMounted(async () => {
  await loadEmployees();
  await loadAll();
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
  align-items: center;
  gap: 12px;
}

.title,
.section-title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle,
.recommendation-reason {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.context-stack {
  display: grid;
  gap: 16px;
}

.mini-title,
.recommendation-type {
  font-size: 14px;
  font-weight: 600;
}

.recommendation-card + .recommendation-card {
  margin-top: 8px;
}
</style>
