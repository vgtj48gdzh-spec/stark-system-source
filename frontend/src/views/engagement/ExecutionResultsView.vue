<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">执行结果</div>
          <div class="subtitle">
            回看灰度执行记录、模板效果、执行人差异和未成交原因，为规则校正提供直接依据。
          </div>
        </div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="灰度批次">
        <el-input v-model="filters.batchCode" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="场景">
        <el-select v-model="filters.scenarioCode" clearable style="width: 180px">
          <el-option label="A端洗车卡宣传" value="a_wash_card_promo" />
          <el-option label="员工福利说明" value="employee_benefit_notice" />
        </el-select>
      </el-form-item>
      <el-form-item label="任务ID">
        <el-input-number v-model="filters.taskId" :min="1" style="width: 150px" />
      </el-form-item>
      <el-form-item label="执行人ID">
        <el-input-number v-model="filters.executedBy" :min="1" style="width: 150px" />
      </el-form-item>
      <el-form-item label="结果状态">
        <el-select v-model="filters.resultStatus" clearable style="width: 140px">
          <el-option label="已记录" value="recorded" />
          <el-option label="已复核" value="reviewed" />
          <el-option label="已忽略" value="ignored" />
        </el-select>
      </el-form-item>
      <el-form-item label="执行时间">
        <el-date-picker
          v-model="filters.dateRange"
          type="datetimerange"
          unlink-panels
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          value-format="YYYY-MM-DD HH:mm:ss"
          style="width: 360px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">任务数</div>
        <div class="summary-value">{{ summary.overview.taskCount || 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">已确认</div>
        <div class="summary-value">{{ summary.overview.confirmedCount || 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">已执行</div>
        <div class="summary-value">{{ summary.overview.executedCount || 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">已回复</div>
        <div class="summary-value">{{ summary.overview.repliedCount || 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">已成交</div>
        <div class="summary-value">{{ summary.overview.convertedCount || 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">已忽略</div>
        <div class="summary-value">{{ summary.overview.ignoredCount || 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">回复率</div>
        <div class="summary-value">{{ formatRate(summary.overview.replyRate) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">转化率</div>
        <div class="summary-value">{{ formatRate(summary.overview.conversionRate) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">平均响应时长</div>
        <div class="summary-value">{{ formatMinutes(summary.overview.averageResponseMinutes) }}</div>
      </div>
    </div>

    <el-row :gutter="16" class="summary-sections">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>执行方案效果摘要</template>
          <el-table :data="summary.byPlaybook" size="small">
            <el-table-column label="方案" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.playbookName || '-' }}
                <div class="sub-cell">{{ formatExecutionScenario(row.scenarioCode, row.scenarioName) }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="taskCount" label="任务数" width="70" />
            <el-table-column prop="executedCount" label="已执行" width="70" />
            <el-table-column label="回复率" width="90">
              <template #default="{ row }">{{ formatRate(row.replyRate) }}</template>
            </el-table-column>
            <el-table-column label="转化率" width="90">
              <template #default="{ row }">{{ formatRate(row.conversionRate) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>未成交原因汇总</template>
          <div v-if="summary.topNonConversionReasons.length" class="reason-list">
            <el-tag
              v-for="item in summary.topNonConversionReasons"
              :key="item.reason"
              class="reason-tag"
              type="warning"
            >
              {{ item.reason }} x {{ item.count }}
            </el-tag>
          </div>
          <el-empty v-else description="当前筛选范围内暂无未成交原因" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="summary-sections">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>模板效果对比</template>
          <el-table :data="summary.byTemplate" size="small">
            <el-table-column label="模板" min-width="190" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.templateName || '-' }}
                <div class="sub-cell">{{ row.templateGroup || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="executedCount" label="样本" width="70" />
            <el-table-column label="回复率" width="90">
              <template #default="{ row }">{{ formatRate(row.replyRate) }}</template>
            </el-table-column>
            <el-table-column label="转化率" width="90">
              <template #default="{ row }">{{ formatRate(row.conversionRate) }}</template>
            </el-table-column>
            <el-table-column label="平均响应" width="100">
              <template #default="{ row }">{{ formatMinutes(row.averageResponseMinutes) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>执行人结果对比</template>
          <el-table :data="summary.byOperator" size="small">
            <el-table-column label="执行人" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.realName || row.username || `用户#${row.operatorId}` }}
                <div class="sub-cell">ID {{ row.operatorId || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="executedCount" label="已执行" width="70" />
            <el-table-column label="回复率" width="90">
              <template #default="{ row }">{{ formatRate(row.replyRate) }}</template>
            </el-table-column>
            <el-table-column label="转化率" width="90">
              <template #default="{ row }">{{ formatRate(row.conversionRate) }}</template>
            </el-table-column>
            <el-table-column label="平均响应" width="100">
              <template #default="{ row }">{{ formatMinutes(row.averageResponseMinutes) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="summary-sections">
      <template #header>规则校正建议</template>
      <el-row :gutter="16">
        <el-col :span="12">
          <div class="section-title">建议保留</div>
          <ul class="plain-list" v-if="summary.ruleCalibration.keepRules.length">
            <li v-for="item in summary.ruleCalibration.keepRules" :key="item.ruleId || item.ruleCode">
              {{ item.ruleName || item.ruleCode }}：{{ item.reason }}
            </li>
          </ul>
          <el-empty v-else description="暂无明确保留项" :image-size="72" />
        </el-col>
        <el-col :span="12">
          <div class="section-title">建议调整</div>
          <ul class="plain-list" v-if="summary.ruleCalibration.adjustRules.length">
            <li v-for="item in summary.ruleCalibration.adjustRules" :key="item.ruleId || item.ruleCode || item.reason">
              {{ item.ruleName || item.ruleCode || '未命名规则' }}：{{ item.reason }}
            </li>
          </ul>
          <el-empty v-else description="暂无明确调整项" :image-size="72" />
        </el-col>
      </el-row>
    </el-card>

    <el-table :data="tableData" v-loading="loading" class="results-table">
      <el-table-column prop="id" label="结果ID" width="90" />
      <el-table-column prop="taskId" label="任务ID" width="90" />
      <el-table-column prop="taskItemId" label="明细ID" width="90" />
      <el-table-column label="执行对象" min-width="140">
        <template #default="{ row }">{{ formatSubjectType(row.subjectType) }} {{ row.subjectId }}</template>
      </el-table-column>
      <el-table-column prop="merchantId" label="商户ID" width="90" />
      <el-table-column prop="businessType" label="业务类型" min-width="140" show-overflow-tooltip />
      <el-table-column prop="scriptTemplateId" label="模板ID" width="90" />
      <el-table-column label="来源内容" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ resolveSourceContentTitle(row) }}</div>
          <div class="sub-cell">{{ resolveSourceContentMeta(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="结果状态" width="100">
        <template #default="{ row }">{{ formatExecutionResultStatus(row.resultStatus) }}</template>
      </el-table-column>
      <el-table-column label="已回复" width="80">
        <template #default="{ row }">{{ row.repliedFlag ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column label="已成交" width="80">
        <template #default="{ row }">{{ row.convertedFlag ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column prop="nonConversionReason" label="未成交原因" min-width="180" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column prop="executedBy" label="执行人ID" width="90" />
      <el-table-column label="执行时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.executedAt" /></template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pager"
      background
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="handlePageChange"
    />
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { getExecutionResults, getExecutionResultsSummary } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatExecutionResultStatus, formatExecutionScenario, formatSubjectType } from '../../utils/engagement';

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);

const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  batchCode: '',
  scenarioCode: '',
  taskId: undefined as number | undefined,
  executedBy: undefined as number | undefined,
  resultStatus: '',
  dateRange: [] as string[],
});
const summary = ref<any>({
  overview: {},
  byPlaybook: [],
  byTemplate: [],
  byOperator: [],
  topNonConversionReasons: [],
  ruleCalibration: {
    keepRules: [],
    adjustRules: [],
  },
});

function buildQueryParams() {
  return {
    page: query.page,
    pageSize: query.pageSize,
    sortBy: 'executedAt',
    sortOrder: 'desc',
    batchCode: filters.batchCode || undefined,
    scenarioCode: filters.scenarioCode || undefined,
    taskId: filters.taskId,
    executedBy: filters.executedBy,
    resultStatus: filters.resultStatus || undefined,
    dateFrom: filters.dateRange[0] || undefined,
    dateTo: filters.dateRange[1] || undefined,
  };
}

async function loadData() {
  loading.value = true;
  try {
    const params = buildQueryParams();
    const [{ data }, summaryResponse] = await Promise.all([
      getExecutionResults(params),
      getExecutionResultsSummary(params),
    ]);
    tableData.value = data.data.list;
    total.value = data.data.total;
    summary.value = summaryResponse.data.data;
  } finally {
    loading.value = false;
  }
}

function formatRate(value?: number | string | null) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numberValue)) {
    return String(value);
  }
  return `${(numberValue * 100).toFixed(1)}%`;
}

function formatMinutes(value?: number | string | null) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numberValue)) {
    return String(value);
  }
  return `${numberValue.toFixed(1)} 分钟`;
}

function resolveSourceContext(row: any) {
  return (
    row?.normalizedPayload?.sourceContext ||
    row?.normalizedPayload?.itemSnapshot?.normalizedPayload?.recommendationSnapshot?.sourceContext ||
    {}
  );
}

function resolveSourceContentTitle(row: any) {
  const context = resolveSourceContext(row);
  return context.contentTitle || context.title || context.contentTopic || context.leadRef || '-';
}

function resolveSourceContentMeta(row: any) {
  const context = resolveSourceContext(row);
  const platform = context.platform || '-';
  const campaign = context.campaignId || '-';
  const contentId = context.contentId || '-';
  return `${platform} / ${campaign} / ${contentId}`;
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.batchCode = '';
  filters.scenarioCode = '';
  filters.taskId = undefined;
  filters.executedBy = undefined;
  filters.resultStatus = '';
  filters.dateRange = [];
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

onMounted(loadData);
</script>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
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
  margin-bottom: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 14px;
  background: #fafafa;
}

.summary-label {
  font-size: 12px;
  color: #6b7280;
}

.summary-value {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.summary-sections {
  margin-bottom: 16px;
}

.reason-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.reason-tag {
  margin-right: 0;
}

.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}

.plain-list {
  margin: 0;
  padding-left: 18px;
  color: #374151;
}

.plain-list li + li {
  margin-top: 8px;
}

.sub-cell {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.results-table {
  margin-top: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
