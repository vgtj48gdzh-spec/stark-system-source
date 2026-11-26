<template>
  <div class="page-stack">
    <el-card v-loading="loading">
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">积点命令详情</div>
            <div class="subtitle">
              命令 #{{ commandId }} / {{ detailData?.commandStatus || '-' }} / {{ detailData?.commandType || '-' }}
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
              v-if="detailData?.commandStatus === 'confirmed'"
              type="success"
              @click="handleExecute"
            >
              执行命令
            </el-button>
            <el-button
              v-if="['drafted', 'confirmed'].includes(detailData?.commandStatus || '')"
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
          <div class="summary-label">对象</div>
          <div class="summary-value">{{ detailData.ownerType }} / {{ detailData.ownerId || '-' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">对象手机号</div>
          <div class="summary-value">{{ detailData.ownerMobile || '-' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">积点变动</div>
          <div class="summary-value">{{ formatMoney(detailData.changeAmount) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">来源类型</div>
          <div class="summary-value">{{ detailData.sourceType || '-' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">草拟来源</div>
          <div class="summary-value">{{ detailData.requestSource || '-' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">下一步</div>
          <div class="summary-value">
            {{ detailData.commandExplanation?.nextStepAfterDone || detailData.aiContext?.nextStepAfterDone || '-' }}
          </div>
        </div>
      </div>

      <div v-if="detailData" class="two-column">
        <div class="detail-block">
          <div class="block-title">命令基本信息</div>
          <div class="detail-line">Provider：{{ detailData.providerKey || '-' }}</div>
          <div class="detail-line">原因短码：{{ detailData.reasonCode || '-' }}</div>
          <div class="detail-line">
            影响绩效前置：{{ renderBoolean(detailData.affectPerformanceFlag) }}
          </div>
          <div class="detail-line">
            影响 B 卡统计：{{ renderBoolean(detailData.affectBCardFlag) }}
          </div>
          <div class="detail-line">备注：{{ detailData.remark || '-' }}</div>
        </div>
        <div class="detail-block">
          <div class="block-title">申请 / 确认 / 执行</div>
          <div class="detail-line">申请：{{ detailData.requestedByName || '-' }} / {{ formatDateTime(detailData.requestedAt) }}</div>
          <div class="detail-line">确认：{{ detailData.confirmedByName || '-' }} / {{ formatDateTime(detailData.confirmedAt) }}</div>
          <div class="detail-line">执行：{{ detailData.executedByName || '-' }} / {{ formatDateTime(detailData.executedAt) }}</div>
          <div class="detail-line">取消：{{ detailData.cancelledByName || '-' }} / {{ formatDateTime(detailData.cancelledAt) }}</div>
          <div class="detail-line">threadKey：{{ detailData.threadKey || '-' }}</div>
          <div class="detail-line">sourceActionId：{{ detailData.sourceActionId || '-' }}</div>
        </div>
      </div>
    </el-card>

    <el-card v-if="detailData">
      <template #header><div class="section-title">执行轨迹</div></template>
      <div class="trace-grid">
        <div class="trace-card">
          <div class="trace-title">命令状态</div>
          <div>{{ detailData.commandStatus || '-' }}</div>
          <div class="subtle-text">命令类型：{{ detailData.commandType || '-' }}</div>
        </div>
        <div class="trace-card">
          <div class="trace-title">AI 来源</div>
          <div>{{ detailData.providerKey || '-' }}</div>
          <div class="subtle-text">sourceActionId：{{ detailData.sourceActionId || '-' }}</div>
        </div>
        <div class="trace-card">
          <div class="trace-title">说明摘要</div>
          <div>{{ detailData.commandExplanation?.summary || '-' }}</div>
        </div>
      </div>

      <el-table :data="executionLogs" size="small">
        <el-table-column prop="action" label="轨迹动作" width="140" />
        <el-table-column prop="detail" label="说明" min-width="280" show-overflow-tooltip />
        <el-table-column prop="operatorId" label="操作人 ID" width="100" />
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="detailData">
      <template #header><div class="section-title">规则 / 记忆 / 人审依据</div></template>
      <div class="summary-block">
        <div class="summary-title">为什么创建 / 为什么这样判断</div>
        <div class="summary-text">{{ detailData.commandExplanation?.summary || '-' }}</div>
      </div>
      <div class="summary-block">
        <div class="summary-title">泛化边界</div>
        <div class="summary-text">{{ detailData.generalizationBoundary || '-' }}</div>
      </div>

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
          <el-empty v-else description="暂无引用的创始人记忆" :image-size="56" />
        </div>

        <div class="evidence-column">
          <div class="evidence-title">引用的岗位规则</div>
          <div v-if="detailData.citedRoleMemories?.length" class="evidence-list">
            <div v-for="item in detailData.citedRoleMemories" :key="`rm-${item.id}`" class="evidence-item">
              <div class="evidence-name">{{ item.title }}</div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无引用的岗位规则" :image-size="56" />
        </div>

        <div class="evidence-column">
          <div class="evidence-title">引用的通用规则</div>
          <div v-if="detailData.citedKnowledge?.length" class="evidence-list">
            <div v-for="item in detailData.citedKnowledge" :key="`knowledge-${item.id}`" class="evidence-item">
              <div class="evidence-name">{{ item.title }}</div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无引用的通用规则" :image-size="56" />
        </div>

        <div class="evidence-column">
          <div class="evidence-title">直接 / 相似人审依据</div>
          <div v-if="detailData.citedManualDecisions?.length" class="evidence-list">
            <div
              v-for="item in detailData.citedManualDecisions"
              :key="`decision-${item.matchType}-${item.id}`"
              class="evidence-item"
            >
              <div class="evidence-name">
                {{ item.matchType === 'direct' ? '当前对象已有直接人审依据' : '相似模式人审经验' }}
              </div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无直接 / 相似人审依据" :image-size="56" />
        </div>
      </div>
    </el-card>

    <el-card v-if="detailData">
      <template #header><div class="section-title">关联积点账本与 AI 解释</div></template>

      <div class="summary-block">
        <div class="summary-title">AI 解释区块</div>
        <div
          v-for="section in detailData.commandExplanation?.answerSections || []"
          :key="section.sectionKey"
          class="answer-section"
        >
          <div class="answer-title">{{ section.title }}</div>
          <div class="summary-text">{{ section.content }}</div>
        </div>
      </div>

      <el-table :data="detailData.relatedLedgerEntries || []" size="small">
        <el-table-column prop="id" label="Ledger ID" width="90" />
        <el-table-column prop="changeType" label="变动类型" width="110" />
        <el-table-column label="变动积点" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.changeAmount) }}</template>
        </el-table-column>
        <el-table-column label="余额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.balanceAfter) }}</template>
        </el-table-column>
        <el-table-column prop="sourceType" label="来源类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="reasonCode" label="原因短码" width="140" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
        <el-table-column label="执行时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.executedAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <AiSideAssistant
      page-title="积点命令详情"
      route-path="/points/commands/:id"
      entity-type="points_command"
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
  cancelPointsCommand,
  confirmPointsCommand,
  executePointsCommand,
  getPointsCommandDetail,
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
  routePath: route.path,
  commandStatus: detailData.value?.commandStatus || '',
  sourceType: detailData.value?.sourceType || '',
  sourceActionId: aiSourceActionId.value || undefined,
}));

const executionLogs = computed(() => detailData.value?.executionTrace?.operationLogs || []);

async function loadDetail() {
  if (!Number.isFinite(commandId.value)) {
    detailData.value = null;
    return;
  }

  loading.value = true;
  try {
    const { data } = await getPointsCommandDetail(commandId.value, {
      sourceActionId: aiSourceActionId.value || undefined,
    });
    detailData.value = data.data;
  } finally {
    loading.value = false;
  }
}

async function handleConfirm() {
  await confirmPointsCommand(commandId.value, {});
  ElMessage.success(`积点命令 #${commandId.value} 已确认`);
  await loadDetail();
}

async function handleExecute() {
  await executePointsCommand(commandId.value, {});
  ElMessage.success(`积点命令 #${commandId.value} 已执行`);
  await loadDetail();
}

async function handleCancel() {
  await cancelPointsCommand(commandId.value, {});
  ElMessage.success(`积点命令 #${commandId.value} 已取消`);
  await loadDetail();
}

function goBack() {
  void router.push('/points/commands');
}

function renderBoolean(value: unknown) {
  if (value === true) {
    return '是';
  }
  if (value === false) {
    return '否';
  }
  return '-';
}

watch(
  () => route.fullPath,
  () => {
    void loadDetail();
  },
);

onMounted(() => {
  void loadDetail();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.header-actions,
.tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.title,
.section-title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle,
.subtle-text,
.detail-line,
.summary-text,
.evidence-summary {
  font-size: 12px;
  color: #6b7280;
}

.summary-grid,
.two-column,
.trace-grid,
.evidence-grid {
  display: grid;
  gap: 12px;
}

.summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-bottom: 16px;
}

.two-column,
.trace-grid,
.evidence-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.summary-card,
.detail-block,
.trace-card,
.summary-block,
.evidence-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.summary-label,
.block-title,
.trace-title,
.summary-title,
.evidence-title,
.evidence-name,
.answer-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.summary-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.evidence-column {
  display: grid;
  gap: 8px;
}

.evidence-list {
  display: grid;
  gap: 8px;
}

.answer-section + .answer-section {
  margin-top: 10px;
}

@media (max-width: 960px) {
  .summary-grid,
  .two-column,
  .trace-grid,
  .evidence-grid {
    grid-template-columns: 1fr;
  }
}
</style>
