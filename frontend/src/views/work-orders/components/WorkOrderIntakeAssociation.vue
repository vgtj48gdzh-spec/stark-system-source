<template>
  <section class="association">
    <h2>客户与车辆关系 · 待核实采集</h2>
    <p>首次来店也可填写，不需要历史消费记录。只保存到这张接车单，不重复开单。</p>
    <el-alert title="你可以独自录入并检查保存结果；这不是独立复核，不会建立已核实客户档案、批准报价或生成工资。"
      type="info" :closable="false" />
    <p>关联车辆沿用原单已保存的 VIN 和车牌，联系电话沿用原单的 {{ order.customerMobile }}。</p>
    <p v-if="draft">已采集 · 关联资料版本 {{ draft.revision }} · {{ draft.sourceCurrent ? '对应当前车辆资料' : '原单资料已变化，请核对后重新保存' }} · 待核实</p>
    <el-alert v-if="notice" :title="notice" :type="noticeType" :closable="false" class="gap" />
    <p v-if="!order.details?.vin">请先在上方保存实际 VIN，再填写客户与车辆关系。</p>
    <p v-if="order.intakeEditsFrozen">原单资料已独立核实或已进入报价前档案，当前资料不能在这里覆盖。</p>
    <el-form label-position="top" :disabled="busy || !loaded || Boolean(preview) || Boolean(pending) || conflict || !sourceReady || order.intakeEditsFrozen">
      <el-form-item label="客户姓名或称呼（按本人提供，仍待核实）">
        <el-input v-model="form.customerName" maxlength="100" autocomplete="off" placeholder="请勿在此填写电话、证件号或猜测姓名" />
      </el-form-item>
      <el-form-item label="客户与这辆车的关系（声明，不是核实结论）">
        <el-select v-model="form.relationshipType" placeholder="请选择实际关系">
          <el-option value="owner" label="车主" /><el-option value="user" label="车辆使用人" /><el-option value="contact" label="送修联系人" />
        </el-select>
      </el-form-item>
      <el-checkbox v-model="form.acknowledged">我确认这是待核实的资料声明，不代表已完成独立复核</el-checkbox>
    </el-form>
    <div class="actions">
      <section v-if="preview" class="preview" aria-label="关系声明保存前预览" aria-live="polite">
        <h3>关系声明预览 · 仍待核实</h3>
        <p>原工单 {{ order.id }} · 车辆资料版本 {{ preview.expectedIntakeRevision }} · 关联资料版本 {{ preview.expectedDraftRevision }}</p>
        <p>姓名或称呼：{{ preview.customerName }}；声明关系：{{ relationshipLabels[preview.relationshipType] }}</p>
        <p>这不是独立复核，不建立正式客户档案、不批准报价或计算工资。</p>
        <el-button type="primary" :disabled="busy || !loaded || conflict || !sourceReady || order.intakeEditsFrozen" @click="confirmSave">确认保存这份待核实声明</el-button>
        <el-button :disabled="busy" @click="preview = null">返回修改</el-button>
      </section>
      <el-button v-else type="primary" :loading="busy" :disabled="!loaded || conflict || !sourceReady || order.intakeEditsFrozen" @click="save">{{ saveLabel }}</el-button>
      <el-button :disabled="busy" @click="refresh">{{ pending || conflict ? '回查当前资料（放弃未保存修改）' : '回查已采集资料' }}</el-button>
    </div>
    <p class="hint">保存后会另行读取原单关联资料确认结果。下一步仍是正式身份与车辆关联核实；不会伪造历史客户绑定。</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { isAxiosError } from 'axios';
import http from '../../../api/http';
import type { IntakeSaved } from './work-order-intake.types';

type Relationship = 'owner' | 'user' | 'contact';
type Draft = { id: number; revision: number; intakeRevision: number; customerName: string; customerMobile: string;
  relationshipType: Relationship; sourceCurrent: boolean };
