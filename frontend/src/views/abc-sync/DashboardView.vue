<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">{{ canViewBusinessDetails ? 'ABC 总经营概览' : 'ABC 同步健康概览' }}</div>
            <div class="subtitle">
              基于订单域、资金域、卡域、库存域 sync 层的只读整合视图，用于经营查看与映射治理。
            </div>
          </div>
          <div class="header-actions">
            <el-button v-if="canViewJobRuns" @click="router.push('/abc-sync/job-runs')">
              查看运行记录
            </el-button>
            <el-button v-if="canManageRules" type="primary" @click="router.push('/abc-sync/rules')">
              映射规则管理
            </el-button>
          </div>
        </div>
      </template>

      <el-form inline class="filters">
        <el-form-item label="来源表">
          <el-select v-model="filters.sourceTable" clearable style="width: 220px">
            <el-option
              v-for="item in sourceTableOptions"
              :key="item"
              :label="formatAbcSourceTable(item)"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="批次号">
          <el-input v-model="filters.batchNo" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="映射确认">
          <el-select v-model="filters.mappingConfirmed" clearable style="width: 160px">
            <el-option label="已确认" value="true" />
            <el-option label="未确认" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="同步时间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DDTHH:mm:ss"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-alert
      v-if="visibleNextActions?.calculationAnchorAt"
      type="info"
      :closable="false"
      show-icon
      class="ai-runtime-hint"
      title="AI 看板当前口径"
    >
      <template #default>
        <div class="ai-runtime-meta">
          <span>岗位：{{ activeAiRoleLabel }}</span>
          <span>时间桶：{{ activeTimeBucketLabel }}</span>
          <span>状态视角：{{ activeProcessingViewLabel }}</span>
          <span>分桶视角：{{ aiFilters.periodMode === 'week' ? '按周' : '按月' }}</span>
          <span>阻塞筛选：{{ aiFilters.onlyBlocking ? '仅阻塞' : '全部' }}</span>
          <span>计算时间：{{ formatDateTime(visibleNextActions?.calculationAnchorAt) }}</span>
          <span>生成时间：{{ formatDateTime(visibleNextActions?.generatedAt) }}</span>
          <span v-if="visibleNextActions?.calculationFingerprint">
            口径指纹：{{ visibleNextActions.calculationFingerprint }}
          </span>
        </div>
      </template>
    </el-alert>

    <AiNextActionsBoard
      :loading="loading"
      :data="visibleNextActions"
      :error-message="aiLoadError"
      :role="aiFilters.role"
      :due-level="aiFilters.dueLevel"
      :only-blocking="aiFilters.onlyBlocking"
      :period-mode="aiFilters.periodMode"
      :time-bucket="aiFilters.timeBucket"
      :processing-view="aiFilters.processingView"
      :role-options="aiRoleOptions"
      :due-level-options="aiDueLevelOptions"
      :time-bucket-options="aiTimeBucketOptions"
      :processing-view-options="aiProcessingViewOptions"
      :active-role-label="activeAiRoleLabel"
      :active-due-level-label="activeDueLevelLabel"
      :active-time-bucket-label="activeTimeBucketLabel"
      :active-processing-view-label="activeProcessingViewLabel"
      @update:role="handleAiRoleChange"
      @update:due-level="handleAiDueLevelChange"
      @update:only-blocking="handleAiOnlyBlockingChange"
      @update:period-mode="handleAiPeriodModeChange"
      @update:time-bucket="handleAiTimeBucketChange"
      @update:processing-view="handleAiProcessingViewChange"
      @refresh="loadData"
    />

    <el-card v-if="false" v-loading="loading">
      <template #header>
        <div class="section-header">
          <div class="section-title">AI建议你现在做这些事</div>
          <div class="subtitle">只做提醒和引导，不会自动执行，也不会跳过人工确认。</div>
        </div>
      </template>
      <div v-if="!hasNextActionTasks" class="empty-tip">
        当前没有新的引导任务，已处理链路会继续按现有规则运行。
      </div>
      <div v-else class="ai-panel">
        <div v-for="section in nextActionSections" :key="section.key" class="ai-section">
          <div class="ai-section-title">{{ section.title }}</div>
          <div v-if="!section.items.length" class="empty-tip">当前暂无此类任务。</div>
          <div v-else class="ai-task-list">
            <div v-for="task in section.items" :key="task.taskType" class="ai-task-item">
              <div class="ai-task-main">
                <div class="ai-task-header">
                  <div class="ai-task-name">{{ task.taskName }}</div>
                  <el-tag size="small" :type="getTaskTagType(task.priority)">
                    {{ task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级' }}
                  </el-tag>
                </div>
                <div class="ai-task-meta">
                  <span>数量：{{ task.relatedCount }}</span>
                  <span>影响金额：{{ formatTaskAmount(task.relatedAmount) }}</span>
                  <span>负责人：{{ getOwnerRoleLabel(task.ownerRole) }}</span>
                  <span>截止：{{ formatTaskDeadline(task.deadline) }}</span>
                </div>
                <div class="ai-task-hint">{{ task.suggestedAction }}</div>
                <div class="ai-task-sources">
                  <span
                    v-for="source in task.sourceBreakdown"
                    :key="`${task.taskType}-${source.source}`"
                    class="ai-task-source"
                  >
                    {{ source.source }}：{{ source.count }}
                    <template v-if="source.amount"> / {{ formatTaskAmount(source.amount) }}</template>
                  </span>
                </div>
              </div>
              <el-button type="primary" link @click="router.push(task.relatedPagePath)">
                一键跳转
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card v-loading="loading">
          <el-statistic title="当前异常总数" :value="dashboard?.syncHealth?.currentExceptionCount ?? 0" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card v-loading="loading">
          <el-statistic title="待治理数量" :value="dashboard?.remediation?.currentUnconfirmedCount ?? 0" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card v-loading="loading">
          <el-statistic title="最近批次" :value="dashboard?.syncHealth?.latestBatchNo || '-'" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card v-loading="loading">
          <el-statistic
            :title="canViewBusinessDetails ? '资金总额' : '最近成功运行'"
            :value="
              canViewBusinessDetails
                ? formatMoney(dashboard?.fundOverview?.amountTotal || '0.00')
                : dashboard?.syncHealth?.recentRunSummary?.success ?? 0
            "
          />
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="canViewBusinessDetails" :gutter="16">
      <el-col :xs="24" :xl="12">
        <el-card v-loading="loading">
          <template #header>
            <div class="section-header">
              <div class="section-title">订单概览</div>
              <el-space>
                <el-button v-if="canViewOrders" text @click="router.push('/abc-sync/orders')">
                  查看订单明细
                </el-button>
                <el-button
                  v-if="canViewMappingExceptions"
                  text
                  @click="router.push('/abc-sync/mapping-exceptions')"
                >
                  查看异常
                </el-button>
              </el-space>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="总订单数">{{ dashboard?.orderOverview?.total ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="已确认映射">
              {{ dashboard?.orderOverview?.mappingSummary?.confirmed ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="未确认映射">
              {{ dashboard?.orderOverview?.mappingSummary?.unconfirmed ?? 0 }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="mini-title">来源表分布</div>
          <el-table :data="dashboard?.orderOverview?.sourceTableCounts ?? []" size="small">
            <el-table-column label="来源表" min-width="140">
              <template #default="{ row }">{{ formatAbcSourceTable(row.key) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="90" />
          </el-table>
          <div class="mini-title">标准状态分布</div>
          <el-table :data="dashboard?.orderOverview?.statusDistribution ?? []" size="small">
            <el-table-column label="标准状态" min-width="140">
              <template #default="{ row }">{{ formatAbcStatus(row.key) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="90" />
          </el-table>
        </el-card>
      </el-col>

      <el-col :xs="24" :xl="12">
        <el-card v-loading="loading">
          <template #header>
            <div class="section-header">
              <div class="section-title">资金概览</div>
              <el-space>
                <el-button v-if="canViewFunds" text @click="router.push('/abc-sync/funds')">
                  查看资金明细
                </el-button>
                <el-button
                  v-if="canViewMappingExceptions"
                  text
                  @click="router.push('/abc-sync/mapping-exceptions')"
                >
                  查看异常
                </el-button>
              </el-space>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="总记录数">{{ dashboard?.fundOverview?.total ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="金额汇总">
              {{ formatMoney(dashboard?.fundOverview?.amountTotal || '0.00') }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="mini-title">资金类型分布</div>
          <el-table :data="dashboard?.fundOverview?.fundTypeDistribution ?? []" size="small">
            <el-table-column label="资金类型" min-width="140">
              <template #default="{ row }">{{ formatAbcFundType(row.key) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="90" />
          </el-table>
          <div class="mini-title">标准状态分布</div>
          <el-table :data="dashboard?.fundOverview?.statusDistribution ?? []" size="small">
            <el-table-column label="标准状态" min-width="140">
              <template #default="{ row }">{{ formatAbcStatus(row.key) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="90" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="canViewBusinessDetails" :gutter="16">
      <el-col :xs="24" :xl="12">
        <el-card v-loading="loading">
          <template #header>
            <div class="section-header">
              <div class="section-title">卡域概览</div>
              <el-space>
                <el-button v-if="canViewCards" text @click="router.push('/abc-sync/cards')">
                  查看卡片
                </el-button>
                <el-button v-if="canViewCards" text @click="router.push('/abc-sync/card-ledger')">
                  查看卡流水
                </el-button>
                <el-button
                  v-if="canViewCardExceptions"
                  text
                  @click="router.push('/abc-sync/card-mapping-exceptions')"
                >
                  查看异常
                </el-button>
              </el-space>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="卡总数">{{ dashboard?.cardOverview?.cardTotal ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="卡流水总数">
              {{ dashboard?.cardOverview?.cardLedgerTotal ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="账户余额汇总">
              {{ formatMoney(dashboard?.cardOverview?.cardBalanceTotal || '0.00') }}
            </el-descriptions-item>
            <el-descriptions-item label="流水金额汇总">
              {{ formatMoney(dashboard?.cardOverview?.ledgerAmountTotal || '0.00') }}
            </el-descriptions-item>
            <el-descriptions-item label="总金额汇总">
              {{ formatMoney(dashboard?.cardOverview?.amountTotal || '0.00') }}
            </el-descriptions-item>
            <el-descriptions-item label="未确认映射">
              {{ dashboard?.cardOverview?.mappingSummary?.unconfirmed ?? 0 }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="mini-title">来源表分布</div>
          <el-table :data="dashboard?.cardOverview?.sourceTableCounts ?? []" size="small">
            <el-table-column label="来源表" min-width="140">
              <template #default="{ row }">{{ formatAbcSourceTable(row.key) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="90" />
          </el-table>
        </el-card>
      </el-col>

      <el-col :xs="24" :xl="12">
        <el-card v-loading="loading">
          <template #header>
            <div class="section-header">
              <div class="section-title">库存域概览</div>
              <el-space>
                <el-button v-if="canViewInventory" text @click="router.push('/abc-sync/materials')">
                  材料
                </el-button>
                <el-button v-if="canViewInventory" text @click="router.push('/abc-sync/suppliers')">
                  供应商
                </el-button>
                <el-button v-if="canViewInventory" text @click="router.push('/abc-sync/warehouses')">
                  库房
                </el-button>
                <el-button v-if="canViewInventory" text @click="router.push('/abc-sync/inventory-ledger')">
                  库存流水
                </el-button>
                <el-button
                  v-if="canViewInventoryExceptions"
                  text
                  @click="router.push('/abc-sync/inventory-mapping-exceptions')"
                >
                  查看异常
                </el-button>
              </el-space>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="材料数">{{ dashboard?.inventoryOverview?.materialCount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="供应商数">
              {{ dashboard?.inventoryOverview?.supplierCount ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="库房数">{{ dashboard?.inventoryOverview?.warehouseCount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="库存流水数">
              {{ dashboard?.inventoryOverview?.inventoryLedgerCount ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="已确认映射">
              {{ dashboard?.inventoryOverview?.mappingSummary?.confirmed ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="未确认映射">
              {{ dashboard?.inventoryOverview?.mappingSummary?.unconfirmed ?? 0 }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="mini-title">来源表分布</div>
          <el-table :data="dashboard?.inventoryOverview?.sourceTableCounts ?? []" size="small">
            <el-table-column label="来源表" min-width="140">
              <template #default="{ row }">{{ formatAbcSourceTable(row.key) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="90" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :xs="24" :xl="12">
        <el-card v-loading="loading">
          <template #header>
            <div class="section-header">
              <div class="section-title">同步健康总览</div>
              <el-button v-if="canViewJobRuns" text @click="router.push('/abc-sync/job-runs')">
                查看运行记录
              </el-button>
            </div>
          </template>

          <el-descriptions :column="1" border>
            <el-descriptions-item label="最近批次">
              {{ dashboard?.syncHealth?.latestBatchNo || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="最近运行">
              <template v-if="dashboard?.syncHealth?.latestRun">
                {{ formatAbcSourceTable(dashboard.syncHealth.latestRun.sourceTable) }}
                / {{ formatAbcRunStatus(dashboard.syncHealth.latestRun.runStatus) }}
                / {{ formatDateTime(dashboard.syncHealth.latestRun.startedAt) }}
              </template>
              <template v-else>-</template>
            </el-descriptions-item>
            <el-descriptions-item label="最近成功次数">
              {{ dashboard?.syncHealth?.recentRunSummary?.success ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="最近失败次数">
              {{ dashboard?.syncHealth?.recentRunSummary?.failed ?? 0 }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="mini-title">异常域分布</div>
          <el-table :data="dashboard?.syncHealth?.exceptionDomainDistribution ?? []" size="small">
            <el-table-column label="业务域" min-width="120">
              <template #default="{ row }">{{ formatAbcTargetDomain(row.key) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="90" />
          </el-table>

          <div class="mini-title">最近检查点</div>
          <el-table :data="dashboard?.syncHealth?.latestCheckpoints ?? []" size="small">
            <el-table-column label="来源表" min-width="140">
              <template #default="{ row }">{{ formatAbcSourceTable(row.sourceTable) }}</template>
            </el-table-column>
            <el-table-column prop="checkpointKey" label="检查点键" min-width="140" />
            <el-table-column prop="checkpointValue" label="检查点值" min-width="180" show-overflow-tooltip />
            <el-table-column label="同步时间" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                <ReadableDateTime :value="row.lastSyncedAt" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :xs="24" :xl="12">
        <el-card v-loading="loading">
          <template #header>
            <div class="section-header">
              <div class="section-title">待治理总览</div>
              <el-space>
                <el-button
                  v-for="entry in visibleGovernanceEntries"
                  :key="entry.path"
                  text
                  @click="router.push(entry.path)"
                >
                  {{ entry.label }}
                </el-button>
              </el-space>
            </div>
          </template>

          <el-descriptions :column="1" border>
            <el-descriptions-item label="当前未确认映射">
              {{ dashboard?.remediation?.currentUnconfirmedCount ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="未命中规则来源表">
              <template v-if="dashboard?.remediation?.missingRuleSourceTables?.length">
                <el-space wrap>
                  <el-tag
                    v-for="item in dashboard.remediation.missingRuleSourceTables"
                    :key="item"
                    type="warning"
                  >
                    {{ formatAbcSourceTable(item) }}
                  </el-tag>
                </el-space>
              </template>
              <template v-else>暂无</template>
            </el-descriptions-item>
          </el-descriptions>

          <div class="mini-title">按域分布</div>
          <el-table :data="dashboard?.remediation?.unconfirmedByDomain ?? []" size="small">
            <el-table-column label="业务域" min-width="120">
              <template #default="{ row }">{{ formatAbcTargetDomain(row.key) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="90" />
          </el-table>

          <div class="mini-title">按来源表分布</div>
          <el-table :data="dashboard?.remediation?.unresolvedSourceTables ?? []" size="small">
            <el-table-column label="来源表" min-width="140">
              <template #default="{ row }">{{ formatAbcSourceTable(row.key) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="90" />
          </el-table>

          <div class="mini-title">最近新增异常</div>
          <el-table :data="dashboard?.remediation?.recentExceptions ?? []" size="small">
            <el-table-column label="业务域" min-width="100">
              <template #default="{ row }">{{ formatAbcTargetDomain(row.targetDomain) }}</template>
            </el-table-column>
            <el-table-column label="来源表" min-width="140">
              <template #default="{ row }">{{ formatAbcSourceTable(row.sourceTable) }}</template>
            </el-table-column>
            <el-table-column prop="mappingNotes" label="映射说明" min-width="220" show-overflow-tooltip />
            <el-table-column label="同步时间" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                <ReadableDateTime :value="row.syncedAt" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getAiNextActions } from '../../api/ai';
import { getAbcSyncDashboard } from '../../api/abc-sync';
import AiNextActionsBoard from './components/AiNextActionsBoard.vue';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatDateTime, formatMoney } from '../../utils/format';
import { currentRoleCode, hasAnyRole, hasPermission, roleProfiles, type RoleCode } from '../../utils/permissions';
import {
  formatAbcFundType,
  formatAbcRunStatus,
  formatAbcSourceTable,
  formatAbcStatus,
  formatAbcTargetDomain,
} from '../../utils/abc-sync';

const router = useRouter();
const sourceTableOptions = [
  'order',
  'repair_order',
  'supermarket_order',
  'top_up_order',
  'transaction',
  'shopping_card',
  'user_shopping_card',
  'user_shopping_card_money',
  'user_shopping_card_recharge',
  'merchant_material',
  'merchant_supplier',
  'merchant_warehouse',
  'merchant_warehouse_out',
];
const loading = ref(false);
const dashboard = ref<any>(null);
const nextActions = ref<any>(null);
const dateRange = ref<[string, string] | []>([]);
const aiRequestSequence = ref(0);
const aiRoleOptions = [
  { label: '全部岗位', value: '' },
  { label: '创始人', value: 'founder' },
  { label: '财务', value: 'finance' },
  { label: '管理员', value: 'admin' },
  { label: '审批人', value: 'approver' },
  { label: '操作员', value: 'operator' },
  { label: '门店负责人', value: 'store_manager' },
  { label: '客服', value: 'customer_service' },
];
const aiDueLevelOptions = [
  { label: '全部紧急度', value: '' },
  { label: '今天必须处理', value: 'must_handle_today' },
  { label: '本周建议处理', value: 'should_handle_this_week' },
  { label: '可延后', value: 'can_defer' },
];
const aiTimeBucketOptions = [
  { label: '全部时间桶', value: '' },
  { label: '本周', value: 'this_week' },
  { label: '上周', value: 'last_week' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '未来', value: 'future' },
  { label: '历史待处理', value: 'backlog_history' },
];
const aiProcessingViewOptions = [
  { label: '当前待办', value: 'current' },
  { label: '已暂缓', value: 'deferred' },
  { label: '已完成', value: 'done' },
  { label: '全部', value: 'all' },
];
const filters = reactive({
  sourceTable: '',
  batchNo: '',
  mappingConfirmed: '',
});
const aiFilters = reactive({
  role: currentRoleCode.value,
  dueLevel: '',
  onlyBlocking: false,
  periodMode: 'month',
  timeBucket: '',
  processingView: 'current',
});
const aiLoadError = ref('');

const canManageRules = computed(() => hasPermission('abcSync.rules.manage'));
const canViewJobRuns = computed(() => hasPermission('abcSync.jobRuns.view'));
const canViewOrders = computed(() => hasPermission('abcSync.orders.view'));
const canViewFunds = computed(() => hasPermission('abcSync.funds.view'));
const canViewCards = computed(() => hasPermission('abcSync.cards.view'));
const canViewInventory = computed(() => hasPermission('abcSync.inventoryLedger.view'));
const canViewMappingExceptions = computed(() => hasPermission('abcSync.mappingExceptions.view'));
const canViewCardExceptions = computed(() => hasPermission('abcSync.cardMappingExceptions.view'));
const canViewInventoryExceptions = computed(() =>
  hasPermission('abcSync.inventoryMappingExceptions.view'),
);
const canViewBusinessDetails = computed(
  () =>
    canViewOrders.value ||
    canViewFunds.value ||
    canViewCards.value ||
    canViewInventory.value,
);

const visibleGovernanceEntries = computed(() =>
  (dashboard.value?.remediation?.governanceEntries ?? []).filter((item: any) =>
    hasAnyRole(item.allowedRoles as RoleCode[]),
  ),
);
const nextActionSections = computed(() => [
  {
    key: 'mustHandleToday',
    title: '今日必须处理',
    items: nextActions.value?.mustHandleToday ?? [],
  },
  {
    key: 'recommended',
    title: '建议处理',
    items: nextActions.value?.recommended ?? [],
  },
  {
    key: 'canDefer',
    title: '可延后',
    items: nextActions.value?.canDefer ?? [],
  },
]);
const hasNextActionTasks = computed(() =>
  nextActionSections.value.some((section) => Array.isArray(section.items) && section.items.length > 0),
);

const activeAiRoleLabel = computed(
  () => aiRoleOptions.find((item) => item.value === aiFilters.role)?.label ?? '全部岗位',
);
const activeDueLevelLabel = computed(
  () => aiDueLevelOptions.find((item) => item.value === aiFilters.dueLevel)?.label ?? '全部紧急度',
);
const activeTimeBucketLabel = computed(
  () => aiTimeBucketOptions.find((item) => item.value === aiFilters.timeBucket)?.label ?? '全部时间桶',
);
const activeProcessingViewLabel = computed(
  () =>
    aiProcessingViewOptions.find((item) => item.value === aiFilters.processingView)?.label ?? '当前待办',
);

const visibleNextActions = computed(() => {
  const source = nextActions.value;
  if (!source) {
    return source;
  }

  const actionItems = (source.actionItems ?? []).filter((item: any) => {
    if (aiFilters.processingView === 'deferred') {
      return item.processingStatus === 'deferred';
    }
    if (aiFilters.processingView === 'done') {
      return item.processingStatus === 'done' || item.processingStatus === 'ignored';
    }
    if (aiFilters.processingView === 'all') {
      return true;
    }
    return !['deferred', 'done', 'ignored'].includes(item.processingStatus);
  });

  return {
    ...source,
    actionItems,
    mustHandleToday: actionItems.filter((item: any) => item.dueLevel === 'must_handle_today'),
    recommended: actionItems.filter((item: any) => item.dueLevel === 'should_handle_this_week'),
    canDefer: actionItems.filter((item: any) => item.dueLevel === 'can_defer'),
  };
});

async function loadData() {
  const requestId = ++aiRequestSequence.value;
  loading.value = true;
  aiLoadError.value = '';
  try {
    const [dashboardResult, nextActionsResult] = await Promise.allSettled([
      getAbcSyncDashboard({
        sourceTable: filters.sourceTable || undefined,
        batchNo: filters.batchNo || undefined,
        mappingConfirmed: filters.mappingConfirmed || undefined,
        dateFrom: dateRange.value[0],
        dateTo: dateRange.value[1],
      }),
      getAiNextActions({
        role: aiFilters.role || undefined,
        dueLevel: aiFilters.dueLevel || undefined,
        onlyBlocking: aiFilters.onlyBlocking || undefined,
        timeBucket: aiFilters.timeBucket || undefined,
        periodMode: aiFilters.periodMode || undefined,
        includeDeferred: ['deferred', 'all'].includes(aiFilters.processingView) || undefined,
        includeDone: ['done', 'all'].includes(aiFilters.processingView) || undefined,
        backlogOnly: aiFilters.timeBucket === 'backlog_history' || undefined,
      }),
    ]);

    if (requestId !== aiRequestSequence.value) {
      return;
    }

    if (dashboardResult.status === 'fulfilled') {
      dashboard.value = dashboardResult.value.data.data;
    }
    if (nextActionsResult.status === 'fulfilled') {
      nextActions.value = nextActionsResult.value.data.data;
    } else {
      nextActions.value = null;
      aiLoadError.value = normalizeErrorMessage(nextActionsResult.reason);
    }
  } finally {
    if (requestId === aiRequestSequence.value) {
      loading.value = false;
    }
  }
}

function normalizeErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const maybeAxios = (error as any).response?.data?.message;
    if (maybeAxios) {
      return Array.isArray(maybeAxios) ? maybeAxios.join('；') : String(maybeAxios);
    }
    if ((error as Error).message) {
      return (error as Error).message;
    }
  }
  return 'AI 状态层暂时不可用，请稍后重试。';
}

function formatTaskAmount(value: string | null | undefined) {
  if (!value) {
    return '按权限隐藏';
  }
  return formatMoney(value);
}

function formatTaskDeadline(value: string | null | undefined) {
  if (!value) {
    return '-';
  }
  return formatDateTime(value);
}

function getTaskTagType(priority: string) {
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'info';
}

function getOwnerRoleLabel(roleCode: string) {
  return roleProfiles[roleCode as keyof typeof roleProfiles]?.label ?? roleCode;
}

function handleAiRoleChange(value: string) {
  aiFilters.role = value;
}

function handleAiDueLevelChange(value: string) {
  aiFilters.dueLevel = value;
}

function handleAiOnlyBlockingChange(value: boolean) {
  aiFilters.onlyBlocking = value;
}

function handleAiPeriodModeChange(value: string) {
  aiFilters.periodMode = value || 'month';
}

function handleAiTimeBucketChange(value: string) {
  aiFilters.timeBucket = value;
}

function handleAiProcessingViewChange(value: string) {
  aiFilters.processingView = value || 'current';
}

function resetFilters() {
  filters.sourceTable = '';
  filters.batchNo = '';
  filters.mappingConfirmed = '';
  dateRange.value = [];
  loadData();
}

onMounted(loadData);
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 16px;
}

.ai-runtime-hint {
  margin-top: -4px;
}

.ai-runtime-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  font-size: 12px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.filters {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
}

.mini-title {
  margin-top: 16px;
  font-size: 13px;
  font-weight: 600;
}

.ai-panel {
  display: grid;
  gap: 16px;
}

.ai-section {
  display: grid;
  gap: 12px;
}

.ai-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.ai-task-list {
  display: grid;
  gap: 12px;
}

.ai-task-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.ai-task-main {
  display: grid;
  gap: 8px;
}

.ai-task-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ai-task-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.ai-task-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #6b7280;
}

.ai-task-hint {
  font-size: 12px;
  color: #374151;
}

.ai-task-sources {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-task-source {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 2px 8px;
}

.empty-tip {
  font-size: 12px;
  color: #6b7280;
}
</style>
