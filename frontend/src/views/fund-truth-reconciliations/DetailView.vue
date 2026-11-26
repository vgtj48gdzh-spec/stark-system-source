<template>
  <div class="page-stack" v-loading="loading">
    <el-card>
      <template #header>
        <div class="hero-header">
          <div>
            <div class="hero-title">
              {{ detailData?.primaryObjectNo || `#${detailData?.primaryObjectId || '-'}` }}
              <el-tag class="hero-tag" :type="truthLevelTagType(detailData?.truthLevel)">
                {{ formatTruthLevel(detailData?.truthLevel) }}
              </el-tag>
              <el-tag
                class="hero-tag"
                :type="reconciliationStatusTagType(detailData?.reconciliationStatus)"
              >
                {{ formatReconciliationStatus(detailData?.reconciliationStatus) }}
              </el-tag>
              <el-tag
                class="hero-tag"
                :type="mappingReadinessTagType(detailData?.mappingReadinessStatus)"
              >
                {{ formatMappingReadinessStatus(detailData?.mappingReadinessStatus) }}
              </el-tag>
            </div>
            <div class="hero-subtitle">
              {{ detailData?.summary || '正在加载资金真相对照详情。' }}
            </div>
          </div>
          <el-button @click="router.push('/fund-truth-reconciliations')">返回列表</el-button>
        </div>
      </template>

      <el-alert v-if="isRestrictedView" type="info" :closable="false" show-icon>
        <template #title>当前角色继续走收口版展示</template>
        <div>
          restricted 视图可以看到“映射准备度、缺口、推荐方案”，但不会额外暴露不必要的原始映射细节。
        </div>
      </el-alert>

      <div class="hero-grid">
        <div class="hero-item">
          <span class="hero-label">主对象类型</span>
          <span>{{ formatObjectType(detailData?.primaryObjectType) }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">当前状态</span>
          <span>{{ detailData?.primaryObjectStatus || '-' }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">映射准备度</span>
          <span>{{ formatMappingReadinessStatus(detailData?.mappingReadinessStatus) }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">锚点置信度</span>
          <span>{{ formatAnchorConfidence(mappingReadiness?.anchorConfidence) }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">下一步谁处理</span>
          <span>{{ formatOwnerRole(detailData?.nextOwnerRole) }}</span>
        </div>
        <div class="hero-item">
          <span class="hero-label">推荐动作</span>
          <span>{{ detailData?.recommendedNextStep || '-' }}</span>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>对象基本信息</template>
      <el-descriptions :column="2" border class="detail-descriptions">
        <el-descriptions-item
          v-for="item in detailData?.basicInfo || []"
          :key="item.key"
          :label="item.label"
          :span="item.span || 1"
        >
          <template v-if="item.valueType === 'datetime'">
            <ReadableDateTime :value="item.value" />
          </template>
          <template v-else-if="item.valueType === 'money'">
            {{ formatMoney(item.value) }}
          </template>
          <template v-else>
            {{ item.value ?? '-' }}
          </template>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card>
      <template #header>真相边界说明</template>
      <div class="truth-grid">
        <div class="truth-item">
          <span class="truth-label">对象角色</span>
          <span>{{ formatSourceRole(detailData?.sourceRole) }}</span>
        </div>
        <div class="truth-item">
          <span class="truth-label">真相级别</span>
          <span>{{ formatTruthLevel(detailData?.truthLevel) }}</span>
        </div>
        <div class="truth-item">
          <span class="truth-label">当前对照状态</span>
          <span>{{ formatReconciliationStatus(detailData?.reconciliationStatus) }}</span>
        </div>
        <div class="truth-item">
          <span class="truth-label">只读边界</span>
          <span>{{ detailData?.sourceOfTruthBoundary || '-' }}</span>
        </div>
      </div>

      <div class="section-subtitle">当前依据</div>
      <ul class="plain-list">
        <li>{{ detailData?.currentArrivalBasis || '当前没有到账依据说明。' }}</li>
        <li>{{ detailData?.currentPayoutBasis || '当前没有付款依据说明。' }}</li>
        <li>{{ detailData?.currentApprovalBasis || '当前没有审批依据说明。' }}</li>
      </ul>

      <div class="section-subtitle">固定边界</div>
      <ul class="plain-list">
        <li>{{ detailData?.truthGapPlan?.boundary?.sourceOfTruthBoundary || '-' }}</li>
        <li>{{ detailData?.truthGapPlan?.boundary?.humanConfirmationBoundary || '-' }}</li>
        <li>{{ detailData?.truthGapPlan?.boundary?.payrollBoundary || '-' }}</li>
        <li>{{ detailData?.truthGapPlan?.boundary?.writeBoundary || '-' }}</li>
      </ul>
    </el-card>

    <el-card>
      <template #header>映射准备度</template>
      <div class="gap-summary">
        <div class="gap-item">
          <span class="gap-label">mappingReadinessStatus</span>
          <span>{{ formatMappingReadinessStatus(detailData?.mappingReadinessStatus) }}</span>
        </div>
        <div class="gap-item">
          <span class="gap-label">anchorConfidence</span>
          <span>{{ formatAnchorConfidence(mappingReadiness?.anchorConfidence) }}</span>
        </div>
        <div class="gap-item">
          <span class="gap-label">anchorPlanSummary</span>
          <span>{{ detailData?.anchorPlanSummary || '-' }}</span>
        </div>
        <div class="gap-item">
          <span class="gap-label">recommendedAnchorPlan</span>
          <span>{{ mappingReadiness?.recommendedAnchorPlan || '-' }}</span>
        </div>
      </div>

      <div class="section-subtitle">稳定映射键</div>
      <el-empty
        v-if="!mappingReadiness?.stableMappingKeys?.length"
        description="当前没有可稳定复用的映射键"
        :image-size="72"
      />
      <div v-else class="mapping-card-list">
        <div
          v-for="item in mappingReadiness?.stableMappingKeys || []"
          :key="item.key"
          class="mapping-card"
        >
          <div class="mapping-card-header">
            <div class="mapping-card-title">{{ item.label }}</div>
            <el-tag type="success" effect="plain">稳定锚点</el-tag>
          </div>
          <div class="mapping-card-value">{{ item.value ?? '-' }}</div>
          <div class="mapping-card-note">{{ item.note }}</div>
          <div v-if="!isRestrictedView" class="mapping-card-source">
            来源字段：{{ item.sourceField }}
          </div>
        </div>
      </div>

      <div class="section-subtitle">弱匹配线索</div>
      <el-empty
        v-if="!mappingReadiness?.weakMatchingHints?.length"
        description="当前没有额外弱匹配线索"
        :image-size="72"
      />
      <div v-else class="mapping-card-list">
        <div
          v-for="item in mappingReadiness?.weakMatchingHints || []"
          :key="item.key"
          class="mapping-card warning-card"
        >
          <div class="mapping-card-header">
            <div class="mapping-card-title">{{ item.label }}</div>
            <el-tag type="warning" effect="plain">弱匹配</el-tag>
          </div>
          <div class="mapping-card-value">{{ item.value ?? '-' }}</div>
          <div class="mapping-card-note">{{ item.note }}</div>
          <div v-if="!isRestrictedView" class="mapping-card-source">
            来源字段：{{ item.sourceField }}
          </div>
        </div>
      </div>

      <div class="section-subtitle">缺失锚点</div>
      <el-empty
        v-if="!mappingReadiness?.missingAnchors?.length"
        description="当前没有额外缺失锚点"
        :image-size="72"
      />
      <div v-else class="mapping-card-list">
        <div
          v-for="item in mappingReadiness?.missingAnchors || []"
          :key="item.key"
          class="mapping-card danger-card"
        >
          <div class="mapping-card-header">
            <div class="mapping-card-title">{{ item.label }}</div>
            <el-tag type="danger" effect="plain">待补锚点</el-tag>
          </div>
          <div class="mapping-card-note">{{ item.description }}</div>
          <div class="mapping-card-source">负责方：{{ formatOwnerRole(item.ownerScope) }}</div>
        </div>
      </div>

      <div class="section-subtitle">映射证据</div>
      <ul class="plain-list">
        <li v-for="item in mappingReadiness?.mappingEvidence || []" :key="item">{{ item }}</li>
      </ul>

      <el-alert class="section-alert" type="warning" :closable="false" show-icon>
        <template #title>未来银行真相源接入边界</template>
        <div>{{ mappingReadiness?.futureTruthIngestionBoundary || '-' }}</div>
      </el-alert>
    </el-card>

    <el-card>
      <template #header>关联对象</template>
      <div class="section-subtitle">linkedObjectRefs</div>
      <div class="linked-list">
        <div v-for="item in linkedRefEntries" :key="item.key" class="linked-card">
          <div class="linked-title">{{ item.label }}</div>
          <div class="linked-meta">
            <span>{{ formatObjectType(item.objectType) }}</span>
            <span>{{ item.objectId ? `#${item.objectId}` : '缺少稳定映射键' }}</span>
          </div>
          <div class="linked-note">{{ item.note }}</div>
          <el-button
            v-if="resolveLinkedRoute(item)"
            link
            type="primary"
            @click="router.push(resolveLinkedRoute(item)!)"
          >
            查看映射对象
          </el-button>
        </div>
      </div>

      <el-alert
        v-if="missingLinkedRefEntries.length"
        class="section-alert"
        type="warning"
        :closable="false"
        show-icon
      >
        <template #title>当前仍缺稳定映射键</template>
        <div>
          {{ missingLinkedRefEntries.map((item) => item.label).join('、') }}。
          {{ detailData?.gapSummary || '当前仍需继续人工收口映射缺口。' }}
        </div>
      </el-alert>

      <el-empty
        v-if="!(detailData?.linkedObjectList || []).length"
        description="当前没有稳定关联对象"
        :image-size="72"
      />
      <div v-else class="linked-list">
        <div
          v-for="item in detailData?.linkedObjectList || []"
          :key="`${item.objectType}-${item.objectId}`"
          class="linked-card"
        >
          <div class="linked-title">{{ item.label }}</div>
          <div class="linked-meta">
            <span>{{ formatObjectType(item.objectType) }}</span>
            <span>{{ item.displayValue }}</span>
          </div>
          <div class="linked-note">
            {{ item.note || '当前只展示已存在的稳定关联，不推断不存在的银行真相对象。' }}
          </div>
          <el-button
            v-if="resolveLinkedRoute(item)"
            link
            type="primary"
            @click="router.push(resolveLinkedRoute(item)!)"
          >
            查看对象
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>Gap 与处理建议</template>
      <div class="gap-summary">
        <div class="gap-item">
          <span class="gap-label">gapSummary</span>
          <span>{{ detailData?.gapSummary || '-' }}</span>
        </div>
        <div class="gap-item">
          <span class="gap-label">recommendedNextStep</span>
          <span>{{ detailData?.recommendedNextStep || '-' }}</span>
        </div>
      </div>

      <div class="section-subtitle">truthGapPlan</div>
      <div class="plan-card-list">
        <div
          v-for="item in detailData?.truthGapPlan?.actionItems || []"
          :key="item.actionKey"
          class="plan-card"
        >
          <div class="plan-card-header">
            <div class="plan-card-title">{{ item.title }}</div>
            <el-tag :type="actionStatusTagType(item.status)">
              {{ formatActionStatus(item.status) }}
            </el-tag>
          </div>
          <div class="plan-card-meta">处理范围：{{ formatOwnerRole(item.ownerScope) }}</div>
          <div class="plan-card-desc">{{ item.description || '-' }}</div>
        </div>
      </div>
    </el-card>

    <el-card v-if="detailData?.visibilityScope === 'full'">
      <template #header>审计补充</template>
      <ul class="plain-list">
        <li v-for="item in detailData?.auditHints || []" :key="item">{{ item }}</li>
      </ul>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getFundTruthReconciliationDetail,
  type FundTruthMappingReadiness,
  type FundTruthReconciliationRecord,
} from '../../api/fund-truth-reconciliations';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatMoney } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const detailData = ref<FundTruthReconciliationRecord | null>(null);

const primaryObjectType = computed(() => String(route.params.primaryObjectType || ''));
const primaryObjectId = computed(() => String(route.params.primaryObjectId || ''));
const isRestrictedView = computed(() => detailData.value?.visibilityScope === 'restricted');
const mappingReadiness = computed<FundTruthMappingReadiness | null>(
  () => detailData.value?.mappingReadiness || null,
);
const linkedRefEntries = computed(() => {
  const refs = detailData.value?.linkedObjectRefs || {};
  return [
    {
      key: 'approvalRequestId',
      label: '审批单映射键',
      objectType: 'approval_request',
      objectId: refs.approvalRequestId ?? null,
      note: refs.approvalRequestId
        ? '当前已能挂到稳定审批对象。'
        : '当前还没有稳定审批映射键，只保留缺口说明，不推断不存在的审批真相。',
    },
    {
      key: 'paymentRecordId',
      label: '到账语义映射键',
      objectType: 'payment_record',
      objectId: refs.paymentRecordId ?? null,
      note: refs.paymentRecordId
        ? '当前已能挂到仓内到账语义对象。'
        : '当前还没有稳定到账语义映射键，到账依据仍需人工核对。',
    },
    {
      key: 'payoutRecordId',
      label: '付款登记映射键',
      objectType: 'payout_record',
      objectId: refs.payoutRecordId ?? null,
      note: refs.payoutRecordId
        ? '当前已能挂到付款登记对象，但它仍不是银行主账。'
        : '当前还没有稳定付款登记映射键，不能把审批或到账背景误判成真实出款。',
    },
    {
      key: 'abcSyncFundId',
      label: '同步副本映射键',
      objectType: 'abc_sync_fund',
      objectId: refs.abcSyncFundId ?? null,
      note: refs.abcSyncFundId
        ? '当前已能挂到同步副本对象，但同步副本仍不是银行主账。'
        : '当前还没有稳定同步副本映射键，不能把缺口自动脑补为已完成映射。',
    },
    {
      key: 'workOrderId',
      label: '工单映射键',
      objectType: 'work_order',
      objectId: refs.workOrderId ?? null,
      note: refs.workOrderId
        ? '当前已能挂到业务工单上下文。'
        : '当前还没有稳定工单映射键，业务上下文仍未站稳。',
    },
  ];
});
const missingLinkedRefEntries = computed(() =>
  linkedRefEntries.value.filter(
    (item) => !item.objectId && item.objectType !== detailData.value?.primaryObjectType,
  ),
);

async function loadDetail() {
  loading.value = true;
  try {
    const { data } = await getFundTruthReconciliationDetail(
      primaryObjectType.value,
      primaryObjectId.value,
    );
    detailData.value = data.data;
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '资金真相对照详情加载失败',
    );
  } finally {
    loading.value = false;
  }
}

function formatObjectType(value?: string) {
  switch (value) {
    case 'approval_request':
      return '审批控制对象';
    case 'payment_record':
      return '到账语义对象';
    case 'payout_record':
      return '付款登记对象';
    case 'abc_sync_fund':
      return '同步副本对象';
    case 'work_order':
      return '工单对象';
    default:
      return value || '-';
  }
}

function formatSourceRole(value?: string) {
  switch (value) {
    case 'approval_control':
      return 'approval_control';
    case 'business_arrival_semantics':
      return 'business_arrival_semantics';
    case 'payout_registration':
      return 'payout_registration';
    case 'sync_replica':
      return 'sync_replica';
    case 'report_only':
      return 'report_only';
    default:
      return value || '-';
  }
}

function formatTruthLevel(value?: string) {
  switch (value) {
    case 'supporting_source':
      return '辅助来源';
    case 'replica_only':
      return '副本专用';
    case 'not_truth_source':
      return '非真相源';
    default:
      return value || '-';
  }
}

function formatReconciliationStatus(value?: string) {
  switch (value) {
    case 'aligned':
      return '已对齐';
    case 'partially_aligned':
      return '部分对齐';
    case 'missing_link':
      return '缺少关联';
    case 'no_truth_source':
      return '没有真相源';
    case 'needs_manual_review':
      return '待人工复核';
    default:
      return value || '-';
  }
}

function formatOwnerRole(value?: string) {
  switch (value) {
    case 'approver_or_admin':
      return '审批人 / 管理员';
    case 'finance':
      return '财务';
    case 'finance_audit':
      return '财务复核';
    case 'finance_manual_review':
      return '财务人工复核';
    case 'finance_data_review':
      return '财务 / 数据复核';
    case 'admin_data_review':
      return '管理员 / 数据治理';
    case 'data_governance':
      return '数据治理';
    case 'business_requester':
      return '业务申请方';
    case 'shared_manual_review':
      return '人工复核';
    default:
      return value || '-';
  }
}

function formatMappingReadinessStatus(value?: string) {
  switch (value) {
    case 'ready':
      return '已就绪';
    case 'partially_ready':
      return '部分就绪';
    case 'weak_anchor_only':
      return '仅弱锚点';
    case 'not_ready':
      return '未就绪';
    default:
      return value || '-';
  }
}

function formatAnchorConfidence(value?: string) {
  switch (value) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
      return '低';
    default:
      return '-';
  }
}

