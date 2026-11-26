<template>
  <section class="first-visit">
    <h3>新客户：核实原单客户与车辆</h3>
    <p>先在下方选择原门店经营范围，再由另一位有权员工核对实际资料和证据。不会伪造历史客户、自动合并冲突车辆，或确认报价、施工与工资。</p>
    <el-alert v-if="notice" :title="notice" type="info" :closable="false" />
    <el-button :disabled="busy || blocked || !businessSectorRef" @click="read">预览 / 回读原单核实状态</el-button>
    <template v-if="preview?.state === 'pending_independent_review'">
      <dl>
        <dt>客户 / 联系方式</dt><dd>{{ preview.source.customerName }} / {{ preview.source.mobileMasked }}</dd>
        <dt>车辆</dt><dd>{{ preview.source.plateNumber }} / {{ preview.source.vehicleModel }}</dd>
        <dt>车辆识别号</dt><dd>{{ preview.source.vin }}</dd>
        <dt>实际里程</dt><dd>{{ preview.source.odometerKm }} 公里</dd>
        <dt>维修需求</dt><dd>{{ preview.source.serviceRequest }}</dd>
        <dt>客户与车辆关系</dt><dd>{{ relationLabel(preview.source.relationshipType) }}</dd>
        <dt>本次建档方式</dt><dd>{{ preview.reuseCustomer ? '复用已核实客户' : '建立新客户' }}；{{ preview.reuseVehicle ? '复用已核实车辆' : '建立车辆档案' }}</dd>
      </dl>
      <p v-if="!preview.canReview">你是该资料的录入人，不能核实自己的声明。请由另一位获授权员工使用本人账号打开本原单核实。</p>
      <el-form label-position="top" :disabled="busy || blocked || !preview.canReview || Boolean(pending)">
        <el-form-item label="内部核实证据引用">
          <el-input v-model="evidenceRef" placeholder="例如 review:internal-001；不要填写证件、手机号或外部链接" />
        </el-form-item>
        <el-checkbox v-model="identityChecked">我已核对客户身份、联系方式与车辆关系，确认资料对应本人声明</el-checkbox>
        <el-checkbox v-model="vehicleChecked">我已核对实际车辆识别号、里程和维修需求，没有把未知内容当作事实</el-checkbox>
      </el-form>
      <el-button type="primary" :disabled="busy || blocked || !preview.canReview || (!pending && (!identityChecked || !vehicleChecked || !evidenceRef.trim()))" @click="save">
        {{ acknowledged ? '回读已提交的核实结果' : pending ? '重试同一核实请求' : '确认核实并建立 / 关联档案' }}
      </el-button>
    </template>
    <template v-else-if="preview?.state === 'reviewed_native_source'">
      <p>已独立核实，原资料已冻结。仍是同一张工单；下一步检查、方案和报价需按原流程审核。</p>
      <el-button :disabled="busy || blocked" @click="useSelection">使用已核实引用继续原单报价前核验</el-button>
    </template>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import http from '../../../api/http';
