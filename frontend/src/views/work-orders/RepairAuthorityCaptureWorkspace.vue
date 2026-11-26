<template>
  <section class="capture-workspace" aria-label="修理正式资料与独立复核">
    <h3>正式资料与独立复核</h3>
    <p class="intro">沿用当前工单，依次完成经济事实关联、责任与三角色归因、五项成本声明。资料通过不等于贡献入账，更不等于工资已确认。</p>
    <el-alert type="warning" :closable="false" show-icon title="当前仅提供资料阶段入口：正式适配器仍为 0/4，工资未启用。实际配件、外协、退款、返工不能伪填为“不适用”。" />
    <el-alert v-if="!formalActorIdentityBound" type="info" :closable="false" title="需要可信代理绑定的正式人员身份；角色预览或默认身份不能读取、录入或复核。" />
    <div class="toolbar">
      <el-select v-model="family" aria-label="正式资料类别" :disabled="busy || hasPending">
        <el-option label="1 · 经济事实关联" value="lineage" /><el-option label="2 · 责任与三角色归因" value="assignment" /><el-option label="3 · 五项成本声明" value="baseline" />
      </el-select>
      <el-button :disabled="!formalActorIdentityBound || busy || hasPending" :loading="busy" @click="load">读取当前资料</el-button>
    </div>
    <el-alert v-if="message" :type="messageKind" :closable="false" :title="message" role="status" />
    <div v-if="hasPending" class="pending-box" role="alert">
      <p>请求结果待核对。重试会保留原始内容和幂等键，不会自动继续下一阶段。当前表单已锁定。</p>
      <el-button :disabled="busy || !formalActorIdentityBound" @click="sendPending">以同一请求重试</el-button>
      <el-button :disabled="busy" @click="abandon">放弃重试并重新读取</el-button>
    </div>
    <p v-if="!snapshot" class="empty-note">本页不会自动查询资料。请选择类别并读取；没有记录不代表事实为零。</p>
    <template v-else>
      <p>当前工单 {{ snapshot.workOrderRef }} · 档案版本 {{ snapshot.profileVersion }} · {{ snapshot.records.length }} 条记录</p>
      <ReviewChecklist v-if="reviewChecklist && !busy && !hasPending" :checklist="reviewChecklist" />
      <el-alert v-else-if="!busy && !hasPending" type="info" :closable="false" title="当前服务未提供复核清单，无法判断资料是否齐全；请核对当前资料，不能将清单缺失视为已完成。" />
      <el-radio-group v-model="mode" :disabled="busy || hasPending" aria-label="资料工作方式">
        <el-radio-button value="records">查看 / 提交 / 复核</el-radio-button>
        <el-radio-button value="draft" :disabled="busy || hasPending || !canCreate">{{ family === 'lineage' ? '提议经济事实关联' : '录入新版本草稿' }}</el-radio-button>
      </el-radio-group>
      <el-form v-if="mode === 'draft' && canCreate" label-position="top" :disabled="busy || hasPending" class="capture-form" @submit.prevent>
        <p class="help">只填写已有、可核对的事实和证据。证据原件沿用现有授权渠道保管；这里不上传原件、不收集手机号或银行短信。</p>
        <template v-if="family === 'lineage'">
          <el-form-item label="关联方式"><el-select v-model="lineage.relationType"><el-option label="首次登记经济事实" value="origin" /><el-option label="撤销后重建同一经济事实" value="cancel_recreate" /></el-select></el-form-item>
          <template v-if="lineage.relationType === 'cancel_recreate'">
            <el-form-item label="已撤销前序工单编号"><el-input-number v-model="lineage.predecessorId" :min="1" :precision="0" /></el-form-item>
            <el-form-item label="已核对的前序档案版本"><el-input-number v-model="lineage.predecessorVersion" :min="1" :precision="0" /></el-form-item>
          </template>
          <EvidenceFields v-model="lineage.evidence" label="关联证据" />
        </template>
        <template v-else>
          <el-form-item v-if="approvedRecords.length" label="替代已通过版本（明确选择；保留旧版本）">
            <el-select v-model="supersedes" placeholder="选择被替代的当前版本"><el-option v-for="row in approvedRecords" :key="row.ref" :label="`v${row.authorityVersion} · ${row.ref}`" :value="row.ref" /></el-select>
          </el-form-item>
          <template v-if="family === 'assignment'">
            <el-form-item label="责任员工引用"><el-input v-model="assignment.responsibilityEmployeeRef" placeholder="employee:已绑定员工编号" /></el-form-item>
            <el-form-item label="责任开始时间（UTC）"><el-input v-model="assignment.responsibilityEffectiveFrom" :placeholder="isoHint" /></el-form-item>
            <el-form-item label="责任结束时间（UTC，可空）"><el-input v-model="assignment.responsibilityEffectiveTo" :placeholder="isoHint" /></el-form-item>
            <EvidenceFields v-model="assignment.responsibilityEvidence" label="责任证据" />
            <h4>三角色归因</h4><p>三个角色都需有人员；全部份额合计 10000 bps = 100%，不是每个角色各 100%。</p>
            <fieldset v-for="(line, index) in assignment.attributions" :key="index">
              <legend>归因 {{ index + 1 }}</legend>
              <el-form-item label="角色"><el-select v-model="line.role"><el-option v-for="role in roles" :key="role.value" :label="role.label" :value="role.value" /></el-select></el-form-item>
              <el-form-item label="员工引用"><el-input v-model="line.employeeRef" placeholder="employee:员工编号" /></el-form-item>
              <el-form-item label="份额（bps）"><el-input-number v-model="line.shareBps" :min="1" :max="10000" :precision="0" /></el-form-item>
              <el-form-item label="开始时间（UTC）"><el-input v-model="line.effectiveFrom" :placeholder="isoHint" /></el-form-item>
              <el-form-item label="结束时间（UTC，可空）"><el-input v-model="line.effectiveTo" :placeholder="isoHint" /></el-form-item>
              <EvidenceFields :model-value="line" @update:model-value="Object.assign(line, $event)" />
              <el-button v-if="assignment.attributions.length > 3" @click="assignment.attributions.splice(index, 1)">移除此归因项</el-button>
            </fieldset>
            <el-button :disabled="assignment.attributions.length >= 30" @click="assignment.attributions.push(newAttribution('lead_originator'))">增加归因员工</el-button>
          </template>
          <template v-else>
            <el-button :disabled="busy || hasPending" @click="loadAssignments">读取本工单已通过的责任归因</el-button>
            <el-form-item label="绑定责任归因版本"><el-select v-model="assignmentRef" placeholder="先读取再选择"><el-option v-for="row in assignmentOptions" :key="row.ref" :label="`v${row.authorityVersion} · ${row.ref}`" :value="row.ref" /></el-select></el-form-item>
            <p>五项都需逐项选择实际处置并提供证据；非零成本可以声明，但首批零外部成本路径仍被阻断。已有退款或返工时请停止，不得用“不适用”绕过。</p>
            <fieldset v-for="line in declarations" :key="line.category">
              <legend>{{ categoryLabels[line.category] }}</legend>
              <el-form-item label="实际处置"><el-select v-model="line.disposition" placeholder="请明确选择"><el-option label="经核对不适用" value="not_applicable" /><el-option v-if="!['refund', 'rework'].includes(line.category)" label="已确认实际成本" value="confirmed_cost" /></el-select></el-form-item>
              <el-form-item label="金额（整数分；不适用也需填写 0）"><el-input v-model="line.amountCents" inputmode="numeric" placeholder="整数分，不使用小数" /></el-form-item>
              <el-form-item label="实际成本发生时间（UTC；不适用留空）"><el-input v-model="line.occurredAt" :placeholder="isoHint" /></el-form-item>
              <EvidenceFields :model-value="line" @update:model-value="Object.assign(line, $event)" />
            </fieldset>
          </template>
        </template>
        <el-button type="primary" class="submit-button" @click="createDraft">{{ family === 'lineage' ? '提交关联提议，等待独立复核' : '仅保存草稿' }}</el-button>
      </el-form>
      <el-form v-else label-position="top" :disabled="busy || hasPending" class="capture-form" @submit.prevent>
        <el-empty v-if="!snapshot.records.length" description="尚无正式资料；不会自动补零或推定已完成" />
        <template v-else>
          <el-form-item label="选择核对记录"><el-select v-model="recordRef" placeholder="请选择记录"><el-option v-for="row in snapshot.records" :key="row.ref" :label="`${row.status} · ${row.authorityVersion ? `v${row.authorityVersion} · ` : ''}${row.ref}`" :value="row.ref" /></el-select></el-form-item>
          <template v-if="selectedRecord">
            <AuthorityRecord :record="selectedRecord" />
            <template v-if="selectedRecord.canApprove || selectedRecord.canSubmit || selectedRecord.canDecide">
              <p>请根据原件核对上方内容和摘要；摘要相同不代表业务事实自动正确。</p>
              <EvidenceFields v-model="reviewEvidence" label="本次操作证据" />
              <el-form-item v-if="selectedRecord.canDecide" label="独立复核决定"><el-select v-model="decision" placeholder="请明确选择"><el-option label="核对通过" value="approve" /><el-option label="核对不通过，驳回" value="reject" /></el-select></el-form-item>
              <el-checkbox v-model="reviewAcknowledged">我已核对所选版本及证据，本次仅处理资料阶段</el-checkbox>
              <div class="review-actions">
                <el-button v-if="selectedRecord.canSubmit" type="primary" :disabled="busy || hasPending || !reviewAcknowledged" @click="review('submit')">提交给独立复核人</el-button>
                <el-button v-if="selectedRecord.canApprove" type="primary" :disabled="busy || hasPending || !reviewAcknowledged" @click="review('approve')">独立复核并接受经济事实关联</el-button>
                <el-button v-if="selectedRecord.canDecide" type="primary" :disabled="busy || hasPending || !reviewAcknowledged || !decision" @click="review('decide')">提交复核决定</el-button>
              </div>
            </template>
            <p v-else>本记录当前不可由你操作；请由有权限的制单人或另一位独立复核人处理。服务端会再次校验实时权限和版本。</p>
          </template>
        </template>
      </el-form>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import { authenticatedUserIdentity, formalActorIdentityBound } from '../../utils/permissions';