function formatActionStatus(value?: string) {
  switch (value) {
    case 'done':
      return '已完成';
    case 'ready':
      return '可继续';
    case 'pending':
      return '待处理';
    case 'blocked':
      return '阻塞';
    case 'not_applicable':
      return '不适用';
    default:
      return value || '-';
  }
}

function truthLevelTagType(value?: string) {
  switch (value) {
    case 'supporting_source':
      return 'warning';
    case 'replica_only':
      return 'info';
    case 'not_truth_source':
      return 'danger';
    default:
      return 'info';
  }
}

function reconciliationStatusTagType(value?: string) {
  switch (value) {
    case 'aligned':
      return 'success';
    case 'partially_aligned':
      return 'warning';
    case 'missing_link':
      return 'danger';
    case 'no_truth_source':
      return 'info';
    case 'needs_manual_review':
      return 'warning';
    default:
      return 'info';
  }
}

function mappingReadinessTagType(value?: string) {
  switch (value) {
    case 'ready':
      return 'success';
    case 'partially_ready':
      return 'warning';
    case 'weak_anchor_only':
      return 'info';
    case 'not_ready':
      return 'danger';
    default:
      return 'info';
  }
}

function actionStatusTagType(value?: string) {
  switch (value) {
    case 'done':
    case 'ready':
      return 'success';
    case 'pending':
      return 'warning';
    case 'blocked':
      return 'danger';
    default:
      return 'info';
  }
}

