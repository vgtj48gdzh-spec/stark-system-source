<template>
  <div v-if="canUseAssistant" class="ai-side-assistant">
    <el-button class="assistant-trigger" type="primary" @click="drawerVisible = true">
      AI 助手
    </el-button>

    <el-drawer
      v-model="drawerVisible"
      :title="drawerTitle"
      size="460px"
      append-to-body
      :destroy-on-close="false"
    >
      <template #header>
        <div class="assistant-header">
          <div>
            <div class="assistant-title">{{ drawerTitle }}</div>
            <div class="assistant-subtitle">
              {{ pageTitle }} / {{ currentRoleLabel }}
            </div>
          </div>
          <el-tag size="small" type="info">{{ currentProviderLabel }}</el-tag>
        </div>
      </template>

      <el-alert
        v-if="contextError"
        type="warning"
        :closable="false"
        show-icon
        class="assistant-alert"
      >
        <template #title>AI 助手暂时不可用，主页面仍可继续使用</template>
        <div class="subtle-text">{{ contextError }}</div>
        <div class="assistant-actions-inline">
          <el-button size="small" @click="reloadContext">重试</el-button>
        </div>
      </el-alert>

      <template v-else>
        <div class="assistant-meta">
          <el-tag size="small">{{ currentRoleLabel }}</el-tag>
          <el-tag v-if="contextData?.rewardDomain" size="small" type="success">
            点值域：{{ contextData.rewardDomain }}
          </el-tag>
          <el-tag v-if="contextData?.sourceOfTruth" size="small" type="info">
            事实源：{{ contextData.sourceOfTruth }}
          </el-tag>
          <el-tag v-if="sourceActionId" size="small" type="warning">
            来自 AI 行动项：{{ sourceActionId }}
          </el-tag>
          <el-tag v-if="contextData?.pageInfo?.pageEntityType" size="small" type="success">
            焦点：{{ contextData?.pageInfo?.pageEntityType }}
          </el-tag>
        </div>

        <el-card shadow="never" class="assistant-section" v-loading="contextLoading">
          <template #header>
            <div class="section-header">
              <span>当前对象摘要</span>
              <span class="subtle-text">
                {{ contextData?.pageInfo?.pageLabel || pageTitle }}
              </span>
            </div>
          </template>
          <template v-if="contextData">
            <div class="summary-item">
              <span class="summary-label">当前页面</span>
              <span>{{ contextData.pageInfo.pageLabel }}</span>
            </div>
            <div class="summary-item" v-if="contextData.rewardDomain || contextData.sourceOfTruth">
              <span class="summary-label">点值体系</span>
              <span>
                {{ contextData.rewardDomain || '-' }} / {{ contextData.sourceOfTruth || '-' }}
              </span>
            </div>
            <div class="summary-item">
              <span class="summary-label">当前筛选</span>
              <span>{{ filterSummaryText }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">当前焦点</span>
              <span>{{ focusLabel }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">{{ latestHandlingPlan ? '当前状态摘要' : '当前阻塞' }}</span>
              <span>{{ latestHandlingPlan ? handlingPlanStatusSummary : blockerText }}</span>
            </div>
            <div v-if="latestHandlingPlan" class="summary-item">
              <span class="summary-label">谁处理 / 怎么处理</span>
              <span>{{ handlingPlanOwnerSummary }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">{{ latestHandlingPlan ? '何时可重试' : '建议下一步' }}</span>
              <span>{{ latestHandlingPlan ? handlingPlanRetrySummary : suggestedNextStep }}</span>
            </div>
            <div v-if="focusFacts.length" class="fact-list">
              <div v-for="item in focusFacts" :key="item.label" class="fact-item">
                <span class="fact-label">{{ item.label }}</span>
                <span class="fact-value">{{ item.value }}</span>
              </div>
            </div>
            <div v-if="pointsSummary" class="fact-list">
              <div class="fact-item">
                <span class="fact-label">近期积点命令</span>
                <span class="fact-value">{{ pointsSummary.recentCommandCount || 0 }} 条</span>
              </div>
              <div class="fact-item">
                <span class="fact-label">近期积点流水</span>
                <span class="fact-value">{{ pointsSummary.recentLedgerCount || 0 }} 条</span>
              </div>
              <div class="fact-item">
                <span class="fact-label">最近余额</span>
                <span class="fact-value">{{ pointsSummary.latestBalanceAfter || '-' }}</span>
              </div>
            </div>
          </template>
          <div v-if="false && canCreateWelfareBatchDraft" class="assistant-actions-inline">
            <el-button
              size="small"
              type="success"
              :loading="creatingWelfareBatchDraft"
              @click="handleCreatePointsWelfareBatchDraft"
            >
              创建员工福利积点母单草案
            </el-button>
          </div>
          <div v-if="false && latestWelfareBatchMeta" class="subtle-text">
            已创建员工福利积点母单草案：#{{ latestWelfareBatchMeta.batch?.id || latestWelfareBatchMeta.id }} /
            {{ latestWelfareBatchMeta.batchStatus || latestWelfareBatchMeta.batch?.batchStatus }}
          </div>
          <div
            v-if="false && (latestWelfareBatchMeta?.batch?.id || latestWelfareBatchMeta?.id)"
            class="assistant-actions-inline"
          >
            <el-button size="small" text type="primary" @click="openLatestWelfareBatchDetail">
              查看员工福利积点母单
            </el-button>
          </div>
          <div v-if="canCreateWelfareBatchDraft" class="assistant-actions-inline">
            <el-button
              size="small"
              type="success"
              :loading="creatingWelfareBatchDraft"
              @click="handleCreatePointsWelfareBatchDraft"
            >
              创建员工福利积点母单草案
            </el-button>
          </div>
          <div v-if="latestWelfareBatchMeta" class="subtle-text">
            已创建员工福利积点母单草案：#{{ latestWelfareBatchMeta.batch?.id || latestWelfareBatchMeta.id }} /
            {{ latestWelfareBatchMeta.batchStatus || latestWelfareBatchMeta.batch?.batchStatus }}
          </div>
          <div
            v-if="latestWelfareBatchMeta?.batch?.id || latestWelfareBatchMeta?.id"
            class="assistant-actions-inline"
          >
            <el-button size="small" text type="primary" @click="openLatestWelfareBatchDetail">
              查看员工福利积点母单
            </el-button>
          </div>
        </el-card>

        <el-card v-if="latestHandlingPlan" shadow="never" class="assistant-section">
          <template #header>
            <div class="section-header">
              <span>处理单收口</span>
              <span class="subtle-text">{{ formatHandlingPlanVisibility(latestHandlingPlan) }}</span>
            </div>
          </template>
          <div class="summary-item">
            <span class="summary-label">当前状态摘要</span>
            <span>{{ handlingPlanStatusSummary }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">谁处理 / 怎么处理</span>
            <span>{{ handlingPlanOwnerSummary }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">何时可重试</span>
            <span>{{ handlingPlanRetrySummary }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">边界说明</span>
            <span>{{ handlingPlanBoundarySummary }}</span>
          </div>
          <ul v-if="latestHandlingPlanActionItems.length" class="assistant-bullet-list">
            <li v-for="item in latestHandlingPlanActionItems" :key="item.actionKey">
              {{ formatHandlingPlanActionLine(item) }}
            </li>
          </ul>
          <div v-if="latestHandlingPlan.visibilityScope !== 'full'" class="subtle-text">
            当前角色默认查看 handlingPlan 收口版，原始兼容诊断已下沉为审计补充。
          </div>
        </el-card>

        <el-card shadow="never" class="assistant-section">
          <template #header>
            <div class="section-header">
              <span>AI 补充分析</span>
              <span class="subtle-text">{{ contextData?.generatedAt || '-' }}</span>
            </div>
          </template>
          <div class="analysis-meta">
            <el-tag size="small" type="primary">{{ latestQuestionTypeLabel }}</el-tag>
            <el-tag size="small" type="success">{{ latestConfidenceLevelLabel }}</el-tag>
          </div>
          <template v-if="latestAnswerSections.length">
            <div v-for="section in latestAnswerSections" :key="section.sectionKey" class="answer-section">
              <div class="answer-section-title">{{ section.title }}</div>
              <div class="analysis-text">{{ section.content }}</div>
            </div>
          </template>
          <div v-else class="analysis-text">{{ analysisText }}</div>

          <div v-if="latestCitedKnowledge.length" class="evidence-block">
            <div class="answer-section-title">引用规则</div>
            <div
              v-for="item in latestCitedKnowledge"
              :key="item.id"
              class="evidence-item"
            >
              <div class="evidence-title">{{ item.title }}</div>
              <div class="subtle-text">{{ item.summary }}</div>
            </div>
          </div>

          <div v-if="latestCitedManualDecisions.length" class="evidence-block">
            <div class="answer-section-title">引用人审记录</div>
            <div
              v-for="item in latestCitedManualDecisions"
              :key="`${item.matchType}-${item.id}`"
              class="evidence-item"
            >
              <div class="evidence-title">
                {{ item.matchType === 'direct' ? '当前对象已有人工裁决' : '相似模式人工裁决' }}
              </div>
              <div class="subtle-text">{{ item.summary }}</div>
              <div class="subtle-text">
                适用范围：{{ item.decisionScope || '未提供' }} / 依据：{{ formatJudgmentBasis(item.judgmentBasis) }}
              </div>
            </div>
          </div>

          <div v-if="latestFounderMemories.length" class="evidence-block">
            <div class="answer-section-title">引用的创始人记忆</div>
            <div
              v-for="item in latestFounderMemories"
              :key="`founder-${item.id}`"
              class="evidence-item"
            >
              <div class="evidence-title">{{ item.title }}</div>
              <div class="subtle-text">{{ item.summary }}</div>
            </div>
          </div>

          <div v-if="latestRoleMemories.length" class="evidence-block">
            <div class="answer-section-title">引用的岗位规则</div>
            <div
              v-for="item in latestRoleMemories"
              :key="`role-${item.id}`"
              class="evidence-item"
            >
              <div class="evidence-title">{{ item.title }}</div>
              <div class="subtle-text">{{ item.summary }}</div>
            </div>
          </div>

          <div
            v-if="
              latestMemoryInfluenceSummary ||
              latestFounderPrinciplesApplied.length ||
              latestRolePlaybookApplied.length
            "
            class="evidence-block"
          >
            <div class="answer-section-title">为什么这样回答</div>
            <div v-if="latestMemoryInfluenceSummary" class="subtle-text">
              {{ latestMemoryInfluenceSummary }}
            </div>
            <div v-if="latestFounderPrinciplesApplied.length" class="subtle-text">
              创始人原则：{{ latestFounderPrinciplesApplied.join('、') }}
            </div>
            <div v-if="latestRolePlaybookApplied.length" class="subtle-text">
              岗位规则：{{ latestRolePlaybookApplied.join('、') }}
            </div>
          </div>

          <el-alert
            v-if="latestGeneralizationBoundary && !latestHandlingPlan"
            type="info"
            :closable="false"
            show-icon
            class="assistant-alert-inline"
          >
            <template #title>边界说明</template>
            <div class="subtle-text">{{ latestGeneralizationBoundary }}</div>
          </el-alert>

          <el-alert
            v-if="latestMissingContext.length"
            type="warning"
            :closable="false"
            show-icon
            class="assistant-alert-inline"
          >
            <template #title>当前仍缺少这些上下文，AI 只能给建议</template>
            <div class="subtle-text">{{ latestMissingContext.join('；') }}</div>
          </el-alert>

          <div v-if="contextData?.suggestedQuestions?.length" class="question-list">
            <el-button
              v-for="question in contextData.suggestedQuestions"
              :key="question"
              text
              type="primary"
              class="question-button"
              @click="handleSuggestedQuestion(question)"
            >
              {{ question }}
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="assistant-section">
          <template #header>
            <div class="section-header">
              <span>命令草稿</span>
              <el-button
                v-if="commandDraftText"
                size="small"
                text
                type="primary"
                @click="copyCommandDraft"
              >
                复制
              </el-button>
            </div>
          </template>
          <pre class="command-draft">{{ commandDraftText }}</pre>
          <div v-if="canCreatePointsRedemptionDraft" class="assistant-actions-inline">
            <el-button
              size="small"
              type="warning"
              :loading="creatingRedemptionDraft"
              @click="handleCreatePointsRedemptionDraft"
            >
              创建积点兑换草稿
            </el-button>
          </div>
          <div v-if="latestRedemptionDraftMeta" class="subtle-text">
            已创建积点兑换草稿：#{{ latestRedemptionDraftMeta.id }} / {{ latestRedemptionDraftMeta.requestStatus }}
          </div>
          <div v-if="latestRedemptionDraftMeta?.id" class="assistant-actions-inline">
            <el-button size="small" text type="primary" @click="openLatestRedemptionDetail">
              查看积点兑换详情
            </el-button>
          </div>
          <div v-if="canCreatePointsDraft" class="assistant-actions-inline">
            <el-button
              size="small"
              type="primary"
              :loading="creatingPointsDraft"
              @click="handleCreatePointsCommandDraft"
            >
              创建积点命令草稿
            </el-button>
          </div>
          <div v-if="latestPointsDraftMeta" class="subtle-text">
            已创建积点命令草稿：#{{ latestPointsDraftMeta.id }} / {{ latestPointsDraftMeta.commandStatus }}
          </div>
          <div v-if="latestPointsDraftMeta?.id" class="assistant-actions-inline">
            <el-button size="small" text type="primary" @click="openLatestPointsDraftDetail">
              查看积点命令详情
            </el-button>
          </div>
          <div v-if="canCreateAbcPointsDraft" class="assistant-actions-inline">
            <el-button
              size="small"
              type="primary"
              plain
              :loading="creatingPointsDraft"
              @click="handleCreateAbcPointsCommandDraft"
            >
              创建 ABC 积分命令草稿
            </el-button>
          </div>
          <div v-if="latestAbcPointsDraftMeta" class="subtle-text">
            已创建 ABC 积分命令草稿：#{{ latestAbcPointsDraftMeta.id }} / {{ latestAbcPointsDraftMeta.commandStatus }}
          </div>
          <div v-if="latestAbcPointsDraftMeta?.id" class="assistant-actions-inline">
            <el-button size="small" text type="primary" @click="openLatestAbcPointsDraftDetail">
              查看 ABC 积分命令
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="assistant-section">
          <template #header>
            <div class="section-header">
              <span>互动记录</span>
              <span class="subtle-text">{{ interactionHistory.length }} 条</span>
            </div>
          </template>

          <div class="reply-composer">
            <el-input
              v-model="promptText"
              type="textarea"
              :rows="3"
              placeholder="例如：这条为什么卡在这里？当前最合理的处理动作是什么？"
            />
            <div class="assistant-actions-inline">
              <el-button size="small" @click="reloadContext">刷新上下文</el-button>
              <el-button
                type="primary"
                size="small"
                :loading="replyLoading"
                @click="submitPrompt()"
              >
                让 AI 分析
              </el-button>
            </div>
          </div>

          <div v-if="interactionHistory.length" class="history-list">
            <div v-for="item in interactionHistory" :key="item.id" class="history-item">
              <div class="history-meta">
                <span>{{ item.createdByName || '系统' }}</span>
                <span>{{ formatDateTime(item.createdAt) }}</span>
              </div>
              <div class="assistant-meta history-tags">
                <el-tag v-if="item.questionType" size="small" type="primary">
                  {{ questionTypeLabelMap[item.questionType] || item.questionType }}
                </el-tag>
                <el-tag v-if="item.confidenceLevel" size="small" type="success">
                  {{ confidenceLevelLabelMap[item.confidenceLevel] || item.confidenceLevel }}
                </el-tag>
              </div>
              <div class="history-question">问：{{ item.userMessage }}</div>
              <div class="history-reply">答：{{ item.assistantReply }}</div>
            </div>
          </div>
          <div v-else class="empty-tip">当前页面还没有互动记录，先点一个建议问题开始。</div>
        </el-card>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getAiPageContext, replyAiAssistant } from '../../api/ai';
import {
  createAbcPointsCommandDraft,
  createPointsCommandDraft,
  createPointsRedemptionDraft,
  createPointsWelfareBatchDraft,
} from '../../api/points';
import { currentRoleCode, currentRoleProfile, hasAnyRole } from '../../utils/permissions';

interface AssistantFocusInput {
  entityType?: string | null;
  entityId?: string | number | null;
  label?: string;
  subtitle?: string;
  sourceTable?: string | null;
  sourceId?: string | number | null;
  keyFacts?: Array<{ label: string; value: string }>;
  rawContext?: Record<string, unknown> | null;
}

const props = withDefaults(
  defineProps<{
    pageTitle: string;
    routePath: string;
    currentFilters?: Record<string, unknown>;
    sourceActionId?: string | null;
    focusObject?: AssistantFocusInput | null;
    entityType?: string | null;
    entityId?: string | number | null;
    scene?: string | null;
  }>(),
  {
    currentFilters: () => ({}),
    sourceActionId: null,
    focusObject: null,
    entityType: null,
    entityId: null,
    scene: null,
  },
);
const router = useRouter();

const drawerVisible = ref(false);
const contextLoading = ref(false);
const replyLoading = ref(false);
const contextError = ref('');
const contextData = ref<any>(null);
const latestReplyRecord = ref<any>(null);
const latestPointsDraftMeta = ref<any>(null);
const latestAbcPointsDraftMeta = ref<any>(null);
const latestRedemptionDraftMeta = ref<any>(null);
const latestWelfareBatchMeta = ref<any>(null);
const promptText = ref('');
const contextRequestId = ref(0);
const replyRequestId = ref(0);
const creatingPointsDraft = ref(false);
const creatingRedemptionDraft = ref(false);
const creatingWelfareBatchDraft = ref(false);

const canUseAssistant = computed(() => hasAnyRole(['admin', 'finance', 'approver']));
const drawerTitle = computed(() => `${props.pageTitle} / 页面内 AI 助手`);
const currentRoleLabel = computed(() => currentRoleProfile.value.label);
const currentProviderLabel = computed(
  () => contextData.value?.provider?.displayName || contextData.value?.provider?.providerKey || 'Stark 本地引导',
);

const effectiveFocus = computed(() => {
  if (props.focusObject?.entityType && props.focusObject?.entityId !== undefined && props.focusObject?.entityId !== null) {
    return {
      entityType: props.focusObject.entityType,
      entityId: String(props.focusObject.entityId),
      label: props.focusObject.label,
      subtitle: props.focusObject.subtitle,
      sourceTable: props.focusObject.sourceTable ?? null,
      sourceId:
        props.focusObject.sourceId === undefined || props.focusObject.sourceId === null
          ? null
          : String(props.focusObject.sourceId),
      keyFacts: props.focusObject.keyFacts ?? [],
      rawContext: props.focusObject.rawContext ?? null,
    };
  }

  if (props.entityType && props.entityId !== undefined && props.entityId !== null) {
    return {
      entityType: props.entityType,
      entityId: String(props.entityId),
      label: '',
      subtitle: '',
      sourceTable: null,
      sourceId: null,
      keyFacts: [],
      rawContext: null,
    };
  }

  return null;
});

const interactionHistory = computed(() => {
  const base = Array.isArray(contextData.value?.interactionHistory)
    ? contextData.value.interactionHistory
    : [];
  if (!latestReplyRecord.value) {
    return base;
  }
  if (base.some((item: any) => item.id === latestReplyRecord.value.id)) {
    return base;
  }
  return [latestReplyRecord.value, ...base];
});

const latestAnalysisRecord = computed(() => latestReplyRecord.value || null);

const focusFacts = computed(() => {
  const focusObject = contextData.value?.focusObject;
  return Array.isArray(focusObject?.keyFacts) ? focusObject.keyFacts : [];
});

const pointsSummary = computed(() => {
  const summary = contextData.value?.pointsSummary;
  return summary && typeof summary === 'object' ? summary : null;
});

const questionTypeLabelMap: Record<string, string> = {
  why_blocked: '为何阻塞',
  what_to_do: '处理建议',
  can_affect_payroll: '绩效/工资前置',
  same_or_special_case: '特例 vs 同类',
  what_missing: '缺失上下文',
  draft_action: '动作草稿',
  explain_rule: '规则解释',
};

const confidenceLevelLabelMap: Record<string, string> = {
  high: '高把握',
  medium: '中等把握',
  low: '低把握',
};

const latestQuestionTypeLabel = computed(() => {
  const questionType = latestAnalysisRecord.value?.questionType;
  return questionType ? questionTypeLabelMap[questionType] || questionType : '上下文分析';
});

const latestConfidenceLevelLabel = computed(() => {
  const confidenceLevel =
    latestHandlingPlan.value?.aiDiagnosis?.confidenceLevel ??
    latestAnalysisRecord.value?.confidenceLevel;
  return confidenceLevel
    ? confidenceLevelLabelMap[confidenceLevel] || confidenceLevel
    : '建议';
});

const latestAnswerSections = computed(() => {
  const sections =
    latestHandlingPlan.value?.aiDiagnosis?.answerSections ??
    latestAnalysisRecord.value?.answerSections;
  return Array.isArray(sections) ? sections : [];
});

const latestCitedKnowledge = computed(() => {
  const cited = latestAnalysisRecord.value?.citedKnowledge ?? contextData.value?.knowledgeHints;
  return Array.isArray(cited) ? cited : [];
});

const latestCitedManualDecisions = computed(() => {
  const cited =
    latestAnalysisRecord.value?.citedManualDecisions ?? contextData.value?.manualDecisionMatches;
  return Array.isArray(cited) ? cited : [];
});

const latestCitedMemories = computed(() => {
  const cited = latestAnalysisRecord.value?.citedMemories ?? contextData.value?.citedMemories;
  return Array.isArray(cited) ? cited : [];
});

const latestFounderMemories = computed(() =>
  latestCitedMemories.value.filter((item: any) => item.memoryBucket === 'founder'),
);

const latestRoleMemories = computed(() =>
  latestCitedMemories.value.filter((item: any) => item.memoryBucket === 'role'),
);

const latestMemoryInfluenceSummary = computed(
  () =>
    latestAnalysisRecord.value?.memoryInfluenceSummary ??
    contextData.value?.memoryInfluenceSummary ??
    '',
);

const latestFounderPrinciplesApplied = computed(() => {
  const values =
    latestAnalysisRecord.value?.founderPrinciplesApplied ?? contextData.value?.founderPrinciplesApplied;
  return Array.isArray(values) ? values : [];
});

const latestRolePlaybookApplied = computed(() => {
  const values =
    latestAnalysisRecord.value?.rolePlaybookApplied ?? contextData.value?.rolePlaybookApplied;
  return Array.isArray(values) ? values : [];
});

const latestHandlingPlan = computed(() => {
  const plan = latestReplyRecord.value?.handlingPlan ?? contextData.value?.handlingPlan ?? null;
  return plan && typeof plan === 'object' ? plan : null;
});

const latestHandlingPlanActionItems = computed(() => {
  const items = latestHandlingPlan.value?.actionItems;
  return Array.isArray(items) ? items : [];
});

const handlingPlanStatusSummary = computed(
  () => latestHandlingPlan.value?.summary || blockerText.value,
);

const handlingPlanOwnerSummary = computed(() => {
  const primaryAction =
    latestHandlingPlanActionItems.value.find((item: any) =>
      ['blocked', 'pending', 'ready'].includes(item?.status),
    ) || latestHandlingPlanActionItems.value[0];
  if (primaryAction) {
    return formatHandlingPlanActionLine(primaryAction);
  }
  return latestHandlingPlan.value?.listSummary || suggestedNextStep.value;
});

const handlingPlanRetrySummary = computed(
  () => latestHandlingPlan.value?.diagnosis?.suggestedNextStep || suggestedNextStep.value,
);

const handlingPlanBoundarySummary = computed(() => {
  const boundary = latestHandlingPlan.value?.boundary;
  return (
    boundary?.executionBoundary ||
    boundary?.humanConfirmationBoundary ||
    boundary?.payrollBoundary ||
    boundary?.generalizationBoundary ||
    latestGeneralizationBoundary.value ||
    '-'
  );
});

const latestGeneralizationBoundary = computed(
  () =>
    latestHandlingPlan.value?.boundary?.generalizationBoundary ??
    latestAnalysisRecord.value?.generalizationBoundary ??
    contextData.value?.generalizationBoundary ??
    '',
);

const latestMissingContext = computed(() => {
  const missing = latestAnalysisRecord.value?.missingContext;
  return Array.isArray(missing) ? missing : [];
});

const filterSummaryText = computed(() => {
  const summary = contextData.value?.filterSummary;
  if (!summary) {
    return '当前未指定额外筛选';
  }

  const parts: string[] = [];
  if (summary.periodKey) {
    parts.push(`周期 ${summary.periodKey}`);
  }
  if (summary.dateFrom || summary.dateTo) {
    parts.push(`时间 ${summary.dateFrom || '-'} ~ ${summary.dateTo || '-'}`);
  }
  const filters = summary.filters || {};
  const filterEntries = Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined && value !== null);
  if (filterEntries.length) {
    parts.push(
      filterEntries
        .map(([key, value]) =>
          Array.isArray(value) ? `${key}=${value.join(',')}` : `${key}=${String(value)}`,
        )
        .join('；'),
    );
  }
  return parts.length ? parts.join(' / ') : '当前未指定额外筛选';
});

const focusLabel = computed(() => {
  const focusObject = contextData.value?.focusObject;
  if (!focusObject) {
    return '当前未选中单条对象，按当前筛选集合分析';
  }
  return `${focusObject.label}${focusObject.subtitle ? ` / ${focusObject.subtitle}` : ''}`;
});

const blockerText = computed(() => {
  if (latestHandlingPlan.value?.visibilityScope && latestHandlingPlan.value?.visibilityScope !== 'full') {
    const summary = latestHandlingPlan.value?.summary;
    return summary ? `处理单摘要：${summary}` : '已收口至 handlingPlan。';
  }
  const diagnosis = latestHandlingPlan.value?.diagnosis;
  if (diagnosis?.blockedReason || diagnosis?.blockedStage) {
    return [
      diagnosis.blockedReason ? `阻塞原因：${diagnosis.blockedReason}` : null,
      diagnosis.blockedStage ? `阶段：${diagnosis.blockedStage}` : null,
    ]
      .filter(Boolean)
      .join(' / ');
  }
  const blockers = Array.isArray(contextData.value?.blockers) ? contextData.value.blockers : [];
  return blockers.length ? blockers.join('、') : '暂无明显阻塞';
});

const suggestedNextStep = computed(() => {
  if (latestHandlingPlan.value?.diagnosis?.suggestedNextStep) {
    return latestHandlingPlan.value.diagnosis.suggestedNextStep;
  }
  const rawContext = contextData.value?.focusObject?.rawContext;
  return rawContext?.suggestedNextStep || '建议继续人工核对当前焦点对象。';
});

const analysisText = computed(() => {
  const handlingPlanReply = latestHandlingPlan.value?.aiDiagnosis?.assistantReply;
  if (handlingPlanReply) {
    return handlingPlanReply;
  }
  if (latestReplyRecord.value?.assistantReply) {
    return latestReplyRecord.value.assistantReply;
  }
  const evidenceSummary = Array.isArray(contextData.value?.evidenceSummary)
    ? contextData.value.evidenceSummary
    : [];
  const roleLabel = contextData.value?.roleInfo?.roleLabel || currentRoleLabel.value;
  if (latestHandlingPlan.value) {
    const boundary = handlingPlanBoundarySummary.value;
    const boundaryText = boundary && boundary !== '-' ? `边界说明：${boundary}` : '';
    return `${roleLabel} 当前正在查看“${focusLabel.value}”。当前状态摘要：${
      handlingPlanStatusSummary.value
    }。谁处理 / 怎么处理：${handlingPlanOwnerSummary.value}。何时可重试：${
      handlingPlanRetrySummary.value
    }${boundaryText ? `。${boundaryText}` : ''}`;
  }
  return `${roleLabel} 当前正在查看“${focusLabel.value}”。阻塞：${blockerText.value}。证据：${
    evidenceSummary.length ? evidenceSummary.join('；') : '当前证据摘要较少，建议先从建议问题开始。'
  } 建议下一步：${suggestedNextStep.value}`;
});

const commandDraftText = computed(() => {
  const draft =
    latestReplyRecord.value?.suggestedCommandDraft ||
    contextData.value?.suggestedActions?.[0] ||
    null;
  if (!draft) {
    return '当前还没有命令草稿。你可以点击建议问题，或直接输入“这条最合理的处理动作是什么？”。';
  }
  return JSON.stringify(draft, null, 2);
});

const isPointsCommandDraft = computed(() => {
  const draft = latestReplyRecord.value?.suggestedCommandDraft;
  const draftType = draft?.draftType;
  return ['issue_points', 'adjust_points', 'revoke_points'].includes(draftType);
});

const isAbcPointsCommandDraft = computed(() => {
  const draft = latestReplyRecord.value?.suggestedCommandDraft;
  const draftType = draft?.draftType;
  return ['issue_score', 'adjust_score', 'revoke_score'].includes(draftType);
});

const isPointsRedemptionDraft = computed(() => {
  const draft = latestReplyRecord.value?.suggestedCommandDraft;
  return draft?.draftType === 'create_points_redemption_request';
});

const isPointsWelfareBatchDraft = computed(() => {
  const draft = latestReplyRecord.value?.suggestedCommandDraft;
  return draft?.draftType === 'create_points_welfare_batch';
});

const canCreatePointsDraft = computed(
  () => isPointsCommandDraft.value && hasAnyRole(['admin', 'finance']),
);

const canCreateAbcPointsDraft = computed(
  () => isAbcPointsCommandDraft.value && hasAnyRole(['admin', 'finance']),
);

const canCreatePointsRedemptionDraft = computed(
  () => isPointsRedemptionDraft.value && hasAnyRole(['admin', 'finance']),
);

const canCreateWelfareBatchDraft = computed(
  () => isPointsWelfareBatchDraft.value && hasAnyRole(['admin', 'finance']),
);

function buildPageContextParams() {
  return {
    routePath: props.routePath,
    role: currentRoleCode.value,
    scene: props.scene || undefined,
    entityType: effectiveFocus.value?.entityType || undefined,
    entityId: effectiveFocus.value?.entityId || undefined,
    sourceActionId: props.sourceActionId || undefined,
    pageQuery: JSON.stringify(props.currentFilters || {}),
  };
}

async function loadContext() {
  if (!canUseAssistant.value || !drawerVisible.value) {
    return;
  }

  const requestId = ++contextRequestId.value;
  contextLoading.value = true;
  contextError.value = '';

  try {
    const { data } = await getAiPageContext(buildPageContextParams());
    if (requestId !== contextRequestId.value) {
      return;
    }
    contextData.value = data.data;
    latestReplyRecord.value = null;
  } catch (error: any) {
    if (requestId !== contextRequestId.value) {
      return;
    }
    contextError.value =
      error?.response?.data?.message || error?.message || 'AI 页面上下文暂时不可用';
  } finally {
    if (requestId === contextRequestId.value) {
      contextLoading.value = false;
    }
  }
}

async function submitPrompt(question?: string) {
  const message = (question ?? promptText.value).trim();
  if (!message) {
    ElMessage.warning('请先输入问题或点击建议问题');
    return;
  }

  const requestId = ++replyRequestId.value;
  replyLoading.value = true;

  try {
    const { data } = await replyAiAssistant({
      routePath: props.routePath,
      role: currentRoleCode.value,
      scene: props.scene || undefined,
      entityType: effectiveFocus.value?.entityType || undefined,
      entityId: effectiveFocus.value?.entityId || undefined,
      sourceActionId: props.sourceActionId || undefined,
      userMessage: message,
      threadKey: contextData.value?.threadKey,
      currentFilters: props.currentFilters || {},
      currentFocus: effectiveFocus.value || undefined,
    });

    if (requestId !== replyRequestId.value) {
      return;
    }

    latestReplyRecord.value = {
      ...(data.data.interactionRecord || {}),
      questionType: data.data.questionType,
      answerSections: data.data.answerSections,
      citedKnowledge: data.data.citedKnowledge,
      citedManualDecisions: data.data.citedManualDecisions,
      citedMemories: data.data.citedMemories,
      memoryInfluenceSummary: data.data.memoryInfluenceSummary,
      founderPrinciplesApplied: data.data.founderPrinciplesApplied,
      rolePlaybookApplied: data.data.rolePlaybookApplied,
      generalizationBoundary: data.data.generalizationBoundary,
      confidenceLevel: data.data.confidenceLevel,
      missingContext: data.data.missingContext,
      suggestedCommandDraft: data.data.suggestedCommandDraft,
      suggestedActions: data.data.suggestedActions,
      handlingPlan: data.data.handlingPlan ?? data.data.interactionRecord?.handlingPlan ?? null,
      assistantReply: data.data.assistantReply,
    };
    promptText.value = '';
    ElMessage.success('AI 助手已生成当前页面分析');
  } catch (error: any) {
    if (requestId !== replyRequestId.value) {
      return;
    }
    ElMessage.error(error?.response?.data?.message || error?.message || 'AI 助手分析失败');
  } finally {
    if (requestId === replyRequestId.value) {
      replyLoading.value = false;
    }
  }
}

function handleSuggestedQuestion(question: string) {
  promptText.value = question;
  void submitPrompt(question);
}

async function copyCommandDraft() {
  try {
    await navigator.clipboard.writeText(commandDraftText.value);
    ElMessage.success('命令草稿已复制');
  } catch {
    ElMessage.warning('当前环境不支持复制，请手动复制草稿内容');
  }
}

async function handleCreatePointsCommandDraft() {
  const draft = latestReplyRecord.value?.suggestedCommandDraft;
  if (!draft || !isPointsCommandDraft.value) {
    ElMessage.warning('当前没有可用的积点命令草稿');
    return;
  }

  creatingPointsDraft.value = true;
  try {
    const response = await createPointsCommandDraft({
      commandType: draft.draftType,
      ownerType: draft.ownerType,
      ownerId: draft.ownerId ?? undefined,
      ownerMobile: draft.ownerMobile ?? undefined,
      merchantId: draft.merchantId ?? undefined,
      changeAmount:
        typeof draft.changeAmount === 'string' && draft.changeAmount.trim()
          ? draft.changeAmount
          : '1',
      sourceType: draft.sourceType || 'manual_reward',
      reasonCode:
        typeof draft.reasonCode === 'string' && draft.reasonCode.trim()
          ? draft.reasonCode.trim()
          : undefined,
      remark:
        typeof draft.suggestedReason === 'string' && draft.suggestedReason.trim()
          ? draft.suggestedReason.trim()
          : 'AI 助手草拟的积点命令',
      requestSource: draft.requestSource || 'ai_assistant_draft',
      providerKey: draft.providerKey || contextData.value?.provider?.providerKey,
      sourceActionId: draft.sourceActionId || props.sourceActionId || undefined,
      threadKey: draft.threadKey || contextData.value?.threadKey || undefined,
      normalizedPayload: draft,
    });

    latestPointsDraftMeta.value = response.data.data;
    ElMessage.success(
      `积点命令草稿已创建：#${response.data.data.id} / ${response.data.data.commandStatus}`,
    );
    void loadContext();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '创建积点命令草稿失败',
    );
  } finally {
    creatingPointsDraft.value = false;
  }
}

async function handleCreateAbcPointsCommandDraft() {
  const draft = latestReplyRecord.value?.suggestedCommandDraft;
  if (!draft || !isAbcPointsCommandDraft.value) {
    ElMessage.warning('当前没有可用的 ABC 积分命令草稿');
    return;
  }

  creatingPointsDraft.value = true;
  try {
    const response = await createAbcPointsCommandDraft({
      commandType: draft.draftType,
      ownerType: draft.ownerType,
      ownerId: draft.ownerId ?? undefined,
      ownerMobile: draft.ownerMobile ?? undefined,
      changeAmount:
        typeof draft.changeAmount === 'string' && draft.changeAmount.trim()
          ? draft.changeAmount
          : '100.00',
      sourceType: draft.sourceType || 'hq_issue',
      reasonCode:
        typeof draft.reasonCode === 'string' && draft.reasonCode.trim()
          ? draft.reasonCode.trim()
          : undefined,
      remark:
        typeof draft.suggestedReason === 'string' && draft.suggestedReason.trim()
          ? draft.suggestedReason.trim()
          : 'AI 助手草拟的 ABC 积分命令',
      requestSource: draft.requestSource || 'ai_assistant_draft',
      providerKey: draft.providerKey || contextData.value?.provider?.providerKey,
      sourceActionId: draft.sourceActionId || props.sourceActionId || undefined,
      threadKey: draft.threadKey || contextData.value?.threadKey || undefined,
      normalizedPayload: draft,
    });

    latestAbcPointsDraftMeta.value = response.data.data.command || response.data.data;
    ElMessage.success(
      `ABC 积分命令草稿已创建：#${latestAbcPointsDraftMeta.value.id} / ${latestAbcPointsDraftMeta.value.commandStatus}`,
    );
    void loadContext();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '创建 ABC 积分命令草稿失败',
    );
  } finally {
    creatingPointsDraft.value = false;
  }
}

async function handleCreatePointsWelfareBatchDraft() {
  const draft = latestReplyRecord.value?.suggestedCommandDraft;
  if (!draft || !isPointsWelfareBatchDraft.value) {
    ElMessage.warning('当前没有可用的员工福利积点母单草稿');
    return;
  }

  creatingWelfareBatchDraft.value = true;
  try {
    const response = await createPointsWelfareBatchDraft({
      periodKey:
        typeof draft.periodKey === 'string' && draft.periodKey.trim()
          ? draft.periodKey.trim()
          : undefined,
      sourceActionId: draft.sourceActionId || props.sourceActionId || undefined,
      providerKey: draft.providerKey || contextData.value?.provider?.providerKey,
      threadKey: draft.threadKey || contextData.value?.threadKey || undefined,
      remark:
        typeof draft.suggestedReason === 'string' && draft.suggestedReason.trim()
          ? draft.suggestedReason.trim()
          : 'AI 助手草拟的员工月度福利积点母单',
      normalizedPayload: draft,
    });

    latestWelfareBatchMeta.value = response.data.data;
    const batchId = response.data.data?.batch?.id || response.data.data?.id || '-';
    const batchStatus =
      response.data.data?.batchStatus || response.data.data?.batch?.batchStatus || 'drafted';
    ElMessage.success(`员工福利积点母单草案已创建：#${batchId} / ${batchStatus}`);
    void loadContext();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '创建员工福利积点母单草案失败',
    );
  } finally {
    creatingWelfareBatchDraft.value = false;
  }
}

async function handleCreatePointsRedemptionDraft() {
  const draft = latestReplyRecord.value?.suggestedCommandDraft;
  if (!draft || !isPointsRedemptionDraft.value) {
    ElMessage.warning('当前没有可用的积点兑换草稿');
    return;
  }

  const redeemableCode =
    typeof draft.redeemableCode === 'string' && draft.redeemableCode.trim()
      ? draft.redeemableCode.trim()
      : '';
  const ownerMobile =
    typeof draft.ownerMobile === 'string' && draft.ownerMobile.trim()
      ? draft.ownerMobile.trim()
      : '';
  const ownerId =
    draft.ownerId === undefined || draft.ownerId === null || draft.ownerId === ''
      ? undefined
      : Number(draft.ownerId);

  if (!redeemableCode) {
    ElMessage.warning('当前兑换草稿缺少 redeemableCode，无法创建正式请求');
    return;
  }
  if (!ownerMobile && ownerId === undefined) {
    ElMessage.warning('当前兑换草稿缺少 ownerMobile / ownerId，无法创建正式请求');
    return;
  }

  creatingRedemptionDraft.value = true;
  try {
    const response = await createPointsRedemptionDraft({
      ownerType:
        typeof draft.ownerType === 'string' && draft.ownerType.trim()
          ? draft.ownerType.trim()
          : 'customer',
      ownerId,
      ownerMobile: ownerMobile || undefined,
      redeemableCode,
      pointsCost:
        typeof draft.pointsCost === 'string' && draft.pointsCost.trim()
          ? draft.pointsCost.trim()
          : '200.00',
      targetValue:
        typeof draft.targetValue === 'string' && draft.targetValue.trim()
          ? draft.targetValue.trim()
          : '200.00',
      reasonCode:
        typeof draft.reasonCode === 'string' && draft.reasonCode.trim()
          ? draft.reasonCode.trim()
          : undefined,
      remark:
        typeof draft.suggestedReason === 'string' && draft.suggestedReason.trim()
          ? draft.suggestedReason.trim()
          : 'AI 助手草拟的积点兑换请求',
      requestSource: draft.requestSource || 'ai_assistant_draft',
      providerKey: draft.providerKey || contextData.value?.provider?.providerKey,
      sourceActionId: draft.sourceActionId || props.sourceActionId || undefined,
      threadKey: draft.threadKey || contextData.value?.threadKey || undefined,
      normalizedPayload: draft,
    });

    latestRedemptionDraftMeta.value = response.data.data;
    ElMessage.success(
      `积点兑换草稿已创建：#${response.data.data.id} / ${response.data.data.requestStatus}`,
    );
    void loadContext();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '创建积点兑换草稿失败',
    );
  } finally {
    creatingRedemptionDraft.value = false;
  }
}

