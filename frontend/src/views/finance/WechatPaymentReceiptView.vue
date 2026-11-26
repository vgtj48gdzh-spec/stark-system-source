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

    <el-card class="hero-card">
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">财务中心 / 微信支付回执</div>
            <div class="subtitle">
              这里记录支付渠道的第一确认。工单可因此进入 paid_confirmed，但资金口径仍停留在 third_party_clearing_wechat，尚未视为银行到账。
            </div>
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" @click="dialogVisible = true">手工导入回执</el-button>
            <el-button plain @click="router.push('/finance/wechat-settlement-batches')">
              查看财付通结算批次
            </el-button>
            <el-button @click="loadPage">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="12">
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">当前列表</div>
            <div class="metric-value">{{ pagination.total }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">已支付确认</div>
            <div class="metric-value success">{{ paidConfirmedCount }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">待结算</div>
            <div class="metric-value warning">{{ pendingSettlementCount }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">微信待结算金额</div>
            <div class="metric-value">{{ formatMoney(pendingSettlementAmount) }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card>
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="公司 ID">
          <el-input v-model="filters.companyId" clearable placeholder="例如 7" />
        </el-form-item>
        <el-form-item label="商户号">
          <el-input v-model="filters.merchantId" clearable placeholder="例如 1900000109" />
        </el-form-item>
        <el-form-item label="工单 ID">
          <el-input v-model="filters.workOrderId" clearable placeholder="例如 2001" />
        </el-form-item>
        <el-form-item label="支付状态">
          <el-select v-model="filters.paymentStatus" clearable placeholder="全部支付状态" style="width: 160px">
            <el-option label="已支付确认" value="paid_confirmed" />
            <el-option label="已退款" value="refunded" />
            <el-option label="已关闭" value="closed" />
          </el-select>
        </el-form-item>
        <el-form-item label="结算状态">
          <el-select v-model="filters.settlementStatus" clearable placeholder="全部结算状态" style="width: 170px">
            <el-option label="待结算" value="pending_settlement" />
            <el-option label="已入批次" value="batched" />
            <el-option label="已结算" value="settled" />
            <el-option label="异常" value="exception" />
          </el-select>
        </el-form-item>
        <el-form-item label="支付日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="tableData" v-loading="loading" empty-text="暂无微信支付回执">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="companyId" label="公司" width="100" />
        <el-table-column label="商户" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.merchantName || row.merchantId }}</div>
            <div class="muted-text">{{ row.merchantId }}</div>
          </template>
        </el-table-column>
        <el-table-column label="工单" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.workOrderNo || '-' }}</div>
            <div class="muted-text">ID {{ row.workOrderId || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="outTradeNo" label="out_trade_no" min-width="170" show-overflow-tooltip />
        <el-table-column prop="transactionId" label="transaction_id" min-width="190" show-overflow-tooltip />
        <el-table-column label="支付金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amountPaid) }}</template>
        </el-table-column>
        <el-table-column label="支付时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.paidAt) }}</template>
        </el-table-column>
        <el-table-column prop="paymentStatus" label="支付状态" width="140" />
        <el-table-column prop="settlementStatus" label="结算状态" width="150" />
        <el-table-column prop="thirdPartyClearingStage" label="资金口径" width="190" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.id)">查看</el-button>
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
          @current-change="loadPage"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" size="760px" :title="`微信支付回执 #${detailData?.id || ''}`">
      <template v-if="detailData">
        <div class="drawer-section">
          <div class="section-title">回执信息</div>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="公司">{{ detailData.companyId }}</el-descriptions-item>
            <el-descriptions-item label="商户">{{ detailData.merchantName || detailData.merchantId }}</el-descriptions-item>
            <el-descriptions-item label="工单">{{ detailData.workOrderNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="工单 ID">{{ detailData.workOrderId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="out_trade_no">{{ detailData.outTradeNo }}</el-descriptions-item>
            <el-descriptions-item label="transaction_id">{{ detailData.transactionId }}</el-descriptions-item>
            <el-descriptions-item label="支付金额">{{ formatMoney(detailData.amountPaid) }}</el-descriptions-item>
            <el-descriptions-item label="支付时间">{{ formatDateTime(detailData.paidAt) }}</el-descriptions-item>
            <el-descriptions-item label="支付状态">{{ detailData.paymentStatus }}</el-descriptions-item>
            <el-descriptions-item label="结算状态">{{ detailData.settlementStatus }}</el-descriptions-item>
            <el-descriptions-item label="资金口径">{{ detailData.thirdPartyClearingStage }}</el-descriptions-item>
            <el-descriptions-item label="结算批次">{{ detailData.settlementBatchId || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="drawer-section">
          <div class="section-title">原始回执</div>
          <pre class="json-block">{{ formatJson(detailData.rawPayload) }}</pre>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="dialogVisible" title="手工导入微信支付回执" width="760px">
      <el-form :model="formState" label-width="120px">
        <el-form-item label="公司 ID">
          <el-input-number v-model="formState.companyId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="商户号">
          <el-input v-model="formState.merchantId" placeholder="例如 1900000109" />
        </el-form-item>
        <el-form-item label="工单 ID">
          <el-input-number v-model="formState.workOrderId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="out_trade_no">
          <el-input v-model="formState.outTradeNo" />
        </el-form-item>
        <el-form-item label="transaction_id">
          <el-input v-model="formState.transactionId" />
        </el-form-item>
        <el-form-item label="付款方标识">
          <el-input v-model="formState.payerRef" />
        </el-form-item>
        <el-form-item label="支付金额">
          <el-input v-model="formState.amountPaid" placeholder="例如 188.50" />
        </el-form-item>
        <el-form-item label="支付时间">
          <el-date-picker
            v-model="formState.paidAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="选择支付时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="支付状态">
          <el-select v-model="formState.paymentStatus" style="width: 100%">
            <el-option label="已支付确认" value="paid_confirmed" />
            <el-option label="已退款" value="refunded" />
            <el-option label="已关闭" value="closed" />
          </el-select>
        </el-form-item>
        <el-form-item label="结算状态">
          <el-select v-model="formState.settlementStatus" style="width: 100%">
            <el-option label="待结算" value="pending_settlement" />
            <el-option label="已入批次" value="batched" />
            <el-option label="已结算" value="settled" />
            <el-option label="异常" value="exception" />
          </el-select>
        </el-form-item>
        <el-form-item label="原始回执 JSON">
          <el-input
            v-model="formState.rawPayloadText"
            type="textarea"
            :rows="6"
            placeholder='例如 {"channel":"wechat-pay","note":"manual import"}'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">导入回执</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  getWechatPaymentReceiptDetail,
  getWechatPaymentReceipts,
  importWechatPaymentReceipt,
} from '../../api/finance-wechat';
import { formatDateTime, formatMoney } from '../../utils/format';

const router = useRouter();
const silentRequestConfig = {
  headers: {
    'x-suppress-global-error': '1',
  },
};

const loading = ref(false);
const submitting = ref(false);
const pageError = ref('');
const tableData = ref<any[]>([]);
const detailVisible = ref(false);
const detailData = ref<any>(null);
const dialogVisible = ref(false);
const dateRange = ref<string[]>([]);
const filters = reactive({
  companyId: '',
  merchantId: '',
  workOrderId: '',
  paymentStatus: '' as '' | 'paid_confirmed' | 'refunded' | 'closed',
  settlementStatus: '' as '' | 'pending_settlement' | 'batched' | 'settled' | 'exception',
});
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});
const formState = reactive({
  companyId: 7,
  merchantId: '',
  workOrderId: undefined as number | undefined,
  outTradeNo: '',
  transactionId: '',
  payerRef: '',
  amountPaid: '',
  paidAt: '',
  paymentStatus: 'paid_confirmed' as 'paid_confirmed' | 'refunded' | 'closed',
  settlementStatus: 'pending_settlement' as
    | 'pending_settlement'
    | 'batched'
    | 'settled'
    | 'exception',
  rawPayloadText: '',
});

const paidConfirmedCount = computed(
  () => tableData.value.filter((item) => item.paymentStatus === 'paid_confirmed').length,
);
const pendingSettlementCount = computed(
  () => tableData.value.filter((item) => item.settlementStatus === 'pending_settlement').length,
);
const pendingSettlementAmount = computed(() =>
  tableData.value
    .filter((item) => item.settlementStatus === 'pending_settlement')
    .reduce((sum, item) => sum + Number(item.amountPaid || 0), 0),
);

async function loadPage() {
  loading.value = true;
  pageError.value = '';
  try {
    const { data } = await getWechatPaymentReceipts(
      {
        page: pagination.page,
        pageSize: pagination.pageSize,
        companyId: filters.companyId ? Number(filters.companyId) : undefined,
        merchantId: filters.merchantId || undefined,
        workOrderId: filters.workOrderId ? Number(filters.workOrderId) : undefined,
        paymentStatus: filters.paymentStatus || undefined,
        settlementStatus: filters.settlementStatus || undefined,
        dateFrom: dateRange.value?.[0],
        dateTo: dateRange.value?.[1],
      },
      silentRequestConfig,
    );
    tableData.value = data.data.list || [];
    pagination.total = data.data.total || 0;
  } catch (error: any) {
    pageError.value =
      error.response?.data?.message || '微信支付回执页面加载失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function openDetail(id: number) {
  try {
    const { data } = await getWechatPaymentReceiptDetail(id, silentRequestConfig);
    detailData.value = data.data;
    detailVisible.value = true;
  } catch (error: any) {
    pageError.value =
      error.response?.data?.message || '微信支付回执详情加载失败，请稍后重试。';
  }
}

async function submitForm() {
  if (
    !formState.companyId ||
    !formState.merchantId.trim() ||
    !formState.outTradeNo.trim() ||
    !formState.transactionId.trim() ||
    !formState.amountPaid.trim() ||
    !formState.paidAt
  ) {
    ElMessage.warning('请先完整填写公司、商户号、交易单号、金额和支付时间。');
    return;
  }

  submitting.value = true;
  try {
    const rawPayload = formState.rawPayloadText.trim()
      ? JSON.parse(formState.rawPayloadText)
      : undefined;
    await importWechatPaymentReceipt(
      {
        companyId: Number(formState.companyId),
        merchantId: formState.merchantId.trim(),
        workOrderId: formState.workOrderId || undefined,
        outTradeNo: formState.outTradeNo.trim(),
        transactionId: formState.transactionId.trim(),
        payerRef: formState.payerRef.trim() || undefined,
        amountPaid: formState.amountPaid.trim(),
        paidAt: formState.paidAt,
        paymentStatus: formState.paymentStatus,
        settlementStatus: formState.settlementStatus,
        rawPayload,
      },
      silentRequestConfig,
    );
    ElMessage.success('微信支付回执已导入。');
    dialogVisible.value = false;
    resetForm();
    await loadPage();
  } catch (error: any) {
    pageError.value =
      error.response?.data?.message || '微信支付回执导入失败，请稍后重试。';
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  formState.companyId = 7;
  formState.merchantId = '';
  formState.workOrderId = undefined;
  formState.outTradeNo = '';
  formState.transactionId = '';
  formState.payerRef = '';
  formState.amountPaid = '';
  formState.paidAt = '';
  formState.paymentStatus = 'paid_confirmed';
  formState.settlementStatus = 'pending_settlement';
  formState.rawPayloadText = '';
}

function handleSearch() {
  pagination.page = 1;
  void loadPage();
}

function handleReset() {
  filters.companyId = '';
  filters.merchantId = '';
  filters.workOrderId = '';
  filters.paymentStatus = '';
  filters.settlementStatus = '';
  dateRange.value = [];
  pagination.page = 1;
  void loadPage();
}

function handleSizeChange(size: number) {
  pagination.pageSize = size;
  pagination.page = 1;
  void loadPage();
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
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
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
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

.hero-card :deep(.el-card__body) {
  display: grid;
  gap: 16px;
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

.metric-value.success {
  color: #15803d;
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

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.muted-text {
  color: #667085;
  font-size: 12px;
}

.drawer-section {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #172033;
}

.json-block {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  overflow: auto;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .toolbar-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
