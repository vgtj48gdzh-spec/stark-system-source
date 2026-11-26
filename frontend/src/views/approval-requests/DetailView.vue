<template>
  <div class="page-stack" v-loading="loading">
    <el-card>
      <template #header>
        <div class="hero-header">
          <div>
            <div class="hero-title">
              审批单详情
              <el-tag class="hero-tag" :type="approvalTagType(detailData?.status)">
                {{ approvalLabel(detailData?.status) }}
              </el-tag>
            </div>
            <div class="hero-subtitle">
              {{ detailData?.handlingPlan?.summary || detailData?.commandExplanation || '当前审批单正在加载处理摘要。' }}
            </div>
          </div>
          <el-button @click="router.push('/approval-requests')">返回列表</el-button>
        </div>
      </template>

      <el-alert
        v-if="detailData?.handlingPlan?.visibilityScope !== 'full'"
        type="info"
        :closable="false"
        show-icon
      >
        <template #title>当前角色默认查看 handlingPlan 收口版</template>
        <div>
          原始兼容字段仍保留，但不会比 handlingPlan 暴露更多细节；verificationCode 也只展示最小安全值。
        </div>
      </el-alert>

      <div class="hero-grid">
        <div class="hero-item">
          <span class="hero-label">当前状态摘要</span>
          <span>{{ detailData?.handlingPlan?.summary || '-' }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">谁处理 / 怎么处理</span>
          <span>{{ detailData?.handlingPlan?.listSummary || detailData?.suggestedAction || '-' }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">何时可执行</span>
          <span>{{ detailData?.suggestedNextStep || detailData?.handlingPlan?.diagnosis?.suggestedNextStep || '-' }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">阻塞原因</span>
          <span>{{ formatBlockedReason(detailData?.blockedReason) }}</span>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>审批单基本信息</template>

      <el-descriptions v-if="detailData" :column="2" border class="detail-descriptions">
        <el-descriptions-item label="审批编号">
          {{ detailData.approval?.approvalNo || detailData.approvalNo || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="审批类型">
          {{ formatApprovalType(detailData.approval?.approvalType || detailData.approvalType) }}
        </el-descriptions-item>
        <el-descriptions-item label="审批状态">
          <el-tag :type="approvalTagType(detailData.status)">
            {{ approvalLabel(detailData.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="isInventoryAdjustment ? '原流水金额' : '申请金额'">
          {{ formatMoney(detailData.requestAmount || detailData.amount) }}
        </el-descriptions-item>
        <el-descriptions-item label="申请人">
          {{ detailData.requester?.name || detailData.approval?.requester?.name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="审批人">
          {{ detailData.approver?.name || detailData.approval?.approver?.name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="申请原因" :span="2">
          {{ detailData.reason || detailData.approval?.reason || '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="isInventoryAdjustment ? '原始库存流水' : '关联工单'">
          {{ isInventoryAdjustment
            ? detailData.linkedBusinessContext?.sourceTransactionNo || detailData.relatedInventoryTransactionId || '-'
            : detailData.linkedBusinessContext?.workOrderNo || detailData.relatedWorkOrderId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="!isInventoryAdjustment" label="最近付款">
          {{ detailData.linkedPayout?.latestPayoutNo || '-' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="isInventoryAdjustment" label="修正动作">
          {{ formatInventoryAdjustmentAction(detailData.linkedBusinessContext?.adjustmentAction) }}
        </el-descriptions-item>
        <el-descriptions-item v-if="isInventoryAdjustment" label="原始数量 / 单价">
          {{ detailData.linkedBusinessContext?.originalQuantity || '-' }} /
          {{ formatMoney(detailData.linkedBusinessContext?.originalUnitPrice) }}
        </el-descriptions-item>
        <el-descriptions-item v-if="isInventoryAdjustment" label="审批目标数量 / 单价">
          {{ detailData.linkedBusinessContext?.targetQuantity || '仅冲销' }} /
          {{ detailData.linkedBusinessContext?.targetUnitPrice
            ? formatMoney(detailData.linkedBusinessContext.targetUnitPrice)
            : '仅冲销' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="isInventoryAdjustment" label="修正执行状态">
          {{ detailData.linkedBusinessContext?.executionStatus === 'executed'
            ? '已生成不可变修正流水'
            : '尚未执行库存修正' }}
        </el-descriptions-item>
        <el-descriptions-item label="验证码">
          {{ detailData.approval?.verificationCode || detailData.verificationCode || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="验证码作用">
          {{ detailData.handlingPlan?.diagnosis?.verificationCodeRole || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="审批通过时间">
          {{ formatDateTime(detailData.approvedAt || detailData.approval?.approvedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="审批驳回时间">
          {{ formatDateTime(detailData.rejectedAt || detailData.approval?.rejectedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDateTime(detailData.createdAt || detailData.approval?.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ formatDateTime(detailData.updatedAt || detailData.approval?.updatedAt) }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <div class="action-block">
        <div class="action-title">审批动作</div>
        <el-alert
          v-if="!canOperateApproval"
          type="info"
          :closable="false"
          show-icon
        >
          <template #title>当前角色以查看和解释为主</template>
          <div>approve / reject 仍需审批人或管理员人工执行，不能跳过人工确认层。</div>
        </el-alert>
        <el-alert
          v-else-if="!canSubmitDecision"
          type="warning"
          :closable="false"
          show-icon
        >
          <template #title>当前不满足直接执行审批的条件</template>
          <div>{{ decisionDisabledReason }}</div>
        </el-alert>

        <template v-if="canOperateApproval">
          <el-input
            v-model="remark"
            type="textarea"
            :rows="3"
            resize="vertical"
            placeholder="可选：补充本次审批说明或驳回原因"
          />
          <div class="action-buttons">
            <el-button
              type="success"
              :disabled="!canSubmitDecision"
              @click="handleApprove"
            >
              通过审批
            </el-button>
            <el-button
              type="danger"
              plain
              :disabled="!canSubmitDecision"
              @click="handleReject"
            >
              驳回审批
            </el-button>
          </div>
        </template>
      </div>
    </el-card>

    <el-card v-if="draftEvidence">
      <template #header>
        <div class="evidence-header">
          <div>
            <div class="section-title">关联审批草稿证据</div>
            <div class="evidence-subtitle">
              {{ draftEvidence.draftNo || '-' }} / {{ draftEvidence.draftStatus || '-' }}
            </div>
          </div>
          <el-tag type="warning">仍需独立人工审批</el-tag>
        </div>
      </template>

      <el-alert type="info" :closable="false" show-icon class="evidence-alert">
        <template #title>证据提交边界</template>
        <div>这里只展示工单、材料、仓库、供应商和出库摘要；提交未执行付款、修改库存、确认银行短信或改写虚拟台账。</div>
      </el-alert>

      <el-descriptions :column="2" border class="detail-descriptions">
        <el-descriptions-item label="工单">
          {{ draftEvidenceValue('workOrder', ['workOrderNo', 'title']) }}
        </el-descriptions-item>
        <el-descriptions-item label="材料">
          {{ draftEvidenceValue('material', ['name', 'materialName', 'label', 'materialCode']) }}
        </el-descriptions-item>
        <el-descriptions-item label="仓库">
          {{ draftEvidenceValue('warehouse', ['name', 'warehouseName', 'label']) }}
        </el-descriptions-item>
        <el-descriptions-item label="供应商">
          {{ draftEvidenceValue('supplier', ['name', 'supplierName', 'label']) }}
        </el-descriptions-item>
        <el-descriptions-item label="证据金额">
          {{ formatMoney(draftEvidence.amount) }}
        </el-descriptions-item>
        <el-descriptions-item label="出库证据">
          {{ draftOutboundSummary }}
        </el-descriptions-item>
        <el-descriptions-item label="必须守卫" :span="2">
          <div v-if="draftEvidenceGuards.length" class="evidence-guards">
            <el-tag
              v-for="guard in draftEvidenceGuards"
              :key="guard"
              size="small"
              type="warning"
              effect="plain"
            >
              {{ formatEvidenceGuard(guard) }}
            </el-tag>
          </div>
          <span v-else>人工提交、独立审批、禁止自动付款与库存写入</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card>
      <template #header>blocked / precheck 诊断</template>

      <div class="diagnostic-grid">
        <div class="diagnostic-item">
          <span class="diagnostic-label">预检状态</span>
          <el-tag :type="precheckTagType(precheckData?.precheckStatus)">
            {{ formatPrecheckStatus(precheckData?.precheckStatus) }}
          </el-tag>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">当前可执行</span>
          <el-tag :type="precheckData?.canExecute ? 'success' : 'warning'">
            {{ precheckData?.canExecute ? '可执行' : '不可执行' }}
          </el-tag>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">阻塞原因</span>
          <span>{{ formatBlockedReason(precheckData?.blockedReason) }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">阻塞阶段</span>
          <span>{{ formatBlockedStage(precheckData?.blockedStage) }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">审批状态是否允许执行</span>
          <span>{{ precheckData?.approvalStatusAllowsExecute ? '允许' : '不允许' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">业务上下文是否存在</span>
          <span>{{ precheckData?.linkedBusinessContextPresent ? '已关联' : '缺失' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">付款状态</span>
          <span>{{ formatLinkedPayoutState(precheckData?.linkedPayoutState) }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">verificationCode 状态</span>
          <span>{{ formatVerificationCodeStatus(precheckData?.verificationCodeStatus) }}</span>
        </div>
      </div>

      <el-alert
        v-if="detailData?.blockedReason"
        type="warning"
        :closable="false"
        show-icon
        class="section-alert"
      >
        <template #title>当前 blocked 原因</template>
        <div>
          {{ formatBlockedReason(detailData.blockedReason) }} / {{ formatBlockedStage(detailData.blockedStage) }}
        </div>
      </el-alert>

      <div v-if="precheckData?.checks?.length" class="check-list">
        <div v-for="item in precheckData.checks" :key="item.checkKey" class="check-item">
          <div class="check-header">
            <span class="check-title">{{ item.checkName }}</span>
            <el-tag :type="precheckTagType(item.checkResult)">
              {{ formatPrecheckStatus(item.checkResult) }}
            </el-tag>
          </div>
          <div class="check-reason">{{ item.checkReason }}</div>
        </div>
      </div>

      <div v-if="precheckData?.remediationSuggestions?.length" class="suggestion-block">
        <div class="section-subtitle">建议先补的条件</div>
        <ul class="plain-list">
          <li v-for="item in precheckData.remediationSuggestions" :key="item">{{ item }}</li>
        </ul>
      </div>
    </el-card>

    <el-card>
      <template #header>handlingPlan 处理单</template>

      <div class="handling-summary">
        <div class="handling-item">
          <span class="handling-label">summary</span>
          <span>{{ detailData?.handlingPlan?.summary || '-' }}</span>
        </div>
        <div class="handling-item">
          <span class="handling-label">listSummary</span>
          <span>{{ detailData?.handlingPlan?.listSummary || '-' }}</span>
        </div>
        <div class="handling-item">
          <span class="handling-label">diagnosis</span>
          <span>
            {{ detailData?.handlingPlan?.diagnosis?.suggestedNextStep || '-' }}
          </span>
        </div>
        <div class="handling-item">
          <span class="handling-label">验证码当前作用</span>
          <span>{{ detailData?.handlingPlan?.diagnosis?.verificationCodeRole || '-' }}</span>
        </div>
      </div>

      <div class="section-subtitle">边界说明</div>
      <ul class="plain-list">
        <li>{{ detailData?.handlingPlan?.boundary?.executionBoundary || '-' }}</li>
        <li>{{ detailData?.handlingPlan?.boundary?.humanConfirmationBoundary || '-' }}</li>
        <li>{{ detailData?.handlingPlan?.boundary?.payrollBoundary || '-' }}</li>
        <li>{{ detailData?.handlingPlan?.boundary?.generalizationBoundary || '-' }}</li>
      </ul>

      <div class="section-subtitle">动作清单</div>
      <div class="plan-card-list">
        <div
          v-for="item in detailData?.handlingPlan?.actionItems || []"
          :key="item.actionKey"
          class="plan-card"
        >
          <div class="plan-card-header">
            <div class="plan-card-title">{{ item.title }}</div>
            <el-tag :type="actionStatusTagType(item.status)">
              {{ formatActionStatus(item.status) }}
            </el-tag>
          </div>
          <div class="plan-card-meta">处理人：{{ formatOwnerScope(item.ownerScope) }}</div>
          <div class="plan-card-desc">{{ item.description || '-' }}</div>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>审计补充</template>

      <div class="audit-section">
        <div class="section-subtitle">命令解释</div>
        <div class="audit-text">{{ detailData?.commandExplanation || '-' }}</div>
      </div>

      <div class="audit-section">
        <div class="section-subtitle">executionTrace</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="当前状态">
            {{ detailData?.executionTrace?.currentStatus || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="最近审批动作">
            {{ detailData?.executionTrace?.latestApprovalAction || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="latestPaymentNo">
            {{ detailData?.executionTrace?.latestPaymentNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="latestPayoutNo">
            {{ detailData?.executionTrace?.latestPayoutNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="付款时间">
            {{ formatDateTime(detailData?.executionTrace?.latestPayoutAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="收款时间">
            {{ formatDateTime(detailData?.executionTrace?.latestPaymentAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="audit-section">
        <div class="section-subtitle">auditTrail</div>
        <el-empty
          v-if="!detailData?.auditTrail?.length"
          description="当前没有额外审计补充"
          :image-size="64"
        />
        <el-timeline v-else>
          <el-timeline-item
            v-for="item in detailData.auditTrail"
            :key="item.eventKey"
            :timestamp="formatDateTime(item.actionAt)"
          >
            <div class="timeline-title">{{ item.actionLabel || item.action || '-' }}</div>
            <div class="timeline-text">{{ item.detail || '-' }}</div>
            <div class="timeline-meta">
              阶段：{{ item.stage || '-' }} / 执行人：{{ item.actorName || '系统' }}
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-card>

    <AiSideAssistant
      page-title="审批单详情"
      route-path="/approval-requests/:id"
      entity-type="approval_request_command"
      :entity-id="String(approvalId)"
      :current-filters="aiCurrentFilters"
      :source-action-id="aiSourceActionId"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import {
  approveApprovalRequest,
  getApprovalRequestDetail,
  getApprovalRequestPrecheck,
  rejectApprovalRequest,
} from '../../api/approval-requests';
import { formatDateTime, formatMoney } from '../../utils/format';
import { formalActorIdentityBound, hasAnyRole } from '../../utils/permissions';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const detailData = ref<any | null>(null);
const precheckResponse = ref<any | null>(null);
const remark = ref('');

const approvalId = computed(() => Number(route.params.id));
const isInventoryAdjustment = computed(
  () =>
    (detailData.value?.approval?.approvalType || detailData.value?.approvalType) ===
    'inventory_adjustment',
);
const canOperateApproval = computed(
  () => formalActorIdentityBound.value && hasAnyRole(['admin', 'approver']),
);
const precheckData = computed(() => precheckResponse.value || detailData.value?.approvalPrecheck || null);
const draftEvidence = computed(() => detailData.value?.linkedDraftEvidence || null);
const draftEvidenceGuards = computed<string[]>(() =>
  Array.isArray(draftEvidence.value?.requiredGuards)
    ? draftEvidence.value.requiredGuards.filter((item: unknown): item is string => typeof item === 'string')
    : [],
);
const draftOutboundSummary = computed(() => {
  const submissionEvidence = draftEvidence.value?.submissionEvidence;
  const outboundIds = Array.isArray(submissionEvidence?.outboundInventoryTransactionIds)
    ? submissionEvidence.outboundInventoryTransactionIds
    : [];
  if (outboundIds.length) {
    return `已关联 ${outboundIds.length} 条出库记录`;
  }

  const inventory = draftEvidence.value?.evidenceSummary?.inventory;
  const quantity = safeEvidenceValue(inventory, ['quantity']);
  const unitPrice = safeEvidenceValue(inventory, ['unitPrice']);
  return [quantity ? `数量 ${quantity}` : '', unitPrice ? `单价 ${formatMoney(unitPrice)}` : '']
    .filter(Boolean)
    .join(' / ') || '已由提交门禁校验';
});
const canSubmitDecision = computed(
  () =>
    Boolean(canOperateApproval.value && detailData.value?.status === 'pending' && detailData.value?.canExecute),
);
const decisionDisabledReason = computed(() => {
  if (!detailData.value) {
    return '审批单详情尚未加载完成。';
  }
  if (detailData.value.status !== 'pending') {
    return '当前审批状态已经结束，不能重复执行 approve / reject。';
  }
  if (!detailData.value.canExecute) {
    return detailData.value.suggestedNextStep || formatBlockedReason(detailData.value.blockedReason);
  }
  return '';
});

const aiSourceActionId = computed(() => {
  if (typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()) {
    return route.query.sourceActionId.trim();
  }
  return null;
});

const aiCurrentFilters = computed(() => ({
  routePath: route.path,
  approvalType: detailData.value?.approvalType || '',
  status: detailData.value?.status || '',
  blockedReason: detailData.value?.blockedReason || '',
  precheckStatus: precheckData.value?.precheckStatus || '',
  executionCapability: detailData.value?.executionCapability || '',
  sourceActionId: aiSourceActionId.value || undefined,
}));

async function loadDetail() {
  loading.value = true;
  try {
    const [detailRes, precheckRes] = await Promise.all([
      getApprovalRequestDetail(route.params.id as string),
      getApprovalRequestPrecheck(route.params.id as string),
    ]);
    detailData.value = detailRes.data.data;
    precheckResponse.value = precheckRes.data.data;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '审批单详情加载失败');
  } finally {
    loading.value = false;
  }
}

async function handleApprove() {
  try {
    await approveApprovalRequest(route.params.id as string, {
      remark: remark.value || undefined,
    });
    ElMessage.success('审批已通过');
    remark.value = '';
    await loadDetail();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '审批通过失败');
  }
}

async function handleReject() {
  try {
    await rejectApprovalRequest(route.params.id as string, {
      remark: remark.value || '审批驳回',
    });
    ElMessage.success('审批已驳回');
    remark.value = '';
    await loadDetail();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '审批驳回失败');
  }
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

function formatInventoryAdjustmentAction(action?: string) {
  return action === 'reverse' ? '整笔冲销' : action === 'adjust' ? '冲销后按审批目标重建' : '-';
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

function safeEvidenceValue(record: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function draftEvidenceValue(section: string, keys: string[]) {
  const record = draftEvidence.value?.evidenceSummary?.[section];
  return safeEvidenceValue(record, keys) || '-';
}

function formatEvidenceGuard(guard: string) {
  const labels: Record<string, string> = {
    human_approval_required: '必须人工审批',
    source_authority_guard: '来源权威校验',
    redaction_guard: '脱敏校验',
    audit_guard: '审计留痕',
    bank_confirmation_guard: '禁止自动确认银行短信',
    virtual_ledger_guard: '禁止自动改虚拟台账',
    owner_review_guard: '需要老板复核',
  };
  return labels[guard] || guard;
}

function formatBlockedStage(stage?: string) {
  switch (stage) {
    case 'approval_status':
      return '审批状态';
    case 'linked_business_context':
      return '业务上下文';
    case 'payout_execution':
      return '付款留痕';
    case 'role_permission':
      return '角色权限';
    default:
      return '无';
  }
}

function formatLinkedPayoutState(state?: string) {
  switch (state) {
    case 'already_executed':
      return '已执行付款';
    case 'awaiting_payout':
      return '待登记付款';
    case 'not_applicable':
      return '当前不适用';
    case 'not_started':
      return '尚未开始';
    default:
      return state || '-';
  }
}

function formatVerificationCodeStatus(status?: string) {
  switch (status) {
    case 'warn:present_for_hint_only':
      return '已存在，但只作提示';
    case 'warn:not_provided':
      return '未提供，也不构成强阻断';
    default:
      return status || '-';
  }
}

function formatActionStatus(status?: string) {
  switch (status) {
    case 'pending':
      return '待处理';
    case 'ready':
      return '可继续';
    case 'blocked':
      return '阻塞';
    case 'done':
      return '已完成';
    case 'not_applicable':
      return '不适用';
    default:
      return status || '待处理';
  }
}

function actionStatusTagType(status?: string) {
  switch (status) {
    case 'ready':
    case 'done':
      return 'success';
    case 'blocked':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'info';
  }
}

function formatOwnerScope(scope?: string) {
  switch (scope) {
    case 'authorized_roles':
      return '授权角色';
    case 'human_review':
      return '人工复核';
    case 'admin_founder':
      return '管理员 / 创始人';
    default:
      return '当前岗位';
  }
}

onMounted(() => {
  void loadDetail();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.hero-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.hero-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.hero-tag {
  margin-left: 4px;
}

.hero-subtitle {
  margin-top: 8px;
  color: #4b5563;
  line-height: 1.7;
}

.hero-grid,
.diagnostic-grid,
.handling-summary {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 16px;
}

.hero-item,
.diagnostic-item,
.handling-item {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fafafa;
}

.hero-label,
.diagnostic-label,
.handling-label,
.section-subtitle {
  font-size: 12px;
  color: #6b7280;
}

.detail-descriptions {
  margin-top: 4px;
}

.action-block {
  display: grid;
  gap: 12px;
}

.action-title {
  font-size: 15px;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.section-alert,
.check-list,
.suggestion-block,
.audit-section {
  margin-top: 16px;
}

.evidence-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.evidence-subtitle {
  margin-top: 6px;
  color: #6b7280;
}

.evidence-alert {
  margin-bottom: 16px;
}

.evidence-guards {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.check-list,
.plan-card-list {
  display: grid;
  gap: 12px;
}

.check-item,
.plan-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  background: #fff;
}

.check-header,
.plan-card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.check-title,
.plan-card-title,
.timeline-title {
  font-weight: 600;
  color: #111827;
}

.check-reason,
.plan-card-desc,
.audit-text,
.timeline-text {
  margin-top: 8px;
  line-height: 1.7;
  color: #374151;
  white-space: pre-wrap;
}

.plan-card-meta,
.timeline-meta {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}

.plain-list {
  margin: 10px 0 0;
  padding-left: 18px;
  line-height: 1.8;
  color: #374151;
}

@media (max-width: 768px) {
  .hero-header {
    flex-direction: column;
  }

  .hero-grid,
  .diagnostic-grid,
  .handling-summary {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