import { readRepairAuthorityCapture, executeRepairAuthorityCapture } from '../../api/repair-authority-capture';
import { assignmentDraft, baselineDraft, createCaptureSession, lineageProposal, newIdempotencyKey, reviewCommand, validateSnapshot, type Attribution, type CaptureAction, type CaptureFamily, type CaptureRecord, type CaptureSnapshot, type Declaration } from '../../utils/repair-authority-capture';
import EvidenceFields from './RepairAuthorityEvidenceFields.vue';
import AuthorityRecord from './RepairAuthorityRecord.vue';
import ReviewChecklist from './RepairCaptureReviewChecklist.vue';
import { validateReviewChecklist, type ReviewChecklistView } from '../../utils/repair-capture-review-checklist';

// null means no legacy-workspace version was loaded, never a synthetic version 0.
// The explicit capture GET supplies the checked version used by every command.
const props = defineProps<{ workOrderId: string; profileVersion: number | null }>();
const family = ref<CaptureFamily>('lineage');
const snapshot = ref<CaptureSnapshot | null>(null);
const reviewChecklist = ref<ReviewChecklistView | null>(null);
const mode = ref('records'); const busy = ref(false); const hasPending = ref(false);
const message = ref(''); const messageKind = ref<'error' | 'success' | 'info'>('info');
const recordRef = ref(''); const supersedes = ref(''); const assignmentRef = ref('');
const assignmentOptions = ref<CaptureRecord[]>([]); const decision = ref(''); const reviewAcknowledged = ref(false);
const blankEvidence = () => ({ evidenceRef: '', evidenceHash: '' });
const reviewEvidence = ref(blankEvidence());
const lineage = reactive({ relationType: 'origin' as 'origin' | 'cancel_recreate', predecessorId: 1, predecessorVersion: 1, evidence: blankEvidence() });
const roles = [{ value: 'lead_originator', label: '线索来源人' }, { value: 'business_owner', label: '业务负责人' }, { value: 'service_owner', label: '服务负责人' }];
function newAttribution(role: string): Attribution { return { role, employeeRef: '', shareBps: 1, effectiveFrom: '', effectiveTo: null, ...blankEvidence() }; }
const assignment = reactive({ responsibilityEmployeeRef: '', responsibilityEffectiveFrom: '', responsibilityEffectiveTo: '' as string | null, responsibilityEvidence: blankEvidence(), attributions: roles.map((role) => newAttribution(role.value)) });
const categoryLabels: Record<string, string> = { parts: '配件', outsourced: '外协', other_direct: '其他直接成本', refund: '退款', rework: '返工' };
const declarations = ref<Declaration[]>(Object.keys(categoryLabels).map((category) => ({ category, disposition: '', amountCents: '', occurredAt: null, ...blankEvidence() })));
const isoHint = '例如 2026-09-01T00:00:00.000Z';
const session = createCaptureSession();
const approvedRecords = computed(() => snapshot.value?.records.filter((row) => row.status === 'approved') ?? []);
const selectedRecord = computed(() => snapshot.value?.records.find((row) => row.ref === recordRef.value));
const canCreate = computed(() => snapshot.value?.capabilities[family.value === 'lineage' ? 'propose' : 'draft'] === true);
function clearForm() {
  mode.value = 'records'; recordRef.value = ''; supersedes.value = ''; assignmentRef.value = ''; assignmentOptions.value = [];
  decision.value = ''; reviewAcknowledged.value = false; reviewEvidence.value = blankEvidence();
  Object.assign(lineage, { relationType: 'origin', predecessorId: 1, predecessorVersion: 1, evidence: blankEvidence() });
  Object.assign(assignment, { responsibilityEmployeeRef: '', responsibilityEffectiveFrom: '', responsibilityEffectiveTo: '', responsibilityEvidence: blankEvidence(), attributions: roles.map((role) => newAttribution(role.value)) });
  declarations.value = Object.keys(categoryLabels).map((category) => ({ category, disposition: '', amountCents: '', occurredAt: null, ...blankEvidence() }));
}
function reset() { session.reset(); hasPending.value = false; snapshot.value = null; reviewChecklist.value = null; busy.value = false; message.value = ''; clearForm(); }
// Invalidation only: mount, parent refresh and identity changes never fetch.
watch(() => [props.workOrderId, props.profileVersion, family.value, formalActorIdentityBound.value, JSON.stringify(authenticatedUserIdentity.value)], reset, { flush: 'sync' });
watch(recordRef, () => { reviewAcknowledged.value = false; decision.value = ''; reviewEvidence.value = blankEvidence(); });
onBeforeUnmount(reset);
function failure(error: unknown) {
  messageKind.value = 'error';
  // No raw transport message (URL, server SQL or submitted payload) is rendered.
  message.value = error instanceof Error && !('isAxiosError' in error) ? error.message : '资料操作未完成。请核对身份、权限及版本；如结果不明，只重试原请求或重新读取核对。';
}
async function load() {
  if (busy.value || hasPending.value || !formalActorIdentityBound.value) return;
  const generation = session.generation; const workOrderRef = `work-order:${props.workOrderId}`; const selectedFamily = family.value;
  busy.value = true; snapshot.value = null; reviewChecklist.value = null; message.value = ''; clearForm();
  try {
    const data = await readRepairAuthorityCapture(props.workOrderId, selectedFamily);
    if (generation !== session.generation) return;
    const validated = validateSnapshot(data, workOrderRef, selectedFamily);
    if (props.profileVersion !== null && validated.profileVersion !== props.profileVersion) throw new Error('工单档案版本已变化，请刷新工单后重新读取资料；旧复核清单已隐藏。');
    const checklist = validateReviewChecklist(validated);
    snapshot.value = validated;
    reviewChecklist.value = checklist;
  } catch (error) { if (generation === session.generation) failure(error); }
  finally { if (generation === session.generation) busy.value = false; }
}
async function loadAssignments() {
  if (busy.value || hasPending.value || !formalActorIdentityBound.value || family.value !== 'baseline' || !snapshot.value) return;
  const generation = session.generation; busy.value = true; assignmentOptions.value = []; assignmentRef.value = '';
  try {
    const data = validateSnapshot(await readRepairAuthorityCapture(props.workOrderId, 'assignment'), `work-order:${props.workOrderId}`, 'assignment');
    if (generation !== session.generation) return;
    if (data.profileVersion !== snapshot.value?.profileVersion) throw new Error('责任归因与当前资料档案版本不一致，请重新读取资料后核对。');
    assignmentOptions.value = data.records.filter((row) => row.status === 'approved');
    if (assignmentOptions.value.length !== 1) throw new Error('未找到唯一已通过的责任归因版本，请先完成前一阶段。');
  } catch (error) { if (generation === session.generation) failure(error); }
  finally { if (generation === session.generation) busy.value = false; }
}
async function prepare(action: CaptureAction, command: Record<string, unknown>) {
  if (busy.value || hasPending.value || !formalActorIdentityBound.value) return;
  session.prepare(action, { ...command, idempotencyKey: newIdempotencyKey(family.value) }); hasPending.value = true;
  reviewChecklist.value = null;
  await sendPending();
}
async function createDraft() {
  if (!snapshot.value) return;
  try {
    const command = family.value === 'lineage' ? lineageProposal(snapshot.value, { ...lineage, ...lineage.evidence }) : family.value === 'assignment' ? assignmentDraft(snapshot.value, { ...assignment, supersedes: supersedes.value }) : baselineDraft(snapshot.value, assignmentOptions.value.find((row) => row.ref === assignmentRef.value), { declarations: declarations.value, supersedes: supersedes.value });
    await prepare(family.value === 'lineage' ? 'lineage-propose' : `${family.value}-draft`, command);
  } catch (error) { failure(error); }
}
async function review(phase: 'approve' | 'submit' | 'decide') {
  if (!snapshot.value || !selectedRecord.value || !reviewAcknowledged.value) return;
  try { await prepare(`${family.value}-${phase}` as CaptureAction, reviewCommand(snapshot.value, selectedRecord.value, phase, reviewEvidence.value, decision.value)); }
  catch (error) { failure(error); }
}
async function sendPending() {
  const request = session.pending;
  if (!request || busy.value || !formalActorIdentityBound.value) return;
  busy.value = true; message.value = '';
  try {
    await executeRepairAuthorityCapture(request.action, request.command);
    if (request.generation !== session.generation) return;
    session.complete(request); hasPending.value = false; snapshot.value = null; clearForm();
    messageKind.value = 'success'; message.value = '本次资料阶段操作成功。请重新读取核对；未自动提交下一阶段，未产生贡献或工资。';
  } catch (error) { if (request.generation === session.generation) failure(error); }
  finally { if (request.generation === session.generation) busy.value = false; }
}
async function abandon() {
  if (busy.value) return;
  const generation = session.generation;
  try { await ElMessageBox.confirm('放弃重试不等于撤销服务器操作。原请求可能已成功；请先重新读取核对，避免重复录入。', '核对未明结果', { confirmButtonText: '重新读取核对', cancelButtonText: '保留原请求', type: 'warning' }); }
  catch { return; }
  if (generation !== session.generation) return;
  reset(); await load();
}
</script>
<style scoped>
.capture-workspace { display: grid; gap: 16px; min-width: 0; } h3, h4, p { margin: 0; } .intro, .help, .empty-note { color: #58677d; line-height: 1.7; } .toolbar { display: flex; flex-wrap: wrap; gap: 12px; } .toolbar .el-select { width: 260px; max-width: 100%; } .capture-form { display: grid; gap: 18px; max-width: 960px; } .capture-form :deep(.el-form-item) { margin-bottom: 14px; } .capture-form :deep(.el-select) { width: 100%; } fieldset { border: 1px solid #dce3ed; border-radius: 8px; padding: 16px; min-width: 0; } legend { padding: 0 8px; font-weight: 600; } .pending-box { padding: 16px; background: #fff5df; border: 1px solid #dfbd78; border-radius: 8px; } .pending-box p { margin-bottom: 12px; } .submit-button { justify-self: start; } .review-actions { display: flex; flex-wrap: wrap; gap: 10px; } .capture-workspace :deep(.el-checkbox) { white-space: normal; height: auto; align-items: flex-start; } .capture-workspace :deep(.el-checkbox__label) { white-space: normal; } @media (max-width: 600px) { .toolbar { flex-direction: column; } .toolbar .el-select { width: 100%; } fieldset { padding: 12px; } .review-actions .el-button, .submit-button { height: auto; min-height: 36px; white-space: normal; } .pending-box .el-button { margin: 6px 0; } }
</style>
