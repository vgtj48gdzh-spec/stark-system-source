<template>
  <div class="page-stack">
    <el-card v-loading="loading">
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">积点兑换详情</div>
            <div class="subtitle">
              兑换请求 #{{ redemptionId }} / {{ detailData?.requestStatus || '-' }} / {{ detailData?.redeemableName || '-' }}
            </div>
          </div>
          <div class="header-actions">
            <el-button @click="goBack">返回列表</el-button>
            <el-button
              v-if="detailData?.requestStatus === 'drafted'"
              type="primary"
              @click="handleConfirm"
            >
              确认请求
            </el-button>
            <el-button
              v-if="['confirmed', 'pending_fulfillment'].includes(detailData?.requestStatus || '')"
              type="success"
              @click="openFulfillDialog"
            >
              标记已在 ABC 履约
            </el-button>
            <el-button
              v-if="['drafted', 'confirmed', 'pending_fulfillment'].includes(detailData?.requestStatus || '')"
              type="danger"
              plain
              @click="handleCancel"
            >
              取消请求
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="detailData" class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">请求状态</div>
          <div class="summary-value">{{ detailData.requestStatus }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">对账状态</div>
          <div class="summary-value">{{ detailData.reconciliationStatus || '-' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">积点成本</div>
          <div class="summary-value">{{ formatMoney(detailData.pointsCost) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">目标价值</div>
          <div class="summary-value">{{ formatMoney(detailData.targetValue) }}</div>
        </div>
      </div>

      <div v-if="detailData" class="two-column">
        <div class="detail-block">
          <div class="block-title">兑换请求基本信息</div>
          <div class="detail-line">对象：{{ detailData.ownerType }} / {{ detailData.ownerId || '-' }}</div>
          <div class="detail-line">手机号：{{ detailData.ownerMobile || '-' }}</div>
          <div class="detail-line">兑换类型：{{ detailData.redeemableType || '-' }}</div>
          <div class="detail-line">兑换编码：{{ detailData.redeemableCode || '-' }}</div>
          <div class="detail-line">兑换名称：{{ detailData.redeemableName || '-' }}</div>
          <div class="detail-line">Provider：{{ detailData.providerSystem || '-' }}</div>
          <div class="detail-line">草拟来源：{{ detailData.requestSource || '-' }}</div>
          <div class="detail-line">原因短码：{{ detailData.reasonCode || '-' }}</div>
          <div class="detail-line">备注：{{ detailData.remark || '-' }}</div>
        </div>

        <div class="detail-block">
          <div class="block-title">履约信息</div>
          <div class="detail-line">申请：{{ detailData.requestedByName || '-' }} / {{ formatDateTime(detailData.requestedAt) }}</div>
          <div class="detail-line">确认：{{ detailData.confirmedByName || '-' }} / {{ formatDateTime(detailData.confirmedAt) }}</div>
          <div class="detail-line">履约：{{ detailData.fulfilledByName || '-' }} / {{ formatDateTime(detailData.fulfilledAt) }}</div>
          <div class="detail-line">取消：{{ detailData.cancelledByName || '-' }} / {{ formatDateTime(detailData.cancelledAt) }}</div>
          <div class="detail-line">externalEntityId：{{ detailData.externalEntityId || '-' }}</div>
          <div class="detail-line">externalNo：{{ detailData.externalNo || '-' }}</div>
          <div class="detail-line">建议动作：{{ detailData.suggestedAction || '-' }}</div>
          <div class="detail-line">下一步：{{ detailData.nextStepAfterDone || '-' }}</div>
        </div>
      </div>
    </el-card>

    <el-card v-if="detailData">
      <template #header><div class="section-title">总部积点账本影响</div></template>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">是否已回写 consume</div>
          <div class="summary-value">{{ detailData.consumeLedgerEntry ? '已回写' : '未回写' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">consume Ledger ID</div>
          <div class="summary-value">{{ detailData.consumeLedgerEntry?.id || '-' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">consume 时间</div>
          <div class="summary-value">{{ formatDateTime(detailData.consumeLedgerEntry?.executedAt) }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">consume 积点</div>
          <div class="summary-value">{{ formatMoney(detailData.consumeLedgerEntry?.changeAmount) }}</div>
        </div>
      </div>

      <el-table :data="detailData.relatedLedgerEntries || []" size="small">
        <el-table-column prop="id" label="Ledger ID" width="90" />
        <el-table-column prop="changeType" label="变动类型" width="110" />
        <el-table-column label="变动积点" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.changeAmount) }}</template>
        </el-table-column>
        <el-table-column label="余额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.balanceAfter) }}</template>
        </el-table-column>
        <el-table-column prop="sourceType" label="来源类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="reasonCode" label="原因短码" width="140" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
        <el-table-column label="执行时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.executedAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="detailData">
      <template #header><div class="section-title">ABC 对接影子信息</div></template>
      <div class="two-column">
        <div class="detail-block">
          <div class="block-title">ABC 履约摘要</div>
          <div class="detail-line">用户归属：{{ detailData.abcFulfillmentSummary?.abcUserMobile || detailData.ownerMobile || '-' }}</div>
          <div class="detail-line">ABC 用户 ID：{{ detailData.abcFulfillmentSummary?.abcUserId || '-' }}</div>
          <div class="detail-line">ABC 卡类型：{{ detailData.abcFulfillmentSummary?.cardTypeName || '-' }}</div>
          <div class="detail-line">卡模板 ID：{{ detailData.abcFulfillmentSummary?.cardTypeId || '-' }}</div>
          <div class="detail-line">履约匹配级别：{{ detailData.abcFulfillmentSummary?.matchLevel || '-' }}</div>
          <div class="detail-line">匹配说明：{{ detailData.abcFulfillmentSummary?.matchReason || '-' }}</div>
        </div>
        <div class="detail-block">
          <div class="block-title">影子记录</div>
          <div class="detail-line">外部实体 ID：{{ detailData.matchedAbcShadowRecord?.externalEntityId || detailData.externalEntityId || '-' }}</div>
          <div class="detail-line">外部单号：{{ detailData.matchedAbcShadowRecord?.externalNo || detailData.externalNo || '-' }}</div>
          <div class="detail-line">影子表：{{ detailData.matchedAbcShadowRecord?.sourceTable || '-' }}</div>
          <div class="detail-line">影子记录 ID：{{ detailData.matchedAbcShadowRecord?.shadowRecordId || '-' }}</div>
          <div class="detail-line">是否稳定命中：{{ detailData.matchedAbcShadowRecord?.matchLevel === 'stable' ? '是' : '否 / 待人工确认' }}</div>
        </div>
      </div>
    </el-card>

    <el-card v-if="detailData">
      <template #header><div class="section-title">对账与异常区</div></template>

      <el-alert :closable="false" show-icon type="warning">
        <template #title>当前对账结论</template>
        <div class="subtle-text">
          {{ detailData.reconciliationStatus || '-' }} / {{ detailData.reconciliationReason || '-' }}
        </div>
      </el-alert>

      <div class="tag-row">
        <el-tag
          v-for="flag in detailData.exceptionFlags || []"
          :key="flag"
          type="danger"
          effect="plain"
        >
          {{ flag }}
        </el-tag>
      </div>

      <div class="summary-block">
        <div class="summary-title">执行轨迹</div>
        <div class="summary-text">{{ detailData.commandExplanation?.summary || '-' }}</div>
      </div>
      <div class="summary-block">
        <div class="summary-title">泛化边界</div>
        <div class="summary-text">{{ detailData.generalizationBoundary || '-' }}</div>
      </div>

      <div class="evidence-grid">
        <div class="evidence-column">
          <div class="evidence-title">创始人原则</div>
          <div v-if="detailData.citedFounderMemories?.length" class="evidence-list">
            <div v-for="item in detailData.citedFounderMemories" :key="`fm-${item.id}`" class="evidence-item">
              <div class="evidence-name">{{ item.title }}</div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无创始人原则引用" :image-size="56" />
        </div>
        <div class="evidence-column">
          <div class="evidence-title">岗位规则</div>
          <div v-if="detailData.citedRoleMemories?.length" class="evidence-list">
            <div v-for="item in detailData.citedRoleMemories" :key="`rm-${item.id}`" class="evidence-item">
              <div class="evidence-name">{{ item.title }}</div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无岗位规则引用" :image-size="56" />
        </div>
        <div class="evidence-column">
          <div class="evidence-title">通用规则知识</div>
          <div v-if="detailData.citedKnowledge?.length" class="evidence-list">
            <div v-for="item in detailData.citedKnowledge" :key="`knowledge-${item.id}`" class="evidence-item">
              <div class="evidence-name">{{ item.title }}</div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无规则知识引用" :image-size="56" />
        </div>
        <div class="evidence-column">
          <div class="evidence-title">人工依据</div>
          <div v-if="detailData.citedManualDecisions?.length" class="evidence-list">
            <div
              v-for="item in detailData.citedManualDecisions"
              :key="`decision-${item.matchType}-${item.id}`"
              class="evidence-item"
            >
              <div class="evidence-name">
                {{ item.matchType === 'direct' ? '当前对象已有直接人审依据' : '相似模式人审经验' }}
              </div>
              <div class="evidence-summary">{{ item.summary }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无人工依据" :image-size="56" />
        </div>
      </div>

      <el-divider />

      <div class="two-column">
        <div class="detail-block">
          <div class="block-title">审计轨迹</div>
          <div v-if="detailData.auditTrail?.length" class="trace-list">
            <div v-for="item in detailData.auditTrail" :key="`${item.stage}-${item.timestamp}-${item.label}`" class="trace-item">
              <div class="trace-title">{{ item.label || item.stage }}</div>
              <div class="detail-line">时间：{{ formatDateTime(item.timestamp) }}</div>
              <div class="detail-line">人员：{{ item.actorName || '-' }}</div>
              <div class="detail-line">说明：{{ item.detail || '-' }}</div>
            </div>
          </div>
          <el-empty v-else description="暂无审计轨迹" :image-size="56" />
        </div>

        <div class="detail-block">
          <div class="block-title">操作日志</div>
          <el-table :data="detailData.executionTrace?.operationLogs || []" size="small">
            <el-table-column prop="action" label="动作" width="120" />
            <el-table-column prop="detail" label="说明" min-width="220" show-overflow-tooltip />
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-card>

    <AiSideAssistant
      page-title="积点兑换详情"
      route-path="/points/redemptions/:id"
      entity-type="points_redemption_request"
      :entity-id="String(redemptionId)"
      :current-filters="aiCurrentFilters"
      :source-action-id="aiSourceActionId"
    />

    <el-dialog v-model="fulfillDialogVisible" title="手工标记已在 ABC 履约" width="560px">
      <el-form label-width="120px">
        <el-form-item label="ABC 实体 ID">
          <el-input v-model="fulfillForm.externalEntityId" clearable />
        </el-form-item>
        <el-form-item label="ABC 单号">
          <el-input v-model="fulfillForm.externalNo" clearable />
        </el-form-item>
        <el-form-item label="履约备注">
          <el-input
            v-model="fulfillForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请填写已在 ABC 完成购物卡履约的凭据说明。"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fulfillDialogVisible = false">取消</el-button>
        <el-button type="success" :loading="fulfillLoading" @click="handleMarkFulfilled">
          标记已在 ABC 履约
        </el-button>
      </template>
    </el-dialog>
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
  getPointsRedemptionDetail,
  markPointsRedemptionFulfilled,
} from '../../api/points';
import { formatDateTime, formatMoney } from '../../utils/format';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const fulfillLoading = ref(false);
const detailData = ref<any | null>(null);
const fulfillDialogVisible = ref(false);

const fulfillForm = reactive({
  externalEntityId: '',
  externalNo: '',
  remark: '',
});

const redemptionId = computed(() => Number(route.params.id));
const aiSourceActionId = computed(() => {
  if (typeof route.query.sourceActionId === 'string' && route.query.sourceActionId.trim()) {
    return route.query.sourceActionId.trim();
  }
  return detailData.value?.sourceActionId || null;
});

const aiCurrentFilters = computed(() => ({
  routePath: route.path,
  requestStatus: detailData.value?.requestStatus || '',
  reconciliationStatus: detailData.value?.reconciliationStatus || '',
  sourceActionId: aiSourceActionId.value || undefined,
}));

async function loadDetail() {
  if (!Number.isFinite(redemptionId.value)) {
    detailData.value = null;
    return;
  }

  loading.value = true;
  try {
    const { data } = await getPointsRedemptionDetail(redemptionId.value, {
      sourceActionId: aiSourceActionId.value || undefined,
    });
    detailData.value = data.data;
    fulfillForm.externalEntityId = data.data.externalEntityId || '';
    fulfillForm.externalNo = data.data.externalNo || '';
    fulfillForm.remark = '';
  } finally {
    loading.value = false;
  }
}

async function handleConfirm() {
  await confirmPointsRedemption(redemptionId.value, {});
  ElMessage.success(`积点兑换请求 #${redemptionId.value} 已确认`);
  await loadDetail();
}

function openFulfillDialog() {
  fulfillDialogVisible.value = true;
}

async function handleMarkFulfilled() {
  if (!fulfillForm.remark.trim()) {
    ElMessage.warning('请填写履约备注');
    return;
  }

  fulfillLoading.value = true;
  try {
    await markPointsRedemptionFulfilled(redemptionId.value, {
      externalEntityId: fulfillForm.externalEntityId || undefined,
      externalNo: fulfillForm.externalNo || undefined,
      remark: fulfillForm.remark.trim(),
    });
    ElMessage.success(`积点兑换请求 #${redemptionId.value} 已标记为 ABC 履约完成`);
    fulfillDialogVisible.value = false;
    await loadDetail();
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '标记 ABC 履约失败');
  } finally {
    fulfillLoading.value = false;
  }
}

async function handleCancel() {
  await cancelPointsRedemption(redemptionId.value, {});
  ElMessage.success(`积点兑换请求 #${redemptionId.value} 已取消`);
  await loadDetail();
}

function goBack() {
  void router.push('/points/redemptions');
}

watch(
  () => route.fullPath,
  () => {
    void loadDetail();
  },
);

onMounted(() => {
  void loadDetail();
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

.header-actions,
.tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.title,
.section-title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle,
.subtle-text,
.detail-line,
.summary-text,
.evidence-summary {
  font-size: 12px;
  color: #6b7280;
}

.summary-grid,
.two-column,
.evidence-grid {
  display: grid;
  gap: 12px;
}

.summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.two-column,
.evidence-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.summary-card,
.detail-block,
.summary-block,
.evidence-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.summary-label,
.block-title,
.summary-title,
.evidence-title,
.evidence-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.summary-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.evidence-column {
  display: grid;
  gap: 8px;
}

.evidence-list {
  display: grid;
  gap: 8px;
}

.trace-list {
  display: grid;
  gap: 8px;
}

.trace-item {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

@media (max-width: 960px) {
  .summary-grid,
  .two-column,
  .evidence-grid {
    grid-template-columns: 1fr;
  }
}
</style>
