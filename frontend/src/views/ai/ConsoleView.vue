<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="console-header">
          <div>
            <div class="title">AI 总控台</div>
            <div class="subtitle">
              用 AI 视角串起待确认、统计、绩效、台账和人工裁决，先做引导和上下文，不做自动执行。
            </div>
          </div>
          <el-button @click="loadOverview">刷新总控台</el-button>
        </div>
      </template>

      <div class="control-grid">
        <el-select v-model="filters.role" placeholder="岗位视角" clearable>
          <el-option v-for="item in roleOptions" :key="item.value || 'all-role'" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.scene" placeholder="场景" clearable>
          <el-option v-for="item in sceneOptions" :key="item.value || 'all-scene'" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.channel" placeholder="终端" clearable>
          <el-option v-for="item in channelOptions" :key="item.value || 'all-channel'" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.providerKey" placeholder="AI provider" clearable>
          <el-option
            v-for="item in providerOptions"
            :key="item.providerKey"
            :label="item.displayName"
            :value="item.providerKey"
          />
        </el-select>
        <el-select v-model="filters.periodMode" placeholder="分桶视角">
          <el-option label="按周" value="week" />
          <el-option label="按月" value="month" />
        </el-select>
        <el-select v-model="filters.timeBucket" placeholder="时间桶" clearable>
          <el-option v-for="item in timeBucketOptions" :key="item.value || 'all-bucket'" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.processingView" placeholder="状态视图">
          <el-option v-for="item in processingViewOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
      <div v-if="overview?.provider" class="provider-strip">
        <span>当前 Provider：{{ overview.provider.displayName }}</span>
        <span>类型：{{ overview.provider.providerType }}</span>
        <span>能力：{{ (overview.provider.capabilitySet || []).join(' / ') }}</span>
      </div>
      <div class="provider-strip">
        <span>时间桶：{{ activeTimeBucketLabel }}</span>
        <span>状态：{{ activeProcessingViewLabel }}</span>
        <span>分桶视角：{{ filters.periodMode === 'week' ? '按周' : '按月' }}</span>
      </div>
      <div v-if="overview?.nextActions?.calculationAnchorAt" class="provider-strip">
        <span>当前岗位：{{ filters.role || '全部岗位' }}</span>
        <span>当前时间桶：{{ activeTimeBucketLabel }}</span>
        <span>当前状态视角：{{ activeProcessingViewLabel }}</span>
        <span>计算时间：{{ formatDateTime(overview.nextActions.calculationAnchorAt) }}</span>
        <span>生成时间：{{ formatDateTime(overview.nextActions.generatedAt) }}</span>
        <span v-if="overview?.nextActions?.calculationFingerprint">
          口径指纹：{{ overview.nextActions.calculationFingerprint }}
        </span>
      </div>
    </el-card>

    <el-alert
      v-if="overviewError"
      type="warning"
      :closable="false"
      show-icon
      title="AI 总控台暂时不可用，业务页面仍可继续使用。"
    >
      <template #default>
        <div class="console-alert-body">
          <div>{{ overviewError }}</div>
          <el-button size="small" @click="loadOverview">重试 AI 总控台</el-button>
        </div>
      </template>
    </el-alert>

    <el-alert
      v-if="contextError"
      type="info"
      :closable="false"
      show-icon
      title="当前 AI 上下文暂时不可读取。"
    >
      <template #default>
        <div>{{ contextError }}</div>
      </template>
    </el-alert>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="10">
        <div class="console-column">
          <el-row :gutter="12">
            <el-col v-for="card in overview?.summaryCards ?? []" :key="card.key" :xs="24" :sm="12">
              <el-card class="summary-card" v-loading="loadingOverview">
                <div class="summary-card-title">{{ card.title }}</div>
                <div class="summary-card-value">{{ card.value }}</div>
                <div class="summary-card-subtitle">{{ card.subtitle }}</div>
              </el-card>
            </el-col>
          </el-row>

          <el-card v-loading="loadingOverview">
            <template #header>
              <div class="section-header">
                <div class="section-title">今日必须处理</div>
                <div class="subtitle">按岗位和场景筛选后的行动项</div>
              </div>
            </template>
            <div v-if="!visibleMustHandleToday.length" class="empty-tip">当前没有今日必须处理的动作。</div>
            <div v-else class="action-list">
              <button
                v-for="action in visibleMustHandleToday"
                :key="action.actionId"
                type="button"
                class="action-card"
                @click="selectAction(action.actionId)"
              >
                <div class="action-card-header">
                  <span class="action-title">{{ action.actionTitle }}</span>
                  <el-tag size="small" type="danger">{{ action.ownerRoleLabel }}</el-tag>
                </div>
                <div class="action-meta">
                  <span>数量：{{ action.relatedCount }}</span>
                  <span>影响金额：{{ formatAmount(action.relatedAmount) }}</span>
                  <span>时间桶：{{ formatTimeBucketLabel(action.bucketLabel) }}</span>
                  <span>状态：{{ formatProcessingStatus(action.processingStatus) }}</span>
                </div>
                <div class="action-copy">{{ action.whyNow }}</div>
                <div class="action-link">点击查看 AI 语义上下文</div>
              </button>
            </div>
          </el-card>

          <el-card v-loading="loadingOverview">
            <template #header>
              <div class="section-header">
                <div class="section-title">本周建议处理 / 可延后</div>
                <div class="subtitle">先给管理层一个节奏，再决定今天是否处理</div>
              </div>
            </template>
            <div class="section-stack">
              <div>
                <div class="mini-title">本周建议处理</div>
                <div v-if="!visibleRecommended.length" class="empty-tip">当前没有本周建议处理动作。</div>
                <div v-else class="compact-action-list">
                  <button
                    v-for="action in visibleRecommended"
                    :key="action.actionId"
                    type="button"
                    class="compact-action-card"
                    @click="selectAction(action.actionId)"
                  >
                    <div class="compact-action-title">{{ action.actionTitle }}</div>
                    <div class="compact-action-meta">
                      {{ action.ownerRoleLabel }} / {{ formatAmount(action.relatedAmount) }} / {{ formatProcessingStatus(action.processingStatus) }}
                    </div>
                  </button>
                </div>
              </div>
              <div>
                <div class="mini-title">可延后</div>
                <div v-if="!visibleCanDefer.length" class="empty-tip">当前没有可延后的动作。</div>
                <div v-else class="compact-action-list">
                  <button
                    v-for="action in visibleCanDefer"
                    :key="action.actionId"
                    type="button"
                    class="compact-action-card"
                    @click="selectAction(action.actionId)"
                  >
                    <div class="compact-action-title">{{ action.actionTitle }}</div>
                    <div class="compact-action-meta">
                      {{ action.ownerRoleLabel }} / {{ formatAmount(action.relatedAmount) }} / {{ formatProcessingStatus(action.processingStatus) }}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </el-card>

          <el-card v-loading="loadingOverview">
            <template #header>
              <div class="section-header">
                <div class="section-title">关键风险卡</div>
                <div class="subtitle">AI 当前最担心的链路阻塞点</div>
              </div>
            </template>
            <div v-if="!(overview?.riskCards?.length)" class="empty-tip">当前没有新的关键风险卡。</div>
            <div v-else class="risk-list">
              <button
                v-for="risk in overview?.riskCards ?? []"
                :key="risk.key"
                type="button"
                class="risk-card"
                @click="router.push({ path: risk.relatedPagePath, query: risk.relatedPageQuery })"
              >
                <div class="risk-card-header">
                  <span>{{ risk.title }}</span>
                  <el-tag size="small" :type="risk.dueLevel === 'must_handle_today' ? 'danger' : risk.dueLevel === 'should_handle_this_week' ? 'warning' : 'info'">
                    {{ formatDueLevelLabel(risk.dueLevel) }}
                  </el-tag>
                </div>
                <div class="risk-summary">{{ risk.summary }}</div>
              </button>
            </div>
          </el-card>

          <el-card v-loading="loadingOverview">
            <template #header>
              <div class="section-header">
                <div class="section-title">当前焦点对象</div>
                <div class="subtitle">优先建议业务先看这一条</div>
              </div>
            </template>
            <div v-if="!overview?.currentFocus" class="empty-tip">当前没有明确焦点对象。</div>
            <button
              v-else
              type="button"
              class="focus-card"
              @click="selectSummaryContext(overview.currentFocus.summaryType, overview.currentFocus.summaryId)"
            >
              <div class="focus-title">{{ overview.currentFocus.title }}</div>
              <div class="focus-subtitle">{{ overview.currentFocus.subtitle }}</div>
              <div class="focus-blocker">阻塞：{{ overview.currentFocus.blocker }}</div>
            </button>
          </el-card>
        </div>
      </el-col>

      <el-col :xs="24" :lg="14">
        <div class="console-column">
          <el-card v-loading="loadingContext">
            <template #header>
              <div class="section-header">
                <div class="section-title">AI 语义上下文</div>
                <div class="subtitle">选中任务或焦点对象后，右侧会展开可读上下文</div>
              </div>
            </template>

            <div v-if="!selectedTaskContext && !selectedSummaryContext" class="empty-tip">
              请先从左侧选择一个行动项或焦点对象。
            </div>

            <template v-else-if="selectedTaskContext">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="任务">{{ selectedTaskContext.actionTitle }}</el-descriptions-item>
                <el-descriptions-item label="岗位">{{ selectedTaskContext.ownerRoleLabel }}</el-descriptions-item>
                <el-descriptions-item label="任务类型">{{ selectedTaskContext.taskType }}</el-descriptions-item>
                <el-descriptions-item label="影响类型">{{ selectedTaskContext.impactType }}</el-descriptions-item>
                <el-descriptions-item label="数量">{{ selectedTaskContext.relatedCount }}</el-descriptions-item>
                <el-descriptions-item label="影响金额">{{ formatAmount(selectedTaskContext.relatedAmount) }}</el-descriptions-item>
                <el-descriptions-item label="时间分桶">{{ formatTimeBucketLabel(selectedTaskContext.bucketLabel) }}</el-descriptions-item>
                <el-descriptions-item label="时间锚点">{{ formatDateTime(selectedTaskContext.timeAnchorDate) }}</el-descriptions-item>
                <el-descriptions-item label="当前状态">{{ formatProcessingStatus(selectedTaskContext.processingStatus) }}</el-descriptions-item>
                <el-descriptions-item label="状态说明">{{ selectedTaskContext.statusRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="推荐筛选">{{ selectedTaskContext.suggestedFilterLabel }}</el-descriptions-item>
                <el-descriptions-item label="下一步">{{ selectedTaskContext.nextStepAfterDone }}</el-descriptions-item>
              </el-descriptions>
              <div class="context-block">
                <div class="context-title">为什么现在做</div>
                <div>{{ selectedTaskContext.whyNow }}</div>
              </div>
              <div class="context-block">
                <div class="context-title">人工状态处理</div>
                <el-space wrap>
                  <el-button
                    v-if="selectedTaskContext.processingStatus !== 'deferred'"
                    @click="markSelectedTaskState('deferred', 'next_week')"
                  >
                    暂缓到下周
                  </el-button>
                  <el-button
                    v-if="selectedTaskContext.processingStatus !== 'deferred'"
                    @click="markSelectedTaskState('deferred', 'next_month')"
                  >
                    暂缓到下月
                  </el-button>
                  <el-button
                    v-if="selectedTaskContext.processingStatus !== 'done'"
                    type="success"
                    plain
                    @click="markSelectedTaskState('done')"
                  >
                    标记已完成
                  </el-button>
                  <el-button
                    v-if="selectedTaskContext.processingStatus === 'deferred' || selectedTaskContext.processingStatus === 'done' || selectedTaskContext.processingStatus === 'ignored'"
                    type="warning"
                    plain
                    @click="markSelectedTaskState('active')"
                  >
                    重新打开
                  </el-button>
                </el-space>
                <div class="history-copy">
                  <span>操作人：{{ selectedTaskContext.markedByName || '-' }}</span>
                  <span> / 操作时间：{{ formatDateTime(selectedTaskContext.markedAt) }}</span>
                </div>
                <div class="history-copy">
                  <span>暂缓到：{{ formatDateTime(selectedTaskContext.deferUntil) }}</span>
                  <span v-if="selectedTaskContext.shouldReopen"> / 已到重新打开时间</span>
                </div>
              </div>
              <div class="context-block">
                <div class="context-title">当前阻塞</div>
                <el-space wrap>
                  <el-tag v-for="blocker in selectedTaskContext.blockers" :key="blocker" size="small" type="warning">
                    {{ blocker }}
                  </el-tag>
                </el-space>
              </div>
            </template>

            <template v-else-if="selectedSummaryContext">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="汇总类型">{{ selectedSummaryContext.summaryType }}</el-descriptions-item>
                <el-descriptions-item label="建议下一步">{{ selectedSummaryContext.suggestedNextStep }}</el-descriptions-item>
                <el-descriptions-item label="客户信息">
                  {{ selectedSummaryContext.customerIdentity?.matchedCustomerName || selectedSummaryContext.customerIdentity?.customerName || '-' }}
                  <template v-if="selectedSummaryContext.customerIdentity?.matchedCustomerMobile || selectedSummaryContext.customerIdentity?.customerMobile">
                    / {{ selectedSummaryContext.customerIdentity?.matchedCustomerMobile || selectedSummaryContext.customerIdentity?.customerMobile }}
                  </template>
                </el-descriptions-item>
                <el-descriptions-item label="支付/对账">
                  {{ selectedSummaryContext.paymentAndReconciliation?.paymentStatus || '-' }}
                  / {{ selectedSummaryContext.paymentAndReconciliation?.reconciliationStatus || '-' }}
                </el-descriptions-item>
              </el-descriptions>
              <div class="context-block">
                <div class="context-title">当前阻塞</div>
                <el-space wrap>
                  <el-tag
                    v-for="blocker in selectedSummaryContext.blockers"
                    :key="blocker"
                    size="small"
                    type="warning"
                  >
                    {{ blocker }}
                  </el-tag>
                </el-space>
              </div>
              <div class="context-block">
                <div class="context-title">产品 / 套餐 / B卡 / 福利</div>
                <pre class="context-json">{{ formatContextJson(selectedSummaryContext.productAndBundle) }}</pre>
              </div>
            </template>
          </el-card>

          <el-card>
            <template #header>
              <div class="section-header">
                <div class="section-title">AI 对话记录</div>
                <div class="subtitle">先做只读会话壳，帮助业务理解当前上下文</div>
              </div>
            </template>
            <div v-if="!conversationMessages.length" class="empty-tip">当前还没有可展示的 AI 语义消息。</div>
            <div v-else class="message-list">
              <div v-for="(message, index) in conversationMessages" :key="`${message.role}-${index}`" class="message-item">
                <div class="message-role">{{ message.role === 'assistant' ? 'AI' : '系统' }}</div>
                <div class="message-content">{{ message.content }}</div>
              </div>
            </div>
          </el-card>

          <el-card>
            <template #header>
              <div class="section-header">
                <div class="section-title">AI 命令草稿</div>
                <div class="subtitle">只生成草稿，不直接执行</div>
              </div>
            </template>
            <el-input v-model="commandDraft" type="textarea" :rows="6" placeholder="选中任务或焦点对象后，系统会生成一份命令草稿。" />
          </el-card>

          <el-card v-loading="loadingOverview">
            <template #header>
              <div class="section-header">
                <div class="section-title">最近人工裁决记录</div>
                <div class="subtitle">帮助 AI 理解“人是怎么判断的”</div>
              </div>
            </template>
            <div v-if="!(overview?.recentDecisions?.length)" class="empty-tip">当前没有最近人工裁决记录。</div>
            <div v-else class="history-list">
              <div v-for="decision in overview?.recentDecisions ?? []" :key="decision.id" class="history-item">
                <div class="history-title">summary#{{ decision.sourceSummaryId }} / {{ decision.actionType }}</div>
                <div class="history-meta">
                  <span>操作人：{{ decision.operatorName || '-' }}</span>
                  <span>时间：{{ formatDateTime(decision.operatedAt) }}</span>
                </div>
                <div class="history-copy">
                  范围：{{ decision.decisionScope || '-' }} / AI：{{ decision.aiLearningMode || '-' }}
                </div>
                <div class="history-copy">依据：{{ (decision.judgmentBasis || []).join(' / ') || '-' }}</div>
              </div>
            </div>
          </el-card>

          <el-card v-loading="loadingOverview">
            <template #header>
              <div class="section-header">
                <div class="section-title">最近状态变更记录</div>
                <div class="subtitle">帮助 AI 解释为什么某些任务不在当前待办里</div>
              </div>
            </template>
            <div v-if="!(overview?.recentActionStates?.length)" class="empty-tip">当前没有最近状态变更。</div>
            <div v-else class="history-list">
              <div v-for="state in overview?.recentActionStates ?? []" :key="state.id" class="history-item">
                <div class="history-title">{{ state.taskType }} / {{ formatProcessingStatus(state.processingStatus) }}</div>
                <div class="history-meta">
                  <span>岗位：{{ state.ownerRole }}</span>
                  <span>时间：{{ formatDateTime(state.markedAt) }}</span>
                </div>
                <div class="history-copy">
                  时间桶：{{ formatTimeBucketLabel(state.timeBucket) }} / 操作人：{{ state.markedByName || '-' }}
                </div>
                <div class="history-copy">
                  暂缓到：{{ formatDateTime(state.deferUntil) }} / 重新打开：{{ formatDateTime(state.reopenAt) }}
                </div>
                <div class="history-copy">{{ state.statusRemark || '-' }}</div>
              </div>
            </div>
          </el-card>

          <el-card v-loading="loadingOverview">
            <template #header>
              <div class="section-header">
                <div class="section-title">最近阻塞变化记录</div>
                <div class="subtitle">帮助 AI 看到哪些链还没打通</div>
              </div>
            </template>
            <div v-if="!(overview?.recentBlockers?.length)" class="empty-tip">当前没有最近阻塞记录。</div>
            <div v-else class="history-list">
              <button
                v-for="blocker in overview?.recentBlockers ?? []"
                :key="blocker.key"
                type="button"
                class="history-item history-button"
                @click="selectSummaryContext(blocker.summaryType, blocker.summaryId)"
              >
                <div class="history-title">{{ blocker.title }}</div>
                <div class="history-meta">
                  <span>阻塞：{{ blocker.blockerReason }}</span>
                  <span>{{ formatDateTime(blocker.updatedAt) }}</span>
                </div>
              </button>
            </div>
          </el-card>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  getAiConsoleOverview,
  getAiSummaryContext,
  getAiTaskContext,
  markAiActionState,
} from '../../api/ai';
import { formatDateTime, formatMoney } from '../../utils/format';
import { currentRoleCode } from '../../utils/permissions';

interface OptionItem {
  label: string;
  value: string;
}

const router = useRouter();

const roleOptions: OptionItem[] = [
  { label: '当前岗位', value: '' },
  { label: '创始人', value: 'founder' },
  { label: '财务', value: 'finance' },
  { label: '管理员', value: 'admin' },
  { label: '审批人', value: 'approver' },
  { label: '操作员', value: 'operator' },
  { label: '门店负责人', value: 'store_manager' },
  { label: '客服', value: 'customer_service' },
];

const sceneOptions: OptionItem[] = [
  { label: '全局场景', value: '' },
  { label: '客户绑定', value: 'customer_binding' },
  { label: '台账修复', value: 'sheet_repair' },
  { label: '绩效确认', value: 'performance_confirmation' },
  { label: '数据清洗', value: 'data_cleanup' },
];

const channelOptions: OptionItem[] = [
  { label: '默认终端', value: '' },
  { label: '网页总控台', value: 'web_console' },
  { label: '管理命令', value: 'management_command' },
  { label: '移动助手', value: 'mobile_assistant' },
  { label: '财务复核', value: 'finance_review' },
];

const timeBucketOptions: OptionItem[] = [
  { label: '全部时间桶', value: '' },
  { label: '本周', value: 'this_week' },
  { label: '上周', value: 'last_week' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '未来', value: 'future' },
  { label: '历史待处理', value: 'backlog_history' },
];

const processingViewOptions: OptionItem[] = [
  { label: '当前待办', value: 'current' },
  { label: '已暂缓', value: 'deferred' },
  { label: '已完成', value: 'done' },
  { label: '全部', value: 'all' },
];

const filters = reactive({
  role: currentRoleCode.value || '',
  scene: '',
  channel: '',
  providerKey: '',
  periodMode: 'month',
  timeBucket: '',
  processingView: 'current',
});

const loadingOverview = ref(false);
const loadingContext = ref(false);
const overview = ref<any>(null);
const selectedTaskContext = ref<any>(null);
const selectedSummaryContext = ref<any>(null);
const commandDraft = ref('');
const overviewError = ref('');
const contextError = ref('');
const overviewRequestSequence = ref(0);
const contextRequestSequence = ref(0);
const suppressAutoReloadOnce = ref(false);

const providerOptions = computed(() => overview.value?.providerOptions ?? []);
const activeTimeBucketLabel = computed(
  () => timeBucketOptions.find((item) => item.value === filters.timeBucket)?.label ?? '全部时间桶',
);
const activeProcessingViewLabel = computed(
  () => processingViewOptions.find((item) => item.value === filters.processingView)?.label ?? '当前待办',
);

function matchesProcessingView(action: any) {
  if (filters.processingView === 'deferred') {
    return action.processingStatus === 'deferred';
  }
  if (filters.processingView === 'done') {
    return action.processingStatus === 'done' || action.processingStatus === 'ignored';
  }
  if (filters.processingView === 'all') {
    return true;
  }
  return !['deferred', 'done', 'ignored'].includes(action.processingStatus);
}

const visibleMustHandleToday = computed(() =>
  (overview.value?.nextActions?.mustHandleToday ?? []).filter((item: any) => matchesProcessingView(item)),
);
const visibleRecommended = computed(() =>
  (overview.value?.nextActions?.recommended ?? []).filter((item: any) => matchesProcessingView(item)),
);
const visibleCanDefer = computed(() =>
  (overview.value?.nextActions?.canDefer ?? []).filter((item: any) => matchesProcessingView(item)),
);

const conversationMessages = computed(() => {
  if (selectedTaskContext.value) {
    return [
      {
        role: 'system',
        content: `当前岗位视角：${selectedTaskContext.value.ownerRoleLabel}，任务类型：${selectedTaskContext.value.taskType}。`,
      },
      {
        role: 'assistant',
        content: `${selectedTaskContext.value.whyNow} 建议动作：${selectedTaskContext.value.suggestedAction}`,
      },
    ];
  }

  if (selectedSummaryContext.value) {
    const blockers = (selectedSummaryContext.value.blockers ?? []).join('、') || '暂无阻塞';
    return [
      {
        role: 'system',
        content: `当前焦点是 ${selectedSummaryContext.value.summaryType} 汇总。`,
      },
      {
        role: 'assistant',
        content: `当前阻塞：${blockers}。建议下一步：${selectedSummaryContext.value.suggestedNextStep}`,
      },
    ];
  }

  return [];
});

function formatAmount(value: string | null | undefined) {
  return value ? formatMoney(value) : '按权限隐藏';
}

function formatDueLevelLabel(value: string) {
  if (value === 'must_handle_today') return '今天必须处理';
  if (value === 'should_handle_this_week') return '本周建议处理';
  if (value === 'can_defer') return '可延后';
  return value || '-';
}

function formatProcessingStatus(value: string) {
  const labels: Record<string, string> = {
    active: '当前待办',
    in_progress: '处理中',
    deferred: '已暂缓',
    waiting_review: '待复核',
    done: '已完成',
    ignored: '已忽略',
  };
  return labels[value] ?? (value || '-');
}

function formatTimeBucketLabel(value: string | null | undefined) {
  return value || '未分桶';
}

function formatContextJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

function buildCommandDraft() {
  if (selectedTaskContext.value) {
    commandDraft.value = [
      `角色：${selectedTaskContext.value.ownerRoleLabel}`,
      `任务：${selectedTaskContext.value.actionTitle}`,
      `为什么现在处理：${selectedTaskContext.value.whyNow}`,
      `建议动作：${selectedTaskContext.value.suggestedAction}`,
      `处理完成后：${selectedTaskContext.value.nextStepAfterDone}`,
      `跳转：${selectedTaskContext.value.relatedPagePath}`,
      `时间桶：${selectedTaskContext.value.bucketLabel || '-'}`,
      `状态：${formatProcessingStatus(selectedTaskContext.value.processingStatus)}`,
    ].join('\n');
    return;
  }

  if (selectedSummaryContext.value) {
    commandDraft.value = [
      `上下文类型：${selectedSummaryContext.value.summaryType}`,
      `阻塞：${(selectedSummaryContext.value.blockers ?? []).join(' / ') || '暂无'}`,
      `建议下一步：${selectedSummaryContext.value.suggestedNextStep}`,
      `客户：${
        selectedSummaryContext.value.customerIdentity?.matchedCustomerName ||
        selectedSummaryContext.value.customerIdentity?.customerName ||
        '-'
      }`,
      `支付/对账：${
        selectedSummaryContext.value.paymentAndReconciliation?.paymentStatus || '-'
      } / ${selectedSummaryContext.value.paymentAndReconciliation?.reconciliationStatus || '-'}`,
    ].join('\n');
    return;
  }

  commandDraft.value = '';
}

async function loadOverview() {
  const requestId = ++overviewRequestSequence.value;
  const requestedProviderKey = filters.providerKey || undefined;
  loadingOverview.value = true;
  overviewError.value = '';
  try {
    const result = await getAiConsoleOverview({
        role: filters.role || undefined,
        scene: filters.scene || undefined,
        channel: filters.channel || undefined,
        providerKey: filters.providerKey || undefined,
        periodMode: filters.periodMode || undefined,
        timeBucket: filters.timeBucket || undefined,
        includeDeferred: ['deferred', 'all'].includes(filters.processingView) || undefined,
        includeDone: ['done', 'all'].includes(filters.processingView) || undefined,
        backlogOnly: filters.timeBucket === 'backlog_history' || undefined,
      });
    if (requestId !== overviewRequestSequence.value) {
      return;
    }
    overview.value = result.data.data;

    if (!requestedProviderKey && overview.value?.provider?.providerKey) {
      suppressAutoReloadOnce.value = true;
      filters.providerKey = overview.value.provider.providerKey;
    }

    if (!selectedTaskContext.value && !selectedSummaryContext.value) {
      const firstAction =
        visibleMustHandleToday.value[0] ??
        visibleRecommended.value[0] ??
        visibleCanDefer.value[0];
      if (firstAction?.actionId) {
        await selectAction(firstAction.actionId);
      } else if (overview.value?.currentFocus) {
        await selectSummaryContext(
          overview.value.currentFocus.summaryType,
          overview.value.currentFocus.summaryId,
        );
      }
    }
  } catch (error) {
    if (requestId !== overviewRequestSequence.value) {
      return;
    }
    overview.value = null;
    selectedTaskContext.value = null;
    selectedSummaryContext.value = null;
    commandDraft.value = '';
    overviewError.value = normalizeErrorMessage(error);
  } finally {
    if (requestId === overviewRequestSequence.value) {
      loadingOverview.value = false;
    }
  }
}

async function selectAction(actionId: string) {
  const requestId = ++contextRequestSequence.value;
  loadingContext.value = true;
  contextError.value = '';
  try {
    const result = await getAiTaskContext(actionId, {
      role: filters.role || undefined,
      scene: filters.scene || undefined,
      channel: filters.channel || undefined,
      providerKey: filters.providerKey || undefined,
      periodMode: filters.periodMode || undefined,
      timeBucket: filters.timeBucket || undefined,
      includeDeferred: ['deferred', 'all'].includes(filters.processingView) || undefined,
      includeDone: ['done', 'all'].includes(filters.processingView) || undefined,
      backlogOnly: filters.timeBucket === 'backlog_history' || undefined,
    });
    if (requestId !== contextRequestSequence.value) {
      return;
    }
    selectedTaskContext.value = result.data.data;
    selectedSummaryContext.value = null;
    buildCommandDraft();
  } catch (error) {
    if (requestId !== contextRequestSequence.value) {
      return;
    }
    selectedTaskContext.value = null;
    contextError.value = normalizeErrorMessage(error);
    ElMessage.warning('AI 任务上下文暂时不可用，请重新选择或刷新总控台。');
  } finally {
    if (requestId === contextRequestSequence.value) {
      loadingContext.value = false;
    }
  }
}

async function selectSummaryContext(summaryType: 'performance' | 'business_stats', summaryId: number) {
  const requestId = ++contextRequestSequence.value;
  loadingContext.value = true;
  contextError.value = '';
  try {
    const result = await getAiSummaryContext(summaryId, { summaryType });
    if (requestId !== contextRequestSequence.value) {
      return;
    }
    selectedSummaryContext.value = result.data.data;
    selectedTaskContext.value = null;
    buildCommandDraft();
  } catch (error) {
    if (requestId !== contextRequestSequence.value) {
      return;
    }
    selectedSummaryContext.value = null;
    contextError.value = normalizeErrorMessage(error);
    ElMessage.warning('AI summary 上下文暂时不可用，请稍后重试。');
  } finally {
    if (requestId === contextRequestSequence.value) {
      loadingContext.value = false;
    }
  }
}

function normalizeErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const maybeAxios = (error as any).response?.data?.message;
    if (maybeAxios) {
      return Array.isArray(maybeAxios) ? maybeAxios.join('；') : String(maybeAxios);
    }
    if ((error as Error).message) {
      return (error as Error).message;
    }
  }
  return '可尝试刷新页面，或检查 AI 状态层与后端运行态。';
}

