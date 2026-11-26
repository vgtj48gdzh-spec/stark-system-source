<template>
  <main class="intake-page">
    <header><p class="eyebrow">斯塔克 · 车辆接车</p><h1>待报价接车登记</h1>
      <p>先记录车辆和需求，再核实资料、报价与客户确认。</p></header>
    <el-alert title="这是接车草稿，不是已报价、已收款或已完工工单。不会生成工资或付款。"
      type="info" :closable="false" show-icon />
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="gap" />
    <el-alert v-if="loading" title="正在读取接车资料…" type="info" :closable="false" class="gap" />
    <el-card v-if="saved" class="gap">
      <template #header><h2>已保存 · 待报价</h2><span>工单号：{{ saved.workOrderNo }}</span></template>
      <dl class="summary">
        <dt>门店</dt><dd>{{ saved.storeName }}</dd><dt>需求</dt><dd>{{ saved.title }}</dd>
        <dt>客户</dt><dd>{{ saved.customerName }} · {{ saved.customerMobile }}</dd>
        <dt>车辆</dt><dd>{{ saved.plateNumber }} · {{ saved.vehicleModel }}</dd>
        <dt>应收 / 收款</dt><dd>尚未报价 / 未收款，不以 ¥0 表示免费</dd>
      </dl>
      <p>待补齐：{{ saved.missing.join('、') }}。</p>
      <p>当前已采集接车资料；尚未形成施工、成本、贡献或工资依据。</p>
      <p>在原工单上继续补资料，请勿重复开单。核实后可进入检查和报价版本；客户确认仍未开放。</p>
      <el-button @click="router.push(`/work-orders/intake/${saved.id}/repair`)">原工单检查 / 报价前核验</el-button>
      <WorkOrderIntakeDetails v-if="saved.details" :key="saved.id" :order="saved" @saved="saved = $event" />
      <WorkOrderIntakeAssociation v-if="saved.details" :key="`association-${saved.id}`" :order="saved" />
      <section class="wecom-return" aria-label="返回企业微信核对">
        <h2>在企业微信继续</h2>
        <p>本页可在企业微信内使用；资料只提交给斯塔克，不发送到聊天。保存按钮后的独立回查完成后，返回机器人聊天发送：</p>
        <p><code>查询工单 {{ saved.id }} 采集</code></p>
        <p>聊天应返回最新资料和关系声明版本。需已授权的采集查询试用；若提示不可用，不代表保存失败，请用本页回查。
          单凭本页提示不代表机器人已启用。不要重复开单或将私人资料粘贴到聊天。</p>
      </section>
      <el-button :loading="loading" @click="load">重新查询已保存工单</el-button>
    </el-card>
    <el-card v-else-if="!route.params.id && !acknowledgedId" class="gap" v-loading="loading">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" :disabled="loading || submitting || Boolean(pendingPayload)">
        <el-form-item label="接车门店" prop="storeRef"><el-select v-model="form.storeRef" placeholder="请选择已授权门店" style="width: 100%">
          <el-option v-for="store in stores" :key="store.storeRef" :value="store.storeRef" :label="store.name" />
        </el-select></el-form-item>
        <el-form-item label="保养 / 维修需求" prop="title"><el-input v-model="form.title" maxlength="100" placeholder="例如：车辆保养；具体项目待检查" /></el-form-item>
        <div class="fields">
          <el-form-item label="客户姓名或称呼" prop="customerName"><el-input v-model="form.customerName" maxlength="100" autocomplete="off" /></el-form-item>
          <el-form-item label="联系电话" prop="customerMobile"><el-input v-model="form.customerMobile" maxlength="11" inputmode="tel" autocomplete="off" /></el-form-item>
          <el-form-item label="车牌号" prop="plateNumber"><el-input v-model="form.plateNumber" maxlength="16" /></el-form-item>
          <el-form-item label="车型（按客户提供，待核实）" prop="vehicleModel"><el-input v-model="form.vehicleModel" maxlength="80" /></el-form-item>
        </div>
        <p class="hint">VIN、里程、具体项目与价格可以稍后核实。请勿填写猜测值，不会自动确认报价或施工。</p>
      </el-form>
      <el-alert v-if="submissionNotice" :type="submitting ? 'info' : 'warning'" :closable="false" :title="submissionNotice" />
      <el-button type="primary" :loading="submitting" :disabled="loading || !stores.length" @click="submit">
        {{ submitLabel }}
      </el-button>
      <el-button v-if="error && !pendingPayload" :disabled="loading || submitting" @click="load">重新读取门店资料</el-button>
      <p v-if="!loading && !error && !stores.length">当前没有可接车的授权门店，请由管理员完成门店与权限核验。</p>
    </el-card>
    <el-button v-else-if="error" class="gap" :disabled="loading" @click="load">重新查询已保存工单</el-button>
    <footer>仅在本页采集必要联系资料；页面不把手机号保存到浏览器本地存储或操作日志。</footer>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { isAxiosError } from 'axios';
