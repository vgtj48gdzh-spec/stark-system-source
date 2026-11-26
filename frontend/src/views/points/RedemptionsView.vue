<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">积点兑换请求</div>
            <div class="subtitle">
              先在总部创建兑换草稿，再由高权限人工确认，最后手工标记已在 ABC 履约并回写 consume ledger。
            </div>
          </div>
          <el-tag v-if="aiSourceActionId" type="warning">
            来自 AI 行动项：{{ aiSourceActionId }}
          </el-tag>
        </div>
      </template>

      <el-form inline class="filters">
        <el-form-item label="状态">
          <el-select v-model="filters.requestStatus" clearable style="width: 170px">
            <el-option label="草稿" value="drafted" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="待履约" value="pending_fulfillment" />
            <el-option label="ABC 已履约" value="fulfilled_in_abc" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="对账状态">
          <el-select v-model="filters.reconciliationStatus" clearable style="width: 200px">
            <el-option label="待确认" value="waiting_confirmation" />
            <el-option label="待履约" value="waiting_fulfillment" />
            <el-option label="已履约待 consume" value="fulfilled_pending_consume" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="失败" value="failed" />
            <el-option label="对账异常待复核" value="mismatch_needs_review" />
          </el-select>
        </el-form-item>
        <el-form-item label="兑换类型">
          <el-select v-model="filters.redeemableType" clearable style="width: 180px">
            <el-option label="ABC 购物卡" value="abc_shopping_card" />
          </el-select>
        </el-form-item>
        <el-form-item label="异常标记">
          <el-select v-model="filters.exceptionFlag" clearable style="width: 220px">
            <el-option label="ABC 已履约但总部未 consume" value="abc_fulfilled_but_no_consume" />
            <el-option label="总部已 consume 但 ABC 缺履约" value="consume_written_but_no_abc_fulfillment" />
            <el-option label="手机号映射冲突" value="mobile_mapping_conflict" />
            <el-option label="重复兑换请求" value="duplicate_redemption_request" />
            <el-option label="待履约超时" value="stale_pending_fulfillment" />
            <el-option label="已确认未履约超时" value="stale_confirmed_not_fulfilled" />
            <el-option label="ABC 影子记录缺失" value="external_record_missing" />
          </el-select>
        </el-form-item>
        <el-form-item label="兑换目录">
          <el-select v-model="filters.redeemableCode" clearable filterable style="width: 220px">
            <el-option
              v-for="item in redeemableTable"
              :key="item.id"
              :label="`${item.redeemableName} / ${item.pointsCost || '-'} 积点`"
              :value="item.redeemableCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Provider">
          <el-select v-model="filters.providerSystem" clearable style="width: 140px">
            <el-option label="ABC" value="abc" />
          </el-select>
        </el-form-item>
        <el-form-item label="周期">
          <el-date-picker
            v-model="filters.periodKey"
            type="month"
            value-format="YYYY-MM"
            format="YYYY-MM"
            clearable
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD HH:mm:ss"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            clearable
            style="width: 320px"
          />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="filters.ownerMobile" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="仅已履约">
          <el-switch v-model="filters.fulfilledOnly" />
        </el-form-item>
        <el-form-item label="已回写 consume">
          <el-select v-model="filters.hasConsumeLedger" clearable style="width: 150px">
            <el-option label="是" value="true" />
            <el-option label="否" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-loading="loading.redeemables">
      <template #header>
        <div class="section-title">可兑换目录（当前只启用 ABC 购物卡）</div>
      </template>

      <el-table :data="redeemableTable" size="small">
        <el-table-column prop="redeemableCode" label="兑换编码" width="180" />
        <el-table-column prop="redeemableName" label="兑换名称" min-width="180" />
        <el-table-column prop="providerSystem" label="Provider" width="120" />
        <el-table-column prop="providerEntityId" label="ABC 实体 ID" width="120" />
        <el-table-column label="积点成本" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.pointsCost) }}</template>
        </el-table-column>
        <el-table-column label="目标价值" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.faceValue) }}</template>
        </el-table-column>
        <el-table-column prop="sceneScope" label="场景" min-width="140" show-overflow-tooltip />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleUseRedeemable(row)">选用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card>
      <template #header><div class="section-title">创建兑换草稿</div></template>

      <el-form :model="draftForm" label-width="110px" class="draft-form">
        <div class="form-grid">
          <el-form-item label="对象类型">
            <el-select v-model="draftForm.ownerType" style="width: 180px">
              <el-option label="客户" value="customer" />
              <el-option label="员工" value="employee" />
            </el-select>
          </el-form-item>
          <el-form-item label="对象 ID">
            <el-input-number v-model="draftForm.ownerId" :min="1" :step="1" controls-position="right" />
          </el-form-item>
          <el-form-item label="对象手机号">
            <el-input v-model="draftForm.ownerMobile" clearable />
          </el-form-item>
          <el-form-item label="兑换编码">
            <el-select v-model="draftForm.redeemableCode" filterable style="width: 220px">
              <el-option
                v-for="item in redeemableTable"
                :key="item.id"
                :label="`${item.redeemableName} / ${item.redeemableCode}`"
                :value="item.redeemableCode"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="积点成本">
            <el-input v-model="draftForm.pointsCost" />
          </el-form-item>
          <el-form-item label="目标价值">
            <el-input v-model="draftForm.targetValue" />
          </el-form-item>
          <el-form-item label="原因短码">
            <el-input v-model="draftForm.reasonCode" clearable />
          </el-form-item>
          <el-form-item label="备注" class="full-width">
            <el-input
              v-model="draftForm.remark"
              type="textarea"
              :rows="2"
              placeholder="例如：总部积点兑换到 ABC 购物卡，等待人工确认与履约。"
            />
          </el-form-item>
        </div>
        <div class="inline-actions">
          <el-button type="primary" :loading="loading.createDraft" @click="handleCreateDraft">
            创建兑换草稿
          </el-button>
        </div>
      </el-form>
    </el-card>

    <el-card v-loading="loading.requests">
      <template #header><div class="section-title">兑换请求列表</div></template>

      <el-table :data="requestTable" size="small">
        <el-table-column prop="id" label="请求 ID" width="90" />
        <el-table-column prop="requestStatus" label="状态" width="130" />
        <el-table-column prop="reconciliationStatus" label="对账状态" width="180" />
        <el-table-column label="对象" min-width="180">
          <template #default="{ row }">
            <div>{{ row.ownerType }} / {{ row.ownerId || '-' }}</div>
            <div class="sub-cell">{{ row.ownerMobile || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="redeemableName" label="兑换对象" min-width="180" show-overflow-tooltip />
        <el-table-column label="积点成本" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.pointsCost) }}</template>
        </el-table-column>
        <el-table-column label="目标价值" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.targetValue) }}</template>
        </el-table-column>
        <el-table-column prop="requestSource" label="草拟来源" width="120" />
        <el-table-column label="异常" min-width="220">
          <template #default="{ row }">
            <div v-if="row.exceptionFlags?.length" class="tag-row">
              <el-tag
                v-for="flag in row.exceptionFlags"
                :key="`${row.id}-${flag}`"
                size="small"
                type="danger"
                effect="plain"
              >
                {{ flag }}
              </el-tag>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="consume 回写" width="120">
          <template #default="{ row }">{{ row.consumeLedgerEntry ? '已回写' : '未回写' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleOpenDetail(row.id)">详情</el-button>
            <el-button
              v-if="row.requestStatus === 'drafted'"
              size="small"
              type="primary"
              @click="handleConfirm(row.id)"
            >
              确认
            </el-button>
            <el-button
              v-if="['confirmed', 'pending_fulfillment'].includes(row.requestStatus)"
              size="small"
              type="success"
              @click="handleOpenDetail(row.id)"
            >
              去履约
            </el-button>
            <el-button
              v-if="['drafted', 'confirmed', 'pending_fulfillment'].includes(row.requestStatus)"
              size="small"
              type="danger"
              plain
              @click="handleCancel(row.id)"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next"
        :total="requestTotal"
        :page-size="requestQuery.pageSize"
        :current-page="requestQuery.page"
        @current-change="handleRequestPageChange"
      />
    </el-card>

    <AiSideAssistant
      page-title="积点兑换请求"
      route-path="/points/redemptions"
      entity-type="points_redemption_request"
      :entity-id="assistantEntityId"
      :current-filters="assistantFilters"
      :source-action-id="aiSourceActionId"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import {
  cancelPointsRedemption,
  confirmPointsRedemption,
  createPointsRedemptionDraft,
  getPointsRedeemables,
  getPointsRedemptions,
} from '../../api/points';
import { formatMoney } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const loading = reactive({
  redeemables: false,
  requests: false,
  createDraft: false,
});

