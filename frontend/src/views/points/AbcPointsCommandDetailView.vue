<template>
  <div class="page-stack">
    <el-card v-loading="loading">
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">ABC 积分命令详情</div>
            <div class="subtitle">
              命令 #{{ commandId }} / {{ detailData?.commandStatus || '-' }} /
              {{ detailData?.commandType || '-' }}
            </div>
          </div>
          <div class="header-actions">
            <el-button @click="goBack">返回列表</el-button>
            <el-button
              v-if="detailData?.commandStatus === 'drafted'"
              type="primary"
              @click="handleConfirm"
            >
              确认命令
            </el-button>
            <el-button
              v-if="['confirmed', 'blocked'].includes(detailData?.commandStatus || '')"
              type="success"
              @click="handleExecute"
            >
              执行 / 复检
            </el-button>
            <el-button
              v-if="['drafted', 'confirmed', 'blocked'].includes(detailData?.commandStatus || '')"
              type="danger"
              plain
              @click="handleCancel"
            >
              取消命令
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="detailData" class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">当前状态摘要</div>
          <div class="summary-value">{{ handlingPlan?.summary || detailData.commandExplanation || '-' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">谁处理 / 怎么处理</div>
          <div class="summary-value">{{ handlingPlan?.listSummary || detailData.suggestedNextStep || '-' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">何时可重试</div>
          <div class="summary-value">{{ handlingPlanRetrySummary }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">边界说明</div>
          <div class="summary-value">{{ handlingPlanBoundarySummary }}</div>
        </div>
      </div>

      <div v-if="detailData" class="two-column">
        <div class="detail-block">
          <div class="block-title">命令基本信息</div>
          <div class="detail-line">命令类型：{{ detailData.commandType || '-' }}</div>
          <div class="detail-line">命令状态：{{ detailData.commandStatus || '-' }}</div>
          <div class="detail-line">对象：{{ detailData.ownerType }} / {{ detailData.ownerId || '-' }}</div>
          <div class="detail-line">手机号：{{ detailData.ownerMobile || '-' }}</div>
          <div class="detail-line">积分变动：{{ formatMoney(detailData.changeAmount) }}</div>
          <div class="detail-line">来源类型：{{ detailData.sourceType || '-' }}</div>
          <div class="detail-line">草稿来源：{{ detailData.requestSource || '-' }}</div>
          <div class="detail-line">Provider：{{ detailData.providerKey || '-' }}</div>
          <div class="detail-line">原因短码：{{ detailData.reasonCode || '-' }}</div>
          <div class="detail-line">备注：{{ detailData.remark || '-' }}</div>
        </div>

        <div class="detail-block">
          <div class="block-title">申请 / 确认 / 执行 / 取消</div>
          <div class="detail-line">
            申请：{{ detailData.requestedByName || '-' }} / {{ formatDateTime(detailData.requestedAt) }}
          </div>
          <div class="detail-line">
            确认：{{ detailData.confirmedByName || '-' }} / {{ formatDateTime(detailData.confirmedAt) }}
          </div>
          <div class="detail-line">
            执行：{{ detailData.executedByName || '-' }} / {{ formatDateTime(detailData.executedAt) }}
          </div>
          <div class="detail-line">
            取消：{{ detailData.cancelledByName || '-' }} / {{ formatDateTime(detailData.cancelledAt) }}
          </div>
          <div class="detail-line">sourceActionId：{{ detailData.sourceActionId || '-' }}</div>
          <div class="detail-line">threadKey：{{ detailData.threadKey || '-' }}</div>
          <div class="detail-line">当前角色视图：{{ formatHandlingPlanVisibility(handlingPlan) }}</div>
          <div class="detail-line">列表摘要：{{ handlingPlan?.listSummary || '-' }}</div>
        </div>
      </div>
    </el-card>

    <el-card v-if="handlingPlan">
      <template #header>
        <div class="section-header">
          <div class="section-title">处理单收口</div>
          <div class="subtle-text">{{ formatHandlingPlanVisibility(handlingPlan) }}</div>
        </div>
      </template>

      <div class="plan-section-grid">
        <div class="detail-block plan-section">
          <div class="block-title">当前状态摘要</div>
          <div class="summary-text">{{ handlingPlan.summary || '-' }}</div>
          <div class="subtle-text">{{ formatHandlingPlanCompatibilitySummary(detailData) }}</div>
        </div>

        <div class="detail-block plan-section">
          <div class="block-title">谁处理 / 怎么处理</div>
          <div class="summary-text">{{ handlingPlan.listSummary || '-' }}</div>
          <ul class="bullet-list compact-bullet-list">
            <li v-for="item in handlingPlanActionItems" :key="item.actionKey">
              {{ formatHandlingPlanActionLine(item) }}
            </li>
          </ul>
        </div>

        <div class="detail-block plan-section">
          <div class="block-title">何时可重试</div>
          <div class="detail-line">建议下一步：{{ handlingPlanRetrySummary }}</div>
          <div class="detail-line">预检状态：{{ handlingPlan?.diagnosis?.precheckStatus || '-' }}</div>
          <div class="detail-line">当前可执行：{{ handlingPlan?.diagnosis?.canExecute ? '是' : '否' }}</div>
          <div class="detail-line">
            唯一 ABC 用户命中：{{ handlingPlan?.precheckSnapshot?.hasUniqueUserMatch ? '是' : '否' }}
          </div>
          <div class="detail-line">命中用户数：{{ handlingPlan?.precheckSnapshot?.matchedUserCount ?? 0 }}</div>
          <div class="detail-line">
            受控写入已开放：{{ handlingPlan?.precheckSnapshot?.currentEnvironmentAllowsWrite ? '是' : '否' }}
          </div>
          <div class="detail-line">
            bridge service 可用：{{ handlingPlan?.precheckSnapshot?.bridgeServiceAvailable ? '是' : '否' }}
          </div>
          <ul v-if="handlingPlanRemediationSuggestions.length" class="bullet-list compact-bullet-list">
            <li v-for="item in handlingPlanRemediationSuggestions" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="detail-block plan-section">
          <div class="block-title">边界说明</div>
          <div class="detail-line">执行边界：{{ handlingPlan?.boundary?.executionBoundary || '-' }}</div>
          <div class="detail-line">
            人工确认：{{ handlingPlan?.boundary?.humanConfirmationBoundary || '-' }}
          </div>
          <div class="detail-line">工资边界：{{ handlingPlan?.boundary?.payrollBoundary || '-' }}</div>
          <div class="detail-line">
            泛化边界：{{ handlingPlan?.boundary?.generalizationBoundary || '-' }}
          </div>
        </div>
      </div>

      <el-alert
        v-if="!canSeeFullAudit"
        class="top-gap"
        type="info"
        :closable="false"
        show-icon
      >
        <template #title>当前角色默认查看 handlingPlan 收口版</template>
        <div class="subtle-text">
          原始兼容字段、预检明细和执行轨迹仍保留在下方审计补充中，但默认不展开。
        </div>
      </el-alert>

      <div v-if="canSeeFullAudit" class="audit-supplement top-gap">
        <div class="block-title">审计补充</div>
        <el-collapse v-model="auditPanels" class="top-gap-small">
          <el-collapse-item title="原始兼容字段 / 审计补充" name="legacy">
            <div class="two-column no-top-gap">
              <div class="detail-block audit-panel">
                <div class="detail-line">blocked 原因：{{ detailData.blockedReason || '-' }}</div>
                <div class="detail-line">blocked 阶段：{{ detailData.blockedStage || '-' }}</div>
                <div class="detail-line">执行能力：{{ detailData.executionCapability || '-' }}</div>
                <div class="detail-line">原始解释：{{ detailData.commandExplanation || '-' }}</div>
                <div class="detail-line">原始泛化边界：{{ detailData.generalizationBoundary || '-' }}</div>
              </div>
              <div class="detail-block audit-panel">
                <div class="detail-line">AI / Provider：{{ detailData.providerKey || '-' }}</div>
                <div class="detail-line">sourceActionId：{{ detailData.sourceActionId || '-' }}</div>
                <div class="detail-line">threadKey：{{ detailData.threadKey || '-' }}</div>
                <div class="detail-line">
                  ABC 用户影子命中：{{ detailData.abcShadowOwner?.matchStatus || '-' }}
                </div>
                <div class="detail-line">
                  候选数：{{ detailData.abcShadowOwner?.matchedCount || 0 }}
                </div>
              </div>
            </div>
          </el-collapse-item>

          <el-collapse-item title="写入预检检查项" name="precheck">
            <el-alert :type="alertType" :closable="false" show-icon>
              <template #title>当前预检结论</template>
              <div class="subtle-text">
                {{ detailData.writePathPrecheck?.precheckStatus || '-' }} /
                canExecute={{ detailData.writePathPrecheck?.canExecute ? 'true' : 'false' }}
              </div>
            </el-alert>

            <el-table class="top-gap-small" :data="detailData.writePathPrecheck?.checks || []" size="small">
              <el-table-column prop="checkName" label="检查项" width="220" />
              <el-table-column prop="checkResult" label="结果" width="90" />
              <el-table-column prop="checkReason" label="说明" min-width="280" show-overflow-tooltip />
            </el-table>
          </el-collapse-item>

          <el-collapse-item title="审计与执行轨迹" name="audit">
            <div class="trace-grid">
              <div class="trace-card">
                <div class="trace-title">blocked 诊断</div>
                <div>{{ detailData.blockedReason || '-' }}</div>
                <div class="subtle-text">阶段：{{ detailData.blockedStage || '-' }}</div>
              </div>
              <div class="trace-card">
                <div class="trace-title">AI / Provider</div>
                <div>{{ detailData.providerKey || '-' }}</div>
                <div class="subtle-text">sourceActionId：{{ detailData.sourceActionId || '-' }}</div>
              </div>
              <div class="trace-card">
                <div class="trace-title">ABC 用户影子命中</div>
                <div>{{ detailData.abcShadowOwner?.matchStatus || '-' }}</div>
                <div class="subtle-text">候选数：{{ detailData.abcShadowOwner?.matchedCount || 0 }}</div>
              </div>
            </div>

            <el-table class="top-gap-small" :data="detailData.auditTrail || []" size="small">
              <el-table-column prop="action" label="动作" width="140" />
              <el-table-column prop="detail" label="说明" min-width="280" show-overflow-tooltip />
              <el-table-column prop="operatorId" label="操作人 ID" width="110" />
              <el-table-column label="时间" width="180">
                <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-card>

    <el-card v-if="detailData">
      <template #header><div class="section-title">AI 补充依据</div></template>

      <div class="tag-row">
        <el-tag
          v-for="item in detailData.founderPrinciplesApplied || []"
          :key="`founder-${item}`"
          type="warning"
          effect="plain"
        >
          创始人原则：{{ item }}
        </el-tag>
        <el-tag
          v-for="item in detailData.rolePlaybookApplied || []"
          :key="`role-${item}`"
          type="success"
          effect="plain"
        >
          岗位规则：{{ item }}
        </el-tag>
      </div>

      <div class="evidence-grid">
        <div class="evidence-column">
          <div class="evidence-title">引用的创始人记忆</div>
          <div v-if="detailData.citedFounderMemories?.length" class="evidence-list">
            <div v-for="item in detailData.citedFounderMemories" :key="`fm-${item.id}`" class="evidence-item">
              <div class="evidence-name">{{ item.title }}</div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无创始人记忆引用" :image-size="56" />
        </div>

        <div class="evidence-column">
          <div class="evidence-title">引用的岗位规则</div>
          <div v-if="detailData.citedRoleMemories?.length" class="evidence-list">
            <div v-for="item in detailData.citedRoleMemories" :key="`rm-${item.id}`" class="evidence-item">
              <div class="evidence-name">{{ item.title }}</div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无岗位规则引用" :image-size="56" />
        </div>

        <div class="evidence-column">
          <div class="evidence-title">引用的规则知识</div>
          <div v-if="detailData.citedKnowledge?.length" class="evidence-list">
            <div v-for="item in detailData.citedKnowledge" :key="`knowledge-${item.id}`" class="evidence-item">
              <div class="evidence-name">{{ item.title }}</div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无规则知识引用" :image-size="56" />
        </div>

        <div class="evidence-column">
          <div class="evidence-title">直接 / 相似人审依据</div>
          <div v-if="detailData.citedManualDecisions?.length" class="evidence-list">
            <div
              v-for="item in detailData.citedManualDecisions"
              :key="`manual-${item.id}`"
              class="evidence-item"
            >
              <div class="evidence-name">
                {{ item.matchType === 'direct' ? '直接人审依据' : '相似模式建议' }}
              </div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无直接 / 相似人审依据" :image-size="56" />
        </div>
      </div>
    </el-card>

    <AiSideAssistant
      page-title="ABC 积分命令详情"
      route-path="/abc-points/commands/:id"
      entity-type="abc_points_command"
      :entity-id="String(commandId)"
      :current-filters="aiCurrentFilters"
      :source-action-id="aiSourceActionId"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import {
  cancelAbcPointsCommand,
  confirmAbcPointsCommand,
  executeAbcPointsCommand,
  getAbcPointsCommandDetail,
} from '../../api/points';
import { formatDateTime, formatMoney } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const detailData = ref<any | null>(null);

const commandId = computed(() => Number(route.params.id));
const aiSourceActionId = computed(() => {
  if (typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()) {
    return route.query.sourceActionId.trim();
  }
  return detailData.value?.sourceActionId || null;
});

const aiCurrentFilters = computed(() => ({
  rewardDomain: 'abc_score',
  routePath: route.path,
  commandStatus: detailData.value?.commandStatus || '',
  blockedReason:
    detailData.value?.handlingPlan?.diagnosis?.blockedReason || detailData.value?.blockedReason || '',
  sourceType: detailData.value?.sourceType || '',
  sourceActionId: aiSourceActionId.value || undefined,
}));

const handlingPlan = computed(() => detailData.value?.handlingPlan || null);
const handlingPlanActionItems = computed(() =>
  Array.isArray(handlingPlan.value?.actionItems) ? handlingPlan.value.actionItems : [],
);
const handlingPlanRemediationSuggestions = computed(() =>
  Array.isArray(handlingPlan.value?.precheckSnapshot?.remediationSuggestions)
    ? handlingPlan.value.precheckSnapshot.remediationSuggestions
    : [],
);
const handlingPlanRetrySummary = computed(
  () =>
    handlingPlan.value?.diagnosis?.suggestedNextStep ||
    detailData.value?.suggestedNextStep ||
    '-',
);
const handlingPlanBoundarySummary = computed(() => {
  const boundary = handlingPlan.value?.boundary;
  return (
    boundary?.executionBoundary ||
    boundary?.humanConfirmationBoundary ||
    boundary?.payrollBoundary ||
    boundary?.generalizationBoundary ||
    '边界说明已保留在 handlingPlan 中。'
  );
});
const canSeeFullAudit = computed(() => handlingPlan.value?.visibilityScope === 'full');
const auditPanels = ref<string[]>([]);

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

function formatHandlingPlanCompatibilitySummary(detail: any) {
  if (handlingPlan.value?.visibilityScope && handlingPlan.value?.visibilityScope !== 'full') {
    return '兼容旧字段仍保留，但默认仅展示 handlingPlan 收口版。';
  }
  const blockedReason = detail?.handlingPlan?.diagnosis?.blockedReason || detail?.blockedReason;
  const blockedStage = detail?.handlingPlan?.diagnosis?.blockedStage || detail?.blockedStage;
  const parts = [
    blockedReason ? `兼容 blockedReason：${blockedReason}` : null,
    blockedStage ? `阶段：${blockedStage}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : '兼容旧字段仍保留，但默认展示 handlingPlan 收口版。';
}

const alertType = computed(() => {
  if (detailData.value?.writePathPrecheck?.canExecute) {
    return 'success';
  }
  return detailData.value?.writePathPrecheck?.precheckStatus === 'warn' ? 'warning' : 'error';
});

async function loadDetail() {
  if (!Number.isFinite(commandId.value)) {
    detailData.value = null;
    return;
  }

  loading.value = true;
  try {
    const response = await getAbcPointsCommandDetail(commandId.value);
    detailData.value = response.data.data || null;
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '加载 ABC 积分命令详情失败',
    );
  } finally {
    loading.value = false;
  }
}

async function handleConfirm() {
  try {
    await confirmAbcPointsCommand(commandId.value, {});
    ElMessage.success(`ABC 积分命令 #${commandId.value} 已确认`);
    await loadDetail();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '确认 ABC 积分命令失败',
    );
  }
}

async function handleExecute() {
  try {
    const response = await executeAbcPointsCommand(commandId.value, {});
    const payload = response.data.data;
    if (payload?.commandStatus === 'blocked') {
      ElMessage.warning(
        `当前只能继续 blocked 留痕：${payload.handlingPlan?.summary || payload.blockedReason || 'abc_score_write_path_not_stable'}`,
      );
    } else {
      ElMessage.success(`ABC 积分命令 #${commandId.value} 已执行`);
    }
    await loadDetail();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '执行 ABC 积分命令失败',
    );
  }
}

async function handleCancel() {
  try {
    await cancelAbcPointsCommand(commandId.value, {});
    ElMessage.success(`ABC 积分命令 #${commandId.value} 已取消`);
    await loadDetail();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '取消 ABC 积分命令失败',
    );
  }
}

function goBack() {
  void router.push({
    path: '/abc-points/commands',
    query: {
      commandId: String(commandId.value),
      sourceActionId: aiSourceActionId.value || undefined,
    },
  });
}

onMounted(() => {
  void loadDetail();
});

watch(
  () => route.params.id,
  () => {
    void loadDetail();
  },
);
</script>

<style scoped>
.page-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.title {
  font-size: 20px;
  font-weight: 600;
}

.subtitle {
  margin-top: 6px;
  color: #6b7280;
  line-height: 1.6;
}

.summary-grid,
.trace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.summary-card,
.trace-card {
  padding: 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.summary-label,
.trace-title {
  color: #6b7280;
  font-size: 12px;
}

.summary-value {
  margin-top: 6px;
  font-weight: 600;
  line-height: 1.5;
}

.two-column {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.plan-section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.plan-section,
.audit-panel {
  padding: 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.top-gap {
  margin-top: 16px;
}

.top-gap-small {
  margin-top: 8px;
}

.no-top-gap {
  margin-top: 0;
}

.detail-block,
.summary-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-title,
.section-title,
.summary-title,
.evidence-title {
  font-size: 16px;
  font-weight: 600;
}

.detail-line,
.summary-text,
.subtle-text,
.evidence-summary {
  color: #4b5563;
  line-height: 1.6;
}

.bullet-list {
  margin: 0;
  padding-left: 18px;
  color: #4b5563;
  line-height: 1.6;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.audit-supplement {
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.evidence-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.evidence-item {
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.evidence-name {
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
