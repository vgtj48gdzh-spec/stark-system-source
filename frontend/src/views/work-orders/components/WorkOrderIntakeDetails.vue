<template>
  <section class="details">
    <h2>补齐接车资料</h2>
    <p>资料版本 {{ revision }} · 待核实。只补充原工单，不创建新单。</p>
    <el-alert title="不知道的项目请留空；录入不代表已检查、已报价或客户已确认。" type="info" :closable="false" />
    <el-alert v-if="order.intakeEditsFrozen" title="原单资料已独立核实或已接入报价前流程，不能在这里覆盖；请进入原汽修工作台核对。" type="warning" :closable="false" />
    <el-alert v-if="notice" :title="notice" :type="noticeType" :closable="false" class="gap" />
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top"
      :disabled="busy || Boolean(preview) || Boolean(pending) || conflict || order.intakeEditsFrozen">
      <el-form-item label="VIN（车辆识别代码，未知可留空）" prop="vin">
        <el-input v-model="form.vin" maxlength="17" autocomplete="off" placeholder="按车辆实际资料填写 17 位 VIN" />
      </el-form-item>
      <el-form-item label="仪表里程（公里，未知可留空）" prop="odometerKm">
        <el-input v-model="form.odometerKm" inputmode="numeric" maxlength="7" placeholder="未提供" />
      </el-form-item>
      <el-form-item label="客户提出的具体保养 / 维修需求（待检查）" prop="requestedService">
        <el-input v-model="form.requestedService" type="textarea" :rows="3" maxlength="100" show-word-limit
          placeholder="只填写已提供的需求，不猜测诊断、价格、材料或工时；请勿填写联系方式" />
      </el-form-item>
    </el-form>
    <section v-if="preview" class="preview" aria-label="接车资料保存前预览" aria-live="polite">
      <h3>资料预览 · 仍待核实</h3>
      <p>原工单 {{ order.id }} · 基于资料版本 {{ preview.expectedRevision }}。未知项按空值保存，不猜测。</p>
      <p>VIN：{{ preview.vin ?? '未提供' }}；里程：{{ preview.odometerKm ?? '未提供' }}</p>
      <p>需求：{{ preview.requestedService ?? '未提供' }}</p>
      <el-button type="primary" :disabled="busy || conflict || order.intakeEditsFrozen" @click="confirmSave">确认保存这份待核实资料</el-button>
      <el-button :disabled="busy" @click="preview = null">返回修改</el-button>
    </section>
    <el-button v-else type="primary" :loading="busy" :disabled="conflict || order.intakeEditsFrozen" @click="save">{{ saveLabel }}</el-button>
    <el-button v-if="pending || conflict" :disabled="busy" @click="refresh">读取最新资料（放弃未保存修改）</el-button>
    <p class="hint">下一步沿用原汽修工作台：核实客户与车辆关联 → 检查与报价 → 客户确认。
      本页不会建立正式客户/车辆关联、授权施工、收款或计算工资。</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue';
import { isAxiosError } from 'axios';
import { type FormInstance, type FormRules } from 'element-plus';
import http from '../../../api/http';
import type { IntakeSaved as Order } from './work-order-intake.types';

type Snapshot = { requestId: string; expectedRevision: number; vin: string | null; odometerKm: number | null; requestedService: string | null };
const props = defineProps<{ order: Order }>();
const emit = defineEmits<{ saved: [order: Order] }>();
const formRef = ref<FormInstance>();
// Keep the displayed value as text; number widgets may clear an uncommitted
// display on blur or round fractions. Parse only an explicitly supplied integer.
const form = reactive({ vin: '', odometerKm: '', requestedService: '' });
const revision = ref(0);
const pending = ref<Snapshot | null>(null);
const preview = ref<Snapshot | null>(null);
const busy = ref(false);
const conflict = ref(false);
const acknowledged = ref(false);
const notice = ref('');
const noticeType = ref<'info' | 'success' | 'warning' | 'error'>('info');
const saveLabel = computed(() => busy.value ? '正在保存 / 核对…' : acknowledged.value
  ? '重新读取保存结果' : pending.value ? '重试同一资料提交' : '预览资料（尚不保存）');
const rules: FormRules = {
  vin: [{ pattern: /^(?:[A-HJ-NPR-Z0-9]{17})?$/i, message: '请填写 17 位 VIN，未知请留空', trigger: 'blur' }],
  odometerKm: [{ pattern: /^(?:[0-9]{1,7})?$/, message: '里程应为非负整数，未知请留空', trigger: 'blur' }],
};
const silent = { headers: { 'x-suppress-global-error': '1' } };
let epoch = 0;
let disposed = false;
let emittedOrder: Order | null = null;
function accept(order: Order) {
  const d = order.details;
  if (!d || !Number.isInteger(d.revision) || d.revision < 0 || d.revision > 2147483647 || d.verificationStatus !== 'pending'
    || !(d.vin === null || (typeof d.vin === 'string' && /^[A-HJ-NPR-Z0-9]{17}$/.test(d.vin)))
    || !(d.odometerKm === null || (Number.isInteger(d.odometerKm) && d.odometerKm >= 0 && d.odometerKm <= 9999999))
    || !(d.requestedService === null || typeof d.requestedService === 'string')) throw new Error('invalid draft response');
  revision.value = d.revision;
  Object.assign(form, { vin: d.vin ?? '', odometerKm: d.odometerKm === null ? '' : String(d.odometerKm), requestedService: d.requestedService ?? '' });
}
// Do not erase our own readback notice, but honor the parent's explicit requery
// even for the same root. Invalidate late responses from the discarded edit.
watch(() => props.order, (order) => {
  if (toRaw(order) === emittedOrder) return;
  epoch++;
  pending.value = null; preview.value = null; acknowledged.value = false; conflict.value = false;
  notice.value = ''; busy.value = false;
  try { accept(props.order); }
  catch { conflict.value = true; notice.value = '资料格式暂不可用，请重新读取。'; noticeType.value = 'error'; }
}, { immediate: true });