const filters = reactive({
  requestStatus: typeof route.query.requestStatus === 'string' ? route.query.requestStatus : '',
  reconciliationStatus:
    typeof route.query.reconciliationStatus === 'string' ? route.query.reconciliationStatus : '',
  exceptionFlag: typeof route.query.exceptionFlag === 'string' ? route.query.exceptionFlag : '',
  redeemableType: typeof route.query.redeemableType === 'string' ? route.query.redeemableType : '',
  redeemableCode: typeof route.query.redeemableCode === 'string' ? route.query.redeemableCode : '',
  providerSystem: typeof route.query.providerSystem === 'string' ? route.query.providerSystem : '',
  periodKey: typeof route.query.periodKey === 'string' ? route.query.periodKey : '',
  dateFrom: typeof route.query.dateFrom === 'string' ? route.query.dateFrom : '',
  dateTo: typeof route.query.dateTo === 'string' ? route.query.dateTo : '',
  ownerMobile: typeof route.query.ownerMobile === 'string' ? route.query.ownerMobile : '',
  fulfilledOnly:
    route.query.fulfilledOnly === 'true'
      ? true
      : route.query.fulfilledOnly === 'false'
        ? false
        : false,
  hasConsumeLedger:
    typeof route.query.hasConsumeLedger === 'string' ? route.query.hasConsumeLedger : '',
});

