<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">员工月度福利积点</div>
            <div class="subtitle">
              先预览，再创建草案，之后由高权限人工确认与执行。当前不会自动批量发放。
            </div>
          </div>
          <el-tag v-if="aiSourceActionId" type="warning">
            来自 AI 行动项：{{ aiSourceActionId }}
          </el-tag>
        </div>
      </template>

      <el-form inline>
        <el-form-item label="福利周期">
          <el-date-picker
            v-model="periodKey"
            type="month"
            value-format="YYYY-MM"
            format="YYYY-MM"
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item label="母单状态">
          <el-select v-model="batchStatusFilter" clearable style="width: 160px">
            <el-option label="草案" value="drafted" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已执行" value="executed" />
            <el-option label="部分执行" value="partially_executed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleReload">刷新</el-button>
          <el-button
            type="success"
            :disabled="!canCreateDraft"
            :loading="loading.draft"
            @click="handleCreateBatchDraft"
          >
            创建批量草案
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-loading="loading.preview">
      <template #header>
        <div class="section-title">当前周期预览</div>
      </template>

      <div v-if="previewData" class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">周期</div>
          <div class="summary-value">{{ previewData.periodKey }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">默认发放人数</div>
          <div class="summary-value">{{ previewData.targetEmployeeCount }} 人</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">默认发放总积点</div>
          <div class="summary-value">{{ formatMoney(previewData.targetTotalAmount) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">自动排除人数</div>
          <div class="summary-value">{{ previewData.excludedEmployees?.length || 0 }} 人</div>
        </div>
      </div>

      <el-alert v-if="previewWarningsText" type="warning" :closable="false" show-icon>
        <template #title>预览警告</template>
        <div class="subtle-text">{{ previewWarningsText }}</div>
      </el-alert>

      <div class="two-column">
        <el-table :data="previewData?.eligibleEmployees || []" size="small">
          <el-table-column prop="employeeId" label="员工 ID" width="90" />
          <el-table-column prop="employeeName" label="姓名" min-width="110" />
          <el-table-column prop="employeeMobile" label="手机号" width="140" />
          <el-table-column prop="companyName" label="公司" min-width="120" show-overflow-tooltip />
          <el-table-column prop="positionName" label="岗位" min-width="120" show-overflow-tooltip />
          <el-table-column prop="suggestedAmount" label="默认积点" width="100" align="right" />
          <el-table-column prop="reasonSummary" label="纳入原因" min-width="160" show-overflow-tooltip />
        </el-table>

        <el-table :data="previewData?.excludedEmployees || []" size="small">
          <el-table-column prop="employeeId" label="员工 ID" width="90" />
          <el-table-column prop="employeeName" label="姓名" min-width="110" />
          <el-table-column prop="employeeMobile" label="手机号" width="140" />
          <el-table-column prop="exclusionReason" label="排除原因" width="160" />
          <el-table-column prop="exclusionDetail" label="说明" min-width="160" show-overflow-tooltip />
        </el-table>
      </div>
    </el-card>

    <el-card v-loading="loading.batches">
      <template #header>
        <div class="section-title">批量母单</div>
      </template>

      <el-table :data="batchTable" size="small">
        <el-table-column prop="id" label="母单 ID" width="90" />
        <el-table-column prop="periodKey" label="周期" width="110" />
        <el-table-column prop="batchStatus" label="状态" width="130" />
        <el-table-column label="计划人数" width="110">
          <template #default="{ row }">{{ row.targetEmployeeCount }} 人</template>
        </el-table-column>
        <el-table-column label="计划总积点" width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.targetTotalAmount) }}</template>
        </el-table-column>
        <el-table-column prop="requestedByName" label="申请人" width="110" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleOpenBatch(row)">详情</el-button>
            <el-button
              v-if="row.batchStatus === 'drafted'"
              size="small"
              type="primary"
              @click="handleConfirmBatch(row.id)"
            >
              确认
            </el-button>
            <el-button
              v-if="['confirmed', 'partially_executed'].includes(row.batchStatus)"
              size="small"
              type="success"
              @click="handleExecuteBatch(row.id)"
            >
              执行
            </el-button>
            <el-button
              v-if="['drafted', 'confirmed'].includes(row.batchStatus)"
              size="small"
              type="danger"
              plain
              @click="handleCancelBatch(row.id)"
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
        :total="batchTotal"
        :page-size="batchQuery.pageSize"
        :current-page="batchQuery.page"
        @current-change="handleBatchPageChange"
      />
    </el-card>

    <el-card v-if="selectedBatchDetail" v-loading="loading.batchDetail">
      <template #header>
        <div class="header-row">
          <div>
            <div class="section-title">母单详情</div>
            <div class="subtitle">
              母单 #{{ selectedBatchDetail.batch?.id }} / {{ selectedBatchDetail.batchStatus }}
            </div>
          </div>
          <div class="subtle-text">
            本批次最终计划发放总积点：{{ formatMoney(selectedBatchDetail.finalPlannedTotal) }}
          </div>
        </div>
      </template>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">默认发放</div>
          <div class="summary-value">{{ selectedBatchDetail.defaultCount }} 人 / {{ formatMoney(selectedBatchDetail.defaultTotal) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">自定义发放</div>
          <div class="summary-value">{{ selectedBatchDetail.customCount }} 人 / {{ formatMoney(selectedBatchDetail.customTotal) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">暂不发放</div>
          <div class="summary-value">{{ selectedBatchDetail.holdCount }} 人 / {{ formatMoney(selectedBatchDetail.holdTotal) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">自动排除</div>
          <div class="summary-value">{{ selectedBatchDetail.excludedCount }} 人 / {{ formatMoney(selectedBatchDetail.excludedTotal) }}</div>
        </div>
      </div>

      <div class="summary-line">子命令统计：{{ childCommandSummaryText }}</div>

      <div class="zone-grid">
        <section class="zone-card">
          <div class="subsection-title">默认发放区</div>
          <el-table :data="defaultItems" size="small" @row-click="selectBatchItem">
            <el-table-column prop="employeeId" label="员工 ID" width="90" />
            <el-table-column prop="employeeNameSnapshot" label="姓名" min-width="110" />
            <el-table-column prop="employeeMobileSnapshot" label="手机号" width="140" />
            <el-table-column prop="finalAmount" label="积点" width="90" align="right" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click.stop="openItemEditor(row, 'custom')">转自定义</el-button>
                <el-button size="small" type="warning" plain @click.stop="openItemEditor(row, 'hold')">
                  暂不发
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <section class="zone-card">
          <div class="subsection-title">自定义发放区</div>
          <el-table :data="customItems" size="small" @row-click="selectBatchItem">
            <el-table-column prop="employeeId" label="员工 ID" width="90" />
            <el-table-column prop="employeeNameSnapshot" label="姓名" min-width="110" />
            <el-table-column prop="employeeMobileSnapshot" label="手机号" width="140" />
            <el-table-column prop="finalAmount" label="积点" width="90" align="right" />
            <el-table-column prop="adjustmentRemark" label="调整说明" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click.stop="openItemEditor(row)">编辑</el-button>
                <el-button size="small" @click.stop="quickMoveItem(row, 'default')">恢复默认</el-button>
                <el-button size="small" type="warning" plain @click.stop="openItemEditor(row, 'hold')">
                  转暂不发
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <section class="zone-card">
          <div class="subsection-title">暂不发放区</div>
          <el-table :data="holdItems" size="small" @row-click="selectBatchItem">
            <el-table-column prop="employeeId" label="员工 ID" width="90" />
            <el-table-column prop="employeeNameSnapshot" label="姓名" min-width="110" />
            <el-table-column prop="employeeMobileSnapshot" label="手机号" width="140" />
            <el-table-column prop="adjustmentRemark" label="留后说明" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click.stop="quickMoveItem(row, 'default')">恢复默认</el-button>
                <el-button size="small" type="primary" @click.stop="openItemEditor(row, 'custom')">转自定义</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <section class="zone-card">
          <div class="subsection-title">自动排除区</div>
          <el-table :data="excludedItems" size="small" @row-click="selectBatchItem">
            <el-table-column prop="employeeId" label="员工 ID" width="90" />
            <el-table-column prop="employeeNameSnapshot" label="姓名" min-width="110" />
            <el-table-column prop="employeeMobileSnapshot" label="手机号" width="140" />
            <el-table-column prop="exclusionReason" label="排除原因" width="150" />
            <el-table-column prop="adjustmentRemark" label="说明" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click.stop="quickMoveItem(row, 'default')">恢复默认</el-button>
                <el-button size="small" type="primary" @click.stop="openItemEditor(row, 'custom')">转自定义</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>
    </el-card>

    <AiSideAssistant
      page-title="员工月度福利积点"
      route-path="/points/welfare"
      :entity-type="assistantEntityType"
      :entity-id="assistantEntityId"
      :current-filters="assistantFilters"
      :source-action-id="aiSourceActionId"
    />

    <el-dialog v-model="editorVisible" title="调整福利批次子项" width="560px">
      <el-form label-width="110px">
        <el-form-item label="员工">
          <div>{{ editingItem?.employeeNameSnapshot || '-' }} / {{ editingItem?.employeeMobileSnapshot || '-' }}</div>
        </el-form-item>
        <el-form-item label="分配区">
          <el-select v-model="editorForm.allocationMode" style="width: 220px">
            <el-option label="默认发放区" value="default" />
            <el-option label="自定义发放区" value="custom" />
            <el-option label="暂不发放区" value="hold" />
            <el-option label="自动排除区" value="excluded" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editorForm.allocationMode === 'custom'" label="最终积点">
          <el-input v-model="editorForm.finalAmount" />
        </el-form-item>
        <el-form-item v-if="['custom', 'hold', 'excluded'].includes(editorForm.allocationMode)" label="说明">
          <el-input v-model="editorForm.adjustmentRemark" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item v-if="editorForm.allocationMode === 'excluded'" label="排除原因">
          <el-select v-model="editorForm.exclusionReason" style="width: 220px">
            <el-option label="员工未启用" value="disabled_employee" />
            <el-option label="缺少手机号" value="missing_mobile" />
            <el-option label="手机号冲突" value="duplicate_mobile_conflict" />
            <el-option label="导入冲突" value="import_conflict" />
            <el-option label="本期已发放" value="already_issued_this_period" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因短码">
          <el-input
            v-model="editorForm.adjustmentReasonCode"
            clearable
            placeholder="可选短码，例如 attendance_half_month"
          />
        </el-form-item>
        <el-form-item label="判断边界">
          <el-select v-model="editorForm.decisionScope" style="width: 220px">
            <el-option label="单条特例" value="case_only" />
            <el-option label="同类模式" value="same_pattern" />
            <el-option label="全局规则" value="global_rule" />
          </el-select>
        </el-form-item>
        <el-form-item label="AI 学习模式">
          <el-select v-model="editorForm.aiLearningMode" style="width: 260px">
            <el-option label="不可泛化" value="do_not_generalize" />
            <el-option label="仅建议同类" value="suggest_same_pattern_only" />
            <el-option label="复核后可泛化" value="can_generalize_with_review" />
            <el-option label="作为全局参考" value="treat_as_global_reference" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading.itemAction" @click="handleSaveItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import {
  cancelPointsWelfareBatch,
  confirmPointsWelfareBatch,
  createPointsWelfareBatchDraft,
  executePointsWelfareBatch,
  getPointsWelfareBatchDetail,
  getPointsWelfareBatches,
  getPointsWelfarePreview,
  movePointsWelfareBatchItem,
  patchPointsWelfareBatchItem,
} from '../../api/points';
import { formatMoney } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const loading = reactive({
  preview: false,
  batches: false,
  batchDetail: false,
  draft: false,
  itemAction: false,
});

const periodKey = ref(resolveRoutePeriodKey());
const batchStatusFilter = ref(typeof route.query.batchStatus === 'string' ? route.query.batchStatus : '');
const previewData = ref<any | null>(null);
const batchTable = ref<any[]>([]);
const batchTotal = ref(0);
const selectedBatchDetail = ref<any | null>(null);
const selectedBatchItem = ref<any | null>(null);

const batchQuery = reactive({
  page: 1,
  pageSize: 10,
});

const editorVisible = ref(false);
const editingItem = ref<any | null>(null);
const originalAllocationMode = ref('');
const editorForm = reactive({
  allocationMode: 'default',
  finalAmount: '',
  exclusionReason: 'other',
  adjustmentReasonCode: '',
  adjustmentRemark: '',
  decisionScope: 'case_only',
  aiLearningMode: 'do_not_generalize',
});

const selectedBatchId = computed(() => {
  const raw = route.query.batchId;
  const parsed = typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
});

const aiSourceActionId = computed(() => {
  if (typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()) {
    return route.query.sourceActionId.trim();
  }
  return selectedBatchDetail.value?.sourceActionId || null;
});

const canCreateDraft = computed(() => Number(previewData.value?.targetEmployeeCount || 0) > 0);
const defaultItems = computed(() => selectedBatchDetail.value?.batchItemsByMode?.defaultItems || []);
const customItems = computed(() => selectedBatchDetail.value?.batchItemsByMode?.customItems || []);
const holdItems = computed(() => selectedBatchDetail.value?.batchItemsByMode?.holdItems || []);
const excludedItems = computed(() => selectedBatchDetail.value?.batchItemsByMode?.excludedItems || []);

const assistantEntityType = computed(() => {
  if (selectedBatchItem.value?.id) return 'points_welfare_batch_item';
  if (selectedBatchDetail.value?.batch?.id) return 'points_welfare_batch';
  return 'points_welfare_preview';
});

const assistantEntityId = computed(() => {
  if (selectedBatchItem.value?.id) return String(selectedBatchItem.value.id);
  if (selectedBatchDetail.value?.batch?.id) return String(selectedBatchDetail.value.batch.id);
  return periodKey.value;
});

const assistantFilters = computed(() => ({
  periodKey: periodKey.value,
  batchStatus: batchStatusFilter.value || undefined,
  batchId: selectedBatchDetail.value?.batch?.id || undefined,
  batchItemId: selectedBatchItem.value?.id || undefined,
  sourceActionId: aiSourceActionId.value || undefined,
}));

const previewWarningsText = computed(() =>
  (Array.isArray(previewData.value?.warnings) ? previewData.value.warnings : []).join('；'),
);

const childCommandSummaryText = computed(() => {
  const summary = selectedBatchDetail.value?.childCommandSummary || {};
  const entries = Object.entries(summary);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(' / ') : '暂无子命令摘要';
});

function resolveCurrentPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function resolveRoutePeriodKey() {
  if (typeof route.query.periodKey === 'string' && route.query.periodKey.trim()) {
    return route.query.periodKey.trim();
  }
  return resolveCurrentPeriodKey();
}

async function syncRouteQuery(extra: Record<string, string | undefined | null>) {
  const next: Record<string, string> = {};
  Object.entries(route.query).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      next[key] = value;
    }
  });

  Object.entries(extra).forEach(([key, value]) => {
    if (!value) {
      delete next[key];
      return;
    }
    next[key] = value;
  });

  await router.replace({ path: '/points/welfare', query: next });
}

function buildBatchQueryParams() {
  return {
    page: batchQuery.page,
    pageSize: batchQuery.pageSize,
    periodKey: periodKey.value,
    batchStatus: batchStatusFilter.value || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };
}

async function loadPreview() {
  loading.preview = true;
  try {
    const { data } = await getPointsWelfarePreview({ periodKey: periodKey.value });
    previewData.value = data.data;
  } finally {
    loading.preview = false;
  }
}

async function loadBatches() {
  loading.batches = true;
  try {
    const { data } = await getPointsWelfareBatches(buildBatchQueryParams());
    batchTable.value = data.data.list || [];
    batchTotal.value = data.data.total || 0;
  } finally {
    loading.batches = false;
  }
}

async function loadBatchDetail(batchId: number | null) {
  if (!batchId) {
    selectedBatchDetail.value = null;
    selectedBatchItem.value = null;
    return;
  }

  loading.batchDetail = true;
  try {
    const { data } = await getPointsWelfareBatchDetail(batchId);
    selectedBatchDetail.value = data.data;
    if (selectedBatchItem.value?.id) {
      selectedBatchItem.value =
        (data.data.batchItems || []).find((item: any) => item.id === selectedBatchItem.value.id) || null;
    }
  } finally {
    loading.batchDetail = false;
  }
}

async function loadAll() {
  await Promise.all([loadPreview(), loadBatches()]);
  await loadBatchDetail(selectedBatchId.value);
}

async function handleReload() {
  batchQuery.page = 1;
  await syncRouteQuery({
    periodKey: periodKey.value,
    batchStatus: batchStatusFilter.value || undefined,
  });
}

async function handleCreateBatchDraft() {
  if (!canCreateDraft.value) {
    ElMessage.warning('当前没有可创建福利草案的员工');
    return;
  }

  loading.draft = true;
  try {
    const { data } = await createPointsWelfareBatchDraft({
      periodKey: periodKey.value,
      sourceActionId: aiSourceActionId.value || undefined,
      remark: `员工月度福利积点 ${periodKey.value}`,
    });
    const createdBatchId = data.data?.batch?.id;
    ElMessage.success(`福利积点母单草案已创建：#${createdBatchId || '-'}`);
    await syncRouteQuery({
      periodKey: periodKey.value,
      batchStatus: batchStatusFilter.value || undefined,
      batchId: createdBatchId ? String(createdBatchId) : undefined,
    });
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '创建福利积点母单草案失败');
  } finally {
    loading.draft = false;
  }
}

async function handleConfirmBatch(batchId?: number | null) {
  if (!batchId) return;
  await confirmPointsWelfareBatch(batchId, {});
  ElMessage.success(`福利积点母单 #${batchId} 已确认`);
  await loadAll();
}

async function handleExecuteBatch(batchId?: number | null) {
  if (!batchId) return;
  await executePointsWelfareBatch(batchId, {});
  ElMessage.success(`福利积点母单 #${batchId} 已执行`);
  await loadAll();
}

async function handleCancelBatch(batchId?: number | null) {
  if (!batchId) return;
  await cancelPointsWelfareBatch(batchId, {});
  ElMessage.success(`福利积点母单 #${batchId} 已取消`);
  await loadAll();
}

async function handleOpenBatch(row: any) {
  selectedBatchItem.value = null;
  await syncRouteQuery({
    periodKey: periodKey.value,
    batchStatus: batchStatusFilter.value || undefined,
    batchId: row?.id ? String(row.id) : undefined,
  });
}

function handleBatchPageChange(page: number) {
  batchQuery.page = page;
  void loadBatches();
}

function selectBatchItem(row: any) {
  selectedBatchItem.value = row;
}

function openItemEditor(row: any, targetMode?: string) {
  editingItem.value = row;
  selectedBatchItem.value = row;
  originalAllocationMode.value = row.allocationMode;
  editorForm.allocationMode = targetMode || row.allocationMode || 'default';
  editorForm.finalAmount = row.finalAmount || row.defaultAmount || '200.00';
  editorForm.exclusionReason = row.exclusionReason || 'other';
  editorForm.adjustmentReasonCode = row.adjustmentReasonCode || '';
  editorForm.adjustmentRemark = row.adjustmentRemark || '';
  editorForm.decisionScope = row.decisionScope || 'case_only';
  editorForm.aiLearningMode = row.aiLearningMode || 'do_not_generalize';
  editorVisible.value = true;
}

async function quickMoveItem(row: any, allocationMode: string) {
  openItemEditor(row, allocationMode);
  if (allocationMode === 'default') {
    editorForm.adjustmentRemark = '';
    await handleSaveItem();
  }
}

async function handleSaveItem() {
  if (!selectedBatchDetail.value?.batch?.id || !editingItem.value?.id) {
    return;
  }

  if (editorForm.allocationMode === 'custom' && !editorForm.adjustmentRemark.trim()) {
    ElMessage.warning('自定义发放区必须填写调整说明');
    return;
  }
  if (editorForm.allocationMode === 'hold' && !editorForm.adjustmentRemark.trim()) {
    ElMessage.warning('暂不发放区必须填写留后处理说明');
    return;
  }
  if (editorForm.allocationMode === 'excluded' && !editorForm.exclusionReason) {
    ElMessage.warning('自动排除区必须填写排除原因');
    return;
  }

  loading.itemAction = true;
  try {
    const payload = {
      allocationMode: editorForm.allocationMode,
      finalAmount: editorForm.allocationMode === 'custom' ? editorForm.finalAmount : undefined,
      exclusionReason: editorForm.allocationMode === 'excluded' ? editorForm.exclusionReason : undefined,
      adjustmentReasonCode: editorForm.adjustmentReasonCode || undefined,
      adjustmentRemark: ['custom', 'hold', 'excluded'].includes(editorForm.allocationMode)
        ? editorForm.adjustmentRemark || undefined
        : undefined,
      basisType: editorForm.allocationMode === 'default' ? 'rule' : 'manual',
      decisionScope: editorForm.decisionScope,
      aiLearningMode: editorForm.aiLearningMode,
    };

    if (editorForm.allocationMode === originalAllocationMode.value) {
      await patchPointsWelfareBatchItem(selectedBatchDetail.value.batch.id, editingItem.value.id, payload);
    } else {
      await movePointsWelfareBatchItem(selectedBatchDetail.value.batch.id, editingItem.value.id, payload);
    }

    ElMessage.success('福利批次子项已更新');
    editorVisible.value = false;
    await loadBatchDetail(selectedBatchDetail.value.batch.id);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '更新福利批次子项失败');
  } finally {
    loading.itemAction = false;
  }
}

watch(
  () => route.fullPath,
  () => {
    periodKey.value = resolveRoutePeriodKey();
    batchStatusFilter.value = typeof route.query.batchStatus === 'string' ? route.query.batchStatus : '';
    void loadAll();
  },
);

onMounted(() => {
  void loadAll();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.header-row,
.summary-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.title,
.section-title,
.subsection-title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle,
.subtle-text {
  font-size: 12px;
  color: #6b7280;
}

.summary-grid,
.two-column,
.zone-grid {
  display: grid;
  gap: 12px;
}

.summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.two-column,
.zone-grid {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.summary-card,
.zone-card {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.summary-label {
  font-size: 12px;
  color: #6b7280;
}

.summary-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 600;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .summary-grid,
  .two-column,
  .zone-grid {
    grid-template-columns: 1fr;
  }
}
</style>
