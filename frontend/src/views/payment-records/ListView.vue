<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">收款确认命令 Pilot</div>
            <div class="subtitle">
              当前先把 payment_records 做成可解释、可预检、可收口的命令壳，不扩展到银行对账、虚拟账户、发票或多公司审批状态机。
            </div>
          </div>
          <el-button
            v-if="canCreatePayment"
            type="primary"
            @click="router.push('/payment-records/create')"
          >
            录入收款
          </el-button>
        </div>
      </template>

      <el-alert type="info" :closable="false" class="page-alert" show-icon>
        <template #title>列表默认按 handlingPlan-first 展示</template>
        <div>
          先看这条收款记录为什么存在、谁处理 / 怎么处理、何时可确认以及 blocked 原因；渠道识别与金额偏差只作为预检提示，不升级为新的强规则。
        </div>
      </el-alert>

      <el-table :data="tableData" v-loading="loading" class="payment-table">
        <el-table-column label="收款记录 / 当前状态摘要" min-width="360">
          <template #default="{ row }">
            <div class="cell-stack">
              <div class="cell-title-row">
                <span class="cell-title">{{ row.paymentNo || `#${row.id}` }}</span>
                <el-tag :type="paymentTagType(row.paymentStatus)">
                  {{ paymentLabel(row.paymentStatus) }}
                </el-tag>
              </div>
              <div class="cell-meta">
                <span>金额：{{ formatMoney(row.amount) }}</span>
                <span>渠道：{{ row.channel || row.paymentMethod || '-' }}</span>
                <span>工单：{{ row.linkedWorkOrderSummary?.workOrderNo || `#${row.workOrderId}` }}</span>
              </div>
              <div class="cell-summary">
                {{ row.handlingPlan?.summary || row.commandExplanation || '暂无状态摘要' }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="谁处理 / 怎么处理" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ row.handlingPlan?.listSummary || row.suggestedAction || '-' }}</div>
              <div class="muted-text">{{ firstActionLine(row.handlingPlan?.actionItems) }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="何时可确认" min-width="240">
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div class="tag-row">
                <el-tag :type="precheckTagType(row.precheckStatus)">
                  预检：{{ formatPrecheckStatus(row.precheckStatus) }}
                </el-tag>
                <el-tag :type="row.canExecute ? 'success' : 'warning'">
                  {{ row.canExecute ? '可继续人工确认' : '暂不可确认' }}
                </el-tag>
              </div>
              <div class="muted-text">
                {{ row.suggestedNextStep || row.handlingPlan?.diagnosis?.suggestedNextStep || '-' }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="blocked 原因" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ formatBlockedReason(row.blockedReason) }}</div>
              <div class="muted-text">{{ formatBlockedStage(row.blockedStage) }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="收款时间" min-width="180">
          <template #default="{ row }">
            <ReadableDateTime :value="row.paidAt || row.createdAt" />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/payment-records/${row.id}`)">
              查看详情
            </el-button>
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
          @current-change="loadData"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getPaymentRecords } from '../../api/payment-records';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatMoney } from '../../utils/format';
import { hasAnyRole } from '../../utils/permissions';

const router = useRouter();

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

const canCreatePayment = computed(() => hasAnyRole(['admin', 'finance']));

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPaymentRecords({
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    tableData.value = data.data.list || [];
    pagination.total = data.data.total || 0;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '收款记录加载失败');
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pagination.pageSize = size;
  pagination.page = 1;
  void loadData();
}

function paymentLabel(status?: string) {
  switch (status) {
    case 'pending':
      return '待确认';
    case 'success':
      return '已到账';
    case 'failed':
      return '失败';
    default:
      return status || '未知状态';
  }
}

function paymentTagType(status?: string) {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'success':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
}

function formatPrecheckStatus(status?: string) {
  switch (status) {
    case 'pass':
      return '通过';
    case 'warn':
      return '提示';
    case 'fail':
      return '失败';
    default:
      return status || '-';
  }
}

function precheckTagType(status?: string) {
  switch (status) {
    case 'pass':
      return 'success';
    case 'warn':
      return 'warning';
    case 'fail':
      return 'danger';
    default:
      return 'info';
  }
}

function formatBlockedReason(reason?: string) {
  switch (reason) {
    case 'payment_not_actionable':
      return '当前 paymentStatus 不是待确认到账对象';
    case 'linked_work_order_missing':
      return '缺少关联工单上下文';
    case 'duplicate_success_risk':
      return '存在疑似重复 success 留痕';
    case 'actor_not_allowed':
      return '当前角色不能继续处理到账确认';
    case 'already_applied_to_work_order':
      return '这条记录已经作用到工单实收与状态';
    default:
      return '无硬阻塞';
  }
}

function formatBlockedStage(stage?: string) {
  switch (stage) {
    case 'payment_status':
      return '阻塞阶段：收款状态';
    case 'linked_work_order':
      return '阻塞阶段：工单上下文';
    case 'duplicate_success_check':
      return '阻塞阶段：重复到账复核';
    case 'role_permission':
      return '阻塞阶段：角色权限';
    case 'work_order_state':
      return '阻塞阶段：工单状态影响';
    default:
      return '阻塞阶段：无';
  }
}

function firstActionLine(actionItems?: Array<Record<string, any>>) {
  const firstItem = Array.isArray(actionItems) ? actionItems[0] : null;
  if (!firstItem) {
    return '处理单暂时没有动作清单';
  }
  return `${firstItem.title || '当前动作'}：${firstItem.description || '-'}`;
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
  gap: 16px;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.subtitle {
  margin-top: 6px;
  color: #6b7280;
  line-height: 1.6;
}

.page-alert {
  margin-bottom: 16px;
}

.payment-table :deep(.el-table__cell) {
  vertical-align: top;
}

.cell-stack {
  display: grid;
  gap: 6px;
}

.cell-stack.compact {
  gap: 4px;
}

.cell-title-row,
.tag-row,
.cell-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.cell-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.cell-meta,
.muted-text {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.cell-summary {
  color: #1f2937;
  line-height: 1.7;
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

  .pagination-wrap {
    justify-content: center;
  }
}
</style>
