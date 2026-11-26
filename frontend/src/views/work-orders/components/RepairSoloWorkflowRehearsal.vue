<template>
  <section class="solo-rehearsal" aria-labelledby="solo-title">
    <h3 id="solo-title">单人流程演练 · 虚构样例</h3>
    <p>你可以独自体验录入、模拟复核和后续规则。不读取或修改下方原单，不创建第二个身份，不替代正式独立复核。</p>
    <p class="boundary">仅本页内存中的教学样例，不连接业务接口、不保存、不转为正式单据。刷新、离开或结束即清空；不证明正式收付款、防重或工资链已验收。</p>
    <template v-if="!started">
      <label><input v-model="acknowledged" type="checkbox" :disabled="blocked" /> 我理解这不是原单操作，也不会产生真实收付款、分配或工资</label>
      <button type="button" :disabled="blocked || !acknowledged" @click="start">开始单人演练</button>
    </template>
    <template v-else>
      <ol class="steps" aria-label="演练流程">
        <li v-for="(label, index) in steps" :key="label" :aria-current="stage === index ? 'step' : undefined">{{ index + 1 }}. {{ label }}{{ stage === index ? '（当前）' : '' }}</li>
      </ol>
      <p><strong>全部为虚构：</strong>示例保养项目；材料对客价 350.00 元，工时收费 250.00 元，对客合计 600.00 元。不是原单报价。</p>
      <div v-if="stage === 0" class="step-body">
        <p>样例资料已准备。下一步由你切换到“模拟检查”步骤，无须创建复核人账号。</p>
        <button type="button" :disabled="blocked" @click="submitSample">查看模拟复核</button>
      </div>
      <div v-if="stage === 1" class="step-body">
        <p>检查样例方案、材料与工时收费。这里的通过只推进演练，原单仍保持原来的待核实状态。</p>
        <div class="buttons">
          <button type="button" :disabled="blocked" @click="reviewSample(false)">模拟驳回，返回资料</button>
          <button type="button" :disabled="blocked" @click="reviewSample(true)">模拟检查通过，体验施工记录</button>
        </div>
      </div>
      <div v-if="stage === 2" class="step-body">
        <label>虚构施工人员<select v-model="worker" :disabled="blocked"><option value="sample-a">示例技师甲</option><option value="sample-b">示例技师乙</option></select></label>
        <label>演练实际工时（小时）<input v-model="hours" inputmode="decimal" maxlength="5" :disabled="blocked" placeholder="例如 1.50，不能填真实敏感资料" /></label>
        <p>工时是工作量；对客工时收费不是员工工资费率。本演练不计算工资。</p>
        <button type="button" :disabled="blocked" @click="finishWork">模拟完工及质检通过</button>
      </div>
      <div v-if="stage === 3" class="step-body">
        <p>已演练工作量：{{ workerLabel }} · {{ completedHours }} 小时。不是正式完工或独立质检记录。</p>
        <label>模拟收款证据<select v-model="receipt" :disabled="blocked">
          <option value="none">未收款</option><option value="unverified">登记全款，但尚未核实</option>
          <option value="deposit">仅核实定金 100.00 元</option><option value="full">样例全款 600.00 元已核实</option>
          <option value="reversed">退款或收款撤销，需处理调整</option>
        </select></label>
        <div class="money-card">
          <h4>材料付款演练 · 同一笔示例采购</h4>
          <p>示例供应商甲／示例采购甲：已验收并使用的样例材料成本 200.00 元。成本和付款分别核实；未付不等于零成本，后来付款不再扣一次成本。</p>
          <p>仅演示普通工单材料路径，需样例结算、全款核实及付款审批前提；不模拟备料特批、退货或分期付款。</p>
          <label><input v-model="payableChecked" type="checkbox" :disabled="blocked" /> 演练前提：样例已结算，原采购、供应商、使用与付款审批均核对完成</label>
          <label>模拟付款返回<select v-model="paymentOutcome" :disabled="blocked"><option value="known">收到样例核实回执</option><option value="unknown">超时，结果未知</option></select></label>
          <button type="button" :disabled="blocked" @click="tryPayment">尝试模拟材料付款（可重复点验防重）</button>
          <p>本轮样例出款次数：{{ paymentAttempts }}；状态：{{ paymentLabel }}。重复点击或换返回选项不会重新出款。</p>
        </div>
        <div class="money-card">
          <h4>经营分配演练 · 同一份示例额度</h4>
          <p>假定样例已批准分配额度 100.00 元，只用于体验条件与防重；不是“收入减材料费”计算结果，也不是公司分成比例或工资。</p>
          <label><input v-model="costChecked" type="checkbox" :disabled="blocked" /> 模拟确认实际成本证据完整</label>
          <label><input v-model="attributionChecked" type="checkbox" :disabled="blocked" /> 模拟确认人员／组归因和适用规则已核实</label>
          <label>示例额度归属<select v-model="recipient" :disabled="blocked"><option value="sample-group-a">示例组甲</option><option value="sample-group-b">示例组乙</option></select></label>
          <label>模拟分配返回<select v-model="allocationOutcome" :disabled="blocked"><option value="known">收到样例成功结果</option><option value="unknown">结果未知，保留占用</option></select></label>
          <button type="button" :disabled="blocked" @click="tryAllocation">尝试模拟分配（可重复点验防重）</button>
          <p>本轮样例分配次数：{{ allocationAttempts }}；状态：{{ allocationLabel }}。</p>
          <p v-if="allocatedTo">原模拟归属：{{ recipientLabels[allocatedTo] }} · 100.00 元；换组不会再生成一份额度。</p>
        </div>
        <p v-if="receipt === 'reversed'" class="boundary">退款不清空原模拟记录或占用，不恢复付款／分配资格；正式系统须走原来源追加调整。</p>
        <p class="boundary">未知结果需核对，不能直接重试出款。组内个人分配应从同一已批准组额度拆分，不新增整份贡献；本演练不制定组内分配公式。</p>
      </div>
      <p v-if="notice" role="status" class="notice">{{ notice }}</p>
      <details v-if="events.length"><summary>本页演练轨迹（非业务审计，不保存）</summary><ol><li v-for="(event, i) in events" :key="i">{{ event }}</li></ol></details>
      <button type="button" class="end" @click="reset">结束并清空本页演练</button>
      <p>重新开始是全新的虚构教学场景，不是解除原单占用或恢复真实付款资格。原单正式状态从未改变。</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
