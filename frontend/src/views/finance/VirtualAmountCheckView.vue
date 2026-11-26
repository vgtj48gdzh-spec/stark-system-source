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
            <div class="title">财务中心 / 虚拟金额核对</div>
            <div class="subtitle">
              这里只展示真正完成人工确认的落账结果。建议匹配不会进入虚拟余额，微信待结算也会单独列出来，不与银行实际和银行虚拟混算。
            </div>
          </div>
          <el-button type="primary" plain @click="router.push('/finance/bank-sms')">
            返回银行短信对账
          </el-button>
        </div>
      </template>

      <el-row :gutter="12">
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">银行实际</div>
            <div class="metric-value">{{ formatMoney(dataState.bankActual) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">银行虚拟</div>
            <div class="metric-value">{{ formatMoney(dataState.bankVirtual) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">微信待结算</div>
            <div class="metric-value warning">{{ formatMoney(dataState.thirdPartyClearingWechat) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">支付宝待结算</div>
            <div class="metric-value">{{ formatMoney(dataState.alipayClearing) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">银行差额</div>
            <div class="metric-value diff">{{ formatMoney(dataState.balanceDiff) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">待处理来源</div>
            <div class="metric-value warning">{{ dataState.pendingCount || 0 }}</div>
          </div>
        </el-col>
      </el-row>

      <el-alert type="info" :closable="false" class="page-alert" show-icon>
        <template #title>口径说明</template>
        <div>
          `bank_actual` 取银行短信最新余额；`bank_virtual` 取人工确认后的虚拟台账快照；`third_party_clearing_wechat`
          取已支付确认但尚未完成银行结算的微信回执。只有 `finance_reconciliation_link.status=confirmed`
          才会进入真正落账分录。
        </div>
      </el-alert>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-title">真正落账分录</div>
      </template>

      <el-table :data="dataState.ledgerEntries || []" v-loading="loading" empty-text="暂无已确认分录">
        <el-table-column prop="id" label="分录 ID" width="100" />
        <el-table-column label="落账类型" width="160">
          <template #default="{ row }">{{ formatLinkType(row.linkType) }}</template>
        </el-table-column>
        <el-table-column label="确认金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.confirmedAmount) }}</template>
        </el-table-column>
        <el-table-column label="方向" width="100">
          <template #default="{ row }">
            <el-tag :type="row.transactionDirection === 'expense' ? 'danger' : 'success'">
              {{ row.transactionDirection === 'expense' ? '支出' : '收入' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="银行余额快照" width="150">
          <template #default="{ row }">{{ formatMoney(row.bankBalanceAfter) }}</template>
        </el-table-column>
        <el-table-column label="对方户名" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.counterparty || '-' }}</template>
        </el-table-column>
        <el-table-column label="确认人" width="140">
          <template #default="{ row }">{{ row.confirmedBy || '-' }}</template>
        </el-table-column>
        <el-table-column label="确认时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.confirmedAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-title">未核对来源</div>
      </template>

      <el-table :data="dataState.unresolvedSources || []" v-loading="loading" empty-text="暂无未核对来源">
        <el-table-column prop="id" label="流水 ID" width="100" />
        <el-table-column label="方向" width="100">
          <template #default="{ row }">
            <el-tag :type="row.direction === 'expense' ? 'danger' : 'success'">
              {{ row.direction === 'expense' ? '支出' : '收入' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="对方户名" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.counterparty || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">{{ formatReconcileStatus(row.reconcileStatus) }}</template>
        </el-table-column>
        <el-table-column label="短信时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.smsReceivedAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getVirtualAmountCheck } from '../../api/finance-reconciliation';
import { formatDateTime, formatMoney } from '../../utils/format';

const router = useRouter();
const loading = ref(false);
const pageError = ref('');
const silentRequestConfig = {
  headers: {
    'x-suppress-global-error': '1',
  },
};
const dataState = reactive<any>({
  bankBalance: '0.00',
  virtualBalance: '0.00',
  balanceDiff: '0.00',
  bankActual: '0.00',
  bankVirtual: '0.00',
  thirdPartyClearingWechat: '0.00',
  alipayClearing: '0.00',
  pendingCount: 0,
  ledgerEntries: [],
  unresolvedSources: [],
});

async function loadData() {
  loading.value = true;
  pageError.value = '';
  try {
    const { data } = await getVirtualAmountCheck(silentRequestConfig);
    Object.assign(dataState, data.data || {});
  } catch (error: any) {
    pageError.value =
      error?.response?.data?.message || error?.message || '虚拟金额核对加载失败。';
  } finally {
    loading.value = false;
  }
}

function formatLinkType(value?: string) {
  switch (value) {
    case 'receivable_tracking':
      return '应收追踪';
    case 'receipt_item':
      return '待收款项';
    case 'approval_order':
      return '审批单';
    case 'manual_fee':
      return '银行手续费';
    case 'wechat_settlement_batch':
      return '财付通结算批次';
    case 'ignore':
      return '忽略';
    default:
      return value || '-';
  }
}

function formatReconcileStatus(value?: string) {
  switch (value) {
    case 'pending':
      return '待处理';
    case 'suggested':
      return '已建议';
    case 'confirmed':
      return '已确认';
    case 'ignored':
      return '已忽略';
    default:
      return value || '-';
  }
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

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
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
  background: linear-gradient(135deg, #fff7ed, #eff6ff);
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

.metric-value.diff,
.metric-value.warning {
  color: #c2410c;
}

.page-alert {
  margin-top: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #172033;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
