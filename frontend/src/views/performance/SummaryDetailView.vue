<template>
  <div class="page-stack">
    <el-card v-loading="summaryLoading">
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">绩效汇总详情</div>
            <div class="subtitle">查看该汇总由哪些绩效事件组成，并在单条样本上做客户绑定人工裁决。</div>
          </div>
          <el-space>
            <el-button @click="router.back()">返回</el-button>
            <el-button
              v-if="canGenerateSummaries && summaryData"
              type="primary"
              :loading="regenerating"
              @click="handleRegenerate"
            >
              重新生成本汇总
            </el-button>
          </el-space>
        </div>
      </template>

      <el-alert
        v-if="summaryData?.customerBinding?.bindingStatus === 'manually_bound'"
        type="success"
        :closable="false"
        class="confirmation-result-alert"
      >
        <template #title>
          已人工确认客户：{{ summaryData.customerBinding?.matchedCustomerName || summaryData.customerName || '-' }}
        </template>
        <div class="subtle-text">
          确认人：{{ summaryData.customerBinding?.boundByName || summaryData.customerBinding?.boundBy || '-' }}
          / 确认时间：{{ formatDateTime(summaryData.customerBinding?.boundAt) }}
        </div>
        <div class="subtle-text">
          当前阻塞：{{ summaryData.performanceBlockReason || '-' }}
          / {{ summaryData.performanceDecisionReason || formatPerformanceBlockReason(summaryData.performanceBlockReason) }}
        </div>
      </el-alert>

      <el-descriptions v-if="summaryData" :column="2" border>
        <el-descriptions-item label="周期">{{ summaryData.periodKey || '-' }}</el-descriptions-item>
        <el-descriptions-item label="员工">{{ summaryData.employeeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="来源域">{{ formatPerformanceDomain(summaryData.sourceDomain) }}</el-descriptions-item>
        <el-descriptions-item label="客户姓名">
          {{ summaryData.customerName || '源链暂无稳定客户信息 / 待人工绑定' }}
        </el-descriptions-item>
        <el-descriptions-item label="客户手机号">
          {{ summaryData.customerMobile || '源链暂无稳定手机号 / 待人工绑定' }}
        </el-descriptions-item>
        <el-descriptions-item label="匹配客户ID">{{ summaryData.matchedCustomerId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="项目/套餐">{{ summaryData.packageName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="客户绑定">
          {{ formatCustomerBindingStatus(summaryData.customerBinding?.bindingStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="绑定备注" :span="2">
          {{ summaryData.customerBinding?.bindingRemark || '源链暂无稳定手机号 / 待人工绑定' }}
        </el-descriptions-item>
        <el-descriptions-item label="绩效条件">
          <el-tag
            v-if="summaryData.performanceReadyFlag !== null"
            :type="summaryData.performanceReadyFlag ? 'success' : 'warning'"
          >
            {{ summaryData.performanceReadyFlag ? '已具备基础条件' : '暂未具备基础条件' }}
          </el-tag>
          <span v-else>源链暂无稳定手机号 / 待人工绑定</span>
        </el-descriptions-item>
        <el-descriptions-item label="阻塞原因">
          <div>{{ summaryData.performanceDecisionReason || formatPerformanceBlockReason(summaryData.performanceBlockReason) }}</div>
          <div class="subtle-text">阻塞编码：{{ summaryData.performanceBlockReason || '-' }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="支付/对账">
          {{ formatPaymentStatus(summaryData.paymentStatus) }} /
          {{ formatSourceClassification(summaryData.sourceClassification) }} /
          {{ formatReconciliationStatus(summaryData.reconciliationStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="对账说明">{{ summaryData.reconciliationReason || '-' }}</el-descriptions-item>
        <el-descriptions-item label="A端已支付金额">{{ formatMoney(summaryData.linkedPaidAAmount) }}</el-descriptions-item>
        <el-descriptions-item label="B卡已发放金额">{{ formatMoney(summaryData.linkedBCardAmount) }}</el-descriptions-item>
        <el-descriptions-item label="B卡来源">{{ formatBCardSourceType(summaryData.linkedBCardSourceType) }}</el-descriptions-item>
        <el-descriptions-item label="套餐证据">
          <el-tag :type="summaryData.bundleEvidenceStrong ? 'success' : 'info'">
            {{ summaryData.bundleEvidenceStrong ? '强证据命中' : '证据不足 / 待核对' }}
          </el-tag>
          <div class="subtle-text">{{ summaryData.bundleInferenceReason || '-' }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="事件数">{{ summaryData.eventCount }}</el-descriptions-item>
        <el-descriptions-item label="已确认">{{ summaryData.confirmedEventCount }}</el-descriptions-item>
        <el-descriptions-item label="待确认">{{ summaryData.pendingEventCount }}</el-descriptions-item>
        <el-descriptions-item v-if="canViewAmounts" label="金额汇总">
          {{ formatMoney(summaryData.amountTotal) }}
        </el-descriptions-item>
        <el-descriptions-item label="数量汇总">{{ formatMoney(summaryData.quantityTotal) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间" :span="2">
          <ReadableDateTime :value="summaryData.updatedAt" />
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="summaryData" class="confirm-binding-panel">
        <div class="section-title">客户绑定人工裁决</div>
        <div class="subtle-text">
          当前只针对本汇总的第一候选客户做单条人工裁决，不批量处理其他样本，也不自动推进正式工资。
        </div>

        <div class="confirm-binding-grid">
          <div class="confirm-binding-item">
            <span class="confirm-binding-label">当前候选客户</span>
            <span>{{ summaryData.matchedCustomerName || summaryData.customerName || '-' }}</span>
          </div>
          <div class="confirm-binding-item">
            <span class="confirm-binding-label">候选客户ID</span>
            <span>{{ summaryData.matchedCustomerId || '-' }}</span>
          </div>
          <div class="confirm-binding-item">
            <span class="confirm-binding-label">候选手机号</span>
            <span>{{ summaryData.matchedCustomerMobile || summaryData.customerMobile || '-' }}</span>
          </div>
          <div class="confirm-binding-item">
            <span class="confirm-binding-label">当前绑定状态</span>
            <span>{{ formatCustomerBindingStatus(summaryData.customerBinding?.bindingStatus) }}</span>
          </div>
        </div>

        <div v-if="summaryData.manualDecision" class="manual-decision-result">
          <div class="section-subtitle">最新人工裁决</div>
          <div class="confirm-binding-grid">
            <div class="confirm-binding-item">
              <span class="confirm-binding-label">动作</span>
              <span>{{ formatManualDecisionAction(summaryData.manualDecision.actionType) }}</span>
            </div>
              <div class="confirm-binding-item">
                <span class="confirm-binding-label">原因短码（可选）</span>
                <span>{{ summaryData.manualDecision.reasonCode || '-' }}</span>
              </div>
            <div class="confirm-binding-item">
              <span class="confirm-binding-label">适用范围</span>
              <span>{{ formatDecisionScope(summaryData.manualDecision.decisionScope) }}</span>
            </div>
            <div class="confirm-binding-item">
              <span class="confirm-binding-label">AI 学习模式</span>
              <span>{{ formatAiLearningMode(summaryData.manualDecision.aiLearningMode) }}</span>
            </div>
            <div class="confirm-binding-item">
              <span class="confirm-binding-label">最终客户ID</span>
              <span>{{ summaryData.manualDecision.finalMatchedCustomerId || '-' }}</span>
            </div>
            <div class="confirm-binding-item">
              <span class="confirm-binding-label">最终分类</span>
              <span>{{ formatManualClassification(summaryData.manualDecision.finalClassification) }}</span>
            </div>
            <div class="confirm-binding-item">
              <span class="confirm-binding-label">影响绩效统计</span>
              <span>{{ summaryData.manualDecision.affectPerformanceFlag ? '是' : '否' }}</span>
            </div>
            <div class="confirm-binding-item">
              <span class="confirm-binding-label">影响 B 卡统计</span>
              <span>{{ summaryData.manualDecision.affectBCardFlag ? '是' : '否' }}</span>
            </div>
            <div class="confirm-binding-item">
              <span class="confirm-binding-label">裁决人</span>
              <span>{{ summaryData.manualDecision.operatorName || summaryData.manualDecision.operatorId || '-' }}</span>
            </div>
            <div class="confirm-binding-item">
              <span class="confirm-binding-label">裁决时间</span>
              <span>{{ formatDateTime(summaryData.manualDecision.operatedAt) }}</span>
            </div>
          </div>
          <div class="subtle-text">判断依据：{{ formatJudgmentBasis(summaryData.manualDecision.judgmentBasis) }}</div>
          <div class="subtle-text">备注：{{ summaryData.manualDecision.remark || '-' }}</div>
        </div>

        <div v-if="canManageManualDecision" class="confirm-binding-actions">
          <el-select v-model="manualDecisionForm.actionType" style="width: 260px">
            <el-option
              v-for="item in manualDecisionActions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>

          <el-select v-model="manualDecisionForm.decisionScope" style="width: 260px" placeholder="请选择适用范围">
            <el-option
              v-for="item in decisionScopeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>

          <el-select
            v-model="manualDecisionForm.aiLearningMode"
            style="width: 260px"
            placeholder="请选择 AI 学习模式"
          >
            <el-option
              v-for="item in aiLearningModeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>

          <el-select
            v-model="manualDecisionForm.judgmentBasis"
            multiple
            collapse-tags
            collapse-tags-tooltip
            style="width: 100%"
            placeholder="请选择判断依据"
          >
            <el-option
              v-for="item in judgmentBasisOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>

          <el-input
            v-if="manualDecisionForm.actionType === 'reassign_customer'"
            v-model="manualDecisionForm.finalMatchedCustomerId"
            placeholder="请输入新的 customerId"
          />

          <el-select
            v-if="manualDecisionForm.actionType === 'reclassify_record'"
            v-model="manualDecisionForm.finalClassification"
            placeholder="请选择人工分类"
            style="width: 260px"
          >
            <el-option
              v-for="item in manualClassifications"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>

            <el-input
              v-model="manualDecisionForm.reasonCode"
              maxlength="100"
              placeholder="可选短码，如 auto_basis_manual_omission；长说明请写备注"
            />
            <div class="subtle-text">留空也可以，系统会按判断依据自动生成短码并写入审计记录。</div>

          <el-input
            v-model="manualDecisionForm.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="请填写人工裁决备注"
          />

          <el-button
            type="primary"
            :loading="manualDecisionSubmitting"
            :disabled="manualDecisionSubmitDisabled"
            @click="handleSubmitManualDecision"
          >
            提交人工裁决
          </el-button>
        </div>
        <div v-else class="subtle-text">仅 admin / finance / founder / super_admin / owner 可执行本条人工裁决。</div>

        <div v-if="summaryData.manualDecisionHistory?.length" class="manual-decision-history">
          <div class="section-subtitle">人工裁决历史</div>
          <div
            v-for="item in summaryData.manualDecisionHistory"
            :key="`${item.id}-${item.operatedAt}`"
            class="history-item"
          >
            <div>
              {{ formatDateTime(item.operatedAt) }} / {{ item.operatorName || item.operatorId || '-' }} /
              {{ formatManualDecisionAction(item.actionType) }}
            </div>
            <div class="subtle-text">
              scope={{ formatDecisionScope(item.decisionScope) }} /
              basis={{ formatJudgmentBasis(item.judgmentBasis) }} /
              ai={{ formatAiLearningMode(item.aiLearningMode) }}
            </div>
            <div class="subtle-text">
              reason={{ item.reasonCode || '-' }} /
              finalCustomer={{ item.finalMatchedCustomerId || '-' }} /
              finalClassification={{ formatManualClassification(item.finalClassification) }} /
              affectPerformance={{ item.affectPerformanceFlag ? 'Y' : 'N' }} /
              affectBCard={{ item.affectBCardFlag ? 'Y' : 'N' }}
            </div>
            <div class="subtle-text">{{ item.remark || '-' }}</div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-title">汇总构成事件</div>
      </template>

      <el-form inline class="filters">
        <el-form-item label="确认状态">
          <el-select v-model="filters.confirmedFlag" clearable style="width: 140px">
            <el-option label="已确认" :value="true" />
            <el-option label="待确认" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="eventTableData" v-loading="eventLoading">
        <el-table-column prop="employeeName" label="员工" min-width="120" show-overflow-tooltip />
        <el-table-column label="事件类型" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ formatPerformanceEventType(row.eventType) }}</template>
        </el-table-column>
        <el-table-column prop="sourceTable" label="来源表" min-width="140" show-overflow-tooltip />
        <el-table-column prop="sourceOrderNo" label="来源单号" min-width="180" show-overflow-tooltip />
        <el-table-column label="客户核对" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.customerName || '源链暂无稳定客户信息 / 待人工绑定' }}</div>
            <div class="subtle-text">{{ row.customerMobile || '-' }}</div>
            <div class="subtle-text">客户ID：{{ row.matchedCustomerId || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="项目/套餐" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ row.packageName || '-' }}</template>
        </el-table-column>
        <el-table-column label="客户绑定" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ formatCustomerBindingStatus(row.customerBinding?.bindingStatus) }}</div>
            <div class="subtle-text">{{ row.matchReason || row.evidenceSummary || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="绩效条件" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="row.performanceReadyFlag !== null" :type="row.performanceReadyFlag ? 'success' : 'warning'">
              {{ row.performanceReadyFlag ? '已具备基础条件' : '暂未具备基础条件' }}
            </el-tag>
            <div class="subtle-text">
              {{ row.performanceDecisionReason || formatPerformanceBlockReason(row.performanceBlockReason) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="支付/对账" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ formatPaymentStatus(row.paymentStatus) }} / {{ formatSourceClassification(row.sourceClassification) }}</div>
            <div class="subtle-text">
              {{ formatReconciliationStatus(row.reconciliationStatus) }}：{{ row.reconciliationReason || '-' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="canViewAmounts" label="金额" min-width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.amountStandard) }}</template>
        </el-table-column>
        <el-table-column label="数量" min-width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.quantityStandard) }}</template>
        </el-table-column>
        <el-table-column label="确认状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.confirmedFlag ? 'success' : 'warning'">
              {{ formatConfirmedFlag(row.confirmedFlag) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处理动作" min-width="120">
          <template #default="{ row }">{{ formatHandlingAction(row.handlingAction) }}</template>
        </el-table-column>
        <el-table-column label="发生时间" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <ReadableDateTime :value="row.occurredAt" />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="说明" min-width="220" show-overflow-tooltip />
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next"
        :total="eventTotal"
        :page-size="query.pageSize"
        :current-page="query.page"
        @current-change="handlePageChange"
      />
    </el-card>

    <AiSideAssistant
      page-title="绩效汇总详情"
      route-path="/performance/summaries/:id"
      :current-filters="aiCurrentFilters"
      :source-action-id="aiSourceActionId"
      entity-type="performance_summary"
      :entity-id="summaryId"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  decidePerformanceSummaryManualDecision,
  generatePerformanceSummaries,
  getPerformanceSummaryDetail,
} from '../../api/performance';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatBCardSourceType,
  formatCustomerBindingStatus,
  formatPaymentStatus,
  formatPerformanceBlockReason,
  formatReconciliationStatus,
  formatSourceClassification,
} from '../../utils/business-stats';
import { formatDateTime, formatMoney } from '../../utils/format';
import { hasAnyRole, hasPermission } from '../../utils/permissions';
import {
  formatConfirmedFlag,
  formatHandlingAction,
  formatPerformanceDomain,
  formatPerformanceEventType,
} from '../../utils/performance';

const manualDecisionActions = [
  { value: 'confirm_binding', label: '确认绑定' },
  { value: 'reject_candidate', label: '驳回候选' },
  { value: 'reassign_customer', label: '改绑其他客户' },
  { value: 'reclassify_record', label: '改分类' },
  { value: 'hold_pending', label: '暂不处理' },
];

const manualClassifications = [
  { value: 'a_card_sale', label: 'A端销售' },
  { value: 'a_plus_c_bundle', label: 'A+C联动' },
  { value: 'points_redemption', label: '积分兑换' },
  { value: 'employee_welfare', label: '员工福利' },
  { value: 'manual_activity', label: '手工活动' },
  { value: 'test_data', label: '测试数据' },
  { value: 'sheet_missing', label: '台账漏记' },
  { value: 'self_recharge', label: '自充值' },
  { value: 'other', label: '其他' },
];

const decisionScopeOptions = [
  { value: 'case_only', label: '仅当前样本' },
  { value: 'same_pattern', label: '同类模式' },
  { value: 'same_product_family', label: '同产品族' },
  { value: 'same_source_rule', label: '同来源规则' },
  { value: 'global_rule', label: '全局参考规则' },
  { value: 'temporary_rule', label: '临时规则' },
];

const judgmentBasisOptions = [
  { value: 'price_abnormal', label: '价格异常' },
  { value: 'non_catalog_product', label: '非目录产品' },
  { value: 'manual_omission', label: '人工漏记' },
  { value: 'bank_verified', label: '银行收款已核实' },
  { value: 'paid_fact_overrides_sheet', label: '已支付事实优先于台账' },
  { value: 'points_redemption', label: '积分兑换' },
  { value: 'employee_test', label: '员工测试' },
  { value: 'admin_test', label: '管理员测试' },
  { value: 'source_conflict', label: '来源冲突' },
  { value: 'operator_experience', label: '人工经验判断' },
  { value: 'other', label: '其他' },
];

const aiLearningModeOptions = [
  { value: 'do_not_generalize', label: '不要泛化' },
  { value: 'suggest_same_pattern_only', label: '仅建议同类模式' },
  { value: 'can_generalize_with_review', label: '可推广但需复核' },
  { value: 'treat_as_global_reference', label: '可作全局参考' },
];

const route = useRoute();
const router = useRouter();
const summaryLoading = ref(false);
const eventLoading = ref(false);
const regenerating = ref(false);
const manualDecisionSubmitting = ref(false);
const summaryData = ref<any | null>(null);
const eventTableData = ref<any[]>([]);
const eventTotal = ref(0);

const manualDecisionForm = reactive({
  actionType: 'confirm_binding',
  finalMatchedCustomerId: '',
  finalClassification: '',
  decisionScope: 'case_only',
  judgmentBasis: [] as string[],
  aiLearningMode: 'do_not_generalize',
  reasonCode: '',
  remark: '',
});

const query = reactive({
  page: 1,
  pageSize: 10,
});

const filters = reactive({
  confirmedFlag: undefined as boolean | undefined,
});

const summaryId = computed(() => Number(route.params.id));
const highPrivilegeRoles = ['admin', 'finance', 'founder', 'super_admin', 'owner'];
const canGenerateSummaries = computed(() => hasPermission('performance.summaries.generate'));
const canViewAmounts = computed(() => hasAnyRole(highPrivilegeRoles));
const canManageManualDecision = computed(() => hasAnyRole(highPrivilegeRoles));
const aiSourceActionId = computed(() =>
  typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()
    ? route.query.sourceActionId.trim()
    : null,
);
const aiCurrentFilters = computed(() => ({
  ...route.query,
  summaryId: summaryId.value,
  confirmedFlag: filters.confirmedFlag,
}));

const manualDecisionSubmitDisabled = computed(() => {
  if (
    !manualDecisionForm.decisionScope ||
    !manualDecisionForm.aiLearningMode ||
    !manualDecisionForm.judgmentBasis.length ||
    !manualDecisionForm.remark.trim()
  ) {
    return true;
  }

  if (
    (manualDecisionForm.actionType === 'confirm_binding' ||
      manualDecisionForm.actionType === 'reject_candidate') &&
    !summaryData.value?.matchedCustomerId
  ) {
    return true;
  }

  if (
    manualDecisionForm.actionType === 'reassign_customer' &&
    !manualDecisionForm.finalMatchedCustomerId.trim()
  ) {
    return true;
  }

  if (manualDecisionForm.actionType === 'reclassify_record' && !manualDecisionForm.finalClassification) {
    return true;
  }

  return false;
});

function syncManualDecisionDefaults() {
  manualDecisionForm.finalMatchedCustomerId = summaryData.value?.matchedCustomerId || '';
  manualDecisionForm.finalClassification =
    summaryData.value?.manualDecision?.finalClassification ||
    summaryData.value?.sourceClassification ||
    '';
  manualDecisionForm.decisionScope = summaryData.value?.manualDecision?.decisionScope || 'case_only';
  manualDecisionForm.judgmentBasis = summaryData.value?.manualDecision?.judgmentBasis || [];
  manualDecisionForm.aiLearningMode =
    summaryData.value?.manualDecision?.aiLearningMode || 'do_not_generalize';
}

function formatManualDecisionAction(value?: string | null) {
  return manualDecisionActions.find((item) => item.value === value)?.label || value || '-';
}

function formatManualClassification(value?: string | null) {
  return manualClassifications.find((item) => item.value === value)?.label || value || '-';
}

function formatDecisionScope(value?: string | null) {
  return decisionScopeOptions.find((item) => item.value === value)?.label || value || '-';
}

function formatJudgmentBasis(values?: string[] | null) {
  if (!values?.length) {
    return '-';
  }

  return values
    .map((value) => judgmentBasisOptions.find((item) => item.value === value)?.label || value)
    .join(' / ');
}

function formatAiLearningMode(value?: string | null) {
  return aiLearningModeOptions.find((item) => item.value === value)?.label || value || '-';
}

function normalizeOptionalReasonCode(value: string) {
  const normalized = value.trim().replace(/\s+/g, '_');
  if (!normalized || normalized.length > 100) {
    return '';
  }
  return normalized;
}

async function loadData() {
  if (!summaryId.value) {
    return;
  }

  eventLoading.value = true;
  if (!summaryData.value) {
    summaryLoading.value = true;
  }

  try {
    const { data } = await getPerformanceSummaryDetail(summaryId.value, {
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
      confirmedFlag: filters.confirmedFlag,
    });

    summaryData.value = data.data.summary;
    eventTableData.value = data.data.events.list;
    eventTotal.value = data.data.events.total;
    syncManualDecisionDefaults();
  } finally {
    eventLoading.value = false;
    summaryLoading.value = false;
  }
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function resetFilters() {
  filters.confirmedFlag = undefined;
  handleSearch();
}

async function handleRegenerate() {
  if (!summaryData.value) {
    return;
  }

  regenerating.value = true;
  try {
    const { data } = await generatePerformanceSummaries({
      periodKey: summaryData.value.periodKey,
      sourceDomains: [summaryData.value.sourceDomain],
    });
    ElMessage.success(`本汇总已重跑，生成 ${data.data.generatedSummaryCount} 条汇总记录`);
    await loadData();
  } finally {
    regenerating.value = false;
  }
}

async function handleSubmitManualDecision() {
  if (manualDecisionSubmitDisabled.value) {
    return;
  }

  manualDecisionSubmitting.value = true;
  try {
    const payload: Record<string, unknown> = {
      actionType: manualDecisionForm.actionType,
      matchedCustomerId: summaryData.value?.matchedCustomerId || undefined,
      decisionScope: manualDecisionForm.decisionScope,
      judgmentBasis: manualDecisionForm.judgmentBasis,
      aiLearningMode: manualDecisionForm.aiLearningMode,
      remark: manualDecisionForm.remark.trim(),
    };

    const normalizedReasonCode = normalizeOptionalReasonCode(manualDecisionForm.reasonCode);
    const hasManualReasonCode = Boolean(normalizedReasonCode);
    if (normalizedReasonCode) {
      payload.reasonCode = normalizedReasonCode;
    }

    if (manualDecisionForm.actionType === 'reassign_customer') {
      payload.finalMatchedCustomerId = manualDecisionForm.finalMatchedCustomerId.trim();
    }

    if (manualDecisionForm.actionType === 'reclassify_record') {
      payload.finalClassification = manualDecisionForm.finalClassification;
    }

    const { data } = await decidePerformanceSummaryManualDecision(summaryId.value, payload);
    summaryData.value = data.data.summary;
    eventTableData.value = data.data.events.list;
    eventTotal.value = data.data.events.total;
    manualDecisionForm.reasonCode = '';
    manualDecisionForm.remark = '';
    syncManualDecisionDefaults();
    const appliedReasonCode =
      data.data.summary?.manualDecision?.reasonCode ||
      data.data.summary?.latestDecisionReason ||
      null;
    ElMessage.success(
      hasManualReasonCode
        ? appliedReasonCode
          ? `已成功提交人工裁决，原因短码：${appliedReasonCode}`
          : '已成功提交人工裁决'
        : appliedReasonCode
          ? `已成功提交人工裁决，系统已自动生成短码 reasonCode：${appliedReasonCode}`
          : '已成功提交人工裁决，系统已自动生成短码 reasonCode',
    );
  } finally {
    manualDecisionSubmitting.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
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

.section-title {
  font-size: 14px;
  font-weight: 600;
}

.section-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.subtle-text {
  font-size: 12px;
  color: #6b7280;
}

.confirmation-result-alert {
  margin-bottom: 16px;
}

.confirm-binding-panel {
  margin-top: 16px;
  display: grid;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.confirm-binding-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.confirm-binding-item {
  display: grid;
  gap: 4px;
}

.confirm-binding-label {
  font-size: 12px;
  color: #6b7280;
}

.confirm-binding-actions {
  display: grid;
  gap: 12px;
}

.manual-decision-result,
.manual-decision-history {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
}

.history-item {
  display: grid;
  gap: 4px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #d1d5db;
}

.history-item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.filters {
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