async function readBack(id: number, current: number, requireSaved: boolean) {
  const response = await http.get(`/work-orders/intake-drafts/${id}`, silent);
  if (disposed || current !== epoch) return;
  const order = response.data.data as Order;
  if (order.id !== id || order.financialEffect !== false || order.wagesAvailable !== false
    || order.pricingStatus !== 'unquoted') throw new Error('response boundary mismatch');
  const attempted = pending.value;
  if (!order.details || (requireSaved && attempted && order.details.revision <= attempted.expectedRevision)) throw new Error('stale readback');
  accept(order);
  // A separate authenticated GET is the evidence, not the PATCH echo. Another
  // editor may already have advanced it; display current truth without a false success.
  const same = attempted && order.details.revision === attempted.expectedRevision + 1
    && order.details.vin === attempted.vin && order.details.odometerKm === attempted.odometerKm
    && order.details.requestedService === attempted.requestedService;
  pending.value = null; preview.value = null; acknowledged.value = false; conflict.value = false;
  emittedOrder = order;
  emit('saved', order);
  notice.value = requireSaved && same ? '资料已保存并重新读取，仍待核实。' : '已读取当前资料，请核对；没有创建新工单。';
  noticeType.value = requireSaved && same ? 'success' : 'info';
}

async function save() {
  if (disposed || busy.value || preview.value || conflict.value || props.order.intakeEditsFrozen) return;
  busy.value = true; notice.value = '正在保存并核对，请勿重复提交。'; noticeType.value = 'info';
  const current = epoch; const id = props.order.id;
  try {
    if (!pending.value) {
      try { if (!await formRef.value?.validate()) { notice.value = ''; return; } }
      catch { notice.value = ''; return; }
      if (disposed || current !== epoch) return;
      if (!/^(?:[0-9]{1,7})?$/.test(form.odometerKm)) {
        notice.value = '里程应为非负整数，未知请留空；不会自动取整。'; noticeType.value = 'warning'; return;
      }
      preview.value = { requestId: crypto.randomUUID(), expectedRevision: revision.value,
        vin: form.vin.trim().toUpperCase() || null, odometerKm: form.odometerKm === '' ? null : Number(form.odometerKm),
        requestedService: form.requestedService.trim() || null };
      notice.value = '请核对预览后确认。当前尚未发送保存请求。';
      return;
    }
    if (!acknowledged.value) {
      const response = await http.patch(`/work-orders/intake-drafts/${id}/details`, pending.value, silent);
      if (disposed || current !== epoch) return;
      if (response.data.data.id !== id || response.data.data.details?.revision !== pending.value.expectedRevision + 1) {
        throw new Error('invalid receipt');
      }
      acknowledged.value = true;
    }
    await readBack(id, current, true);
  } catch (cause) {
    if (disposed || current !== epoch) return;
    noticeType.value = 'warning';
    if (!acknowledged.value && isAxiosError(cause) && cause.response?.status === 400) {
      pending.value = null;
      notice.value = '资料未通过校验：请检查 VIN、里程和文字长度；不要在需求中填写电话。登记信息较长时请缩短需求，不会截断保存。';
    } else if (!acknowledged.value && isAxiosError(cause) && cause.response?.status === 409) {
      conflict.value = true;
      notice.value = '资料版本已变化。请先读取最新资料后核对，不会覆盖他人的修改。';
    } else {
      notice.value = acknowledged.value ? '已收到保存回执，尚未完成回读。请重新读取保存结果，不要重复录单。'
        : '保存结果尚未确认，资料已锁定。可重试同一提交或读取最新资料核对。';
    }
  } finally { if (current === epoch) busy.value = false; }
}

async function confirmSave() {
  if (disposed || busy.value || !preview.value || pending.value || conflict.value || props.order.intakeEditsFrozen
    || preview.value.expectedRevision !== revision.value) return;
  // Freeze exactly what the owner saw. Subsequent retries retain this UUID/CAS.
  pending.value = { ...preview.value }; preview.value = null;
  await save();
}

async function refresh() {
  if (disposed || busy.value) return;
  busy.value = true;
  const current = epoch;
  try { await readBack(props.order.id, current, false); }
  catch { if (!disposed && current === epoch) { noticeType.value = 'error'; notice.value = '无法读取最新资料，请检查登录和权限；未发出写入请求。'; } }
  finally { if (current === epoch) busy.value = false; }
}
onBeforeUnmount(() => { disposed = true; epoch++; pending.value = null; preview.value = null; Object.assign(form, { vin: '', odometerKm: '', requestedService: '' }); });
</script>

<style scoped>
.details { border-top: 1px solid #dbe4ed; margin-top: 24px; padding-top: 16px; }
.el-form, .gap { margin-top: 16px; }
.hint { color: #617083; line-height: 1.7; }
.preview { margin: 16px 0; padding: 16px; border: 1px solid #b9d8e0; overflow-wrap: anywhere; }
.el-button { white-space: normal; height: auto; min-height: 40px; margin-bottom: 8px; }
</style>