function openLatestPointsDraftDetail() {
  if (!latestPointsDraftMeta.value?.id) {
    return;
  }
  void router.push(`/points/commands/${latestPointsDraftMeta.value.id}`);
}

function openLatestRedemptionDetail() {
  if (!latestRedemptionDraftMeta.value?.id) {
    return;
  }
  void router.push({
    path: `/points/redemptions/${latestRedemptionDraftMeta.value.id}`,
    query: {
      sourceActionId:
        latestRedemptionDraftMeta.value.sourceActionId ||
        latestReplyRecord.value?.suggestedCommandDraft?.sourceActionId ||
        props.sourceActionId ||
        undefined,
    },
  });
}

function openLatestWelfareBatchDetail() {
  const batchId =
    latestWelfareBatchMeta.value?.batch?.id || latestWelfareBatchMeta.value?.id || null;
  if (!batchId) {
    return;
  }
  const periodKey =
    latestWelfareBatchMeta.value?.periodKey ||
    latestWelfareBatchMeta.value?.batch?.periodKey ||
    latestReplyRecord.value?.suggestedCommandDraft?.periodKey ||
    undefined;
  void router.push({
    path: '/points/welfare',
    query: {
      batchId: String(batchId),
      periodKey: periodKey || undefined,
      sourceActionId:
        latestWelfareBatchMeta.value?.sourceActionId ||
        latestReplyRecord.value?.suggestedCommandDraft?.sourceActionId ||
        props.sourceActionId ||
        undefined,
    },
  });
}