watch(
  () => [
    filters.role,
    filters.scene,
    filters.channel,
    filters.providerKey,
    filters.periodMode,
    filters.timeBucket,
    filters.processingView,
  ],
  () => {
    if (suppressAutoReloadOnce.value) {
      suppressAutoReloadOnce.value = false;
      return;
    }
    void loadOverview();
  },
);

function startOfNextWeek() {
  const date = new Date();
  const day = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - day + 8);
  date.setHours(9, 0, 0, 0);
  return date;
}

function startOfNextMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1, 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

async function markSelectedTaskState(
  processingStatus: 'active' | 'deferred' | 'done',
  deferMode?: 'next_week' | 'next_month',
) {
  if (!selectedTaskContext.value) {
    return;
  }

  const payload: Record<string, unknown> = {
    actionId: selectedTaskContext.value.actionId,
    taskType: selectedTaskContext.value.taskType,
    ownerRole: selectedTaskContext.value.ownerRole,
    processingStatus,
    timeBucket: selectedTaskContext.value.timeBucket,
    bucketLabel: selectedTaskContext.value.bucketLabel,
    timeAnchorType: selectedTaskContext.value.timeAnchorType,
    timeAnchorDate: selectedTaskContext.value.timeAnchorDate,
    normalizedPayload: {
      relatedPagePath: selectedTaskContext.value.relatedPagePath,
      relatedPageQuery: selectedTaskContext.value.relatedPageQuery,
      previousProcessingStatus: selectedTaskContext.value.processingStatus,
    },
  };

  if (processingStatus === 'deferred') {
    const targetDate = deferMode === 'next_month' ? startOfNextMonth() : startOfNextWeek();
    payload.deferUntil = targetDate.toISOString();
    payload.reopenAt = targetDate.toISOString();
    payload.deferReason =
      deferMode === 'next_month' ? 'manual_defer_to_next_month' : 'manual_defer_to_next_week';
    payload.statusRemark = deferMode === 'next_month' ? '人工暂缓到下月' : '人工暂缓到下周';
  } else if (processingStatus === 'done') {
    payload.statusRemark = '人工标记已完成';
  } else {
    payload.statusRemark = '人工重新打开为当前待办';
  }

  await markAiActionState(payload);
  ElMessage.success(
    processingStatus === 'deferred'
      ? deferMode === 'next_month'
        ? '已暂缓到下月'
        : '已暂缓到下周'
      : processingStatus === 'done'
        ? '已标记完成'
        : '已重新打开为当前待办',
  );
  await loadOverview();
  await selectAction(selectedTaskContext.value.actionId);
}

