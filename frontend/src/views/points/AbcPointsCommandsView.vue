<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">ABC 积分命令</div>
            <div class="subtitle">
              这里处理的是总部发起的 ABC 积分补发 / 调整命令。如果当前受控写入路径还不稳定，
              命令只能停留在草稿、确认或 blocked，不会假装执行成功。
            </div>
          </div>
        </div>
      </template>

      <el-form inline class="filters">
        <el-form-item label="命令状态">
          <el-select v-model="filters.commandStatus" clearable style="width: 180px">
            <el-option label="草稿" value="drafted" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已执行" value="executed" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="已阻塞" value="blocked" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="阻塞原因">
          <el-select v-model="filters.blockedReason" clearable style="width: 240px">
            <el-option label="写入路径未稳定" value="abc_score_write_path_not_stable" />
            <el-option label="手机号映射冲突" value="mobile_mapping_conflict" />
            <el-option label="未找到 ABC 用户" value="abc_user_not_found" />
            <el-option label="缺少手机号" value="owner_mobile_missing" />
            <el-option label="历史手改风险" value="legacy_db_direct_risk" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源类型">
          <el-select v-model="filters.sourceType" clearable style="width: 220px">
            <el-option label="总部补发" value="hq_issue" />
            <el-option label="纠偏" value="correction" />
            <el-option label="迁移修复" value="migration_fix" />
            <el-option label="客服补偿" value="customer_service_compensation" />
            <el-option label="历史手改遗留" value="legacy_db_direct" />
            <el-option label="产品赠分只读识别" value="product_bonus_readonly" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="草稿来源">
          <el-select v-model="filters.requestSource" clearable style="width: 180px">
            <el-option label="人工" value="manual" />
            <el-option label="AI 草稿" value="ai_assistant_draft" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="filters.ownerMobile" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="Provider">
          <el-input v-model="filters.providerKey" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="唯一命中">
          <el-select v-model="filters.hasUniqueUserMatch" clearable style="width: 140px">
            <el-option label="是" value="true" />
            <el-option label="否" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="可执行">
          <el-select v-model="filters.canExecute" clearable style="width: 140px">
            <el-option label="是" value="true" />
            <el-option label="否" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="仅看 blocked">
          <el-switch v-model="blockedOnly" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-title">创建 ABC 积分命令草稿</div>
      </template>

      <el-form :model="draftForm" label-width="110px" class="draft-form">
        <div class="form-grid">
          <el-form-item label="命令类型">
            <el-select v-model="draftForm.commandType" style="width: 180px">
              <el-option label="发放积分" value="issue_score" />
              <el-option label="调整积分" value="adjust_score" />
              <el-option label="撤销积分" value="revoke_score" />
            </el-select>
          </el-form-item>
          <el-form-item label="对象类型">
            <el-select v-model="draftForm.ownerType" style="width: 180px">
              <el-option label="客户" value="customer" />
              <el-option label="员工" value="employee" />
            </el-select>
          </el-form-item>
          <el-form-item label="对象 ID">
            <el-input-number
              v-model="draftForm.ownerId"
              :min="1"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="手机号">
            <el-input v-model="draftForm.ownerMobile" clearable />
          </el-form-item>
          <el-form-item label="积分变动">
            <el-input v-model="draftForm.changeAmount" />
          </el-form-item>
          <el-form-item label="来源类型">
            <el-select v-model="draftForm.sourceType" style="width: 220px">
              <el-option label="总部补发" value="hq_issue" />
              <el-option label="纠偏" value="correction" />
              <el-option label="迁移修复" value="migration_fix" />
              <el-option label="客服补偿" value="customer_service_compensation" />
              <el-option label="其他" value="other" />
            </el-select>
          </el-form-item>
          <el-form-item label="原因短码">
            <el-input v-model="draftForm.reasonCode" clearable />
          </el-form-item>
          <el-form-item label="备注" class="full-width">
            <el-input
              v-model="draftForm.remark"
              type="textarea"
              :rows="2"
              placeholder="说明为什么要从总部侧发起这条 ABC 积分命令。"
            />
          </el-form-item>
        </div>
        <div class="inline-actions">
          <el-button type="primary" :loading="loading.createDraft" @click="handleCreateDraft">
            创建 ABC 积分命令草稿
          </el-button>
        </div>
      </el-form>
    </el-card>

    <el-card v-loading="loading.commands">
      <template #header>
        <div class="section-title">ABC 积分命令队列</div>
      </template>

      <el-table :data="commandTable" size="small" @row-click="handleSelectCommand">
        <el-table-column prop="id" label="命令 ID" width="90" />
        <el-table-column prop="rewardDomain" label="点值域" width="110" />
        <el-table-column prop="commandStatus" label="状态" width="120" />
        <el-table-column prop="commandType" label="命令类型" width="120" />
        <el-table-column label="对象" min-width="180">
          <template #default="{ row }">
            <div>{{ row.ownerType }} / {{ row.ownerId || '-' }}</div>
            <div class="sub-cell">{{ row.ownerMobile || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="积分变动" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.changeAmount) }}</template>
        </el-table-column>
        <el-table-column prop="sourceType" label="来源类型" min-width="150" show-overflow-tooltip />
        <el-table-column label="当前状态摘要" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ formatHandlingPlanStatusSummary(row) }}</div>
            <div class="sub-cell">{{ formatHandlingPlanCompatibilitySummary(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="precheckStatus" label="预检状态" width="110" />
        <el-table-column label="唯一命中" width="100">
          <template #default="{ row }">{{ row.hasUniqueUserMatch ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="可执行" width="100">
          <template #default="{ row }">{{ row.canExecute ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="谁处理 / 怎么处理" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.handlingPlan?.listSummary || row.suggestedAction || '-' }}</div>
            <div class="sub-cell">{{ formatHandlingPlanPrimaryAction(row.handlingPlan) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click.stop="openDetail(row.id)">详情</el-button>
            <el-button
              v-if="row.commandStatus === 'drafted'"
              size="small"
              type="primary"
              @click.stop="handleConfirm(row.id)"
            >
              确认
            </el-button>
            <el-button
              v-if="['confirmed', 'blocked'].includes(row.commandStatus)"
              size="small"
              type="success"
              @click.stop="handleExecute(row.id)"
            >
              执行 / 复检
            </el-button>
            <el-button
              v-if="['drafted', 'confirmed', 'blocked'].includes(row.commandStatus)"
              size="small"
              type="danger"
              plain
              @click.stop="handleCancel(row.id)"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next"
        :total="commandTotal"
        :page-size="commandQuery.pageSize"
        :current-page="commandQuery.page"
        @current-change="handlePageChange"
      />
    </el-card>

    <el-card v-if="selectedCommand" class="selected-summary">
      <template #header>
        <div class="section-title">当前选中命令摘要</div>
      </template>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">命令 ID</div>
          <div class="summary-value">#{{ selectedCommand.id }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">当前状态摘要</div>
          <div class="summary-value">{{ formatHandlingPlanStatusSummary(selectedCommand) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">谁处理 / 怎么处理</div>
          <div class="summary-value">
            {{ selectedCommand.handlingPlan?.listSummary || selectedCommand.suggestedAction || '-' }}
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">何时可重试</div>
          <div class="summary-value">
            {{ formatHandlingPlanRetrySummary(selectedCommand) }}
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">边界说明</div>
          <div class="summary-value">
            {{ formatHandlingPlanBoundarySummary(selectedCommand) }}
          </div>
        </div>
      </div>
      <div v-if="selectedCommand.handlingPlan" class="plan-summary-card">
        <div class="summary-label">处理单收口</div>
        <div class="summary-value">{{ selectedCommand.handlingPlan.summary || '-' }}</div>
        <div class="sub-cell top-gap-small">
          当前角色默认查看{{ formatHandlingPlanVisibility(selectedCommand.handlingPlan) }}。
        </div>
        <ul class="bullet-list compact-bullet-list">
          <li
            v-for="item in selectedCommand.handlingPlan.actionItems || []"
            :key="`${selectedCommand.id}-${item.actionKey}`"
          >
            {{ formatHandlingPlanActionLine(item) }}
          </li>
        </ul>
      </div>
      <div class="inline-actions">
        <el-button type="primary" @click="openDetail(selectedCommand.id)">
          查看 blocked / precheck 诊断单
        </el-button>
      </div>
    </el-card>

    <AiSideAssistant
      page-title="ABC 积分命令"
      route-path="/abc-points/commands"
      :entity-type="selectedCommand ? 'abc_points_command' : undefined"
      :entity-id="selectedCommand ? String(selectedCommand.id) : undefined"
      :current-filters="currentFilters"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import {
  cancelAbcPointsCommand,
  confirmAbcPointsCommand,
  createAbcPointsCommandDraft,
  executeAbcPointsCommand,
  getAbcPointsCommands,
} from '../../api/points';
import { formatMoney } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const loading = reactive({
  commands: false,
  createDraft: false,
});

const filters = reactive({
  commandStatus: '',
  blockedReason: '',
  sourceType: '',
  requestSource: '',
  ownerMobile: '',
  providerKey: '',
  hasUniqueUserMatch: '',
  canExecute: '',
});

const blockedOnly = ref(false);
const commandQuery = reactive({
  page: 1,
  pageSize: 10,
});

const draftForm = reactive({
  commandType: 'issue_score',
  ownerType: 'customer',
  ownerId: undefined as number | undefined,
  ownerMobile: '',
  changeAmount: '100.00',
  sourceType: 'hq_issue',
  reasonCode: '',
  remark: '',
});

const commandTable = ref<any[]>([]);
const commandTotal = ref(0);
const selectedCommand = ref<any | null>(null);

const currentFilters = computed(() => ({
  rewardDomain: 'abc_score',
  commandStatus: filters.commandStatus || undefined,
  blockedReason: filters.blockedReason || undefined,
  sourceType: filters.sourceType || undefined,
  requestSource: filters.requestSource || undefined,
  ownerMobile: filters.ownerMobile || undefined,
  providerKey: filters.providerKey || undefined,
  hasUniqueUserMatch: filters.hasUniqueUserMatch || undefined,
  canExecute: filters.canExecute || undefined,
  blockedOnly: blockedOnly.value ? 'true' : undefined,
}));

function pickHandlingPlanPrimaryAction(plan: any) {
  const items = Array.isArray(plan?.actionItems) ? plan.actionItems : [];
  return (
    items.find((item: any) => ['blocked', 'pending', 'ready'].includes(item?.status)) ||
    items[0] ||
    null
  );
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

function formatHandlingPlanStatusSummary(row: any) {
  return row?.handlingPlan?.summary || row?.commandExplanation || row?.blockedReason || '-';
}

function formatHandlingPlanCompatibilitySummary(row: any) {
  const plan = row?.handlingPlan;
  if (plan?.visibilityScope && plan.visibilityScope !== 'full') {
    return '兼容字段已下沉为审计补充。';
  }
  const blockedReason = row?.handlingPlan?.diagnosis?.blockedReason || row?.blockedReason;
  const blockedStage = row?.handlingPlan?.diagnosis?.blockedStage || row?.blockedStage;
  const parts = [
    blockedReason ? `兼容 blockedReason：${blockedReason}` : null,
    blockedStage ? `阶段：${blockedStage}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : '兼容旧字段已保留，但主展示已切到 handlingPlan。';
}

function formatHandlingPlanPrimaryAction(plan: any) {
  const primaryAction = pickHandlingPlanPrimaryAction(plan);
  return primaryAction
    ? formatHandlingPlanActionLine(primaryAction)
    : plan?.diagnosis?.suggestedNextStep || '-';
}

function formatHandlingPlanRetrySummary(row: any) {
  return row?.handlingPlan?.diagnosis?.suggestedNextStep || row?.suggestedNextStep || '-';
}

function formatHandlingPlanBoundarySummary(row: any) {
  const boundary = row?.handlingPlan?.boundary;
  const summary =
    boundary?.executionBoundary ||
    boundary?.humanConfirmationBoundary ||
    boundary?.payrollBoundary ||
    boundary?.generalizationBoundary;
  return summary || '边界说明已保留在 handlingPlan 中。';
}

function buildParams() {
  return {
    page: commandQuery.page,
    pageSize: commandQuery.pageSize,
    commandStatus: filters.commandStatus || undefined,
    blockedReason: filters.blockedReason || undefined,
    sourceType: filters.sourceType || undefined,
    requestSource: filters.requestSource || undefined,
    ownerMobile: filters.ownerMobile || undefined,
    providerKey: filters.providerKey || undefined,
    hasUniqueUserMatch: filters.hasUniqueUserMatch || undefined,
    canExecute: filters.canExecute || undefined,
    blockedOnly: blockedOnly.value ? 'true' : undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };
}

async function loadCommands() {
  loading.commands = true;
  try {
    const response = await getAbcPointsCommands(buildParams());
    const payload = response.data.data;
    commandTable.value = payload.list || [];
    commandTotal.value = payload.total || 0;

    const selectedId = Number(route.query.commandId || selectedCommand.value?.id || 0);
    if (selectedId) {
      selectedCommand.value =
        commandTable.value.find((item: any) => item.id === selectedId) || null;
    } else {
      selectedCommand.value = commandTable.value[0] || null;
    }
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '加载 ABC 积分命令失败',
    );
  } finally {
    loading.commands = false;
  }
}

async function handleCreateDraft() {
  loading.createDraft = true;
  try {
    const response = await createAbcPointsCommandDraft({
      ...draftForm,
      ownerId: draftForm.ownerId ?? undefined,
      ownerMobile: draftForm.ownerMobile || undefined,
      reasonCode: draftForm.reasonCode || undefined,
      remark: draftForm.remark || undefined,
    });
    const payload = response.data.data;
    const createdId = payload.command?.id || payload.id;
    ElMessage.success(`ABC 积分命令草稿已创建：#${createdId}`);
    await router.replace({
      path: '/abc-points/commands',
      query: { ...route.query, commandId: String(createdId) },
    });
    await loadCommands();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '创建 ABC 积分命令草稿失败',
    );
  } finally {
    loading.createDraft = false;
  }
}

async function handleConfirm(id: number) {
  try {
    await confirmAbcPointsCommand(id, {});
    ElMessage.success(`ABC 积分命令 #${id} 已确认`);
    await loadCommands();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '确认 ABC 积分命令失败',
    );
  }
}

async function handleExecute(id: number) {
  try {
    const response = await executeAbcPointsCommand(id, {});
    const payload = response.data.data;
    if (payload?.commandStatus === 'blocked') {
      ElMessage.warning(
        `当前只能继续 blocked 留痕：${payload.handlingPlan?.summary || payload.blockedReason || 'abc_score_write_path_not_stable'}`,
      );
    } else {
      ElMessage.success(`ABC 积分命令 #${id} 已执行`);
    }
    await loadCommands();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '执行 ABC 积分命令失败',
    );
  }
}

async function handleCancel(id: number) {
  try {
    await cancelAbcPointsCommand(id, {});
    ElMessage.success(`ABC 积分命令 #${id} 已取消`);
    await loadCommands();
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '取消 ABC 积分命令失败',
    );
  }
}

function handleSelectCommand(row: any) {
  selectedCommand.value = row;
  void router.replace({
    path: '/abc-points/commands',
    query: {
      ...route.query,
      commandId: String(row.id),
    },
  });
}

function openDetail(id: number) {
  void router.push({
    path: `/abc-points/commands/${id}`,
    query: {
      sourceActionId:
        typeof route.query.sourceActionId === 'string' ? route.query.sourceActionId : undefined,
    },
  });
}

function handlePageChange(page: number) {
  commandQuery.page = page;
  void loadCommands();
}

function handleSearch() {
  commandQuery.page = 1;
  void loadCommands();
}

function resetFilters() {
  filters.commandStatus = '';
  filters.blockedReason = '';
  filters.sourceType = '';
  filters.requestSource = '';
  filters.ownerMobile = '';
  filters.providerKey = '';
  filters.hasUniqueUserMatch = '';
  filters.canExecute = '';
  blockedOnly.value = false;
  handleSearch();
}

onMounted(() => {
  void loadCommands();
});

watch(
  () => route.query.commandId,
  () => {
    const selectedId = Number(route.query.commandId || 0);
    if (!selectedId) {
      return;
    }
    selectedCommand.value =
      commandTable.value.find((item: any) => item.id === selectedId) || selectedCommand.value;
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

.title {
  font-size: 20px;
  font-weight: 600;
}

.subtitle {
  margin-top: 6px;
  color: #6b7280;
  line-height: 1.6;
}

.filters {
  gap: 8px 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
}

.draft-form {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 8px 16px;
}

.full-width {
  grid-column: 1 / -1;
}

.inline-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.sub-cell {
  color: #6b7280;
  font-size: 12px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.selected-summary {
  border: 1px solid #dbeafe;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.summary-card {
  padding: 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.plan-summary-card {
  margin-top: 12px;
  padding: 12px;
  border-radius: 10px;
  background: #eff6ff;
}

.summary-label {
  color: #6b7280;
  font-size: 12px;
}

.summary-value {
  margin-top: 6px;
  font-weight: 600;
  line-height: 1.5;
}

.bullet-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #4b5563;
  line-height: 1.6;
}

.compact-bullet-list {
  margin-top: 10px;
}

.top-gap-small {
  margin-top: 8px;
}
</style>