// A closed teaching fixture. No order/employee data, DTOs, APIs, persistence or outputs.
const props = defineProps<{ blocked?: boolean }>();
const steps = ['样例资料', '模拟复核', '工时与完工', '收款／防重体验'];
const acknowledged = ref(false), started = ref(false), stage = ref(0), notice = ref('');
const worker = ref('sample-a'), hours = ref(''), completedHours = ref('');
const receipt = ref('none'), payableChecked = ref(false), costChecked = ref(false), attributionChecked = ref(false);
const paymentOutcome = ref('known'), allocationOutcome = ref('known');
const paymentState = ref('untouched'), allocationState = ref('untouched');
const paymentAttempts = ref(0), allocationAttempts = ref(0);
const recipientLabels: Record<string, string> = { 'sample-group-a': '示例组甲', 'sample-group-b': '示例组乙' };
const recipient = ref('sample-group-a'), allocatedTo = ref(''), events = ref<string[]>([]);
const workerLabel = computed(() => worker.value === 'sample-a' ? '示例技师甲' : '示例技师乙');
const paymentLabel = computed(() => paymentState.value === 'recorded' ? '仅样例已核实付款' : paymentState.value === 'unknown' ? '结果未知，保持占用' : '未尝试（不代表真实未付款）');
const allocationLabel = computed(() => allocationState.value === 'recorded' ? '仅样例已分配' : allocationState.value === 'unknown' ? '结果未知，保持占用' : '未尝试');
function message(text: string) { notice.value = text; events.value = [...events.value.slice(-9), text]; }
function ready(expected: number) { return started.value && !props.blocked && stage.value === expected; }
function start() { if (!props.blocked && acknowledged.value) { started.value = true; message('已开始虚构演练；没有读取原单资料。'); } }
function submitSample() { if (ready(0)) { stage.value = 1; message('样例待模拟检查；没有送审原单。'); } }
function reviewSample(pass: boolean) { if (ready(1)) { stage.value = pass ? 2 : 0; message(pass ? '模拟检查通过；不是正式独立复核。' : '模拟驳回；可重新检查样例资料。'); } }
function finishWork() {
  if (!ready(2)) return;
  if (!['sample-a', 'sample-b'].includes(worker.value) || !/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/.test(hours.value)
    || Number(hours.value) <= 0 || Number(hours.value) > 24) { message('请输入 0 至 24 小时内的正数，最多两位小数；仅选择虚构技师。'); return; }
  completedHours.value = Number(hours.value).toFixed(2); stage.value = 3;
  message('已模拟完工及质检；可以尝试未收款、定金、全款和重复操作。');
}
function tryPayment() {
  if (!ready(3)) return;
  if (paymentState.value !== 'untouched') { message(paymentState.value === 'unknown' ? '阻止再次出款：原模拟结果未知，先核对；占用未释放。' : '返回原模拟付款结果；没有再次出款。'); return; }
  if (receipt.value !== 'full' || !payableChecked.value || !['known', 'unknown'].includes(paymentOutcome.value)) {
    message('模拟付款被阻止：需核实全款及原采购、使用、结算和付款审批前提。'); return;
  }
  paymentAttempts.value = 1; paymentState.value = paymentOutcome.value === 'known' ? 'recorded' : 'unknown';
  message(paymentState.value === 'recorded' ? '仅样例材料款 200.00 元核实；重复点击返回这一结果。' : '模拟出款结果未知，保持原占用；禁止换请求再出款。');
}
function tryAllocation() {
  if (!ready(3)) return;
  if (allocationState.value !== 'untouched') { message(allocationState.value === 'unknown' ? '阻止再次分配：原模拟结果未知，保持同一来源占用。' : '返回原模拟分配；重复点击、换组也不增加额度。'); return; }
  if (receipt.value !== 'full' || !costChecked.value || !attributionChecked.value
    || !Object.hasOwn(recipientLabels, recipient.value) || !['known', 'unknown'].includes(allocationOutcome.value)) {
    message('模拟分配被阻止：需核实全款、完整成本、人员／组归因与已批准规则；定金不能释放整单额度。'); return;
  }
  allocatedTo.value = recipient.value; allocationAttempts.value = 1;
  allocationState.value = allocationOutcome.value === 'known' ? 'recorded' : 'unknown';
  message(allocationState.value === 'recorded' ? '仅样例额度 100.00 元使用一次；不是利润或工资结果。' : '模拟分配结果未知，保留额度占用；不能换组再分一次。');
}
function reset() {
  acknowledged.value = false; started.value = false; stage.value = 0; notice.value = ''; events.value = [];
  worker.value = 'sample-a'; hours.value = ''; completedHours.value = ''; receipt.value = 'none';
  payableChecked.value = false; costChecked.value = false; attributionChecked.value = false;
  paymentOutcome.value = 'known'; allocationOutcome.value = 'known'; paymentState.value = 'untouched'; allocationState.value = 'untouched';
  paymentAttempts.value = 0; allocationAttempts.value = 0; recipient.value = 'sample-group-a'; allocatedTo.value = '';
}
watch(() => props.blocked, value => { if (value) reset(); }, { flush: 'sync' });
onBeforeUnmount(reset);
</script>

