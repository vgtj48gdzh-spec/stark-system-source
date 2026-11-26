<template>
  <section class="proposal-source" aria-label="原单材料接入方案报价">
    <h3>接入已保存的方案材料</h3>
    <p>不用重新录入。先独立核实原单并审核诊断，再逐行选择已有材料编码，生成待复核方案；方案审核后再生成待复核报价。</p>
    <p class="boundary">对客单价不是采购成本。供应商仍待核实，付款状态未知；本操作不采购、不出库、不收付款、不分配工资。</p>
    <el-button :disabled="busy || !formalActorIdentityBound" @click="read">回读已保存草稿</el-button>
    <p v-if="error" role="alert">{{ error }}</p>
    <el-button v-if="pending" :disabled="busy || !formalActorIdentityBound" @click="retry">回读 / 重试同一提交</el-button>
    <template v-if="source">
      <p>原单 #{{ source.workOrderId }} · 草稿 v{{ source.proposalVersion }} · {{ source.plan }}</p>
      <div v-for="(row, index) in source.rows" :key="index" class="source-row">
        <strong>{{ index + 1 }}. {{ row.name }}</strong>
        <p>{{ row.specification || '规格待核实' }} · {{ row.quantity || '数量待补' }} {{ row.unit || '单位待补' }} · 对客单价 {{ row.unitPrice || '待补齐' }}</p>
        <template v-if="row.category === 'part'">
          <p>候选供应商：{{ row.supplierCandidate || '尚未提供' }}（不是采购/付款依据）</p>
          <el-select v-model="bindings[index]" filterable clearable :disabled="busy || !!pending || !!source.approvedPlanVersion"
            :aria-label="'第 ' + (index + 1) + ' 行已有材料'" placeholder="人工选择已有材料编码，不按名称自动绑定">
            <el-option v-for="m in source.materials" :key="m.id" :value="m.id"
              :disabled="m.unit !== row.unit" :label="m.materialNo + ' · ' + m.name + ' · ' + (m.specification || '-') + ' · ' + m.unit" />
          </el-select>
          <small>数量单位必须与材料档案一致；这不是领料或成本确认。</small>
        </template>
      </div>
      <p v-if="source.materialCatalogTruncated">仅显示前 200 项材料；找不到时请由材料管理人员核对档案，不要选择相近名称代替。</p>
      <p>对客报价合计：{{ source.quoteTotal === null ? '未齐全，不能按零生成报价' : source.quoteTotal + ' 元' }}</p>
      <p v-if="!source.diagnosisVersion">尚缺已独立审核的诊断版本。</p>
      <p v-for="d in source.imported" :key="d.id">已接入{{ d.documentType === 'repair_plan' ? '方案' : '报价' }} v{{ d.version }}，请在下方版本记录回读及复核；不会重复生成。</p>
      <label><input v-model="acknowledged" type="checkbox" :disabled="busy || !!pending" /> 我已逐行核对材料编码；本次仅提交待复核版本</label>
      <div class="actions">
        <el-button type="primary" :disabled="!canSubmit('repair_plan')" :loading="busy" @click="submit('repair_plan')">接入待复核方案</el-button>
        <el-button type="primary" :disabled="!canSubmit('quote')" :loading="busy" @click="submit('quote')">接入待复核报价</el-button>
      </div>
      <p>草稿提交人和版本录入人不能审核自己的资料。仅选择材料编码并不证明已采购、已付款或可分成。</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { createRepairDocument, getOwnerProposalDocumentSource } from '../../../api/repair-shop';
import { authenticatedUserIdentity, formalActorIdentityBound } from '../../../utils/permissions';

