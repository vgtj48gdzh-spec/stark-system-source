<template>
  <el-card v-loading="loading">
    <template #header>
      <div class="section-header ai-header">
        <div>
          <div class="section-title">AI 建议你现在做这些事</div>
          <div class="subtitle">先做引导、分桶和人工状态管理，不自动执行，也不跳过人工确认。</div>
        </div>
        <div class="ai-header-actions">
          <el-select
            :model-value="role"
            clearable
            placeholder="全部岗位"
            style="width: 160px"
            @update:model-value="emit('update:role', $event ?? '')"
          >
            <el-option
              v-for="item in roleOptions"
              :key="item.value || 'all-role'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            :model-value="dueLevel"
            clearable
            placeholder="全部紧急度"
            style="width: 170px"
            @update:model-value="emit('update:dueLevel', $event ?? '')"
          >
            <el-option
              v-for="item in dueLevelOptions"
              :key="item.value || 'all-due'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            :model-value="periodMode"
            placeholder="分桶视角"
            style="width: 140px"
            @update:model-value="emit('update:periodMode', $event || 'month')"
          >
            <el-option label="按周" value="week" />
            <el-option label="按月" value="month" />
          </el-select>
          <el-select
            :model-value="timeBucket"
            clearable
            placeholder="全部时间桶"
            style="width: 160px"
            @update:model-value="emit('update:timeBucket', $event ?? '')"
          >
            <el-option
              v-for="item in timeBucketOptions"
              :key="item.value || 'all-bucket'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            :model-value="processingView"
            placeholder="状态视图"
            style="width: 160px"
            @update:model-value="emit('update:processingView', $event || 'current')"
          >
            <el-option
              v-for="item in processingViewOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-switch
            :model-value="onlyBlocking"
            inline-prompt
            active-text="只看阻塞"
            inactive-text="全部任务"
            @update:model-value="emit('update:onlyBlocking', $event)"
          />
          <el-button @click="emit('refresh')">刷新建议</el-button>
        </div>
      </div>
    </template>

    <div class="ai-filter-summary">
      <span>当前岗位视角：{{ activeRoleLabel }}</span>
      <span>紧急度：{{ activeDueLevelLabel }}</span>
      <span>时间桶：{{ activeTimeBucketLabel }}</span>
      <span>状态：{{ activeProcessingViewLabel }}</span>
      <span>阻塞筛选：{{ onlyBlocking ? '仅阻塞链' : '全部' }}</span>
    </div>

    <el-alert
      v-if="errorMessage"
      class="state-hint"
      type="warning"
      :closable="false"
      show-icon
      title="AI 总控台暂时不可用，业务页面仍可继续使用。"
    >
      <template #default>
        <div class="ai-error-body">
          <div>{{ errorMessage }}</div>
          <el-button size="small" @click="emit('refresh')">重试 AI 建议</el-button>
        </div>
      </template>
    </el-alert>

    <div v-if="!hasActionItems" class="empty-tip">
      当前没有新的岗位动作建议。若你之前做了“暂缓 / 完成”，可以切到对应状态视图继续回查。
    </div>

    <div v-else class="ai-panel">
      <div v-for="section in sections" :key="section.key" class="ai-section">
        <div class="ai-section-title">{{ section.title }}</div>
        <div v-if="!section.items.length" class="empty-tip">当前暂无此类岗位动作。</div>
        <div v-else class="ai-task-list">
          <div v-for="action in section.items" :key="action.actionId" class="ai-task-item">
            <div class="ai-task-main">
              <div class="ai-task-header">
                <div class="ai-task-name">{{ action.actionTitle }}</div>
                <el-tag size="small" :type="getDueLevelTagType(action.dueLevel)">
                  {{ formatDueLevelLabel(action.dueLevel) }}
                </el-tag>
                <el-tag size="small" effect="plain">{{ action.ownerRoleLabel }}</el-tag>
                <el-tag size="small" effect="plain" type="info">
                  {{ formatImpactTypeLabel(action.impactType) }}
                </el-tag>
                <el-tag size="small" effect="plain" type="warning">
                  {{ formatTimeBucketLabel(action.bucketLabel) }}
                </el-tag>
                <el-tag size="small" :type="getProcessingStatusTagType(action.processingStatus)">
                  {{ formatProcessingStatus(action.processingStatus) }}
                </el-tag>
              </div>

              <div class="ai-task-summary">{{ action.actionSummary }}</div>

              <div class="ai-task-meta">
                <span>数量：{{ action.relatedCount }}</span>
                <span>影响金额：{{ formatAmount(action.relatedAmount) }}</span>
                <span>时间锚点：{{ formatDateTime(action.timeAnchorDate) }}</span>
                <span>截止：{{ formatDateTime(action.deadline) }}</span>
              </div>

              <div class="ai-task-copy">
                <span class="ai-task-label">为什么现在要做：</span>{{ action.whyNow }}
              </div>
              <div class="ai-task-copy">
                <span class="ai-task-label">建议动作：</span>{{ action.suggestedAction }}
              </div>
              <div v-if="action.suggestedFilterLabel" class="ai-task-copy">
                <span class="ai-task-label">推荐筛选：</span>{{ action.suggestedFilterLabel }}
              </div>
              <div v-if="action.blockers?.length" class="ai-task-copy">
                <span class="ai-task-label">当前阻塞：</span>
                <el-space wrap>
                  <el-tag
                    v-for="blocker in action.blockers"
                    :key="`${action.actionId}-${blocker}`"
                    size="small"
                    type="warning"
                  >
                    {{ blocker }}
                  </el-tag>
                </el-space>
              </div>
              <div class="ai-task-copy">
                <span class="ai-task-label">做完后下一步：</span>{{ action.nextStepAfterDone }}
              </div>
              <div v-if="action.processingStatus === 'deferred'" class="ai-task-copy">
                <span class="ai-task-label">当前为何不在今日待办：</span>
                已被人工暂缓
                <template v-if="action.deferUntil">，暂缓到 {{ formatDateTime(action.deferUntil) }}</template>
                <template v-if="action.deferReason">，原因：{{ action.deferReason }}</template>
                <template v-if="action.shouldReopen">。当前已到重新打开时间。</template>
              </div>
              <div v-else-if="action.processingStatus === 'done' || action.processingStatus === 'ignored'" class="ai-task-copy">
                <span class="ai-task-label">当前为何不在今日待办：</span>
                已人工标记为{{ formatProcessingStatus(action.processingStatus) }}
                <template v-if="action.statusRemark">，备注：{{ action.statusRemark }}</template>
              </div>

              <div v-if="action.sourceBreakdown?.length" class="ai-task-sources">
                <span
                  v-for="source in action.sourceBreakdown"
                  :key="`${action.actionId}-${source.source}`"
                  class="ai-task-source"
                >
                  {{ source.source }}：{{ source.count }}
                  <template v-if="source.amount"> / {{ formatAmount(source.amount) }}</template>
                </span>
              </div>
            </div>

            <div class="ai-task-actions">
              <el-button type="primary" link @click="goToAction(action)">一键跳转</el-button>
              <el-divider direction="vertical" />
              <el-button
                v-if="action.processingStatus !== 'deferred'"
                link
                @click="markActionState(action, 'deferred', 'next_week')"
              >
                暂缓到下周
              </el-button>
              <el-button
                v-if="action.processingStatus !== 'deferred'"
                link
                @click="markActionState(action, 'deferred', 'next_month')"
              >
                暂缓到下月
              </el-button>
              <el-button
                v-if="action.processingStatus !== 'done'"
                link
                type="success"
                @click="markActionState(action, 'done')"
              >
                标记已完成
              </el-button>
              <el-button
                v-if="action.processingStatus === 'deferred' || action.processingStatus === 'done' || action.processingStatus === 'ignored'"
                link
                type="warning"
                @click="markActionState(action, 'active')"
              >
                重新打开
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { markAiActionState } from '../../../api/ai';
import { formatDateTime, formatMoney } from '../../../utils/format';

