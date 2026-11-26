<template>
  <section class="quote-rehearsal" aria-labelledby="rehearsal-title">
    <h3 id="rehearsal-title">原单方案与材料 · 待核实草稿</h3>
    <p class="boundary">可保存到这张原工单，刷新后回读。不送审、不发送给客户；不是施工、采购、付款、分配或工资依据。</p>
    <p class="muted">只有确认保存并回查的版本会保留；未保存输入离开后清空。请勿填写手机号、证件或 VIN；未知数量、价格留空，不按零计算。</p>
    <p v-if="loaded">已存草稿版本：{{ state?.revision || '尚无' }} · {{ state?.editable ? '可填写待核实资料' : '暂不可保存：请先核对接车、关系资料或冻结状态' }}</p>
    <p v-if="state?.draft && !state.draft.sourceCurrent" class="boundary">原接车或关系资料已变化。下方是历史草稿，不能当作当前已核实资料；请重新核对后再保存新版本。</p>
    <el-form label-position="top" :disabled="locked">
      <el-form-item label="拟定维修 / 保养方案">
        <el-input v-model="form.plan" type="textarea" :rows="3" :maxlength="1000"
          placeholder="填写待核对的项目和处理方式；此处不代表已经诊断或完成维修" />
      </el-form-item>
      <el-form-item label="风险、排除项或备选方案（可选）">
        <el-input v-model="form.notes" type="textarea" :rows="2" :maxlength="1000" placeholder="尚需检查或与客户沟通的事项" />
      </el-form-item>
      <div v-for="(row, index) in form.rows" :key="row.key" class="quote-line">
        <div class="line-heading"><strong>报价项目 {{ index + 1 }}</strong>
          <el-button :disabled="locked || form.rows.length <= 1" @click="removeRow(row.key)">移除这一项</el-button>
        </div>
        <div class="field-grid">
          <el-form-item :label="'项目 ' + (index + 1) + ' · 类型'">
            <el-select v-model="row.category">
              <el-option label="材料" value="part" /><el-option label="工时收费" value="labor" /><el-option label="其他收费" value="other" />
            </el-select>
          </el-form-item>
          <el-form-item :label="'项目 ' + (index + 1) + ' · 名称'">
            <el-input v-model="row.name" :maxlength="120" placeholder="材料或服务名称" />
          </el-form-item>
          <el-form-item :label="'项目 ' + (index + 1) + ' · 规格 / 品牌（可选）'">
            <el-input v-model="row.specification" :maxlength="200" placeholder="未知可留空" />
          </el-form-item>
          <el-form-item :label="'项目 ' + (index + 1) + ' · 单位'">
            <el-input v-model="row.unit" :maxlength="20" placeholder="例如件、升或小时" />
          </el-form-item>
          <el-form-item :label="'项目 ' + (index + 1) + ' · 数量'">
            <el-input v-model="row.quantity" inputmode="decimal" :maxlength="9" placeholder="待确认，最多两位小数" />
          </el-form-item>
          <el-form-item :label="'项目 ' + (index + 1) + ' · 对客单价（元）'">
            <el-input v-model="row.unitPrice" inputmode="decimal" :maxlength="9" placeholder="未询价留空，不是采购成本或工资费率" />
          </el-form-item>
          <el-form-item v-if="row.category === 'part'" :label="'项目 ' + (index + 1) + ' · 供应商候选（可选）'">
            <el-input v-model="row.supplierCandidate" :maxlength="120" placeholder="仅记录待核实名称，不建立应付或付款关系" />
          </el-form-item>
          <el-form-item v-if="row.category === 'part'" :label="'项目 ' + (index + 1) + ' · 预计来源（待核实）'">
            <el-select v-model="row.sourceHint"><el-option label="未知 / 待补" value="unknown" />
              <el-option label="预计采购" value="pending_purchase" /><el-option label="拟用库存" value="existing_stock" />
              <el-option label="客户自带声明" value="customer_supplied" /></el-select>
          </el-form-item>
        </div>
        <p class="muted">实际成本：待补证据 · 付款状态：未知 · 不可付款或分配；工时收费不等于员工工资。</p>
      </div>
      <p class="muted">金额按每行“数量 × 对客单价”四舍五入到分后合计；不计算采购成本、利润、税额或员工工资。</p>
      <div class="buttons">
        <el-button :disabled="locked || form.rows.length >= 20" @click="addRow">添加报价项目（最多 20 项）</el-button>
        <el-button type="primary" :disabled="locked" @click="makePreview">预览待保存草稿</el-button>
        <el-button :disabled="locked" @click="clear">清空未保存输入</el-button>
      </div>
    <el-checkbox v-model="form.acknowledged">我确认仅保存待核实草稿，不确认报价、采购、成本、付款或工资</el-checkbox>
    </el-form>
    <div class="buttons">
      <el-button :disabled="busy || blocked" @click="refresh">回读原单已存草稿</el-button>
      <el-button v-if="pending" type="warning" :disabled="busy || blocked || !loaded" @click="submit">
        {{ acknowledged ? '回查已收到回执的结果' : '重试同一提交（不新建请求）' }}
      </el-button>
    </div>
    <el-alert v-if="notice" :title="notice" :type="noticeType" :closable="false" />
    <el-alert v-if="error" :title="error" type="warning" :closable="false" />
    <section v-if="preview" class="preview" aria-live="polite">
      <h3>待保存预览 · 尚未提交</h3>
      <p>对应当前工单 #{{ workOrderId }}，不是正式报价版本；保存仍是待核实资料。</p>
      <p><strong>拟定方案：</strong>{{ preview.plan }}</p>
      <p v-if="preview.notes"><strong>待核对事项：</strong>{{ preview.notes }}</p>
      <ul>
        <li v-for="(row, index) in preview.rows" :key="index">
          {{ categoryLabel(row.category) }} · {{ row.name }}{{ row.specification ? ' / ' + row.specification : '' }}：
          {{ row.quantity || '未知数量' }} {{ row.unit }} × {{ row.unitPrice ? '¥' + row.unitPrice : '待询价' }} = {{ preview.amounts[index] === null ? '未完整' : '¥' + preview.amounts[index] }}
          <span v-if="row.category === 'part'">；供应商候选：{{ row.supplierCandidate || '待补' }}；预计来源：{{ sourceLabel(row.sourceHint) }}（均待核实）</span>
        </li>
      </ul>
      <strong class="total">对客报价草稿合计：{{ preview.total === null ? '待补齐数量 / 单位 / 单价' : '¥' + preview.total }}</strong>
      <p>正式报价仍须完成独立核实，沿用原单报价版本及审核流程。你本人保存不等于可以核实自己的资料。</p>
      <el-button type="primary" :disabled="busy || blocked || !loaded || !state?.editable" @click="confirmSave">确认保存待核实草稿</el-button>
      <el-button :disabled="busy" @click="preview = null">返回修改</el-button>
      <p>供应商、采购/领料来源均为候选声明，不是已付款或未付款凭据。</p>
    </section>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import http from '../../../api/http';