function openLatestAbcPointsDraftDetail() {
  if (!latestAbcPointsDraftMeta.value?.id) {
    return;
  }
  void router.push({
    path: '/abc-points/commands',
    query: {
      commandId: String(latestAbcPointsDraftMeta.value.id),
      sourceActionId:
        latestAbcPointsDraftMeta.value.sourceActionId ||
        latestReplyRecord.value?.suggestedCommandDraft?.sourceActionId ||
        props.sourceActionId ||
        undefined,
    },
  });
}

function reloadContext() {
  void loadContext();
}

function formatHandlingPlanVisibility(plan: any) {
  return plan?.visibilityScope === 'full' ? '完整视图' : '收口视图';
}

function formatHandlingPlanActionStatus(status?: string) {
  switch (status) {
    case 'pending':
      return '待确认';
    case 'ready':
      return '可继续';
    case 'blocked':
      return '阻塞';
    case 'done':
      return '已完成';
    case 'not_applicable':
      return '不适用';
    default:
      return '待处理';
  }
}

function formatHandlingPlanOwnerScope(scope?: string) {
  switch (scope) {
    case 'admin_founder':
      return '管理员 / 创始人';
    case 'authorized_roles':
      return '授权角色';
    case 'human_review':
      return '人工复核';
    default:
      return '当前岗位';
  }
}

