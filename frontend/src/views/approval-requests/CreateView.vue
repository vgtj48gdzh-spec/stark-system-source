<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="page-header">
          <div>
            <div class="page-title">发起付款审批</div>
            <div class="page-subtitle">复用工单材料、仓库和出库证据，不允许自由修改关联对象或金额。</div>
          </div>
          <el-button @click="router.push('/approval-requests')">返回审批列表</el-button>
        </div>
      </template>

      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="提交只会生成 pending 审批单"
        class="page-alert"
      >
        <div>
          本页不会执行付款、修改库存、确认银行短信或改写虚拟台账；草稿经办、财务提交和最终审批必须由三名不同人员完成。
        </div>
      </el-alert>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="工单材料证据发起" name="evidence">
          <div class="section-stack">
            <el-steps :active="evidenceStep" align-center finish-status="success">
              <el-step title="选择证据候选" description="evidence_ready 仅代表证据结构完整，提交时仍会二次校验" />
              <el-step title="创建审批草稿" description="冻结候选、关联与金额" />
              <el-step title="人工确认提交" description="生成 pending 审批单" />
            </el-steps>

            <el-alert
              v-if="!canSubmitApprovalDraft"
              type="info"
              :closable="false"
              show-icon
              title="当前为只读预览"
            >
              <div>审批人可以核对候选证据，但不能创建或提交审批草稿。</div>
            </el-alert>

            <div class="toolbar">
              <div>
                <div class="section-title">可发起候选</div>
                <div class="muted-text">
                  固定筛选：stark_work_order / reimbursement / evidence_ready / 最多 50 条
                </div>
              </div>
              <el-button :loading="previewLoading" @click="loadWarehousePreviews">刷新候选</el-button>
            </div>

            <el-table
              :data="warehousePreviews"
              :class="{ 'table-locked': Boolean(createdDraft) }"
              v-loading="previewLoading"
              highlight-current-row
              empty-text="暂无满足条件的工单材料证据"
              @current-change="handlePreviewSelection"
            >
              <el-table-column label="工单" min-width="190">
                <template #default="{ row }">
                  <div class="cell-stack">
                    <strong>{{ workOrderPrimary(row) }}</strong>
                    <span class="muted-text">{{ workOrderSecondary(row) }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="材料 / 出库" min-width="230">
                <template #default="{ row }">
                  <div class="cell-stack">
                    <strong>{{ materialPrimary(row) }}</strong>
                    <span class="muted-text">{{ inventorySummary(row) }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="仓库" min-width="140">
                <template #default="{ row }">{{ warehouseLabel(row) }}</template>
              </el-table-column>
              <el-table-column label="供应商" min-width="150">
                <template #default="{ row }">{{ supplierLabel(row) }}</template>
              </el-table-column>
              <el-table-column label="证据金额" width="140" align="right">
                <template #default="{ row }">
                  <strong>{{ formatMoney(row.amount) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="必须守卫" min-width="220">
                <template #default="{ row }">
                  <div class="guard-list">
                    <el-tag
                      v-for="guard in row.requiredGuards"
                      :key="guard"
                      size="small"
                      type="warning"
                      effect="plain"
                    >
                      {{ guardLabel(guard) }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
            </el-table>

            <el-card v-if="selectedPreview" shadow="never" class="selection-card">
              <div class="selection-header">
                <div>
                  <div class="section-title">已选择：{{ workOrderPrimary(selectedPreview) }}</div>
                  <div class="muted-text">
                    {{ materialPrimary(selectedPreview) }} / {{ warehouseLabel(selectedPreview) }} /
                    {{ supplierLabel(selectedPreview) }} / {{ formatMoney(selectedPreview.amount) }}
                  </div>
                </div>
                <el-button
                  v-if="canSubmitApprovalDraft && !createdDraft"
                  type="primary"
                  :loading="draftCreating"
                  @click="handleCreateDraft"
                >
                  创建审批草稿
                </el-button>
              </div>
            </el-card>

            <el-card v-if="createdDraft" shadow="never" class="draft-card">
              <template #header>
                <div class="selection-header">
                  <div>
                    <div class="section-title">审批草稿 {{ createdDraft.draftNo }}</div>
                    <div class="muted-text">
                      金额和关联证据已冻结；状态：{{ createdDraft.draftStatus }}
                    </div>
                  </div>
                  <el-tag type="warning">仍需人工提交与独立审批</el-tag>
                </div>
              </template>

              <template v-if="createdDraft.draftStatus === 'draft_created'">
                <el-alert
                  v-if="!hasIndependentDraftCreator"
                  type="warning"
                  :closable="false"
                  show-icon
                  :title="
                    isCurrentUserDraftCreator
                      ? '该草稿需要交给另一名提交人'
                      : '该草稿缺少有效经办人身份，禁止提交'
                  "
                  class="handoff-alert"
                >
                  <div v-if="isCurrentUserDraftCreator">
                    当前账号是草稿经办人，不能继续提交。请另一名具备财务提交权限的账号登录后重新选择同一候选；当前 MVP 可由与经办人不同的管理员或财务账号接手，再由第三名独立审批人处理。
                  </div>
                  <div v-else>
                    系统无法确认这份历史草稿的经办人，不能推断或补填身份。请由管理员先人工复核并重建证据链。
                  </div>
                </el-alert>
                <el-form label-position="top" class="submit-form">
                  <el-form-item label="人工核对与提交说明" required>
                    <el-input
                      v-model="submissionForm.submissionReason"
                      type="textarea"
                      :rows="4"
                      maxlength="500"
                      show-word-limit
                      placeholder="请说明已核对的工单、材料、仓库、供应商和出库证据"
                    />
                  </el-form-item>

                  <div class="confirmation-list">
                    <el-checkbox v-model="submissionForm.confirmEvidenceReviewed">
                      我已人工核对工单、材料、仓库、供应商和出库证据
                    </el-checkbox>
                    <el-checkbox v-model="submissionForm.confirmNormalMaterial">
                      我已确认该材料不是需要单独审批的特殊材料
                    </el-checkbox>
                    <el-checkbox v-model="submissionForm.confirmHumanSubmission">
                      我确认本次提交由本人主动发起，系统或 AI 未替我作出审批决定
                    </el-checkbox>
                    <el-checkbox v-model="submissionForm.humanOverrideAiSuggestion">
                      本次人工判断与 AI 建议不同（可选，仅记录，不影响审批）
                    </el-checkbox>
                  </div>

                  <div class="submit-actions">
                    <el-button
                      v-if="canSubmitApprovalDraft"
                      type="primary"
                      :disabled="!canConfirmSubmission"
                      :loading="draftSubmitting"
                      @click="handleSubmitDraft"
                    >
                      人工确认并提交审批
                    </el-button>
                  </div>
                </el-form>
              </template>

              <el-result
                v-else-if="createdDraft.draftStatus === 'submitted'"
                icon="success"
                title="该草稿已经提交"
                sub-title="系统未重复创建审批单。"
              >
                <template #extra>
                  <el-button
                    v-if="createdDraft.linkedApprovalRequestId"
                    type="primary"
                    @click="router.push(`/approval-requests/${createdDraft.linkedApprovalRequestId}`)"
                  >
                    查看关联审批单
                  </el-button>
                </template>
              </el-result>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="canUseManualForm" label="管理员手工发起" name="manual">
          <el-alert
            type="info"
            :closable="false"
            title="兼容入口：仅管理员可见"
            class="manual-alert"
          >
            <div>申请人使用当前登录用户；审批通过前仍不能创建付款记录。</div>
          </el-alert>

          <el-form
            ref="manualFormRef"
            :model="manualForm"
            :rules="manualRules"
            label-width="120px"
            class="manual-form"
          >
            <el-form-item label="关联工单" prop="relatedWorkOrderId">
              <el-select v-model="manualForm.relatedWorkOrderId" filterable clearable style="width: 100%">
                <el-option
                  v-for="item in workOrderOptions"
                  :key="item.id"
                  :label="`${item.workOrderNo} / ${item.title}`"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="申请金额" prop="amount">
              <el-input v-model="manualForm.amount" placeholder="例如 800.00" />
            </el-form-item>
            <el-form-item label="用途说明" prop="reason">
              <el-input v-model="manualForm.reason" type="textarea" :rows="4" />
            </el-form-item>
            <el-form-item label="验证码" prop="verificationCode">
              <el-input v-model="manualForm.verificationCode" placeholder="可选" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="manualSubmitting" @click="handleManualSubmit">
                提交手工审批
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  createApprovalDraftFromWarehousePreview,
  createApprovalRequest,
  getApprovalWarehousePreviews,
  submitApprovalRequestDraft,
  type ApprovalRequestDraftSummary,
  type ApprovalWarehousePreview,
} from '../../api/approval-requests';
import { getWorkOrders } from '../../api/work-orders';
import { formatMoney } from '../../utils/format';
import {
  formalActorIdentityBound,
  getCurrentUserId,
  hasAnyRole,
} from '../../utils/permissions';

const router = useRouter();
const activeTab = ref('evidence');
const previewLoading = ref(false);
const draftCreating = ref(false);
const draftSubmitting = ref(false);
const manualSubmitting = ref(false);
const warehousePreviews = ref<ApprovalWarehousePreview[]>([]);
const selectedPreview = ref<ApprovalWarehousePreview | null>(null);
const createdDraft = ref<ApprovalRequestDraftSummary | null>(null);
const workOrderOptions = ref<any[]>([]);
const manualFormRef = ref<FormInstance>();

const canSubmitApprovalDraft = computed(
  () => formalActorIdentityBound.value && hasAnyRole(['finance', 'admin']),
);
const canUseManualForm = computed(
  () => formalActorIdentityBound.value && hasAnyRole(['admin']),
);
const isCurrentUserDraftCreator = computed(
  () => createdDraft.value?.createdByUserId === getCurrentUserId(),
);
const hasIndependentDraftCreator = computed(() => {
  const creatorUserId = createdDraft.value?.createdByUserId;
  return (
    Number.isInteger(creatorUserId) &&
    Number(creatorUserId) > 0 &&
    creatorUserId !== getCurrentUserId()
  );
});
const evidenceStep = computed(() => {
  if (createdDraft.value) return 2;
  if (selectedPreview.value) return 1;
  return 0;
});

const submissionForm = reactive({
  submissionReason: '',
  confirmHumanSubmission: false,
  confirmEvidenceReviewed: false,
  confirmNormalMaterial: false,
  humanOverrideAiSuggestion: false,
});

const canConfirmSubmission = computed(
  () =>
    canSubmitApprovalDraft.value &&
    hasIndependentDraftCreator.value &&
    createdDraft.value?.draftStatus === 'draft_created' &&
    Boolean(submissionForm.submissionReason.trim()) &&
    submissionForm.confirmHumanSubmission &&
    submissionForm.confirmEvidenceReviewed &&
    submissionForm.confirmNormalMaterial,
);

const manualForm = reactive({
  relatedWorkOrderId: undefined as number | undefined,
  amount: '',
  reason: '',
  verificationCode: '',
});

const manualRules: FormRules = {
  relatedWorkOrderId: [{ required: true, message: '请选择工单', trigger: 'change' }],
  amount: [{ required: true, message: '请输入申请金额', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入用途说明', trigger: 'blur' }],
};

async function loadWarehousePreviews() {
  previewLoading.value = true;
  try {
    const { data } = await getApprovalWarehousePreviews({
      sourceSystem: 'stark_work_order',
      candidateType: 'reimbursement',
      status: 'evidence_ready',
      limit: 50,
    });
    const list = Array.isArray(data?.data?.list) ? data.data.list : [];
    warehousePreviews.value = list.filter(
      (item: ApprovalWarehousePreview) => item.sourceEntityType === 'work_order_materials',
    );

    if (selectedPreview.value) {
      const refreshedPreview = warehousePreviews.value.find(
        (item) => item.candidateRef === selectedPreview.value?.candidateRef,
      );
      const evidenceVersionChanged =
        Boolean(createdDraft.value) &&
        (!refreshedPreview ||
          refreshedPreview.idempotencyKey !== createdDraft.value?.previewIdempotencyKey);

      selectedPreview.value = refreshedPreview ?? null;
      if (evidenceVersionChanged) {
        createdDraft.value = null;
        resetSubmissionConfirmations();
        ElMessage.warning('证据版本已经变化，旧草稿不会继续提交，请重新选择并人工核对');
      }
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '工单材料候选加载失败');
  } finally {
    previewLoading.value = false;
  }
}

function resetSubmissionConfirmations() {
  submissionForm.submissionReason = '';
  submissionForm.confirmHumanSubmission = false;
  submissionForm.confirmEvidenceReviewed = false;
  submissionForm.confirmNormalMaterial = false;
  submissionForm.humanOverrideAiSuggestion = false;
}

function handlePreviewSelection(row: ApprovalWarehousePreview | null) {
  if (createdDraft.value) return;
  selectedPreview.value = row;
}

async function handleCreateDraft() {
  if (!selectedPreview.value || !canSubmitApprovalDraft.value) return;

  draftCreating.value = true;
  try {
    const preview = selectedPreview.value;
    const { data } = await createApprovalDraftFromWarehousePreview({
      candidateRef: preview.candidateRef,
      idempotencyKey: preview.idempotencyKey,
      draftReason: '人工选择工单材料证据并准备提交审批',
    });
    createdDraft.value = data?.data?.draft ?? null;
    if (!createdDraft.value) {
      throw new Error('服务端未返回审批草稿');
    }
    ElMessage.success(data?.data?.idempotentReplay ? '已恢复现有审批草稿' : '审批草稿已创建');
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '审批草稿创建失败');
  } finally {
    draftCreating.value = false;
  }
}

async function handleSubmitDraft() {
  const draft = createdDraft.value;
  if (!draft || !canConfirmSubmission.value) return;

  try {
    await ElMessageBox.confirm(
      '本次操作只会创建 pending 审批单，不会付款、改库存、确认银行短信或改虚拟台账。确认由本人提交并交给另一名审批人处理吗？',
      '确认提交审批',
      {
        confirmButtonText: '确认提交',
        cancelButtonText: '继续核对',
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  draftSubmitting.value = true;
  try {
    const { data } = await submitApprovalRequestDraft(draft.id, {
      idempotencyKey: draft.idempotencyKey,
      submissionReason: submissionForm.submissionReason.trim(),
      confirmHumanSubmission: true,
      confirmEvidenceReviewed: true,
      confirmNormalMaterial: true,
      ...(submissionForm.humanOverrideAiSuggestion
        ? { humanOverrideAiSuggestion: true }
        : {}),
    });
    const approvalId = data?.data?.approvalRequest?.id;
    if (!approvalId) {
      throw new Error('服务端未返回关联审批单');
    }
    ElMessage.success(data?.data?.idempotentReplay ? '审批单已存在，未重复创建' : '审批已提交，等待独立审批人处理');
    await router.push(`/approval-requests/${approvalId}`);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '审批草稿提交失败');
    await loadWarehousePreviews();
  } finally {
    draftSubmitting.value = false;
  }
}

async function loadWorkOrders() {
  if (!canUseManualForm.value) return;
  const { data } = await getWorkOrders({ page: 1, pageSize: 100 });
  workOrderOptions.value = data.data.list;
}

async function handleManualSubmit() {
  await manualFormRef.value?.validate();
  manualSubmitting.value = true;
  try {
    const { data } = await createApprovalRequest(manualForm);
    ElMessage.success('审批申请提交成功');
    const approvalId = data?.data?.id;
    await router.push(approvalId ? `/approval-requests/${approvalId}` : '/approval-requests');
  } finally {
    manualSubmitting.value = false;
  }
}

function safeValue(record: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function workOrderPrimary(row: ApprovalWarehousePreview) {
  return safeValue(row.evidenceSummary.workOrder, ['workOrderNo', 'label', 'title']) || '未标注工单';
}

function workOrderSecondary(row: ApprovalWarehousePreview) {
  const workOrder = row.evidenceSummary.workOrder;
  const title = safeValue(workOrder, ['title']);
  const status = safeValue(workOrder, ['status']);
  return [title, status ? `状态：${status}` : ''].filter(Boolean).join(' / ') || '工单证据已关联';
}

function materialPrimary(row: ApprovalWarehousePreview) {
  return (
    safeValue(row.evidenceSummary.material, ['name', 'materialName', 'label', 'materialCode']) ||
    '未标注材料'
  );
}

function inventorySummary(row: ApprovalWarehousePreview) {
  const inventory = row.evidenceSummary.inventory;
  const quantity = safeValue(inventory, ['quantity']);
  const unitPrice = safeValue(inventory, ['unitPrice']);
  const sourceType = safeValue(inventory, ['sourceType']);
  return [
    quantity ? `数量 ${quantity}` : '',
    unitPrice ? `单价 ${formatMoney(unitPrice)}` : '',
    sourceType ? `来源 ${sourceType}` : '',
  ]
    .filter(Boolean)
    .join(' / ') || '出库关联已由后端校验';
}

function warehouseLabel(row: ApprovalWarehousePreview) {
  return safeValue(row.evidenceSummary.warehouse, ['name', 'warehouseName', 'label']) || '-';
}

function supplierLabel(row: ApprovalWarehousePreview) {
  return safeValue(row.evidenceSummary.supplier, ['name', 'supplierName', 'label']) || '-';
}

function guardLabel(guard: string) {
  const labels: Record<string, string> = {
    human_approval_required: '必须人工审批',
    source_authority_guard: '来源权威校验',
    redaction_guard: '脱敏校验',
    audit_guard: '审计留痕',
    bank_confirmation_guard: '禁止自动确认银行短信',
    virtual_ledger_guard: '禁止自动改虚拟台账',
    owner_review_guard: '需要老板复核',
  };
  return labels[guard] || guard;
}

onMounted(() => {
  void loadWarehousePreviews();
});

watch(
  formalActorIdentityBound,
  (isBound) => {
    if (isBound) {
      void loadWorkOrders();
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.page-stack,
.section-stack,
.cell-stack,
.confirmation-list {
  display: grid;
  gap: 16px;
}

.page-header,
.toolbar,
.selection-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
}

.page-subtitle,
.muted-text {
  margin-top: 6px;
  color: #6b7280;
  line-height: 1.6;
}

.page-alert,
.manual-alert {
  margin-bottom: 16px;
}

.section-stack {
  padding-top: 8px;
}

.section-title {
  font-weight: 600;
  color: #111827;
}

.cell-stack {
  gap: 4px;
}

.guard-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.table-locked {
  pointer-events: none;
  opacity: 0.78;
}

.selection-card,
.draft-card {
  border-color: #dbeafe;
}

.submit-form,
.manual-form {
  max-width: 760px;
}

.confirmation-list {
  gap: 10px;
}

.confirmation-list :deep(.el-checkbox) {
  height: auto;
  align-items: flex-start;
  white-space: normal;
}

.submit-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .page-header,
  .toolbar,
  .selection-header {
    flex-direction: column;
  }

  .submit-actions {
    justify-content: flex-start;
  }
}
</style>
