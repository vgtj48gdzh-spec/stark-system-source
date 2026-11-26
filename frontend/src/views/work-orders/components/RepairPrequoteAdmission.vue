<template>
  <section class="prequote-admission">
    <el-alert type="warning" :closable="false"
      title="只接入原工单的检查、诊断和报价版本。需已核实客户来源、车辆关系及实际 VIN；不会新建客户、推断身份或放行施工。" />
    <p>接入后冻结当前接车资料。录入和审核由不同的有权人员完成；本次接入不会确认报价、客户同意、成本、收款或工资，后续仍按原流程核验。</p>
    <el-alert v-if="notice" :title="notice" :type="noticeType" :closable="false" />
    <div class="buttons">
      <el-button :disabled="busy || blocked || Boolean(pending)" @click="check">核验所选客户、车辆和当前资料</el-button>
      <el-button type="primary" :disabled="busy || blocked || (!ready && !pending) || !evidenceRef.trim()" @click="admit">
        {{ acknowledged ? '回读原工单' : pending ? '重试同一接入请求' : '接入原工单（仅报价前）' }}
      </el-button>
      <el-button :disabled="busy || blocked" @click="requery">只回读原工单</el-button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { admitRepairPrequote, getRepairPrequoteReadiness, getRepairWorkspace, type PrequoteSelection, type PrequoteAdmissionRequest } from '../../../api/repair-shop';
const props = defineProps<{ workOrderId: string; selection: PrequoteSelection; evidenceRef: string; blocked?: boolean }>();
const emit = defineEmits<{ admitted: []; locked: [value: boolean] }>();
const busy = ref(false);
const ready = ref<{ expectedRevision: number; expectedAuthorityHash: string } | null>(null);
const pending = ref<PrequoteAdmissionRequest | null>(null);
const acknowledged = ref(false);
const notice = ref('');
const noticeType = ref<'info' | 'success' | 'warning'>('info');
let epoch = 0; let disposed = false;
watch(() => JSON.stringify([props.workOrderId, props.selection, props.evidenceRef]), () => {
  epoch++; ready.value = null;
  // Parent controls are locked while an ambiguous request is pending. A route
  // change invalidates late responses; never retarget the old write to a new root.
  pending.value = null; acknowledged.value = false; busy.value = false; emit('locked', false);
  notice.value = '';
}, { flush: 'sync' });
function start() { busy.value = true; emit('locked', true); return { n: epoch, id: props.workOrderId }; }
function current(n: number) { return !disposed && n === epoch; }
function finish(n: number) { if (current(n)) { busy.value = false; emit('locked', Boolean(pending.value)); } }
async function check() {
  if (busy.value || props.blocked || pending.value) return;
  ready.value = null; const { n, id } = start();
  try {
    const selection = JSON.parse(JSON.stringify(props.selection)) as PrequoteSelection;
    if (!selection.vehicleId || !selection.customerRef || !selection.storeRef) throw new Error('selection');
    const { data } = await getRepairPrequoteReadiness(id, selection);
    if (!current(n)) return;
    const value = data?.data;
    if (String(value?.workOrderId) !== id || value?.financialEffect !== false || value?.wagesAvailable !== false
      || !Number.isInteger(value?.expectedRevision) || value.expectedRevision < 1 || !/^[a-f0-9]{64}$/.test(value?.expectedAuthorityHash)
      || !['ready_for_prequote', 'admitted_prequote_only'].includes(value?.state)) throw new Error('contract');
    if (value.state === 'admitted_prequote_only') { await read(id, n); return; }
    ready.value = { expectedRevision: value.expectedRevision, expectedAuthorityHash: value.expectedAuthorityHash };
    noticeType.value = 'info'; notice.value = '当前引用与资料核验通过，请核对证据后点击接入；尚未写入。';
  } catch {
    if (current(n)) { noticeType.value = 'warning'; notice.value = '尚不能接入：请核对实际 VIN、里程、需求、已审核客户/车辆关系和当前权限。未知资料不要编造。'; }
  } finally { finish(n); }
}
async function read(id: string, n: number) {
  const { data } = await getRepairWorkspace(id);
  if (!current(n)) return;
  const value = data?.data;
  if (String(value?.workOrder?.id) !== id || value.prequoteOnly !== true
    || value.financialEffect !== false || value.wagesAvailable !== false) throw new Error('read contract');
  if (value.profile && String(value.profile.workOrderId) === id) {
    pending.value = null; ready.value = null; acknowledged.value = false;
    noticeType.value = 'success'; notice.value = '已回读原工单报价前档案；未授权施工或收款。'; emit('admitted');
  } else {
    noticeType.value = 'warning'; notice.value = '原工单尚无已接入档案。已发出的请求仍保留，可重试同一请求。';
  }
}
async function admit() {
  if (busy.value || props.blocked || (!ready.value && !pending.value)) return;
  const { n, id } = start();
  try {
    if (!pending.value) pending.value = { ...JSON.parse(JSON.stringify(props.selection)), ...ready.value!,
      requestId: crypto.randomUUID(), scopeResolutionEvidenceRef: props.evidenceRef.trim() };
    if (!acknowledged.value) {
      const { data } = await admitRepairPrequote(id, pending.value);
      if (!current(n)) return;
      if (String(data?.data?.workOrderId) !== id || data?.data?.state !== 'admitted_prequote_only'
        || data.data.financialEffect !== false || data.data.wagesAvailable !== false) throw new Error('receipt');
      acknowledged.value = true;
    }
    await read(id, n);
  } catch (error: any) {
    if (!current(n)) return;
    noticeType.value = 'warning';
    if (!acknowledged.value && [400, 403, 404, 409].includes(error?.response?.status)) {
      pending.value = null; ready.value = null;
      notice.value = '接入被拒绝：权限、资料或核验版本需要更新。先回读原工单，不会另建新单。';
    } else notice.value = '尚未确认接入结果。选择回读原工单或重试同一请求，不要重复开单。';
  } finally { finish(n); }
}
async function requery() {
  if (busy.value || props.blocked) return;
  const { n, id } = start();
  try { await read(id, n); }
  catch { if (current(n)) { noticeType.value = 'warning'; notice.value = '回读失败，请检查登录及权限；没有发出写入。'; } }
  finally { finish(n); }
}
onBeforeUnmount(() => { disposed = true; epoch++; pending.value = null; ready.value = null; });
</script>
<style scoped>
.prequote-admission p { color: #617083; line-height: 1.7; }
.buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
</style>