const props = defineProps<{ workOrderId: string; profileVersion: number }>();
const emit = defineEmits<{ (e: 'saved'): void }>();
interface Source {
  contract: string; workOrderId: number; profileVersion: number; proposalVersion: number; proposalHash: string;
  plan: string; rows: Array<{ category: string; name: string; specification: string; quantity: string; unit: string; unitPrice: string; supplierCandidate: string }>;
  materials: Array<{ id: number; materialNo: string; name: string; specification: string | null; unit: string }>;
  materialCatalogTruncated: boolean; quoteTotal: string | null; diagnosisVersion: number | null; approvedPlanVersion: number | null;
  approvedMaterialBindings: Array<{ row: number; materialId: number }> | null;
  imported: Array<{ id: number; documentType: string; version: number; status: string }>;
  verificationStatus: string; financialEffect: boolean; wagesAvailable: boolean; actualCost: null;
  supplierAuthority: string; paymentStatus: string;
}
type Command = Parameters<typeof createRepairDocument>[1];
const source = ref<Source | null>(null), bindings = ref<Record<number, number | undefined>>({});
const acknowledged = ref(false), busy = ref(false), error = ref('');
const pending = ref<{ id: string; command: Command } | null>(null);
let epoch = 0, disposed = false;
const identity = computed(() => JSON.stringify(authenticatedUserIdentity.value));
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
function valid(value: Source, id: string) {
  if (!value || value.contract !== 'repair_owner_proposal_document_v1' || String(value.workOrderId) !== id
    || !integer(value.profileVersion) || !integer(value.proposalVersion) || !/^[a-f0-9]{64}$/.test(value.proposalHash)
    || value.financialEffect !== false || value.wagesAvailable !== false || value.verificationStatus !== 'pending'
    || value.actualCost !== null || value.supplierAuthority !== 'unverified' || value.paymentStatus !== 'unknown'
    || typeof value.plan !== 'string' || !Array.isArray(value.rows) || !value.rows.length || value.rows.length > 20
    || !value.rows.every(r => r && ['part', 'labor', 'other'].includes(r.category)
      && ['name', 'specification', 'quantity', 'unit', 'unitPrice', 'supplierCandidate'].every(k => typeof (r as any)[k] === 'string'))
    || !Array.isArray(value.materials) || !value.materials.every(m => integer(m.id) && typeof m.materialNo === 'string' && typeof m.name === 'string' && typeof m.unit === 'string')
    || new Set(value.materials.map(m => m.id)).size !== value.materials.length
    || !Array.isArray(value.imported) || !value.imported.every(d => integer(d.id) && integer(d.version) && ['repair_plan', 'quote'].includes(d.documentType))
    || ![value.diagnosisVersion, value.approvedPlanVersion].every(v => v === null || integer(v))
    || !(value.quoteTotal === null || (typeof value.quoteTotal === 'string' && /^\d+\.\d{2}$/.test(value.quoteTotal)))
    || !(value.approvedMaterialBindings === null || (Array.isArray(value.approvedMaterialBindings)
      && value.approvedMaterialBindings.every(b => Number.isInteger(b.row) && b.row >= 0 && b.row < value.rows.length && integer(b.materialId))))) throw Error('invalid source');
  return value;
}
function reset() { epoch++; source.value = null; bindings.value = {}; acknowledged.value = false; error.value = ''; pending.value = null; busy.value = false; }
watch([() => props.workOrderId, identity, formalActorIdentityBound], reset, { flush: 'sync' });
watch(() => props.profileVersion, () => { epoch++; source.value = null; acknowledged.value = false; busy.value = false; }, { flush: 'sync' });
onBeforeUnmount(() => { disposed = true; reset(); });
const current = (e: number, id: string) => !disposed && e === epoch && id === props.workOrderId && formalActorIdentityBound.value;
async function read() {
  if (busy.value || !formalActorIdentityBound.value) return;
  const e = ++epoch, id = props.workOrderId; busy.value = true; source.value = null; error.value = ''; acknowledged.value = false;
  try {
    const result = await getOwnerProposalDocumentSource(id);
    if (!current(e, id)) return;
    const value = valid(result.data.data, id);
    source.value = value;
    bindings.value = Object.fromEntries((value.approvedMaterialBindings ?? []).map(b => [b.row, b.materialId]));
  } catch { if (current(e, id)) error.value = '暂不能回读可接入草稿。请核对原单接入、当前权限及资料版本；不会自动新建工单。'; }
  finally { if (current(e, id)) busy.value = false; }
}
function canSubmit(type: 'repair_plan' | 'quote') {
  const s = source.value;
  return !!s && formalActorIdentityBound.value && !busy.value && !pending.value && acknowledged.value
    && s.profileVersion === props.profileVersion && !s.imported.some(d => d.documentType === type)
    && s.rows.every((r,i) => r.category !== 'part' || s.materials.some(m => m.id === bindings.value[i] && m.unit === r.unit) && !!r.quantity)
    && (type === 'repair_plan' ? !!s.diagnosisVersion : !!s.approvedPlanVersion && s.quoteTotal !== null);
}
async function submit(type: 'repair_plan' | 'quote') {
  if (!canSubmit(type)) return;
  const s = source.value!;
  pending.value = { id: props.workOrderId, command: { documentType: type, expectedProfileVersion: s.profileVersion,
    summary: '原单方案材料接入（待复核）', payload: {}, generatedBy: 'human', ownerProposalSource: {
      requestId: crypto.randomUUID(), proposalVersion: s.proposalVersion, proposalHash: s.proposalHash,
      materialBindings: s.rows.flatMap((r,row) => r.category === 'part' ? [{ row, materialId: bindings.value[row]! }] : []),
    } } };
  await retry();
}
async function retry() {
  if (!pending.value || busy.value || !formalActorIdentityBound.value) return;
  const p = JSON.parse(JSON.stringify(pending.value)) as NonNullable<typeof pending.value>;
  const e = ++epoch; busy.value = true; error.value = '';
  try {
    const result = (await createRepairDocument(p.id, p.command)).data.data;
    if (!current(e, p.id)) return;
    if (!integer(result?.document?.id) || result.document.workOrderId !== Number(p.id)
      || result.document.documentType !== p.command.documentType
      || result.document.sourceReferences?.[0]?.contract !== 'repair_owner_proposal_document_v1'
      || result.document.sourceReferences[0].input?.requestId !== p.command.ownerProposalSource!.requestId) throw Error('unconfirmed');
    pending.value = null; source.value = null; acknowledged.value = false; emit('saved');
  } catch { if (current(e, p.id)) error.value = '提交结果尚未确认。保留同一请求，先回读或重试；不要新建工单或重复生成版本。'; }
  finally { if (current(e, p.id)) busy.value = false; }
}
</script>

<style scoped>
.proposal-source{border:1px solid #cbd5e1;border-radius:10px;padding:16px;margin-bottom:20px;overflow-wrap:anywhere}
.proposal-source h3{margin-top:0}.boundary{color:#8b4c0b;background:#fff7ed;padding:12px;border-radius:6px}
.source-row{border-top:1px solid #e2e8f0;padding:12px 0}.source-row :deep(.el-select){width:100%}
small{display:block;color:#64748b;margin-top:8px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.actions :deep(.el-button){margin-left:0;white-space:normal;height:auto;min-height:36px}
[role=alert]{color:#b42318}@media(max-width:600px){.proposal-source{padding:12px}.actions{flex-direction:column}.actions :deep(.el-button){width:100%}}
</style>