interface OptionItem {
  label: string;
  value: string;
}

interface ActionSourceBreakdown {
  source: string;
  count: number;
  amount: string | null;
}

interface AiActionItem {
  actionId: string;
  ownerRole: string;
  ownerRoleLabel: string;
  taskType: string;
  actionTitle: string;
  actionSummary: string;
  whyNow: string;
  impactType: string;
  relatedCount: number;
  relatedAmount: string | null;
  dueLevel: string;
  suggestedAction: string;
  directTargetType?: string | null;
  relatedPagePath: string;
  relatedPageQuery?: Record<string, string | number | undefined> | null;
  suggestedFilterLabel?: string | null;
  deadline: string;
  blockers: string[];
  nextStepAfterDone: string;
  sourceBreakdown: ActionSourceBreakdown[];
  timeBucket: string;
  bucketLabel: string;
  timeAnchorType?: string | null;
  timeAnchorDate?: string | null;
  processingStatus: string;
  deferUntil?: string | null;
  deferReason?: string | null;
  markedByName?: string | null;
  markedAt?: string | null;
  reopenAt?: string | null;
  statusRemark?: string | null;
  shouldReopen?: boolean;
}

const props = defineProps<{
  loading: boolean;
  data: {
    mustHandleToday?: AiActionItem[];
    recommended?: AiActionItem[];
    canDefer?: AiActionItem[];
    actionItems?: AiActionItem[];
  } | null;
  role: string;
  dueLevel: string;
  onlyBlocking: boolean;
  periodMode: string;
  timeBucket: string;
  processingView: string;
  roleOptions: OptionItem[];
  dueLevelOptions: OptionItem[];
  timeBucketOptions: OptionItem[];
  processingViewOptions: OptionItem[];
  activeRoleLabel: string;
  activeDueLevelLabel: string;
  activeTimeBucketLabel: string;
  activeProcessingViewLabel: string;
  errorMessage?: string;
}>();

