<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">资金真相对照 Pilot</div>
            <div class="subtitle">
              当前继续保持只读对照口径，只补未来银行真相源接入前所需的稳定映射键准备层，不新增写入对象、不自动闭环。
            </div>
          </div>
        </div>
      </template>

      <el-alert type="info" :closable="false" class="page-alert" show-icon>
        <template #title>列表先回答“这条主干现在靠什么挂、还缺什么挂、下一步先补什么锚点”</template>
        <div>
          `mappingReadinessStatus` 只反映未来银行真相源接入准备度，不改变当前 truthLevel、reconciliationStatus、
          也不改变任何人工确认边界。
        </div>
      </el-alert>

      <el-table :data="tableData" v-loading="loading" class="truth-table">
        <el-table-column label="主对象" min-width="300">
          <template #default="{ row }">
            <div class="cell-stack">
              <div class="cell-title-row">
                <span class="cell-title">{{ row.primaryObjectNo || `#${row.primaryObjectId}` }}</span>
                <el-tag effect="plain" size="small">
                  {{ formatObjectType(row.primaryObjectType) }}
                </el-tag>
              </div>
              <div class="cell-meta">
                <span>状态：{{ row.primaryObjectStatus || '-' }}</span>
                <span>视图：{{ row.visibilityScope === 'full' ? '完整视图' : '收口视图' }}</span>
              </div>
              <div class="cell-summary">{{ row.summary || '-' }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="真相级别 / 当前对照" min-width="240">
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div class="tag-row">
                <el-tag :type="sourceRoleTagType(row.sourceRole)">
                  {{ formatSourceRole(row.sourceRole) }}
                </el-tag>
                <el-tag :type="truthLevelTagType(row.truthLevel)">
                  {{ formatTruthLevel(row.truthLevel) }}
                </el-tag>
              </div>
              <div class="tag-row">
                <el-tag :type="reconciliationStatusTagType(row.reconciliationStatus)">
                  {{ formatReconciliationStatus(row.reconciliationStatus) }}
                </el-tag>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="映射准备度" min-width="180">
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div class="tag-row">
                <el-tag :type="mappingReadinessTagType(row.mappingReadinessStatus)">
                  {{ formatMappingReadinessStatus(row.mappingReadinessStatus) }}
                </el-tag>
              </div>
              <div class="muted-text">
                置信度：{{ formatAnchorConfidence(row.mappingReadiness?.anchorConfidence) }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="锚点方案摘要" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ row.anchorPlanSummary || '-' }}</div>
              <div class="muted-text">
                {{ row.mappingReadiness?.futureTruthIngestionBoundary || '-' }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="下一步谁处理" min-width="180">
          <template #default="{ row }">
            <div class="muted-text">{{ formatOwnerRole(row.nextOwnerRole) }}</div>
          </template>
        </el-table-column>

        <el-table-column label="推荐动作" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-stack compact">
              <div>{{ row.listSummary || '-' }}</div>
              <div class="muted-text">{{ row.recommendedNextStep || '-' }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">
            <ReadableDateTime :value="row.updatedAt || row.createdAt || row.sortTime" />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="router.push(`/fund-truth-reconciliations/${row.primaryObjectType}/${row.primaryObjectId}`)"
            >
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          layout="total, sizes, prev, pager, next"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="loadData"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  getFundTruthReconciliations,
  type FundTruthReconciliationRecord,
} from '../../api/fund-truth-reconciliations';
import ReadableDateTime from '../../components/ReadableDateTime.vue';

const router = useRouter();

const loading = ref(false);
const tableData = ref<FundTruthReconciliationRecord[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getFundTruthReconciliations({
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    tableData.value = data.data.list || [];
    pagination.total = data.data.total || 0;
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || '资金真相对照列表加载失败',
    );
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(size: number) {
  pagination.pageSize = size;
  pagination.page = 1;
  void loadData();
}

function formatObjectType(value?: string) {
  switch (value) {
    case 'approval_request':
      return '审批控制对象';
    case 'payment_record':
      return '到账语义对象';
    case 'payout_record':
      return '付款登记对象';
    case 'abc_sync_fund':
      return '同步副本对象';
    default:
      return value || '-';
  }
}

function formatSourceRole(value?: string) {
  switch (value) {
    case 'approval_control':
      return 'approval_control';
    case 'business_arrival_semantics':
      return 'business_arrival_semantics';
    case 'payout_registration':
      return 'payout_registration';
    case 'sync_replica':
      return 'sync_replica';
    case 'report_only':
      return 'report_only';
    default:
      return value || '-';
  }
}

function formatTruthLevel(value?: string) {
  switch (value) {
    case 'supporting_source':
      return '辅助来源';
    case 'replica_only':
      return '副本专用';
    case 'not_truth_source':
      return '非真相源';
    default:
      return value || '-';
  }
}

function formatReconciliationStatus(value?: string) {
  switch (value) {
    case 'aligned':
      return '已对齐';
    case 'partially_aligned':
      return '部分对齐';
    case 'missing_link':
      return '缺少关联';
    case 'no_truth_source':
      return '没有真相源';
    case 'needs_manual_review':
      return '待人工复核';
    default:
      return value || '-';
  }
}

function formatOwnerRole(value?: string) {
  switch (value) {
    case 'approver_or_admin':
      return '审批人 / 管理员';
    case 'finance':
      return '财务';
    case 'finance_audit':
      return '财务复核';
    case 'finance_manual_review':
      return '财务人工复核';
    case 'finance_data_review':
      return '财务 / 数据复核';
    case 'admin_data_review':
      return '管理员 / 数据治理';
    case 'data_governance':
      return '数据治理';
    case 'business_requester':
      return '业务申请方';
    case 'shared_manual_review':
      return '人工复核';
    default:
      return value || '-';
  }
}

function formatMappingReadinessStatus(value?: string) {
  switch (value) {
    case 'ready':
      return '已就绪';
    case 'partially_ready':
      return '部分就绪';
    case 'weak_anchor_only':
      return '仅弱锚点';
    case 'not_ready':
      return '未就绪';
    default:
      return value || '-';
  }
}

function formatAnchorConfidence(value?: string) {
  switch (value) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
      return '低';
    default:
      return '-';
  }
}

function sourceRoleTagType(value?: string) {
  switch (value) {
    case 'approval_control':
      return 'warning';
    case 'business_arrival_semantics':
      return 'success';
    case 'payout_registration':
      return 'danger';
    case 'sync_replica':
      return 'info';
    default:
      return 'info';
  }
}

function truthLevelTagType(value?: string) {
  switch (value) {
    case 'supporting_source':
      return 'warning';
    case 'replica_only':
      return 'info';
    case 'not_truth_source':
      return 'danger';
    default:
      return 'info';
  }
}

function reconciliationStatusTagType(value?: string) {
  switch (value) {
    case 'aligned':
      return 'success';
    case 'partially_aligned':
      return 'warning';
    case 'missing_link':
      return 'danger';
    case 'no_truth_source':
      return 'info';
    case 'needs_manual_review':
      return 'warning';
    default:
      return 'info';
  }
}

function mappingReadinessTagType(value?: string) {
  switch (value) {
    case 'ready':
      return 'success';
    case 'partially_ready':
      return 'warning';
    case 'weak_anchor_only':
      return 'info';
    case 'not_ready':
      return 'danger';
    default:
      return 'info';
  }
}

onMounted(() => {
  void loadData();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.subtitle {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
}

.page-alert {
  margin-bottom: 16px;
}

.cell-stack {
  display: grid;
  gap: 8px;
}

.cell-stack.compact {
  gap: 6px;
}

.cell-title-row,
.tag-row,
.cell-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cell-title {
  font-weight: 600;
  color: #111827;
}

.cell-meta,
.muted-text {
  font-size: 12px;
  line-height: 1.5;
  color: #6b7280;
}

.cell-summary {
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
