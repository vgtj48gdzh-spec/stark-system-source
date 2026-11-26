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
            <div class="title">财务中心 / 财付通结算批次</div>
            <div class="subtitle">
              财付通结算批次是第二确认层。银行短信若识别为财付通合并款，应优先匹配批次，而不是直接匹配单个工单或单条微信回执。
            </div>
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" @click="dialogVisible = true">新建结算批次</el-button>
            <el-button plain @click="router.push('/finance/wechat-receipts')">
              查看微信支付回执
            </el-button>
            <el-button plain @click="router.push('/finance/bank-sms')">
              去银行短信对账
            </el-button>
            <el-button @click="loadPage">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="12">
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">当前批次数</div>
            <div class="metric-value">{{ pagination.total }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">待银行匹配</div>
            <div class="metric-value warning">{{ pendingBankMatchCount }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">已确认银行到账</div>
            <div class="metric-value success">{{ confirmedMatchCount }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="4">
          <div class="metric-card">
            <div class="metric-label">净额合计</div>
            <div class="metric-value">{{ formatMoney(netAmountTotal) }}</div>
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
        <el-form-item label="银行账户绑定 ID">
          <el-input v-model="filters.bankAccountRegistryId" clearable placeholder="例如 3" />
        </el-form-item>
        <el-form-item label="匹配状态">
          <el-select v-model="filters.matchStatus" clearable placeholder="全部状态" style="width: 180px">
            <el-option label="待银行匹配" value="pending_bank_match" />
            <el-option label="已建议匹配" value="suggested" />
            <el-option label="已确认到账" value="confirmed" />
            <el-option label="异常" value="exception" />
          </el-select>
        </el-form-item>
        <el-form-item label="结算日期">
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
      <el-table :data="tableData" v-loading="loading" empty-text="暂无财付通结算批次">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="companyId" label="公司" width="100" />
        <el-table-column label="商户" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.merchantName || row.merchantId }}</div>
            <div class="muted-text">{{ row.merchantId }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="settlementDate" label="结算日期" width="120" />
        <el-table-column prop="batchNo" label="批次号" min-width="160" show-overflow-tooltip />
        <el-table-column label="gross_amount" width="120">
          <template #default="{ row }">{{ formatMoney(row.grossAmount) }}</template>
        </el-table-column>
        <el-table-column label="fee_amount" width="120">
          <template #default="{ row }">{{ formatMoney(row.feeAmount) }}</template>
        </el-table-column>
        <el-table-column label="net_amount" width="120">
          <template #default="{ row }">{{ formatMoney(row.netAmount) }}</template>
        </el-table-column>
        <el-table-column prop="receiptCount" label="回执数" width="90" />
        <el-table-column label="关联银行账户" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div v-if="row.settlementBankAccount">
              {{ row.settlementBankAccount.accountAlias || row.settlementBankAccount.bankName }}
            </div>
            <div v-else>-</div>
            <div class="muted-text" v-if="row.settlementBankAccount">
              {{ row.settlementBankAccount.bankName }} / 尾号 {{ row.settlementBankAccount.accountTail }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="关联银行短信" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.bankSmsTransactionId || '-' }}</div>
            <div class="muted-text" v-if="row.linkedBankSms">
              {{ formatMoney(row.linkedBankSms.amount) }} / {{ row.linkedBankSms.reconcileStatus }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="matchStatus" label="匹配状态" width="150" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.id)">查看批次</el-button>
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

    <el-drawer v-model="detailVisible" size="860px" :title="`财付通结算批次 #${detailData?.id || ''}`">
      <template v-if="detailData">
        <div class="drawer-section">
          <div class="section-title">批次信息</div>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="公司">{{ detailData.companyId }}</el-descriptions-item>
            <el-descriptions-item label="商户">{{ detailData.merchantName || detailData.merchantId }}</el-descriptions-item>
            <el-descriptions-item label="结算日期">{{ detailData.settlementDate }}</el-descriptions-item>
            <el-descriptions-item label="批次号">{{ detailData.batchNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="gross_amount">{{ formatMoney(detailData.grossAmount) }}</el-descriptions-item>
            <el-descriptions-item label="fee_amount">{{ formatMoney(detailData.feeAmount) }}</el-descriptions-item>
            <el-descriptions-item label="net_amount">{{ formatMoney(detailData.netAmount) }}</el-descriptions-item>
            <el-descriptions-item label="回执数">{{ detailData.receiptCount }}</el-descriptions-item>
            <el-descriptions-item label="匹配状态">{{ detailData.matchStatus }}</el-descriptions-item>
            <el-descriptions-item label="银行短信 ID">{{ detailData.bankSmsTransactionId || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="drawer-section">
          <div class="section-title">包含的工单回执</div>
          <el-table :data="detailData.receipts || []" empty-text="暂无回执">
            <el-table-column prop="id" label="回执 ID" width="90" />
            <el-table-column label="工单" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <div>{{ row.workOrderNo || '-' }}</div>
                <div class="muted-text">ID {{ row.workOrderId || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="outTradeNo" label="out_trade_no" min-width="160" show-overflow-tooltip />
            <el-table-column prop="transactionId" label="transaction_id" min-width="180" show-overflow-tooltip />
            <el-table-column label="金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="paymentStatus" label="支付状态" width="130" />
            <el-table-column prop="settlementStatus" label="结算状态" width="140" />
          </el-table>
        </div>

        <div class="drawer-section">
          <div class="section-title">原始批次载荷</div>
          <pre class="json-block">{{ formatJson(detailData.rawPayload) }}</pre>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="dialogVisible" title="新建财付通结算批次" width="780px">
      <el-form :model="formState" label-width="140px">
        <el-form-item label="公司 ID">
          <el-input-number v-model="formState.companyId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="商户号">
          <el-input v-model="formState.merchantId" placeholder="例如 1900000109" />
        </el-form-item>
        <el-form-item label="结算日期">
          <el-date-picker
            v-model="formState.settlementDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择结算日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="批次号">
          <el-input v-model="formState.batchNo" placeholder="可为空" />
        </el-form-item>
        <el-form-item label="手续费">
          <el-input v-model="formState.feeAmount" placeholder="例如 3.20" />
        </el-form-item>
        <el-form-item label="银行账户绑定 ID">
          <el-input-number v-model="formState.bankAccountRegistryId" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="回执 ID 列表">
          <el-input
            v-model="formState.paymentReceiptIdsText"
            type="textarea"
            :rows="4"
            placeholder="请输入回执 ID，使用逗号或换行分隔，例如：101,102,103"
          />
        </el-form-item>
        <el-form-item label="原始批次 JSON">
          <el-input
            v-model="formState.rawPayloadText"
            type="textarea"
            :rows="6"
            placeholder='例如 {"channel":"tenpay","settlementType":"T+1"}'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">创建批次</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  createWechatSettlementBatch,
  getWechatSettlementBatchDetail,
  getWechatSettlementBatches,
} from '../../api/finance-wechat';
import { formatMoney } from '../../utils/format';

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
  bankAccountRegistryId: '',
  matchStatus: '' as '' | 'pending_bank_match' | 'suggested' | 'confirmed' | 'exception',
});
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});
const formState = reactive({
  companyId: 7,
  merchantId: '',
  settlementDate: '',
  batchNo: '',
  feeAmount: '0.00',
  bankAccountRegistryId: undefined as number | undefined,
  paymentReceiptIdsText: '',
  rawPayloadText: '',
});

const pendingBankMatchCount = computed(
  () => tableData.value.filter((item) => item.matchStatus === 'pending_bank_match').length,
);
const confirmedMatchCount = computed(
  () => tableData.value.filter((item) => item.matchStatus === 'confirmed').length,
);
const netAmountTotal = computed(() =>
  tableData.value.reduce((sum, item) => sum + Number(item.netAmount || 0), 0),
);

async function loadPage() {
  loading.value = true;
  pageError.value = '';
  try {
    const { data } = await getWechatSettlementBatches(
      {
        page: pagination.page,
        pageSize: pagination.pageSize,
        companyId: filters.companyId ? Number(filters.companyId) : undefined,
        merchantId: filters.merchantId || undefined,
        bankAccountRegistryId: filters.bankAccountRegistryId
          ? Number(filters.bankAccountRegistryId)
          : undefined,
        matchStatus: filters.matchStatus || undefined,
        dateFrom: dateRange.value?.[0],
        dateTo: dateRange.value?.[1],
      },
      silentRequestConfig,
    );
    tableData.value = data.data.list || [];
    pagination.total = data.data.total || 0;
  } catch (error: any) {
    pageError.value =
      error.response?.data?.message || '财付通结算批次页面加载失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function openDetail(id: number) {
  try {
    const { data } = await getWechatSettlementBatchDetail(id, silentRequestConfig);
    detailData.value = data.data;
    detailVisible.value = true;
  } catch (error: any) {
    pageError.value =
      error.response?.data?.message || '财付通结算批次详情加载失败，请稍后重试。';
  }
}

async function submitForm() {
  if (!formState.companyId || !formState.merchantId.trim() || !formState.settlementDate) {
    ElMessage.warning('请先填写公司、商户号和结算日期。');
    return;
  }

  const paymentReceiptIds = formState.paymentReceiptIdsText
    .split(/[\s,，]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  if (!paymentReceiptIds.length) {
    ElMessage.warning('请至少填写一个微信支付回执 ID。');
    return;
  }

  submitting.value = true;
  try {
    const rawPayload = formState.rawPayloadText.trim()
      ? JSON.parse(formState.rawPayloadText)
      : undefined;
    await createWechatSettlementBatch(
      {
        companyId: Number(formState.companyId),
        merchantId: formState.merchantId.trim(),
        settlementDate: formState.settlementDate,
        batchNo: formState.batchNo.trim() || undefined,
        feeAmount: formState.feeAmount.trim() || '0.00',
        bankAccountRegistryId: formState.bankAccountRegistryId || undefined,
        paymentReceiptIds,
        rawPayload,
      },
      silentRequestConfig,
    );
    ElMessage.success('财付通结算批次已创建。');
    dialogVisible.value = false;
    resetForm();
    await loadPage();
  } catch (error: any) {
    pageError.value =
      error.response?.data?.message || '财付通结算批次创建失败，请稍后重试。';
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  formState.companyId = 7;
  formState.merchantId = '';
  formState.settlementDate = '';
  formState.batchNo = '';
  formState.feeAmount = '0.00';
  formState.bankAccountRegistryId = undefined;
  formState.paymentReceiptIdsText = '';
  formState.rawPayloadText = '';
}

function handleSearch() {
  pagination.page = 1;
  void loadPage();
}

function handleReset() {
  filters.companyId = '';
  filters.merchantId = '';
  filters.bankAccountRegistryId = '';
  filters.matchStatus = '';
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