onMounted(() => {
  void loadOverview();
});
</script>

<style scoped>
.page-stack,
.console-column,
.section-stack,
.action-list,
.risk-list,
.history-list,
.message-list {
  display: grid;
  gap: 16px;
}

.console-header,
.section-header,
.action-card-header,
.risk-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.title,
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.subtitle,
.summary-card-subtitle,
.history-meta,
.action-meta,
.compact-action-meta {
  font-size: 12px;
  color: #6b7280;
}

.control-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.provider-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  font-size: 12px;
  color: #6b7280;
}

.console-alert-body {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.summary-card-title {
  font-size: 13px;
  color: #374151;
}

.summary-card-value {
  margin-top: 10px;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.mini-title,
.context-title,
.history-title,
.focus-title,
.action-title,
.compact-action-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.action-card,
.compact-action-card,
.risk-card,
.focus-card,
.history-button {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fafafa;
  text-align: left;
  cursor: pointer;
}

.action-card:hover,
.compact-action-card:hover,
.risk-card:hover,
.focus-card:hover,
.history-button:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.action-card,
.risk-card,
.focus-card {
  display: grid;
  gap: 8px;
}

.action-copy,
.risk-summary,
.focus-subtitle,
.focus-blocker,
.history-copy,
.message-content {
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
}

.action-link {
  font-size: 12px;
  color: #2563eb;
}

.compact-action-list {
  display: grid;
  gap: 10px;
}

.context-block {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.context-json {
  margin: 0;
  padding: 12px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  font-size: 12px;
  color: #374151;
}

.message-item {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.message-role {
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
}

.empty-tip {
  font-size: 13px;
  color: #6b7280;
}

@media (max-width: 992px) {
  .control-grid {
    grid-template-columns: 1fr;
  }
}
</style>