import { isAxiosError } from 'axios';
// Existing original-order form, now persisted only as owner_intake_proposal.
// Never call formal document/approval/procurement/payroll endpoints.
const props = defineProps<{ workOrderId: string; blocked?: boolean }>();
type Category = 'part' | 'labor' | 'other';
type SourceHint = 'unknown' | 'pending_purchase' | 'existing_stock' | 'customer_supplied';
interface Row { category: Category; name: string; specification: string; unit: string; quantity: string; unitPrice: string;
  supplierCandidate: string; sourceHint: SourceHint }
interface Content { plan: string; notes: string; rows: Row[] }
interface Submission extends Content { requestId: string; expectedIntakeRevision: number; expectedAssociationRevision: number;
  expectedDraftRevision: number; pendingDeclarationAcknowledged: true }
interface Draft extends Content { revision: number; requestId: string; intakeRevision: number; associationRevision: number;
  sourceCurrent: boolean; quoteTotal: string | null; lineAmounts: Array<string | null>; actualCost: null;
  supplierAuthority: 'unverified'; paymentStatus: 'unknown'; allocationStatus: 'unavailable' }
interface Result { contract: string; workOrderId: number; captureOnly: true; financialEffect: false; wagesAvailable: false;
  verificationStatus: 'pending'; source: { intakeRevision: number; associationRevision: number; ready: boolean };
  revision: number; editable: boolean; frozen: boolean; draft: Draft | null;
  appliedRequestId?: string; appliedRevision?: number; replayed?: boolean }