function formatHandlingPlanActionLine(item: any) {
  if (!item) {
    return '-';
  }
  return `${item.title || '处理动作'}（${formatHandlingPlanOwnerScope(item.ownerScope)} / ${formatHandlingPlanActionStatus(item.status)}）：${item.description || '-'}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatJudgmentBasis(values?: string[] | null) {
  if (!Array.isArray(values) || !values.length) {
    return '未提供';
  }
  return values.join('、');
}

watch(
  () => drawerVisible.value,
  (visible) => {
    if (visible) {
      void loadContext();
    }
  },
);

watch(
  () =>
    JSON.stringify({
      routePath: props.routePath,
      filters: props.currentFilters || {},
      focus: effectiveFocus.value,
      sourceActionId: props.sourceActionId || null,
    }),
  () => {
    if (drawerVisible.value) {
      void loadContext();
    }
  },
);
</script>

<style scoped>
.assistant-trigger {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 20;
}

.assistant-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.assistant-title {
  font-size: 16px;
  font-weight: 600;
}

.assistant-subtitle,
.subtle-text {
  font-size: 12px;
  color: #6b7280;
}

.assistant-alert,
.assistant-section {
  margin-bottom: 12px;
}

.assistant-alert-inline {
  margin-top: 12px;
}

.assistant-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}

.summary-item,
.fact-item,
.history-item {
  margin-bottom: 8px;
}

.summary-label,
.fact-label {
  display: inline-block;
  min-width: 88px;
  color: #6b7280;
}

.fact-list {
  margin-top: 10px;
}

.fact-value {
  word-break: break-all;
}

.analysis-text,
.history-question,
.history-reply {
  white-space: pre-wrap;
  line-height: 1.6;
}

.analysis-meta,
.history-tags {
  margin-bottom: 10px;
}

.answer-section {
  margin-bottom: 10px;
}

.answer-section-title,
.evidence-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.evidence-block {
  margin-top: 12px;
}

.evidence-item {
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}

.question-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.question-button {
  margin: 0;
  padding: 0;
}

.command-draft {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.5;
}

.reply-composer {
  margin-bottom: 12px;
}

.assistant-actions-inline {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.assistant-bullet-list {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #4b5563;
  line-height: 1.6;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}

.history-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #6b7280;
}

.empty-tip {
  font-size: 13px;
  color: #6b7280;
}

@media (max-width: 768px) {
  .assistant-trigger {
    right: 16px;
    bottom: 16px;
  }
}
</style>




