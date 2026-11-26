<template>
  <el-card v-loading="loading">
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">执行任务详情</div>
          <div class="subtitle">查看候选对象、人工确认状态、执行结果和未成交原因，形成完整闭环。</div>
        </div>
        <div class="header-actions">
          <el-button v-if="canManage && task && task.status === 'draft'" type="success" @click="handleConfirmTask">
            确认任务
          </el-button>
          <el-button
            v-if="canManage && task && task.status !== 'closed'"
            type="warning"
            plain
            @click="handleCloseTask"
          >
            关闭任务
          </el-button>
          <el-button @click="goBack">返回</el-button>
        </div>
      </div>
    </template>

    <template v-if="task">
      <el-descriptions :column="2" border class="summary-box">
        <el-descriptions-item label="任务编码">{{ task.taskCode }}</el-descriptions-item>
        <el-descriptions-item label="任务名称">{{ task.taskName }}</el-descriptions-item>
        <el-descriptions-item label="场景">
          {{ formatExecutionScenario(task.scenarioCode, task.scenarioName) }}
        </el-descriptions-item>
        <el-descriptions-item label="执行方案">{{ task.playbookName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="任务状态">
          <el-tag
            :type="
              task.status === 'completed'
                ? 'success'
                : task.status === 'running'
                  ? 'warning'
                  : task.status === 'closed'
                    ? 'info'
                    : ''
            "
          >
            {{ formatExecutionTaskStatus(task.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="执行人ID">{{ task.assignedTo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="商户ID">{{ task.merchantId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="目标数 / 明细数 / 结果数">
          {{ task.targetCount || 0 }} / {{ task.itemCount || 0 }} / {{ task.resultCount || 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="确认时间"><ReadableDateTime :value="task.confirmedAt" /></el-descriptions-item>
        <el-descriptions-item label="关闭时间"><ReadableDateTime :value="task.closedAt" /></el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ task.remark || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions :column="1" border class="summary-box">
        <el-descriptions-item label="结果汇总">
          总结果 {{ resultSummary.total || 0 }}，已回复 {{ resultSummary.replied || 0 }}，已成交
          {{ resultSummary.converted || 0 }}
          <template v-if="resultSummary.nonConversionReasons?.length">
            ，未成交原因：
            <span
              v-for="item in resultSummary.nonConversionReasons"
              :key="item.reason"
              class="reason-chip"
            >
              {{ item.reason }} × {{ item.count }}
            </span>
          </template>
        </el-descriptions-item>
      </el-descriptions>

      <div class="section-title">任务明细</div>
      <el-table :data="items">
        <el-table-column prop="id" label="明细ID" width="90" />
        <el-table-column label="执行对象" min-width="150">
          <template #default="{ row }">{{ formatSubjectType(row.subjectType) }} {{ row.subjectId }}</template>
        </el-table-column>
        <el-table-column prop="merchantId" label="商户ID" width="90" />
        <el-table-column prop="businessType" label="业务类型" min-width="140" show-overflow-tooltip />
        <el-table-column prop="businessId" label="业务ID" width="90" />
        <el-table-column prop="scriptTemplateId" label="模板ID" width="90" />
        <el-table-column label="证据状态" width="100">
          <template #default="{ row }">{{ formatEvidenceStatus(row.evidenceStatus) }}</template>
        </el-table-column>
        <el-table-column label="置信度" width="90">
          <template #default="{ row }">{{ formatConfidenceScore(row.confidenceScore) }}</template>
        </el-table-column>
        <el-table-column prop="matchedRule" label="命中规则" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag
              :type="
                row.status === 'executed'
                  ? 'success'
                  : row.status === 'confirmed'
                    ? 'warning'
                    : row.status === 'skipped'
                      ? 'info'
                      : ''
              "
            >
              {{ formatExecutionTaskItemStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="skipReason" label="跳过原因" min-width="180" show-overflow-tooltip />
        <el-table-column label="确认时间" min-width="200" show-overflow-tooltip>
          <template #default="{ row }"><ReadableDateTime :value="row.confirmedAt" /></template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canManage && row.status === 'pending_confirmation'"
              link
              type="success"
              @click="handleConfirmItem(row)"
            >
              确认
            </el-button>
            <el-button
              v-if="canManage && row.status === 'pending_confirmation'"
              link
              type="warning"
              @click="openSkipDialog(row)"
            >
              跳过
            </el-button>
            <el-button
              v-if="canRecordResult && ['confirmed', 'executed'].includes(row.status)"
              link
              type="primary"
              @click="openResultDialog(row)"
            >
              录入结果
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="section-title">最近执行结果</div>
      <el-table :data="results">
        <el-table-column prop="id" label="结果ID" width="90" />
        <el-table-column prop="taskItemId" label="明细ID" width="90" />
        <el-table-column label="执行对象" min-width="140">
          <template #default="{ row }">{{ formatSubjectType(row.subjectType) }} {{ row.subjectId }}</template>
        </el-table-column>
        <el-table-column prop="scriptTemplateId" label="模板ID" width="90" />
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
        <el-table-column label="执行时间" min-width="200" show-overflow-tooltip>
          <template #default="{ row }"><ReadableDateTime :value="row.executedAt" /></template>
        </el-table-column>
      </el-table>
    </template>

    <el-dialog v-model="resultDialogVisible" title="录入执行结果" width="640px">
      <el-form label-width="120px">
        <el-form-item label="明细ID"><el-input :model-value="selectedItem?.id || '-'" readonly /></el-form-item>
        <el-form-item label="执行时间">
          <el-date-picker
            v-model="resultForm.executedAt"
            type="datetime"
            style="width: 100%"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="已回复"><el-switch v-model="resultForm.repliedFlag" /></el-form-item>
        <el-form-item label="已成交"><el-switch v-model="resultForm.convertedFlag" /></el-form-item>
        <el-form-item label="结果状态">
          <el-select v-model="resultForm.resultStatus" style="width: 100%">
            <el-option label="已记录" value="recorded" />
            <el-option label="已复核" value="reviewed" />
            <el-option label="已忽略" value="ignored" />
          </el-select>
        </el-form-item>
        <el-form-item label="未成交原因">
          <el-input v-model="resultForm.nonConversionReason" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="resultForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resultDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitResult">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="skipDialogVisible" title="跳过任务明细" width="520px">
      <el-form label-width="100px">
        <el-form-item label="明细ID"><el-input :model-value="selectedItem?.id || '-'" readonly /></el-form-item>
        <el-form-item label="跳过原因">
          <el-input v-model="skipReason" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="skipDialogVisible = false">取消</el-button>
        <el-button type="warning" :loading="submitting" @click="submitSkip">确认跳过</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  closeExecutionTask,
  confirmExecutionTask,
  confirmExecutionTaskItem,
  createExecutionResult,
  getExecutionTask,
  skipExecutionTaskItem,
} from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatConfidenceScore,
  formatEvidenceStatus,
  formatExecutionResultStatus,
  formatExecutionScenario,
  formatExecutionTaskItemStatus,
  formatExecutionTaskStatus,
  formatSubjectType,
} from '../../utils/engagement';
import { hasPermission } from '../../utils/permissions';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const task = ref<any | null>(null);
const items = ref<any[]>([]);
const results = ref<any[]>([]);
const resultSummary = ref<any>({});
const selectedItem = ref<any | null>(null);
const resultDialogVisible = ref(false);
const skipDialogVisible = ref(false);
const skipReason = ref('');

const resultForm = ref({
  executedAt: '',
  repliedFlag: false,
  convertedFlag: false,
  resultStatus: 'recorded',
  nonConversionReason: '',
  remark: '',
});

const canManage = computed(() => hasPermission('engagement.executionTasks.manage'));
const canRecordResult = computed(
  () =>
    hasPermission('engagement.executionResults.manage') ||
    hasPermission('engagement.executionTasks.operate'),
);

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getExecutionTask(Number(route.params.id));
    task.value = data.data;
    items.value = data.data.items || [];
    results.value = data.data.results || [];
    resultSummary.value = data.data.resultSummary || {};
  } finally {
    loading.value = false;
  }
}

async function handleConfirmTask() {
  if (!task.value) return;
  await confirmExecutionTask(task.value.id, {});
  ElMessage.success('执行任务已确认');
  await loadData();
}

async function handleCloseTask() {
  if (!task.value) return;
  await closeExecutionTask(task.value.id, {});
  ElMessage.success('执行任务已关闭');
  await loadData();
}

async function handleConfirmItem(row: any) {
  await confirmExecutionTaskItem(row.id, {});
  ElMessage.success('任务明细已确认');
  await loadData();
}

function openSkipDialog(row: any) {
  selectedItem.value = row;
  skipReason.value = '';
  skipDialogVisible.value = true;
}

async function submitSkip() {
  if (!selectedItem.value) return;
  submitting.value = true;
  try {
    await skipExecutionTaskItem(selectedItem.value.id, { skipReason: skipReason.value || undefined });
    ElMessage.success('任务明细已跳过');
    skipDialogVisible.value = false;
    await loadData();
  } finally {
    submitting.value = false;
  }
}

function openResultDialog(row: any) {
  selectedItem.value = row;
  resultForm.value = {
    executedAt: '',
    repliedFlag: false,
    convertedFlag: false,
    resultStatus: 'recorded',
    nonConversionReason: '',
    remark: '',
  };
  resultDialogVisible.value = true;
}

async function submitResult() {
  if (!task.value || !selectedItem.value) return;
  submitting.value = true;
  try {
    await createExecutionResult({
      taskId: task.value.id,
      taskItemId: selectedItem.value.id,
      recommendationId: selectedItem.value.recommendationId || undefined,
      executedAt: resultForm.value.executedAt || undefined,
      repliedFlag: resultForm.value.repliedFlag,
      convertedFlag: resultForm.value.convertedFlag,
      resultStatus: resultForm.value.resultStatus,
      nonConversionReason: resultForm.value.nonConversionReason || undefined,
      remark: resultForm.value.remark || undefined,
    });
    ElMessage.success('执行结果已记录');
    resultDialogVisible.value = false;
    await loadData();
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  router.push('/engagement/execution-tasks');
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

.header-actions {
  display: flex;
  gap: 8px;
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

.summary-box {
  margin-bottom: 16px;
}

.section-title {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.reason-chip {
  margin-left: 8px;
  color: #374151;
}
</style>