const requestQuery = reactive({
  page: 1,
  pageSize: 10,
});

const dateRange = ref<string[]>(filters.dateFrom || filters.dateTo ? [filters.dateFrom || '', filters.dateTo || ''] : []);

const draftForm = reactive({
  ownerType: 'customer',
  ownerId: undefined as number | undefined,
  ownerMobile: '',
  redeemableCode: typeof route.query.redeemableCode === 'string' ? route.query.redeemableCode : '',
  pointsCost: '200.00',
  targetValue: '200.00',
  reasonCode: '',
  remark: '',
});

const redeemableTable = ref<any[]>([]);
const requestTable = ref<any[]>([]);
const requestTotal = ref(0);

const aiSourceActionId = computed(() =>
  typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()
    ? route.query.sourceActionId.trim()
    : null,
);

const assistantEntityId = computed(() => {
  const raw = route.query.redemptionId;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return null;
});

const assistantFilters = computed(() => ({
  requestStatus: filters.requestStatus || undefined,
  reconciliationStatus: filters.reconciliationStatus || undefined,
  exceptionFlag: filters.exceptionFlag || undefined,
  redeemableType: filters.redeemableType || undefined,
  redeemableCode: filters.redeemableCode || undefined,
  providerSystem: filters.providerSystem || undefined,
  periodKey: filters.periodKey || undefined,
  dateFrom: filters.dateFrom || undefined,
  dateTo: filters.dateTo || undefined,
  ownerMobile: filters.ownerMobile || undefined,
  fulfilledOnly: filters.fulfilledOnly ? 'true' : undefined,
  hasConsumeLedger: filters.hasConsumeLedger || undefined,
  sourceActionId: aiSourceActionId.value || undefined,
}));