const props = defineProps<{ workOrderId: string; businessSectorRef: string; blocked?: boolean }>();
const emit = defineEmits<{ locked: [value: boolean]; resolved: [value: { selection: any; evidenceRef: string }] }>();
const preview = ref<any>(null), pending = ref<any>(null);
const busy = ref(false), acknowledged = ref(false), identityChecked = ref(false), vehicleChecked = ref(false);
const evidenceRef = ref(''), notice = ref('');
let epoch = 0, disposed = false;
const silent = { silentError: true } as any;
const url = (id: string) => `/repair-shop/work-orders/${id}/first-visit-review`;
const relationLabel = (v: string) => ({ owner: '车主', user: '使用人', contact: '联系人' })[v] || '待核对';
watch(() => JSON.stringify([props.workOrderId, props.businessSectorRef]), () => {
  epoch++; preview.value = null; pending.value = null; busy.value = false; acknowledged.value = false;
  identityChecked.value = false; vehicleChecked.value = false; evidenceRef.value = ''; notice.value = ''; emit('locked',false);
}, { flush: 'sync' });
const current = (n: number) => !disposed && epoch === n;
function start() { busy.value = true; emit('locked',true); return { n: epoch, id: props.workOrderId, sector: props.businessSectorRef }; }
function finish(n: number) { if (current(n)) { busy.value = false; emit('locked',Boolean(pending.value)); } }
function validate(v: any, id: string, sector: string) {
  const positive = (n: unknown) => Number.isSafeInteger(n) && Number(n) > 0 && Number(n) <= 2147483647;
  if (v?.contract !== 'repair_first_visit_preview_v1' || String(v.workOrderId) !== id
    || v.financialEffect !== false || v.wagesAvailable !== false
    || !positive(v.expectedIntakeRevision) || !positive(v.expectedDeclarationRevision)) throw Error('contract');
  if (v.state === 'reviewed_native_source') {
    if (v.intakeEditsFrozen !== true || v.selection?.businessSectorRef !== sector || !positive(v.selection?.vehicleId)
      || !['companyRef','businessSectorRef','storeRef','customerRef'].every(k => typeof v.selection?.[k] === 'string' && v.selection[k].length > 0 && v.selection[k].length <= 100)
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v.requestId)
      || !positive(v.reviewerId) || !positive(v.collectorId) || v.reviewerId === v.collectorId
      || typeof v.replayed !== 'boolean' || typeof v.evidenceRef !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,254}$/.test(v.evidenceRef)) throw Error('receipt');
  } else if (v.state !== 'pending_independent_review' || typeof v.canReview !== 'boolean'
    || !/^[a-f0-9]{64}$/.test(v.expectedReviewHash) || v.scope?.businessSectorRef !== sector
    || !v.source || !['customerName','mobileMasked','plateNumber','vehicleModel','vin','serviceRequest'].every(k => typeof v.source[k] === 'string')
    || !Number.isSafeInteger(v.source.odometerKm) || v.source.odometerKm < 0
    || !['owner','user','contact'].includes(v.source.relationshipType)
    || typeof v.reuseCustomer !== 'boolean' || typeof v.reuseVehicle !== 'boolean') throw Error('preview');
  return v;
}
async function lookup(id: string, sector: string, n: number) {
  const response = await http.get(url(id), { ...silent, params: { businessSectorRef: sector } });
  if (!current(n)) return;
  const v = validate(response?.data?.data,id,sector);
  if (pending.value && v.state === 'reviewed_native_source' && (v.requestId !== pending.value.requestId
    || v.expectedIntakeRevision !== pending.value.expectedIntakeRevision
    || v.expectedDeclarationRevision !== pending.value.expectedDeclarationRevision)) throw Error('different decision');
  preview.value = v;
  if (v.state === 'reviewed_native_source') { pending.value = null; acknowledged.value = false; notice.value = '已回读原单独立核实记录；尚未接入报价或工资。'; }
  else notice.value = v.canReview ? '请逐项核对实际证据后明确确认；预览不会写入。' : '已显示原单资料，必须由另一位有权员工核实。';
}
async function read() {
  if (busy.value || props.blocked || !props.businessSectorRef || !/^\d+$/.test(props.workOrderId)) return;
  const c = start();
  if (!pending.value) { preview.value = null; identityChecked.value = false; vehicleChecked.value = false; }
  try { await lookup(c.id,c.sector,c.n); }
  catch { if (current(c.n)) { preview.value = null; notice.value = '暂不能读取核实状态：请检查本人权限、原门店范围和当前资料，不要重复建档。'; } }
  finally { finish(c.n); }
}
async function save() {
  if (busy.value || props.blocked || !preview.value?.canReview
    || (!pending.value && (!identityChecked.value || !vehicleChecked.value || !evidenceRef.value.trim()))) return;
  const c = start();
  try {
    if (!pending.value) pending.value = { businessSectorRef: c.sector, requestId: crypto.randomUUID(),
      expectedIntakeRevision: preview.value.expectedIntakeRevision, expectedDeclarationRevision: preview.value.expectedDeclarationRevision,
      expectedReviewHash: preview.value.expectedReviewHash, evidenceRef: evidenceRef.value.trim(),
      identityAndRelationshipChecked: true, vehicleAndDetailsChecked: true };
    if (!acknowledged.value) {
      const response = await http.post(url(c.id), { ...pending.value }, silent);
      if (!current(c.n)) return;
      const v = validate(response?.data?.data,c.id,c.sector);
      if (v.state !== 'reviewed_native_source' || v.requestId !== pending.value.requestId) throw Error('ack');
      acknowledged.value = true;
    }
    await lookup(c.id,c.sector,c.n);
  } catch (error: any) {
    if (!current(c.n)) return;
    if (!acknowledged.value && [400,403,404,409].includes(error?.response?.status)) {
      pending.value = null; preview.value = null;
      notice.value = '核实已被拒绝，请重新预览。可能是同人核实、资料过期、权限或既有客户车辆冲突。';
    } else notice.value = '尚未确认结果。只回读原单或重试同一请求，不要重新建档。';
  } finally { finish(c.n); }
}
function useSelection() {
  if (busy.value || props.blocked || pending.value || preview.value?.state !== 'reviewed_native_source') return;
  emit('resolved',{ selection: { ...preview.value.selection }, evidenceRef: preview.value.evidenceRef });
}
onBeforeUnmount(() => { disposed = true; epoch++; preview.value = null; pending.value = null; emit('locked',false); });
</script>
<style scoped>
.first-visit { border: 1px solid #cddfeb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
.first-visit p, .first-visit dd { line-height: 1.7; overflow-wrap: anywhere; }
.first-visit dl { display: grid; grid-template-columns: 145px 1fr; gap: 10px; }
.first-visit dd { margin: 0; min-width: 0; }
.first-visit :deep(.el-checkbox) { white-space: normal; height: auto; margin: 10px 0; display: flex; }
.first-visit :deep(.el-checkbox__label) { white-space: normal; line-height: 1.6; }
.first-visit :deep(.el-button) { white-space: normal; height: auto; min-height: 34px; line-height: 1.6; max-width: 100%; margin: 6px 0; }
@media (max-width: 600px) { .first-visit dl { grid-template-columns: 1fr; gap: 4px; } .first-visit dd { margin-bottom: 10px; } }
</style>