type Result = { workOrderId: number; captureOnly: true; state: 'manual_pending'; source: 'owner_statement';
  customerRef: null; vehicleId: null; independentReviewPerformed: false; financialEffect: false; wagesAvailable: false; draft: Draft | null };
type Submission = { requestId: string; expectedIntakeRevision: number; expectedDraftRevision: number;
  customerName: string; relationshipType: Relationship; pendingDeclarationAcknowledged: true };
const props = defineProps<{ order: IntakeSaved }>();
const form = reactive({ customerName: '', relationshipType: '' as Relationship | '', acknowledged: false });
const draft = ref<Draft | null>(null);
const pending = ref<Submission | null>(null);
const preview = ref<Submission | null>(null);
const relationshipLabels = { owner: '车主', user: '车辆使用人', contact: '送修联系人' };
const busy = ref(false); const loaded = ref(false); const conflict = ref(false); const acknowledged = ref(false);
const notice = ref(''); const noticeType = ref<'info' | 'success' | 'warning'>('info');
const sourceReady = computed(() => Boolean(props.order.details?.vin && props.order.details.revision > 0));
const saveLabel = computed(() => acknowledged.value ? '重新读取保存结果' : pending.value ? '重试同一资料提交' : '预览关系声明（尚不保存）');
const silent = { headers: { 'x-suppress-global-error': '1' } };
let epoch = 0; let disposed = false;
const url = (id: number) => `/work-orders/intake-drafts/${id}/association-draft`;
function valid(result: Result, id: number) {
  const d = result?.draft;
  if (result?.workOrderId !== id || result.captureOnly !== true || result.state !== 'manual_pending'
    || result.source !== 'owner_statement' || result.customerRef !== null || result.vehicleId !== null
    || result.independentReviewPerformed !== false || result.financialEffect !== false || result.wagesAvailable !== false
    || !(d === null || (d && [d.id, d.revision, d.intakeRevision].every(n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647)
      && typeof d.customerName === 'string' && d.customerName.length > 0 && d.customerName.length <= 100
      && typeof d.customerMobile === 'string' && /^1[3-9]\d\*{4}\d{4}$/.test(d.customerMobile)
      && ['owner', 'user', 'contact'].includes(d.relationshipType) && typeof d.sourceCurrent === 'boolean'))) {
    throw new Error('invalid pending capture response');
  }
  return result;
}
async function readBack(id: number, current: number, afterSave: boolean) {
  const response = await http.get(url(id), silent);
  if (disposed || current !== epoch) return;
  const result = valid(response.data.data, id); const attempted = pending.value;
  if (afterSave && attempted && (!result.draft || result.draft.revision <= attempted.expectedDraftRevision)) throw new Error('stale readback');
  const same = afterSave && attempted && result.draft?.revision === attempted.expectedDraftRevision + 1
    && result.draft.intakeRevision === attempted.expectedIntakeRevision && result.draft.customerName === attempted.customerName
    && result.draft.relationshipType === attempted.relationshipType && result.draft.sourceCurrent;
  draft.value = result.draft; loaded.value = true; pending.value = null; preview.value = null; acknowledged.value = false; conflict.value = false;
  Object.assign(form, { customerName: result.draft?.customerName ?? '', relationshipType: result.draft?.relationshipType ?? '', acknowledged: false });
  notice.value = same ? '关系声明已保存并回查，仍待核实；未建立正式客户或车辆档案。'
    : result.draft ? '已读取原单当前关系声明，请核对；仍待核实。' : '本单尚未采集客户与车辆关系，可由你本人先填写。';
  noticeType.value = same ? 'success' : 'info';
}
async function refresh() {
  if (disposed || busy.value) return;
  const current = epoch; busy.value = true;
  try { await readBack(props.order.id, current, false); }
  catch (cause) {
    if (disposed || current !== epoch) return;
    // A failed requery cannot leave stale authority available for a new write.
    loaded.value = false; noticeType.value = 'warning';
    notice.value = isAxiosError(cause) && cause.response?.status === 404 ? '当前入口暂不可用：版本尚未提供，或原单已不可访问。接车资料不会因此丢失。'
      : '暂不能回查关系声明，请检查登录或门店权限；没有发出写入请求。';
  } finally { if (current === epoch) busy.value = false; }
}
async function save() {
  if (disposed || busy.value || preview.value || !loaded.value || conflict.value || !sourceReady.value || props.order.intakeEditsFrozen) return;
  const current = epoch; const id = props.order.id; busy.value = true;
  try {
    if (!pending.value) {
      const name = form.customerName.trim();
      if (!name || name.length > 100 || /[\r\n\t\u0000-\u001f]|\d{7,}/.test(name)
        || !['owner', 'user', 'contact'].includes(form.relationshipType) || form.acknowledged !== true) {
        notice.value = '请填写实际姓名或称呼、选择关系并确认待核实声明；不要填写电话或证件号码。'; noticeType.value = 'warning'; return;
      }
      preview.value = { requestId: crypto.randomUUID(), expectedIntakeRevision: props.order.details!.revision,
        expectedDraftRevision: draft.value?.revision ?? 0, customerName: name,
        relationshipType: form.relationshipType as Relationship, pendingDeclarationAcknowledged: true };
      notice.value = '请核对关系声明预览后确认。当前尚未发送保存请求。'; noticeType.value = 'info';
      return;
    }
    if (!acknowledged.value) {
      const response = await http.post(url(id), pending.value, silent);
      if (disposed || current !== epoch) return;
      const receipt = valid(response.data.data, id);
      if (receipt.draft?.revision !== pending.value.expectedDraftRevision + 1) throw new Error('invalid pending receipt');
      acknowledged.value = true;
    }
    await readBack(id, current, true);
  } catch (cause) {
    if (disposed || current !== epoch) return;
    noticeType.value = 'warning';
    if (!acknowledged.value && isAxiosError(cause) && cause.response?.status === 400) {
      pending.value = null; notice.value = '资料未通过校验，请核对姓名、关系与声明；没有完成保存。';
    } else if (!acknowledged.value && isAxiosError(cause) && cause.response?.status === 409) {
      conflict.value = true; notice.value = '原单或关联资料版本已变化。请回查最新资料后核对；不会自动覆盖。';
    } else {
      notice.value = acknowledged.value ? '已收到保存回执，但回查尚未完成；重试只读取结果，不再次提交。'
        : '保存结果尚未确认，提交内容已锁定；请重试同一提交或回查原单，不要另开工单。';
    }
  } finally { if (current === epoch) busy.value = false; }
}
async function confirmSave() {
  if (disposed || busy.value || !preview.value || pending.value || !loaded.value || conflict.value || !sourceReady.value
    || props.order.intakeEditsFrozen || preview.value.expectedIntakeRevision !== props.order.details?.revision) return;
  pending.value = { ...preview.value }; preview.value = null;
  await save();
}

watch(() => props.order, () => {
  epoch++; busy.value = false; loaded.value = false; conflict.value = false; acknowledged.value = false; pending.value = null; preview.value = null; draft.value = null;
  Object.assign(form, { customerName: '', relationshipType: '', acknowledged: false }); notice.value = '';
  void refresh();
}, { immediate: true });
onBeforeUnmount(() => { disposed = true; epoch++; draft.value = null; pending.value = null; preview.value = null;
  Object.assign(form, { customerName: '', relationshipType: '', acknowledged: false }); });
</script>

<style scoped>
.association { border-top: 1px solid #dbe4ed; margin-top: 24px; padding-top: 16px; }
.el-form, .gap, .actions { margin-top: 16px; }
.el-select { width: 100%; } .hint { color: #617083; line-height: 1.7; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.actions .el-button { margin-left: 0; }
.preview { width: 100%; padding: 16px; border: 1px solid #b9d8e0; overflow-wrap: anywhere; }
.el-button { white-space: normal; height: auto; min-height: 40px; margin-bottom: 8px; }
</style>
