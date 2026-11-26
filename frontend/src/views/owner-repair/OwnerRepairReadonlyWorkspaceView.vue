<template>
  <div class="page-stack" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">汽修只读档案 · {{ workOrder?.workOrderNo || `#${workOrderId}` }}</div>
            <div class="subtitle">
              客户/车辆 → 接车检查 → 诊断报价 → 客户确认 → 维修施工 → 质检 → 交车 → 售后
            </div>
          </div>
          <div class="actions">
            <el-button @click="router.push('/work-orders')">返回列表</el-button>
            <el-button :loading="loading" @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="只读验收：本页没有新建、修改、客户确认、领料出库、收付款、任务完工、质检放行、交车或权益操作。"
      />

      <el-result
        v-if="invalidId"
        icon="error"
        title="工单编号无效"
        sub-title="请从工单列表重新进入。"
      />

      <template v-else-if="workOrder">
        <el-descriptions class="summary" :column="4" border>
          <el-descriptions-item label="工单编号">{{ workOrder.workOrderNo }}</el-descriptions-item>
          <el-descriptions-item label="工单状态">
            <el-tag :type="statusType(workOrder.status)" effect="plain">
              {{ statusLabel(workOrder.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="客户">{{ workOrder.customerName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ safeMaskedMobile(workOrder.customerMobile) }}</el-descriptions-item>
          <el-descriptions-item label="业务内容" :span="2">{{ workOrder.title || '-' }}</el-descriptions-item>
          <el-descriptions-item label="应收">{{ money(workOrder.amountDue) }}</el-descriptions-item>
          <el-descriptions-item label="已收">{{ money(workOrder.amountReceived) }}</el-descriptions-item>
          <el-descriptions-item label="材料成本">{{ money(workOrder.materialCostTotal) }}</el-descriptions-item>
          <el-descriptions-item label="责任人 ID">{{ workOrder.responsibleUserId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ dateTime(workOrder.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ dateTime(workOrder.updatedAt) }}</el-descriptions-item>
          <el-descriptions-item v-if="workOrder.remark" label="备注" :span="4">
            {{ workOrder.remark }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-card>

    <el-card v-if="workspaceError && workOrder" shadow="never">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="该正式工单尚无当前身份可读取的汽修档案"
        :description="workspaceError"
      />
      <ProcessBlueprint />
    </el-card>

    <el-card v-else-if="workspace && !workspace.profile" shadow="never">
      <el-empty description="该正式工单尚未建立汽修扩展档案；当前只展示流程蓝图，不会在验收入口中创建数据。" />
      <ProcessBlueprint />
    </el-card>

    <template v-else-if="workspace?.profile">
      <el-card shadow="never">
        <div class="status-grid">
          <div class="metric">
            <span>当前阶段</span>
            <strong>{{ lifecycleLabel(workspace.profile.lifecycleStatus) }}</strong>
          </div>
          <div class="metric plate">
            <span>车辆车牌（内部授权可见）</span>
            <strong>{{ workspace.vehicle?.plateNumber || '-' }}</strong>
          </div>
          <div class="metric">
            <span>客户确认</span>
            <strong>{{ confirmationLabel(workspace.profile.customerConfirmationState) }}</strong>
          </div>
          <div class="metric">
            <span>档案版本</span>
            <strong>v{{ workspace.profile.version ?? '-' }}</strong>
          </div>
        </div>

        <el-steps class="lifecycle" :active="lifecycleStep" finish-status="success" align-center>
          <el-step title="接车检查" />
          <el-step title="诊断报价" />
          <el-step title="客户确认" />
          <el-step title="维修施工" />
          <el-step title="质检" />
          <el-step title="交车售后" />
        </el-steps>

        <el-descriptions :column="4" border>
          <el-descriptions-item label="公司">{{ workspace.profile.companyDisplaySnapshot || workspace.profile.companyRef || '-' }}</el-descriptions-item>
          <el-descriptions-item label="业务板块">{{ workspace.profile.businessSectorDisplaySnapshot || workspace.profile.businessSectorRef || '-' }}</el-descriptions-item>
          <el-descriptions-item label="门店">{{ workspace.profile.storeDisplaySnapshot || workspace.profile.storeRef || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户引用">{{ workspace.profile.customerRef || '-' }}</el-descriptions-item>
          <el-descriptions-item label="品牌/车型">{{ vehicleName }}</el-descriptions-item>
          <el-descriptions-item label="VIN（脱敏）">{{ workspace.vehicle?.vinMasked || '-' }}</el-descriptions-item>
          <el-descriptions-item label="里程">{{ workspace.vehicle?.odometerKm ?? '-' }} km</el-descriptions-item>
          <el-descriptions-item label="销售市场">{{ workspace.vehicle?.salesMarket || '-' }}</el-descriptions-item>
          <el-descriptions-item label="方案版本">{{ workspace.profile.activePlanVersion || '-' }}</el-descriptions-item>
          <el-descriptions-item label="报价版本">{{ workspace.profile.activeQuoteVersion || '-' }}</el-descriptions-item>
          <el-descriptions-item label="解释版本">{{ workspace.profile.activeExplanationVersion || '-' }}</el-descriptions-item>
          <el-descriptions-item label="正式工单根">work_orders</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="检查 / 诊断 / 方案 / 报价" name="documents">
            <el-table :data="workspace.documents || []" stripe empty-text="暂无检查、诊断、方案或报价版本">
              <el-table-column label="类型" min-width="145">
                <template #default="{ row }">{{ documentLabel(row.documentType) }}</template>
              </el-table-column>
              <el-table-column prop="version" label="版本" width="80" />
              <el-table-column label="状态" width="120">
                <template #default="{ row }"><el-tag effect="plain">{{ statusLabel(row.status) }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="summary" label="一致口径摘要" min-width="260" show-overflow-tooltip />
              <el-table-column label="来源" width="100">
                <template #default="{ row }">{{ row.generatedBy === 'ai' ? 'AI 草稿' : '人工' }}</template>
              </el-table-column>
              <el-table-column label="审核时间" min-width="165">
                <template #default="{ row }">{{ dateTime(row.reviewedAt) }}</template>
              </el-table-column>
            </el-table>

            <h3>客户确认请求</h3>
            <el-table :data="workspace.confirmationRequests || []" stripe empty-text="暂无客户确认请求">
              <el-table-column prop="planVersion" label="方案版本" width="105" />
              <el-table-column prop="quoteVersion" label="报价版本" width="105" />
              <el-table-column prop="explanationVersion" label="解释版本" width="105" />
              <el-table-column prop="channel" label="渠道" width="100" />
              <el-table-column prop="recipientMasked" label="接收方（脱敏）" min-width="140" />
              <el-table-column label="状态" width="110">
                <template #default="{ row }">{{ confirmationLabel(row.status) }}</template>
              </el-table-column>
              <el-table-column label="请求时间" min-width="165">
                <template #default="{ row }">{{ dateTime(row.requestedAt) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="维修任务 / 工时 / 配件" name="execution">
            <h3>维修任务</h3>
            <el-table :data="workspace.tasks || []" stripe empty-text="暂无维修任务">
              <el-table-column prop="title" label="任务" min-width="180" show-overflow-tooltip />
              <el-table-column prop="planItemRef" label="确认方案项目" min-width="150" show-overflow-tooltip />
              <el-table-column prop="technicianEmployeeId" label="技师 ID" width="100" />
              <el-table-column label="状态" width="110">
                <template #default="{ row }">{{ statusLabel(row.status) }}</template>
              </el-table-column>
              <el-table-column prop="reworkOfInspectionId" label="返工关联质检" min-width="125" />
              <el-table-column label="完成时间" min-width="165">
                <template #default="{ row }">{{ dateTime(row.completedAt) }}</template>
              </el-table-column>
            </el-table>

            <div class="two-column">
              <section>
                <h3>工时项目</h3>
                <el-table :data="workspace.laborItems || []" stripe empty-text="暂无工时项目">
                  <el-table-column prop="name" label="项目" min-width="130" />
                  <el-table-column prop="hours" label="工时" width="80" />
                  <el-table-column prop="unitPrice" label="单价" width="100" />
                  <el-table-column prop="amount" label="金额" width="100" />
                </el-table>
              </section>
              <section>
                <h3>配件关联</h3>
                <el-table :data="workspace.partLinks || []" stripe empty-text="暂无配件关联">
                  <el-table-column prop="materialId" label="材料 ID" width="95" />
                  <el-table-column prop="quantity" label="数量" width="80" />
                  <el-table-column prop="status" label="状态" min-width="100" />
                  <el-table-column prop="planItemRef" label="方案项目" min-width="130" />
                </el-table>
              </section>
            </div>
          </el-tab-pane>

          <el-tab-pane label="质检 / 交车 / 保修" name="quality">
            <h3>质检记录</h3>
            <el-table :data="workspace.qualityInspections || []" stripe empty-text="暂无质检记录">
              <el-table-column prop="result" label="结果" width="110" />
              <el-table-column prop="summary" label="质检摘要" min-width="240" show-overflow-tooltip />
              <el-table-column prop="inspectorEmployeeId" label="质检人 ID" width="110" />
              <el-table-column label="质检时间" min-width="165">
                <template #default="{ row }">{{ dateTime(row.createdAt) }}</template>
              </el-table-column>
            </el-table>

            <div class="two-column">
              <section>
                <h3>交车记录</h3>
                <el-descriptions v-if="workspace.delivery" :column="1" border>
                  <el-descriptions-item label="交车状态">{{ workspace.delivery.status || '已记录' }}</el-descriptions-item>
                  <el-descriptions-item label="交车时间">{{ dateTime(workspace.delivery.deliveredAt || workspace.delivery.createdAt) }}</el-descriptions-item>
                  <el-descriptions-item label="交车摘要">{{ workspace.delivery.summary || '-' }}</el-descriptions-item>
                </el-descriptions>
                <el-empty v-else description="尚未交车" :image-size="64" />
              </section>
              <section>
                <h3>保修记录</h3>
                <el-table :data="workspace.warranties || []" stripe empty-text="暂无保修记录">
                  <el-table-column prop="scope" label="保修范围" min-width="140" />
                  <el-table-column prop="status" label="状态" width="90" />
                  <el-table-column label="到期时间" min-width="150">
                    <template #default="{ row }">{{ dateTime(row.expiresAt) }}</template>
                  </el-table-column>
                </el-table>
              </section>
            </div>
          </el-tab-pane>

          <el-tab-pane label="AI 辅助 / 安全边界" name="ai">
            <el-alert
              type="info"
              :closable="false"
              show-icon
              title="AI 只辅助故障判断、方案草稿、案例/视频参考和客户解释一致性；不能形成最终诊断，也不能确认价格、付款、出库、完工、质检、交车或客户权益。"
            />
            <h3>AI 草稿状态（不提供执行按钮）</h3>
            <el-table :data="workspace.aiDrafts || []" stripe empty-text="暂无 AI 辅助草稿">
              <el-table-column prop="draftType" label="草稿类型" min-width="150" />
              <el-table-column prop="status" label="状态" width="110" />
              <el-table-column prop="basisVersion" label="依据版本" width="110" />
              <el-table-column label="创建时间" min-width="165">
                <template #default="{ row }">{{ dateTime(row.createdAt) }}</template>
              </el-table-column>
            </el-table>

            <div class="safety-grid">
              <div>
                <span>资金门槛</span>
                <strong>{{ financeReadinessLabel }}</strong>
                <small>来源：{{ workspace.financeReadiness?.source || 'finance_collection_order' }}</small>
              </div>
              <div>
                <span>库存真源</span>
                <strong>{{ workspace.boundaries?.inventorySource || 'inventory_transactions' }}</strong>
                <small>本入口不执行领料或出库</small>
              </div>
              <div>
                <span>审批真源</span>
                <strong>{{ workspace.boundaries?.approvalSource || 'approval_requests' }}</strong>
                <small>本入口不审批</small>
              </div>
              <div>
                <span>助手执行权</span>
                <strong>{{ workspace.boundaries?.assistantMayExecute === false ? '无' : '未授予' }}</strong>
                <small>只查询、草稿、请求确认、进度</small>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getOwnerRepairWorkOrder,
  getOwnerRepairWorkspace,
  type OwnerRepairWorkOrder,
  type OwnerRepairWorkspace,
} from '../../api/owner-repair-readonly';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const activeTab = ref('documents');
const workOrder = ref<OwnerRepairWorkOrder | null>(null);
const workspace = ref<OwnerRepairWorkspace | null>(null);
const workspaceError = ref('');
const workOrderId = computed(() => String(route.params.id ?? ''));
const invalidId = computed(() => !/^[1-9][0-9]*$/.test(workOrderId.value));

const lifecycleOrder = [
  'intake_inspection',
  'diagnosis_quotation',
  'customer_confirmation',
  'repair_execution',
  'quality_inspection',
  'ready_for_delivery',
  'delivered',
  'after_sales',
  'closed',
];

const ProcessBlueprint = defineComponent({
  setup() {
    const stages = [
      ['客户 / 车辆', '显示正式工单客户、脱敏手机号和内部授权完整车牌'],
      ['接车检查', '查看检查版本、摘要与审核状态'],
      ['诊断报价', '查看诊断、维修方案、报价及客户解释的一致版本'],
      ['客户确认', '查看请求渠道、脱敏接收方、绑定版本和确认状态'],
      ['维修施工', '查看方案项目覆盖、技师任务、工时和配件关联'],
      ['质量检验', '查看质检结论以及返工关联是否闭环'],
      ['交车', '查看确认收款门槛、质检门槛和交车记录'],
      ['售后保修', '查看保修范围、状态和到期时间'],
    ];
    return () => h('div', { class: 'blueprint' }, [
        h('strong', '汽修 MVP 流程'),
        h('p', '客户/车辆 → 接车检查 → 诊断报价 → 客户确认 → 配件领料/施工 → 质检 → 交车 → 售后'),
        h(
          'div',
          { class: 'blueprint-stages' },
          stages.map(([title, detail]) =>
            h('div', { class: 'blueprint-stage' }, [h('b', title), h('small', detail)]),
          ),
        ),
      ]);
  },
});

const lifecycleStep = computed(() => {
  const status = String(workspace.value?.profile?.lifecycleStatus ?? '');
  const index = lifecycleOrder.indexOf(status);
  if (index < 0) return 0;
  if (index <= 0) return 0;
  if (index === 1) return 1;
  if (index === 2) return 2;
  if (index === 3) return 3;
  if (index <= 5) return 4;
  return 6;
});

const vehicleName = computed(() => {
  const vehicle = workspace.value?.vehicle;
  return [vehicle?.brand, vehicle?.model, vehicle?.modelYear].filter(Boolean).join(' ') || '-';
});

const financeReadinessLabel = computed(() => {
  const finance = workspace.value?.financeReadiness;
  if (!finance) return '未提供';
  if (finance.ready === true) return `已确认覆盖（${money(finance.readyAmount)}）`;
  return `未满足（已确认 ${money(finance.readyAmount)} / 应收 ${money(finance.requiredQuoteTotal)}）`;
});

async function loadData() {
  if (invalidId.value) return;
  loading.value = true;
  workspaceError.value = '';
  try {
    const [workOrderResult, workspaceResult] = await Promise.allSettled([
      getOwnerRepairWorkOrder(workOrderId.value),
      getOwnerRepairWorkspace(workOrderId.value),
    ]);
    if (workOrderResult.status === 'fulfilled') {
      workOrder.value = workOrderResult.value.data.data;
    } else {
      throw workOrderResult.reason;
    }
    if (workspaceResult.status === 'fulfilled') {
      workspace.value = workspaceResult.value.data.data;
    } else {
      workspace.value = null;
      const status = workspaceResult.reason?.response?.status;
      workspaceError.value = status === 403
        ? '历史工单尚未建立可验证的组织/门店汽修作用域，系统已按权限边界拒绝展开。'
        : '当前没有可读取的汽修扩展数据；正式工单信息仍可正常验收。';
    }
  } finally {
    loading.value = false;
  }
}

function safeMaskedMobile(value?: string | null) {
  if (!value) return '未提供';
  const compact = value.trim();
  if (/^\d{3}\*{4}\d{4}$/.test(compact)) return compact;
  const digits = compact.replace(/\D/g, '');
  if (digits.length >= 7) return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  return '已隐藏';
}

function money(value?: string | number | null) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? `¥${numberValue.toFixed(2)}` : '¥0.00';
}

function dateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false });
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  review_pending: '待审核',
  approved: '已审核',
  authorized: '已授权',
  superseded: '已被新版本替代',
  stale: '已失效',
  pending: '待处理',
  accepted: '已接受',
  confirmed: '已确认',
  rejected: '已拒绝',
  cancelled: '已取消',
  in_progress: '进行中',
  completed: '已完成',
  closed: '已关闭',
};

function statusLabel(status?: string) {
  return statusLabels[status ?? ''] ?? status ?? '-';
}

function statusType(status?: string) {
  if (['completed', 'closed', 'confirmed'].includes(status ?? '')) return 'success';
  if (['cancelled', 'rejected'].includes(status ?? '')) return 'info';
  if (status === 'in_progress') return 'primary';
  return 'warning';
}

const lifecycleLabels: Record<string, string> = {
  intake_inspection: '接车检查',
  diagnosis_quotation: '诊断报价',
  customer_confirmation: '客户确认',
  repair_execution: '维修施工',
  quality_inspection: '质检',
  rework_required: '返工中',
  ready_for_delivery: '待交车',
  delivered: '已交车',
  after_sales: '售后',
  suspended: '已暂停',
  cancelled: '已取消',
  closed: '已关闭',
};

function lifecycleLabel(status?: string) {
  return lifecycleLabels[status ?? ''] ?? status ?? '-';
}

function confirmationLabel(status?: string) {
  const labels: Record<string, string> = {
    not_requested: '未请求',
    pending: '待客户确认',
    confirmed: '客户已确认',
    rejected: '客户已拒绝',
    expired: '已过期',
    cancelled: '已撤销',
  };
  return labels[status ?? ''] ?? statusLabel(status);
}

function documentLabel(type?: string) {
  const labels: Record<string, string> = {
    intake_inspection: '接车检查',
    diagnosis: '故障诊断',
    repair_plan: '维修方案',
    quote: '报价',
    customer_explanation: '客户解释',
  };
  return labels[type ?? ''] ?? type ?? '-';
}

onMounted(loadData);
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.toolbar,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title {
  color: #173c36;
  font-size: 18px;
  font-weight: 750;
}

.subtitle {
  margin-top: 6px;
  color: #66756f;
  font-size: 13px;
}

.summary {
  margin-top: 18px;
}

.status-grid,
.safety-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.metric,
.safety-grid > div {
  min-height: 84px;
  padding: 15px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  border: 1px solid #dbe8e3;
  border-radius: 10px;
  background: #f8fbfa;
}

.metric span,
.safety-grid span {
  color: #6d7975;
  font-size: 12px;
}

.metric strong,
.safety-grid strong {
  color: #143f38;
  font-size: 16px;
  overflow-wrap: anywhere;
}

.metric.plate strong {
  font-size: 22px;
  letter-spacing: 0.08em;
}

.safety-grid small {
  color: #7a8782;
}

.lifecycle {
  margin: 10px 0 28px;
}

.two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

h3 {
  margin: 22px 0 12px;
  color: #264a44;
  font-size: 15px;
}

:global(.blueprint) {
  margin-top: 18px;
  padding: 18px;
  border-radius: 10px;
  color: #234a43;
  background: #f0f7f4;
}

:global(.blueprint p) {
  margin: 8px 0 0;
  color: #61726d;
}

:global(.blueprint-stages) {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

:global(.blueprint-stage) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid #d7e8e2;
  border-radius: 8px;
  background: #fff;
}

:global(.blueprint-stage small) {
  color: #65756f;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .status-grid,
  .safety-grid,
  .two-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :global(.blueprint-stages) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .status-grid,
  .safety-grid,
  .two-column {
    grid-template-columns: 1fr;
  }

  :global(.blueprint-stages) {
    grid-template-columns: 1fr;
  }
}
</style>
