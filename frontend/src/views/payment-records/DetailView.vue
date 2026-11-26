<template>
  <div class="page-stack" v-loading="loading">
    <el-card>
      <template #header>
        <div class="hero-header">
          <div>
            <div class="hero-title">
              收款确认命令详情
              <el-tag class="hero-tag" :type="paymentStatusTagType(paymentInfo?.paymentStatus || detailData?.paymentStatus)">
                {{ formatPaymentStatus(paymentInfo?.paymentStatus || detailData?.paymentStatus) }}
              </el-tag>
            </div>
            <div class="hero-subtitle">
              {{ detailData?.handlingPlan?.summary || detailData?.commandExplanation || '当前正在加载这条收款记录的处理摘要。' }}
            </div>
          </div>
          <el-button @click="router.push('/payment-records')">返回列表</el-button>
        </div>
      </template>

      <el-alert
        v-if="isRestrictedView"
        type="info"
        :closable="false"
        show-icon
      >
        <template #title>当前角色默认查看 handlingPlan-first 收口版</template>
        <div>
          兼容字段仍会保留，但不会比 handlingPlan 暴露更多细节；备注、创建人和审计补充都会按最小安全范围展示。
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
          <span class="hero-label">何时可确认</span>
          <span>{{ detailData?.suggestedNextStep || detailData?.handlingPlan?.diagnosis?.suggestedNextStep || '-' }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">blocked 原因</span>
          <span>{{ formatBlockedReason(detailData?.blockedReason) }}</span>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>收款记录基本信息</template>

      <el-descriptions v-if="detailData" :column="2" border class="detail-descriptions">
        <el-descriptions-item label="收款编号">
          {{ paymentInfo?.paymentNo || detailData.paymentNo || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="收款状态">
          <el-tag :type="paymentStatusTagType(paymentInfo?.paymentStatus || detailData?.paymentStatus)">
            {{ formatPaymentStatus(paymentInfo?.paymentStatus || detailData?.paymentStatus) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="收款渠道">
          {{ paymentInfo?.channel || detailData?.channel || detailData?.paymentMethod || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="请求来源">
          {{ paymentInfo?.requestSource || detailData?.requestSource || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="金额">
          {{ formatMoney(paymentInfo?.amount || detailData?.amount) }}
        </el-descriptions-item>
        <el-descriptions-item label="付款人">
          {{ paymentInfo?.payerName || detailData?.payerName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="收款时间">
          {{ formatDateTime(paymentInfo?.paidAt || detailData?.paidAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDateTime(paymentInfo?.createdAt || detailData?.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="关联工单">
          {{ linkedWorkOrder?.workOrderNo || detailData?.linkedWorkOrderSummary?.workOrderNo || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="工单当前状态">
          {{ linkedWorkOrder?.status || detailData?.linkedWorkOrderSummary?.status || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="到账依据" :span="2">
          {{ detailData?.sourceOfTruth || detailData?.handlingPlan?.diagnosis?.currentArrivalBasis || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ paymentInfo?.remark || detailData?.remark || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="section-subtitle">关联工单与金额影响</div>
      <div class="diagnostic-grid">
        <div class="diagnostic-item">
          <span class="diagnostic-label">工单标题</span>
          <span>{{ linkedWorkOrder?.title || detailData?.linkedWorkOrderSummary?.title || '-' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">工单负责人</span>
          <span>{{ linkedWorkOrder?.responsibleUserName || detailData?.linkedWorkOrderSummary?.responsibleUserName || '-' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">当前工单实收</span>
          <span>{{ formatMoney(amountImpact?.currentWorkOrderAmountReceived || detailData?.linkedWorkOrderSummary?.amountReceived) }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">确认后预计工单实收</span>
          <span>{{ formatMoney(amountImpact?.expectedWorkOrderAmountReceivedAfterFinalize) }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">当前工单状态</span>
          <span>{{ amountImpact?.currentWorkOrderStatus || linkedWorkOrder?.status || '-' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">确认后预计工单状态</span>
          <span>{{ amountImpact?.expectedWorkOrderStatusAfterFinalize || '-' }}</span>
        </div>
      </div>

      <el-alert
        v-if="amountImpact?.summary"
        class="section-alert"
        type="info"
        :closable="false"
        show-icon
      >
        <template #title>amountImpact 摘要</template>
        <div>{{ amountImpact.summary }}</div>
      </el-alert>
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
            {{ precheckData?.canExecute ? '可继续处理' : '当前不可直接处理' }}
          </el-tag>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">blocked 原因</span>
          <span>{{ formatBlockedReason(precheckData?.blockedReason) }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">blocked 阶段</span>
          <span>{{ formatBlockedStage(precheckData?.blockedStage) }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">paymentStatus 是否仍可确认</span>
          <span>{{ precheckData?.paymentStatusAllowsFinalize ? '允许沿现有路径确认' : '当前只适合查看结果态' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">已有关联工单</span>
          <span>{{ precheckData?.linkedWorkOrderPresent ? '已关联' : '缺失' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">duplicateSuccessRisk</span>
          <span>{{ precheckData?.duplicateSuccessRisk?.summary || '-' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">paymentChannelRecognition</span>
          <span>{{ precheckData?.paymentChannelRecognition?.summary || '-' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">amountConsistency</span>
          <span>{{ precheckData?.amountConsistency?.summary || '-' }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">workOrderStateImpact</span>
          <span>{{ precheckData?.workOrderStateImpact?.summary || '-' }}</span>
        </div>
      </div>

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
        <div class="section-subtitle">remediationSuggestions</div>
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
          <span class="handling-label">缺哪个条件</span>
          <span>{{ detailData?.handlingPlan?.diagnosis?.missingCondition || '-' }}</span>
        </div>
        <div class="handling-item">
          <span class="handling-label">下一步谁处理</span>
          <span>{{ detailData?.handlingPlan?.diagnosis?.nextOwner || '-' }}</span>
        </div>
        <div class="handling-item">
          <span class="handling-label">当前到账依据</span>
          <span>{{ detailData?.handlingPlan?.diagnosis?.currentArrivalBasis || '-' }}</span>
        </div>
        <div class="handling-item">
          <span class="handling-label">suggestedNextStep</span>
          <span>{{ detailData?.handlingPlan?.diagnosis?.suggestedNextStep || detailData?.suggestedNextStep || '-' }}</span>
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
          <div class="plan-card-meta">处理范围：{{ formatOwnerScope(item.ownerScope) }}</div>
          <div class="plan-card-desc">{{ item.description || '-' }}</div>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>审计补充</template>

      <div class="audit-section">
        <div class="section-subtitle">commandExplanation</div>
        <div class="audit-text">{{ detailData?.commandExplanation || '-' }}</div>
      </div>

      <div class="audit-section">
        <div class="section-subtitle">executionTrace</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="当前状态">
            {{ detailData?.executionTrace?.currentStatus || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="latestOperation">
            {{ detailData?.executionTrace?.latestOperation || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="canExecute">
            {{ detailData?.executionTrace?.canExecute ? 'true' : 'false' }}
          </el-descriptions-item>
          <el-descriptions-item label="statusAppliedToWorkOrder">
            {{ detailData?.executionTrace?.statusAppliedToWorkOrder ? 'true' : 'false' }}
          </el-descriptions-item>
          <el-descriptions-item label="latestPaymentNo">
            {{ detailData?.executionTrace?.latestPaymentNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="latestPaymentAt">
            {{ formatDateTime(detailData?.executionTrace?.latestPaymentAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="预计工单实收">
            {{ formatMoney(detailData?.executionTrace?.expectedWorkOrderAmountReceivedAfterFinalize) }}
          </el-descriptions-item>
          <el-descriptions-item label="预计工单状态">
            {{ detailData?.executionTrace?.expectedWorkOrderStatusAfterFinalize || '-' }}
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
      page-title="收款确认命令详情"
      route-path="/payment-records/:id"
      entity-type="payment_record_command"
      :entity-id="String(paymentId)"
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
  getPaymentRecordDetail,
  getPaymentRecordPrecheck,
} from '../../api/payment-records';
import { formatDateTime, formatMoney } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const detailData = ref<any | null>(null);
const precheckResponse = ref<any | null>(null);

const paymentId = computed(() => Number(route.params.id));
const paymentInfo = computed(() => detailData.value?.payment || null);
const linkedWorkOrder = computed(() => detailData.value?.linkedWorkOrder || null);
const amountImpact = computed(() => detailData.value?.amountImpact || null);
const precheckData = computed(() => precheckResponse.value || detailData.value?.paymentPrecheck || null);
const isRestrictedView = computed(() => detailData.value?.handlingPlan?.visibilityScope !== 'full');

const aiSourceActionId = computed(() => {
  if (typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()) {
    return route.query.sourceActionId.trim();
  }
  return null;
});

const aiCurrentFilters = computed(() => ({
  routePath: route.path,
  paymentStatus: detailData.value?.paymentStatus || '',
  blockedReason: detailData.value?.blockedReason || '',
  blockedStage: detailData.value?.blockedStage || '',
  precheckStatus: precheckData.value?.precheckStatus || '',
  executionCapability: detailData.value?.executionCapability || '',
  sourceActionId: aiSourceActionId.value || undefined,
}));

async function loadDetail() {
  loading.value = true;
  try {
    const [detailRes, precheckRes] = await Promise.all([
      getPaymentRecordDetail(route.params.id as string),
      getPaymentRecordPrecheck(route.params.id as string),
    ]);
    detailData.value = detailRes.data.data;
    precheckResponse.value = precheckRes.data.data;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '收款记录详情加载失败');
  } finally {
    loading.value = false;
  }
}

function formatPaymentStatus(status?: string) {
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

function paymentStatusTagType(status?: string) {
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

function formatBlockedReason(reason?: string | null) {
  switch (reason) {
    case 'payment_not_actionable':
      return '当前 paymentStatus 不再适合作为待确认到账对象';
    case 'linked_work_order_missing':
      return '缺少关联工单上下文';
    case 'duplicate_success_risk':
      return '疑似存在重复 success 留痕';
    case 'actor_not_allowed':
      return '当前角色不能继续处理到账确认';
    case 'already_applied_to_work_order':
      return '当前记录已经作用到工单实收与状态';
    default:
      return '无硬阻塞';
  }
}

function formatBlockedStage(stage?: string | null) {
  switch (stage) {
    case 'payment_status':
      return 'paymentStatus 状态';
    case 'linked_work_order':
      return '关联工单';
    case 'duplicate_success_check':
      return '重复到账检查';
    case 'role_permission':
      return '角色权限';
    case 'work_order_state':
      return '工单状态影响';
    default:
      return '-';
  }
}

function formatActionStatus(status?: string) {
  switch (status) {
    case 'ready':
      return '可继续';
    case 'pending':
      return '待处理';
    case 'blocked':
      return '阻塞';
    case 'done':
      return '已完成';
    case 'not_applicable':
      return '不适用';
    default:
      return status || '-';
  }
}

function actionStatusTagType(status?: string) {
  switch (status) {
    case 'ready':
    case 'done':
      return 'success';
    case 'pending':
      return 'warning';
    case 'blocked':
      return 'danger';
    default:
      return 'info';
  }
}

function formatOwnerScope(scope?: string) {
  switch (scope) {
    case 'finance_admin': return '财务 / 管理员'; /*
      return '财务 / 管理员';
    */ case 'finance_admin_founder': return '财务 / 管理员 / founder'; /*
      return '财务 / 管理员 / founder';
    */ case 'restricted_roles': return 'restricted 角色先查看'; /*
      return 'restricted 角色先查看';
    */ case 'human_review':
      return '人工复核';
    default:
      return scope || '-';
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

.section-alert,
.check-list,
.suggestion-block,
.audit-section {
  margin-top: 16px;
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
}
</style>