const emit = defineEmits<{
  (e: 'update:role', value: string): void;
  (e: 'update:dueLevel', value: string): void;
  (e: 'update:onlyBlocking', value: boolean): void;
  (e: 'update:periodMode', value: string): void;
  (e: 'update:timeBucket', value: string): void;
  (e: 'update:processingView', value: string): void;
  (e: 'refresh'): void;
}>();

const router = useRouter();

const sections = computed(() => [
  {
    key: 'mustHandleToday',
    title: '今天必须处理',
    items: props.data?.mustHandleToday ?? [],
  },
  {
    key: 'recommended',
    title: '本周建议处理',
    items: props.data?.recommended ?? [],
  },
  {
    key: 'canDefer',
    title: '可延后',
    items: props.data?.canDefer ?? [],
  },
]);

const hasActionItems = computed(() =>
  sections.value.some((section) => Array.isArray(section.items) && section.items.length > 0),
);

function formatAmount(value: string | null | undefined) {
  if (!value) {
    return '按权限隐藏';
  }
  return formatMoney(value);
}

function formatDueLevelLabel(value: string) {
  if (value === 'must_handle_today') return '今天必须处理';
  if (value === 'should_handle_this_week') return '本周建议处理';
  if (value === 'can_defer') return '可延后';
  return value || '-';
}

function getDueLevelTagType(value: string) {
  if (value === 'must_handle_today') return 'danger';
  if (value === 'should_handle_this_week') return 'warning';
  return 'info';
}

function formatImpactTypeLabel(value: string) {
  const labels: Record<string, string> = {
    payroll_blocking: '工资前置阻塞',
    data_accuracy: '数据准确性',
    customer_binding: '客户绑定',
    financial_reconciliation: '财务对账',
    bcard_reconciliation: 'B卡对账',
    performance_confirmation: '绩效确认',
    audit_cleanup: '审计清理',
  };
  return labels[value] ?? value;
}

function formatTimeBucketLabel(value: string) {
  return value || '未分桶';
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
  return labels[value] ?? value;
}

function getProcessingStatusTagType(value: string) {
  if (value === 'done') return 'success';
  if (value === 'deferred') return 'warning';
  if (value === 'in_progress') return 'primary';
  if (value === 'ignored') return 'info';
  return '';
}

function goToAction(action: AiActionItem) {
  router.push({
    path: action.relatedPagePath,
    query: {
      ...(action.relatedPageQuery ?? {}),
      sourceActionId: action.actionId,
    },
  });
}

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

async function markActionState(
  action: AiActionItem,
  processingStatus: 'active' | 'deferred' | 'done',
  deferMode?: 'next_week' | 'next_month',
) {
  const payload: Record<string, unknown> = {
    actionId: action.actionId,
    taskType: action.taskType,
    ownerRole: action.ownerRole,
    processingStatus,
    timeBucket: action.timeBucket,
    bucketLabel: action.bucketLabel,
    timeAnchorType: action.timeAnchorType,
    timeAnchorDate: action.timeAnchorDate,
    normalizedPayload: {
      directTargetType: action.directTargetType,
      relatedPagePath: action.relatedPagePath,
      relatedPageQuery: action.relatedPageQuery,
      previousProcessingStatus: action.processingStatus,
    },
  };

  if (processingStatus === 'deferred') {
    const targetDate = deferMode === 'next_month' ? startOfNextMonth() : startOfNextWeek();
    payload.deferUntil = targetDate.toISOString();
    payload.reopenAt = targetDate.toISOString();
    payload.deferReason = deferMode === 'next_month' ? 'manual_defer_to_next_month' : 'manual_defer_to_next_week';
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
        : '已重新打开到当前待办',
  );
  emit('refresh');
}
</script>

<style scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.ai-header {
  align-items: flex-start;
}

.ai-header-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ai-filter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #6b7280;
}

.ai-error-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ai-panel {
  display: grid;
  gap: 16px;
}

.ai-section {
  display: grid;
  gap: 12px;
}

.ai-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.ai-task-list {
  display: grid;
  gap: 12px;
}

.ai-task-item {
  display: grid;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.ai-task-main {
  display: grid;
  gap: 8px;
}

.ai-task-header,
.ai-task-meta,
.ai-task-actions {
  display: flex;
  gap: 8px 12px;
  flex-wrap: wrap;
  align-items: center;
}

.ai-task-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.ai-task-summary,
.ai-task-copy {
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
}

.ai-task-label {
  color: #6b7280;
}

.ai-task-meta,
.ai-task-sources {
  font-size: 12px;
  color: #6b7280;
}

.ai-task-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.ai-task-source {
  padding: 4px 8px;
  border-radius: 999px;
  background: #f3f4f6;
}

.empty-tip {
  font-size: 12px;
  color: #6b7280;
}
</style>