import { useRoute, useRouter } from 'vue-router';
import { type FormInstance, type FormRules } from 'element-plus';
import http from '../../../api/http';
import WorkOrderIntakeDetails from './WorkOrderIntakeDetails.vue';
import WorkOrderIntakeAssociation from './WorkOrderIntakeAssociation.vue';
import type { IntakeSaved } from './work-order-intake.types';

type Payload = { requestId: string; storeRef: string; title: string; customerName: string; customerMobile: string; plateNumber: string; vehicleModel: string };
const route = useRoute();
const router = useRouter();
const formRef = ref<FormInstance>();
const form = reactive({ storeRef: '', title: '', customerName: '', customerMobile: '', plateNumber: '', vehicleModel: '' });
const stores = ref<Array<{ storeRef: string; name: string }>>([]);
const saved = ref<IntakeSaved | null>(null);
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
// Only a random request UUID survives refresh; no personal data or form values in storage.
const requestKey = 'stark.owner-intake.pending-request.v1';
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function pendingRequestId() {
  let key = sessionStorage.getItem(requestKey);
  if (key && !uuidV4.test(key)) throw new Error('invalid recovery key');
  if (!key) {
    key = crypto.randomUUID(); sessionStorage.setItem(requestKey, key);
  }
  return key;
}
const pendingPayload = ref<Payload | null>(null);
const acknowledgedId = ref<number | null>(null);
let acknowledgedRequestId: string | null = null;
const submissionNotice = computed(() => submitting.value
  ? '正在保存，请稍候；请勿重复点击或关闭页面。'
  : pendingPayload.value ? '提交结果尚未确认。资料已锁定，请重试同一提交，避免重复登记。' : '');
const submitLabel = computed(() => submitting.value ? '保存中…'
  : pendingPayload.value ? '重试同一提交（不会重复开单）' : '保存待报价接车草稿');