function resolveLinkedRoute(item: any) {
  if (
    item?.objectType === primaryObjectType.value &&
    String(item?.objectId || '') === primaryObjectId.value
  ) {
    return null;
  }

  switch (item?.objectType) {
    case 'approval_request':
      return `/approval-requests/${item.objectId}`;
    case 'payment_record':
      return `/payment-records/${item.objectId}`;
    case 'payout_record':
    case 'abc_sync_fund':
      return `/fund-truth-reconciliations/${item.objectType}/${item.objectId}`;
    case 'work_order':
      return `/work-orders/${item.objectId}`;
    default:
      return null;
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
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
}

.hero-subtitle {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #6b7280;
}

.hero-tag {
  margin-left: 0;
}

.hero-grid,
.truth-grid,
.gap-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.hero-item,
.truth-item,
.gap-item,
.linked-card,
.plan-card,
.mapping-card {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
}

.warning-card {
  background: #fffaf0;
}

.danger-card {
  background: #fff5f5;
}

.hero-label,
.truth-label,
.gap-label {
  font-size: 12px;
  color: #6b7280;
}

.section-subtitle {
  margin: 16px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.section-alert {
  margin-top: 16px;
}

.plain-list {
  display: grid;
  gap: 10px;
  padding-left: 18px;
  margin: 0;
  color: #374151;
  line-height: 1.7;
}

.linked-list,
.plan-card-list,
.mapping-card-list {
  display: grid;
  gap: 12px;
}

.linked-title,
.plan-card-title,
.mapping-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.linked-meta,
.plan-card-meta,
.linked-note,
.plan-card-desc,
.mapping-card-note,
.mapping-card-source {
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
}

.mapping-card-value {
  font-size: 14px;
  line-height: 1.6;
  color: #111827;
  word-break: break-all;
}

.plan-card-header,
.mapping-card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}
</style>