function syncRouteQuery(extra: Record<string, string | undefined>) {
  void router.replace({
    path: '/points/redemptions',
    query: {
      requestStatus: filters.requestStatus || undefined,
      reconciliationStatus: filters.reconciliationStatus || undefined,
      exceptionFlag: filters.exceptionFlag || undefined,
      redeemableType: filters.redeemableType || undefined,
      redeemableCode: filters.redeemableCode || undefined,
      providerSystem: filters.providerSystem || undefined,
      periodKey: filters.periodKey || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      ownerMobile: filters.ownerMobile || undefined,
      fulfilledOnly: filters.fulfilledOnly ? 'true' : undefined,
      hasConsumeLedger: filters.hasConsumeLedger || undefined,
      sourceActionId: aiSourceActionId.value || undefined,
      ...extra,
    },
  });
}

function buildRequestParams() {
  return {
    page: requestQuery.page,
    pageSize: requestQuery.pageSize,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    requestStatus: filters.requestStatus || undefined,
    reconciliationStatus: filters.reconciliationStatus || undefined,
    exceptionFlag: filters.exceptionFlag || undefined,
    redeemableType: filters.redeemableType || undefined,
    redeemableCode: filters.redeemableCode || undefined,
    providerSystem: filters.providerSystem || undefined,
    periodKey: filters.periodKey || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    ownerMobile: filters.ownerMobile || undefined,
    fulfilledOnly: filters.fulfilledOnly ? 'true' : undefined,
    hasConsumeLedger: filters.hasConsumeLedger || undefined,
  };
}

async function loadRedeemables() {
  loading.redeemables = true;
  try {
    const { data } = await getPointsRedeemables({
      providerSystem: 'abc',
      sceneScope: 'points_redemption',
    });
    redeemableTable.value = data.data.list || [];
  } finally {
    loading.redeemables = false;
  }
}

async function loadRequests() {
  loading.requests = true;
  try {
    const { data } = await getPointsRedemptions(buildRequestParams());
    requestTable.value = data.data.list || [];
    requestTotal.value = data.data.total || 0;
  } finally {
    loading.requests = false;
  }
}

async function loadAll() {
  await Promise.all([loadRedeemables(), loadRequests()]);
}

function applyRedeemablePreset(code: string) {
  const matched = redeemableTable.value.find((item) => item.redeemableCode === code);
  if (!matched) {
    return;
  }
  draftForm.redeemableCode = matched.redeemableCode;
  draftForm.pointsCost = matched.pointsCost || draftForm.pointsCost || '200.00';
  draftForm.targetValue = matched.faceValue || draftForm.targetValue || '200.00';
}

function handleUseRedeemable(row: any) {
  draftForm.redeemableCode = row.redeemableCode;
  draftForm.pointsCost = row.pointsCost || '200.00';
  draftForm.targetValue = row.faceValue || '200.00';
  filters.redeemableCode = row.redeemableCode;
  syncRouteQuery({ redeemableCode: row.redeemableCode });
}

async function handleCreateDraft() {
  if (!draftForm.redeemableCode) {
    ElMessage.warning('请先选择兑换目录');
    return;
  }
  if (!draftForm.ownerMobile && !draftForm.ownerId) {
    ElMessage.warning('ownerMobile / ownerId 至少填写一个');
    return;
  }

  loading.createDraft = true;
  try {
    const { data } = await createPointsRedemptionDraft({
      ownerType: draftForm.ownerType,
      ownerId: draftForm.ownerId || undefined,
      ownerMobile: draftForm.ownerMobile || undefined,
      redeemableCode: draftForm.redeemableCode,
      pointsCost: draftForm.pointsCost,
      targetValue: draftForm.targetValue,
      reasonCode: draftForm.reasonCode || undefined,
      remark: draftForm.remark || undefined,
      requestSource: 'manual',
      sourceActionId: aiSourceActionId.value || undefined,
      normalizedPayload: { routePath: route.path },
    });
    const created = data.data;
    ElMessage.success(`积点兑换草稿已创建：#${created.id} / ${created.requestStatus}`);
    await loadRequests();
    void router.push({
      path: `/points/redemptions/${created.id}`,
      query: {
        sourceActionId: aiSourceActionId.value || undefined,
      },
    });
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '创建积点兑换草稿失败');
  } finally {
    loading.createDraft = false;
  }
}

