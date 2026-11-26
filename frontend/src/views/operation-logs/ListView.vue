<template>
  <el-card>
    <template #header>
      <div>
        <div class="title">操作日志</div>
        <div class="subtitle">只读查看操作元数据；原始详情、客户联系信息及内部载荷不在此入口开放。</div>
      </div>
    </template>

    <el-alert v-if="!admitted" title="正式身份未通过，未加载日志数据" type="warning" :closable="false"
      description="请使用已授权的正式账号登录后刷新页面；本地演示角色不能访问此入口。" />
    <el-alert v-else-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <el-table v-if="admitted" :data="tableData" v-loading="loading" empty-text="暂无可显示的操作元数据">
      <el-table-column prop="module" label="模块" min-width="140" show-overflow-tooltip />
      <el-table-column prop="targetId" label="目标编号" min-width="100" show-overflow-tooltip />
      <el-table-column prop="action" label="动作" min-width="180" show-overflow-tooltip />
      <el-table-column prop="operatorId" label="操作人编号" min-width="110" show-overflow-tooltip />
      <el-table-column label="详情" min-width="200">
        <template #default>已隐藏，仅展示操作元数据</template>
      </el-table-column>
      <el-table-column label="时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.createdAt" />
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="admitted && !errorMessage"
      class="pager"
      :disabled="loading"
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
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { getOperationLogs } from '../../api/operation-logs';
import { operationLogsAdmission } from '../../utils/operation-logs-admission';
import { setAuthenticatedUserIdentity } from '../../utils/permissions';
import ReadableDateTime from '../../components/ReadableDateTime.vue';

const loading = ref(false);
const admitted = computed(() => operationLogsAdmission.state.value.status === 'authorized');
const errorMessage = ref('');
let requestSequence = 0;
let pending: AbortController | null = null;
const tableData = ref<any[]>([]);
const total = ref(0);
const query = reactive({
  page: 1,
  pageSize: 10,
});

async function loadData() {
  pending?.abort();
  const sequence = ++requestSequence;
  tableData.value = [];
  errorMessage.value = '';
  loading.value = false;
  if (!admitted.value) {
    total.value = 0;
    return;
  }
  // Keep the accepted count during an authorized page request. Resetting it
  // here makes Element Plus clamp page 2 back to page 1 before it is fetched.
  const controller = new AbortController();
  pending = controller;
  loading.value = true;
  try {
    const { data } = await getOperationLogs(query, controller.signal);
    if (sequence !== requestSequence || !admitted.value) return;
    if (data?.success !== true || !Array.isArray(data.data?.list) ||
      !Number.isSafeInteger(data.data.total) || data.data.total < 0 ||
      data.data.list.some((row: Record<string, unknown>) => row?.detailsRedacted !== true)) {
      throw new Error('readonly_response_invalid');
    }
    // Explicit UI fields also prevent accidental rendering of future payloads.
    tableData.value = data.data.list.map((row: Record<string, unknown>) => ({
      id: row.id, module: row.module, targetId: row.targetId,
      action: row.action, operatorId: row.operatorId, createdAt: row.createdAt,
    }));
    total.value = data.data.total;
  } catch (error: unknown) {
    if (sequence !== requestSequence || controller.signal.aborted) return;
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      operationLogsAdmission.invalidate('denied');
      setAuthenticatedUserIdentity(null);
    }
    errorMessage.value = '日志读取失败，未保留旧数据。请确认权限后刷新重试。';
    total.value = 0;
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

function handlePageChange(page: number) {
  if (!admitted.value || loading.value || errorMessage.value) return;
  query.page = page;
  loadData();
}

watch(admitted, () => { void loadData(); }, { immediate: true, flush: 'sync' });
onBeforeUnmount(() => { requestSequence += 1; pending?.abort(); });
</script>

<style scoped>
.title {
  font-size: 16px;
  font-weight: 600;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
