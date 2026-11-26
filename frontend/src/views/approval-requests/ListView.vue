<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">审批命令 Pilot</div>
            <div class="subtitle">
              先把 approval_requests 做成可解释、可预检、可收口的总公司审批/资金命令试点，不扩展到发票、对账、虚拟账户或多公司审批状态机。
            </div>
          </div>
          <el-button
            v-if="canCreateApproval"
            type="primary"
            @click="router.push('/approval-requests/create')"
          >
            发起审批
          </el-button>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        class="page-alert"
        show-icon
      >
        <template #title>列表默认按 handlingPlan-first 展示</template>
        <div>
          finance / approver 默认先看状态摘要、谁处理、阻塞原因和下一步；verificationCode 本轮只进入 precheck / handlingPlan / 解释链，不升级为强阻断。
        </div>
      </el-alert>

      <el-table :data="tableData" v-loading="loading" class="approval-table">
        <el-table-column label="审批单 / 当前状态摘要" min-width="360">
          <template #default="{ row }">
            <div class="cell-stack">
              <div class="cell-title-row">
                <span class="cell-title">{{ row.approvalNo || `#${row.id}` }}</span>
                <el-tag :type="approvalTagType(row.status)">
                  {{ approvalLabel(row.status) }}
                </el-tag>
              </div>
              <div class="cell-meta">
                <span>金额：{{ formatMoney(row.requestAmount || row.amount) }}</span>
                <span>申请人：{{ row.requester?.name || '-' }}</span>
                <span>类型：{{ formatApprovalType(row.approvalType) }}</span>
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
              <div class="muted-text">
                {{ firstActionLine(row.handlingPlan?.actionItems) }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="何时可执行" min-width="220">
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div class="tag-row">
                <el-tag :type="precheckTagType(row.precheckStatus)">
                  预检：{{ formatPrecheckStatus(row.precheckStatus) }}
                </el-tag>
                <el-tag :type="row.canExecute ? 'success' : 'warning'">
                  {{ row.canExecute ? '可继续人工审批' : '暂不可执行' }}
                </el-tag>
              </div>
              <div class="muted-text">
                {{ row.suggestedNextStep || row.handlingPlan?.diagnosis?.suggestedNextStep || '-' }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="阻塞原因" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ formatBlockedReason(row.blockedReason) }}</div>
              <div class="muted-text">
                {{ formatBlockedStage(row.blockedStage) }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">
            <ReadableDateTime :value="row.updatedAt || row.createdAt" />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/approval-requests/${row.id}`)">
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
import { onMounted, reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getApprovalRequests } from '../../api/approval-requests';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatMoney } from '../../utils/format';
import { formalActorIdentityBound, hasAnyRole } from '../../utils/permissions';

const router = useRouter();

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

const canCreateApproval = computed(
  () => formalActorIdentityBound.value && hasAnyRole(['finance', 'admin']),
);

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getApprovalRequests({
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    tableData.value = data.data.list || [];
    pagination.total = data.data.total || 0;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '审批列表加载失败');
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pagination.pageSize = size;
  pagination.page = 1;
  void loadData();
}

function approvalLabel(status?: string) {
  switch (status) {
    case 'pending':
      return '待审批';
    case 'approved':
      return '已通过';
    case 'rejected':
      return '已驳回';
    default:
      return status || '未知状态';
  }
}

function approvalTagType(status?: string) {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    default:
      return 'info';
  }
}

function formatApprovalType(type?: string) {
  switch (type) {
    case 'payout':
      return '付款审批';
    case 'inventory_adjustment':
      return '库存冲销 / 调整审批';
    default:
      return type || '-';
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
    case 'approval_not_pending':
      return '审批状态已结束';
    case 'linked_context_missing':
      return '缺少关联业务上下文';
    case 'payout_already_executed':
      return '付款已经登记';
    case 'actor_not_allowed':
      return '当前角色不能执行审批';
    case 'self_approval_forbidden':
      return '申请人与审批人必须相互独立';
    default:
      return '无硬阻塞';
  }
}

function formatBlockedStage(stage?: string) {
  switch (stage) {
    case 'approval_status':
      return '阻塞阶段：审批状态';
    case 'linked_business_context':
      return '阻塞阶段：业务上下文';
    case 'payout_execution':
      return '阻塞阶段：付款留痕';
    case 'role_permission':
      return '阻塞阶段：角色权限';
    default:
      return '阻塞阶段：无';
  }
}

function firstActionLine(actionItems?: Array<Record<string, any>>) {
  const firstItem = Array.isArray(actionItems) ? actionItems[0] : null;
  if (!firstItem) {
    return '处理单暂无动作清单';
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

.approval-table :deep(.el-table__cell) {
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
.tag-row {
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

.cell-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: #6b7280;
  font-size: 12px;
}

.cell-summary {
  line-height: 1.6;
  color: #1f2937;
}

.muted-text {
  color: #6b7280;
  line-height: 1.6;
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