const rules: FormRules = Object.fromEntries(Object.keys(form).map((key) => [key, [{ required: true, message: '请填写此项', trigger: 'blur' }]]));
rules.customerMobile = [{ required: true, pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位联系电话', trigger: 'blur' }];
rules.plateNumber = [{ required: true, pattern: /^[\u4e00-\u9fffA-Za-z0-9·-]{2,16}$/, message: '请输入正确车牌号', trigger: 'blur' }];
const silent = { headers: { 'x-suppress-global-error': '1' } };
let epoch = 0;
let disposed = false;
function positiveId(value: unknown): number {
  if (!/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('invalid id');
  return Number(value);
}
async function openAcknowledged(id: number, current: number) {
  await router.replace(`/work-orders/intake/${id}`);
  // A successful navigation is read by the watcher. A cancelled/no-op navigation
  // still permits GET-only receipt recovery without re-opening the create form.
  if (!disposed && current === epoch) await load();
}
async function load() {
  if (disposed) return;
  const current = ++epoch;
  loading.value = true; error.value = ''; saved.value = null; stores.value = [];
  try {
    if (route.params.id || acknowledgedId.value) {
      const id = positiveId(route.params.id || acknowledgedId.value);
      const response = await http.get(`/work-orders/intake-drafts/${id}`, silent);
      if (current !== epoch) return;
      if (response.data.data.id !== id) throw new Error('response identity mismatch');
      saved.value = response.data.data;
      // Retire the recovery UUID only after a separate authenticated GET and a
      // durable order URL. Never clear a newer/different request's recovery key.
      if (String(route.params.id) === String(id) && acknowledgedId.value === id && acknowledgedRequestId
        && sessionStorage.getItem(requestKey) === acknowledgedRequestId) sessionStorage.removeItem(requestKey);
    } else {
      const key = sessionStorage.getItem(requestKey);
      if (key) {
        if (!uuidV4.test(key)) throw new Error('invalid recovery key');
        try {
          const prior = await http.get(`/work-orders/intake-drafts/by-request/${encodeURIComponent(key)}`, silent);
          if (current === epoch) {
            const id = positiveId(prior.data.data.id);
            acknowledgedId.value = id; acknowledgedRequestId = key;
            await openAcknowledged(id, current);
          }
          return;
        } catch (cause) {
          if (!isAxiosError(cause) || cause.response?.status !== 404) throw cause;
        }
      }
      if (current !== epoch) return;
      const response = await http.get('/work-orders/intake-drafts/stores', silent);
      if (current === epoch) {
        stores.value = response.data.data.stores;
        if (stores.value.length === 1) form.storeRef = stores.value[0].storeRef;
      }
    }
  } catch {
    if (current === epoch) error.value = acknowledgedId.value
      ? '已收到保存回执，但详情尚未读取成功。请重新查询已保存工单，不要重新开单。'
      : '无法读取接车资料。请确认登录和门店权限后重试；不会显示其他人的工单。';
  } finally { if (current === epoch) loading.value = false; }
}
async function submit() {
  if (disposed || submitting.value || loading.value || !stores.value.length || route.params.id || acknowledgedId.value) return;
  // Lock before asynchronous validation, not only before the POST.
  submitting.value = true; error.value = '';
  const current = epoch;
  try {
    if (!pendingPayload.value) {
      try { if (!await formRef.value?.validate()) return; } catch { return; }
      if (disposed || current !== epoch) return;
      try { pendingPayload.value = { ...form, requestId: pendingRequestId() }; }
      catch { error.value = '浏览器无法保存防重复请求号，请允许本网站会话存储后再提交。'; return; }
    }
    const requestId = pendingPayload.value.requestId;
    const response = await http.post('/work-orders/intake-drafts', pendingPayload.value, silent);
    if (disposed || current !== epoch) return;
    const id = response.data.data.id;
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('invalid response');
    acknowledgedId.value = id; acknowledgedRequestId = requestId;
    form.customerMobile = ''; pendingPayload.value = null;
    await openAcknowledged(id, current);
    // Route watcher performs a separate authenticated GET, not just the POST echo.
  } catch (cause) {
    if (disposed || current !== epoch) return;
    if (acknowledgedId.value) {
      error.value = '已收到保存回执，但详情跳转未完成。请重新查询已保存工单，不要重新开单。';
    } else if (isAxiosError(cause) && cause.response?.status === 400) {
      pendingPayload.value = null;
      error.value = '资料校验未通过：请检查必填项，手机号只填在电话栏，文字栏不要包含电话号码。尚未创建新工单。';
    } else {
      error.value = '尚未确认保存结果。请使用下方按钮重试同一提交；系统会校验原记录，不会重复创建。';
    }
  } finally { submitting.value = false; }
}
watch(() => route.params.id, load, { immediate: true });
onBeforeUnmount(() => { disposed = true; epoch++; form.customerMobile = ''; pendingPayload.value = null; });
</script>

<style scoped>
.intake-page { max-width: 880px; margin: auto; padding: 32px 20px; color: #182a40; }
.eyebrow { color: #337a80; font-weight: 600; letter-spacing: 2px; }
h1 { margin: 8px 0; font-size: 30px; } h2 { margin: 0 0 8px; font-size: 22px; }
header { margin-bottom: 24px; } .gap { margin-top: 20px; }
.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
.hint, footer { color: #617083; line-height: 1.7; } footer { font-size: 13px; margin-top: 24px; }
.summary { display: grid; grid-template-columns: 130px 1fr; gap: 14px; }
.wecom-return { margin: 24px 0; padding: 16px; background: #eff7f8; line-height: 1.7; }
dt { color: #617083; } dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 600px) { .fields { grid-template-columns: 1fr; } .summary { grid-template-columns: 1fr; gap: 6px; } dd { margin-bottom: 12px; } }
</style>