const state = ref<Result | null>(null), loaded = ref(false), busy = ref(false);
const pending = ref<Submission | null>(null), acknowledged = ref(false);
const preview = ref<(Submission & { total: string | null; amounts: Array<string | null> }) | null>(null);
const notice = ref(''), noticeType = ref<'info' | 'success' | 'warning'>('info'), error = ref('');
let nextKey = 1, epoch = 0, disposed = false;
const blankRow = () => ({ key: nextKey++, category: 'part' as Category, name: '', specification: '', unit: '', quantity: '', unitPrice: '',
  supplierCandidate: '', sourceHint: 'unknown' as SourceHint });
const form = reactive({ plan: '', notes: '', rows: [blankRow()], acknowledged: false });
const locked = computed(() => !!props.blocked || busy.value || !!pending.value || !loaded.value || !state.value?.editable);
const categoryLabel = (c: Category) => ({ part: '材料', labor: '工时收费', other: '其他收费' })[c];
const sourceLabel = (s: SourceHint) => ({ unknown: '未知 / 待补', pending_purchase: '预计采购', existing_stock: '拟用库存', customer_supplied: '客户自带声明' })[s];
const url = (id: string) => '/work-orders/intake-drafts/' + id + '/proposal-draft';
const silent = { headers: { 'x-suppress-global-error': '1' } };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const validRevision = (n: unknown, min = 0): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= 2147483647;
const uuid = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
function safeText(s: unknown, max: number, required = false): string {
  if (typeof s !== 'string' || s.length > max || (required && !s.trim())
    || /[\u0000-\u0008\u000b-\u001f\u007f]|1[3-9]\d{9}|\b[A-HJ-NPR-Z0-9]{17}\b|\d{16,}|(?:password|secret|token)\s*[:=]|PRIVATE KEY/i.test(s)) throw Error('text');
  return s.trim();
}
const money = (n: bigint) => (n / 100n) + '.' + String(n % 100n).padStart(2, '0');
function decimal(s: unknown, positive: boolean): string {
  if (typeof s !== 'string') throw Error('decimal');
  s = s.trim(); if (s === '') return '';
  if (!/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(s as string)) throw Error('decimal');
  const [w, f = ''] = (s as string).split('.');
  const n = BigInt(w) * 100n + BigInt(f.padEnd(2, '0'));
  if (positive && n === 0n) throw Error('quantity');
  return money(n);
}
function content(value: Content): Content {
  if (!Array.isArray(value?.rows) || value.rows.length < 1 || value.rows.length > 20) throw Error('rows');
  return { plan: safeText(value.plan, 1000, true), notes: safeText(value.notes, 1000), rows: value.rows.map(row => {
    if (!row || !['part', 'labor', 'other'].includes(row.category)
      || !['unknown', 'pending_purchase', 'existing_stock', 'customer_supplied'].includes(row.sourceHint)) throw Error('category');
    return { category: row.category, name: safeText(row.name, 120, true), specification: safeText(row.specification, 200),
      unit: safeText(row.unit, 20), quantity: decimal(row.quantity, true), unitPrice: decimal(row.unitPrice, false),
      supplierCandidate: row.category === 'part' ? safeText(row.supplierCandidate, 120) : '',
      sourceHint: row.category === 'part' ? row.sourceHint : 'unknown' };
  }) };
}
function totals(data: Content) {
  let sum = 0n, complete = true;
  const amounts = data.rows.map(row => {
    if (!row.quantity || !row.unitPrice || !row.unit) { complete = false; return null; }
    const n = (BigInt(row.quantity.replace('.', '')) * BigInt(row.unitPrice.replace('.', '')) + 50n) / 100n;
    sum += n; if (sum > 9999999999n) throw Error('total'); return money(n);
  });
  return { total: complete ? money(sum) : null, amounts };
}
function validate(value: Result, id: string) {
  if (!value || value.contract !== 'owner_intake_proposal_draft_v1' || String(value.workOrderId) !== id
    || value.captureOnly !== true || value.financialEffect !== false || value.wagesAvailable !== false || value.verificationStatus !== 'pending'
    || !validRevision(value.revision) || !validRevision(value.source?.intakeRevision) || !validRevision(value.source?.associationRevision)
    || typeof value.source.ready !== 'boolean' || typeof value.editable !== 'boolean' || typeof value.frozen !== 'boolean'
    || value.editable !== (value.source.ready && !value.frozen)
    || (value.draft === null ? value.revision !== 0 : !value.draft)) throw Error('invalid response');
  if (value.draft) {
    const d = value.draft, normalized = content(d), sum = totals(normalized);
    if (d.revision !== value.revision || !validRevision(d.revision, 1) || !uuid(d.requestId)
      || !validRevision(d.intakeRevision, 1) || !validRevision(d.associationRevision, 1) || typeof d.sourceCurrent !== 'boolean'
      || d.actualCost !== null || d.paymentStatus !== 'unknown' || d.supplierAuthority !== 'unverified' || d.allocationStatus !== 'unavailable'
      || d.quoteTotal !== sum.total || JSON.stringify(d.lineAmounts) !== JSON.stringify(sum.amounts)) throw Error('invalid draft');
  }
  return value;
}
function resetForm() { form.plan = ''; form.notes = ''; form.rows = [blankRow()]; form.acknowledged = false; preview.value = null; error.value = ''; }
function hydrate(d: Draft | null) {
  resetForm();
  if (d) { form.plan = d.plan; form.notes = d.notes; form.rows = d.rows.map(row => ({ ...clone(row), key: nextKey++ })); }
}
function invalidate() { preview.value = null; error.value = ''; }
watch(form, invalidate, { deep: true, flush: 'sync' });
function addRow() { if (!disposed && !locked.value && form.rows.length < 20) form.rows.push(blankRow()); }
function removeRow(key: number) { if (!disposed && !locked.value && form.rows.length > 1) form.rows = form.rows.filter(r => r.key !== key); }
function clear() { if (!disposed && !locked.value) resetForm(); }
async function readBack(id: string, e: number) {
  const response = await http.get(url(id), silent);
  if (disposed || e !== epoch) return;
  const result = validate(response.data.data, id), attempted = pending.value;
  state.value = result; loaded.value = true;
  if (attempted) {
    if (result.draft?.requestId === attempted.requestId && result.revision === attempted.expectedDraftRevision + 1
      && JSON.stringify(content(result.draft)) === JSON.stringify(content(attempted))) {
      pending.value = null; acknowledged.value = false; hydrate(result.draft);
      notice.value = '待核实草稿已保存并独立回查。仍未形成实际成本、付款、分配或工资。'; noticeType.value = 'success'; return;
    }
    if (result.revision <= attempted.expectedDraftRevision) {
      notice.value = '回查尚未找到本次提交，结果仍待确认；可重试同一提交，不会另建请求。'; noticeType.value = 'warning'; return;
    }
    pending.value = null; acknowledged.value = false; hydrate(result.draft);
    notice.value = '原单已有不同的新版本，已回读当前草稿；请核对，不会自动覆盖。'; noticeType.value = 'warning'; return;
  }
  hydrate(result.draft);
  notice.value = result.draft ? '已回读原单待核实草稿。金额为对客报价，不是材料成本或已付款证明。'
    : '本单还没有已存方案草稿。可先填写已知资料，未知价格和来源留空。';
  noticeType.value = 'info';
}
async function refresh() {
  if (disposed || busy.value || props.blocked || !/^[1-9]\d{0,9}$/.test(props.workOrderId) || Number(props.workOrderId) > 2147483647) return;
  const e = epoch; busy.value = true;
  try { await readBack(props.workOrderId, e); }
  catch {
    if (disposed || e !== epoch) return;
    loaded.value = false; state.value = null; preview.value = null;
    notice.value = pending.value ? '暂不能回读；之前提交的结果仍待核对。本次回读没有新增保存请求，请勿另建提交。'
      : '暂不能回读可保存草稿，请核对登录、权限或当前入口版本；未发出保存请求。'; noticeType.value = 'warning';
  } finally { if (e === epoch) busy.value = false; }
}
function makePreview() {
  invalidate();
  if (disposed || locked.value || !state.value || !form.acknowledged) { error.value = '请先回读原单并确认仅保存待核实草稿。'; return; }
  try {
    const data = content(form);
    preview.value = { requestId: crypto.randomUUID(), expectedIntakeRevision: state.value.source.intakeRevision,
      expectedAssociationRevision: state.value.source.associationRevision, expectedDraftRevision: state.value.revision,
      ...data, pendingDeclarationAcknowledged: true, ...totals(data) };
  } catch { error.value = '请填写方案和每项名称，数量须为正数、单价非负且最多两位小数；未知可留空。不要填写电话、证件或秘密。'; }
}
async function confirmSave() {
  if (disposed || busy.value || props.blocked || !loaded.value || !state.value?.editable || !preview.value || pending.value) return;
  const { total, amounts, ...submission } = preview.value;
  pending.value = clone(submission); preview.value = null; await submit();
}
async function submit() {
  if (disposed || busy.value || props.blocked || !pending.value || !loaded.value) return;
  const e = epoch, id = props.workOrderId; busy.value = true;
  try {
    if (!acknowledged.value) {
      const response = await http.post(url(id), clone(pending.value), silent);
      if (disposed || e !== epoch) return;
      const result = validate(response.data.data, id);
      if (result.appliedRequestId !== pending.value.requestId || result.appliedRevision !== pending.value.expectedDraftRevision + 1
        || typeof result.replayed !== 'boolean') throw Error('receipt mismatch');
      acknowledged.value = true;
    }
    await readBack(id, e);
  } catch (cause) {
    if (disposed || e !== epoch) return;
    noticeType.value = 'warning';
    const code = isAxiosError(cause) ? cause.response?.status : null;
    if (!acknowledged.value && [400, 401, 403, 404, 409].includes(code ?? 0)) {
      pending.value = null; loaded.value = false; state.value = null; preview.value = null;
      notice.value = '保存被拒绝或原单已变化。请先回读核对，不自动覆盖、不另建工单。';
    } else notice.value = acknowledged.value ? '已收到保存回执，但回查尚未完成；重试只回查，不再次提交。'
      : '保存结果尚未确认，提交内容已锁定。请重试同一提交或回读，不要重复新建。';
  } finally { if (e === epoch) busy.value = false; }
}
watch(() => [props.workOrderId, props.blocked], () => {
  epoch++; busy.value = false; loaded.value = false; state.value = null; pending.value = null; acknowledged.value = false;
  resetForm(); notice.value = ''; void refresh();
}, { immediate: true, flush: 'sync' });
onBeforeUnmount(() => { disposed = true; epoch++; pending.value = null; state.value = null; resetForm(); });
</script>
<style scoped>
.quote-rehearsal { border: 1px solid #cddfeb; border-radius: 8px; padding: 16px; margin-bottom: 20px; min-width: 0; }
.quote-rehearsal h3 { margin: 0 0 12px; }
.quote-rehearsal p, .quote-rehearsal li { line-height: 1.7; overflow-wrap: anywhere; white-space: pre-wrap; }
.boundary { color: #8a531b; }.muted { color: #617083; font-size: 13px; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
.quote-line { padding: 12px; border: 1px solid #dfe7ef; border-radius: 8px; margin-bottom: 12px; }
.line-heading, .buttons { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
.line-heading { justify-content: space-between; }
.quote-rehearsal :deep(.el-select) { width: 100%; }
.quote-rehearsal :deep(.el-checkbox) { width: 100%; height: auto; align-items: flex-start; margin: 0 0 12px; }
.quote-rehearsal :deep(.el-checkbox__input) { margin-top: 4px; }
.quote-rehearsal :deep(.el-checkbox__label) { white-space: normal; overflow-wrap: anywhere; line-height: 1.6; }
.quote-rehearsal :deep(.el-button) { white-space: normal; height: auto; min-height: 40px; line-height: 1.5; margin-left: 0; max-width: 100%; }
.preview { border: 1px solid #b9d5c9; border-radius: 8px; padding: 14px; margin-top: 16px; background: #f3faf6; }
.total { font-size: 18px; overflow-wrap: anywhere; }
@media (max-width: 600px) { .field-grid { grid-template-columns: 1fr; } .buttons > * { width: 100%; } }
</style>