<style scoped>
.solo-rehearsal { margin-bottom: 24px; padding: 20px; border: 2px dashed #80723a; border-radius: 8px; background: #fffdf5; color: #303133; min-width: 0; }
h3, h4 { margin: 0 0 12px; }
p, li, label, summary, button { line-height: 1.65; overflow-wrap: anywhere; }
.boundary { color: #76530b; }
.steps { display: flex; flex-wrap: wrap; gap: 8px 24px; padding: 0; list-style: none; }
.steps [aria-current] { font-weight: bold; color: #245889; }
label { display: block; margin: 12px 0; }
input:not([type=checkbox]), select { display: block; width: 100%; max-width: 480px; box-sizing: border-box; min-height: 44px; margin-top: 6px; padding: 8px; font: inherit; background: white; color: #303133; border: 1px solid #999; border-radius: 4px; }
input[type=checkbox] { width: 18px; height: 18px; vertical-align: middle; }
button { min-height: 44px; max-width: 100%; padding: 8px 16px; border: 1px solid #406f91; border-radius: 4px; background: #fff; color: #234e70; font: inherit; cursor: pointer; white-space: normal; }
button:disabled { color: #767676; border-color: #aaa; cursor: not-allowed; }
button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible { outline: 3px solid #2b7bd0; outline-offset: 3px; }
.buttons { display: flex; flex-wrap: wrap; gap: 12px; }
.money-card { border-top: 1px solid #cfbf92; padding-top: 16px; margin-top: 20px; }
.notice { background: #edf3f8; padding: 12px; border-radius: 4px; }
.end { margin-top: 16px; }
@media (max-width: 600px) { .solo-rehearsal { padding: 14px; } .buttons { flex-direction: column; } }
</style>