async function handleConfirm(id: number) {
  await confirmPointsRedemption(id, {});
  ElMessage.success(`积点兑换请求 #${id} 已确认`);
  await loadRequests();
}

async function handleCancel(id: number) {
  await cancelPointsRedemption(id, {});
  ElMessage.success(`积点兑换请求 #${id} 已取消`);
  await loadRequests();
}

function handleOpenDetail(id: number) {
  void router.push({
    path: `/points/redemptions/${id}`,
    query: {
      sourceActionId: aiSourceActionId.value || undefined,
    },
  });
}

function handleSearch() {
  requestQuery.page = 1;
  filters.dateFrom = dateRange.value?.[0] || '';
  filters.dateTo = dateRange.value?.[1] || '';
  syncRouteQuery({});
  void loadRequests();
}

function resetFilters() {
  filters.requestStatus = '';
  filters.reconciliationStatus = '';
  filters.exceptionFlag = '';
  filters.redeemableType = '';
  filters.redeemableCode = '';
  filters.providerSystem = '';
  filters.periodKey = '';
  filters.dateFrom = '';
  filters.dateTo = '';
  filters.ownerMobile = '';
  filters.fulfilledOnly = false;
  filters.hasConsumeLedger = '';
  dateRange.value = [];
  requestQuery.page = 1;
  syncRouteQuery({
    requestStatus: undefined,
    reconciliationStatus: undefined,
    exceptionFlag: undefined,
    redeemableType: undefined,
    redeemableCode: undefined,
    providerSystem: undefined,
    periodKey: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    ownerMobile: undefined,
    fulfilledOnly: undefined,
    hasConsumeLedger: undefined,
  });
  void loadRequests();
}

function handleRequestPageChange(page: number) {
  requestQuery.page = page;
  void loadRequests();
}

watch(
  () => route.query,
  () => {
    filters.requestStatus = typeof route.query.requestStatus === 'string' ? route.query.requestStatus : '';
    filters.reconciliationStatus =
      typeof route.query.reconciliationStatus === 'string' ? route.query.reconciliationStatus : '';
    filters.exceptionFlag = typeof route.query.exceptionFlag === 'string' ? route.query.exceptionFlag : '';
    filters.redeemableType = typeof route.query.redeemableType === 'string' ? route.query.redeemableType : '';
    filters.redeemableCode = typeof route.query.redeemableCode === 'string' ? route.query.redeemableCode : '';
    filters.providerSystem = typeof route.query.providerSystem === 'string' ? route.query.providerSystem : '';
    filters.periodKey = typeof route.query.periodKey === 'string' ? route.query.periodKey : '';
    filters.dateFrom = typeof route.query.dateFrom === 'string' ? route.query.dateFrom : '';
    filters.dateTo = typeof route.query.dateTo === 'string' ? route.query.dateTo : '';
    filters.ownerMobile = typeof route.query.ownerMobile === 'string' ? route.query.ownerMobile : '';
    filters.fulfilledOnly =
      route.query.fulfilledOnly === 'true'
        ? true
        : route.query.fulfilledOnly === 'false'
          ? false
          : false;
    filters.hasConsumeLedger =
      typeof route.query.hasConsumeLedger === 'string' ? route.query.hasConsumeLedger : '';
    dateRange.value =
      filters.dateFrom || filters.dateTo ? [filters.dateFrom || '', filters.dateTo || ''] : [];

    if (filters.redeemableCode) {
      applyRedeemablePreset(filters.redeemableCode);
    }

    void loadRequests();
  },
);

onMounted(() => {
  void loadAll().then(() => {
    if (filters.redeemableCode) {
      applyRedeemablePreset(filters.redeemableCode);
    }
  });
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.title,
.section-title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle,
.sub-cell {
  font-size: 12px;
  color: #6b7280;
}

.filters,
.inline-actions,
.tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.draft-form {
  margin-top: 4px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.full-width {
  grid-column: 1 / -1;
}

.pager {
  margin-top: 12px;
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
