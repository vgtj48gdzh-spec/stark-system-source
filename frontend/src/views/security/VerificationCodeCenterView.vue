<template>
  <div class="page-stack">
    <el-alert
      v-if="pageError"
      type="error"
      :closable="false"
      show-icon
      class="page-alert"
      :title="pageError"
    />

    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">安全中心 / 验证码转发中心</div>
            <div class="subtitle">
              所有识别为 verification_code 的短信都会立即转发到提醒通道。AI 只做提醒与摘要，不改写验证码本体，也不会自动代填或自动执行。
            </div>
          </div>
          <el-button @click="loadPage">刷新</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="发送方">
          <el-input v-model="filters.sender" clearable placeholder="例如 95566 / 平台名称" />
        </el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="filters.channel" clearable placeholder="全部渠道" style="width: 140px">
            <el-option label="AI 提醒" value="ai_alert" />
            <el-option label="邮箱" value="email" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-input v-model="filters.status" clearable placeholder="例如 success" />
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="tableData" v-loading="loading" empty-text="暂无验证码转发记录">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="sender" label="发送方" width="140" />
        <el-table-column label="验证码" width="120">
          <template #default="{ row }">{{ row.code }}</template>
        </el-table-column>
        <el-table-column label="原文" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">{{ row.body }}</template>
        </el-table-column>
        <el-table-column prop="channel" label="渠道" width="120" />
        <el-table-column prop="receiver" label="接收方" min-width="180" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column label="收到时间" width="180">
          <template #default="{ row }">{{ formatNullableDate(row.receivedAt) }}</template>
        </el-table-column>
        <el-table-column label="转发时间" width="180">
          <template #default="{ row }">{{ formatNullableDate(row.dispatchedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.id)">查看</el-button>
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
          @current-change="loadPage"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" size="680px" :title="`验证码转发 #${detailData?.id || ''}`">
      <template v-if="detailData">
        <div class="drawer-section">
          <div class="section-title">短信信息</div>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="发送方">{{ detailData.sender }}</el-descriptions-item>
            <el-descriptions-item label="验证码">{{ detailData.code }}</el-descriptions-item>
            <el-descriptions-item label="收到时间">
              {{ formatNullableDate(detailData.receivedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="转发时间">
              {{ formatNullableDate(detailData.dispatchedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="渠道">{{ detailData.channel }}</el-descriptions-item>
            <el-descriptions-item label="接收方">{{ detailData.receiver }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ detailData.status }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="drawer-section">
          <div class="section-title">短信原文</div>
          <el-input :model-value="detailData.body || ''" type="textarea" :rows="5" readonly />
        </div>

        <div class="drawer-section">
          <div class="section-title">分类结果</div>
          <pre class="json-block">{{ formatJson(detailData.classification) }}</pre>
        </div>

        <div class="drawer-section">
          <div class="section-title">转发响应</div>
          <pre class="json-block">{{ formatJson(detailData.responsePayload) }}</pre>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import {
  getVerificationCodeDispatchDetail,
  getVerificationCodeDispatches,
} from '../../api/verification-forward';
import { formatDateTime } from '../../utils/format';

const silentRequestConfig = {
  headers: {
    'x-suppress-global-error': '1',
  },
};

const loading = ref(false);
const tableData = ref<any[]>([]);
const detailVisible = ref(false);
const detailData = ref<any>(null);
const pageError = ref('');
const filters = reactive({
  sender: '',
  channel: '' as '' | 'ai_alert' | 'email',
  status: '',
});
const dateRange = ref<string[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

async function loadPage() {
  loading.value = true;
  pageError.value = '';
  try {
    const { data } = await getVerificationCodeDispatches(
      {
        page: pagination.page,
        pageSize: pagination.pageSize,
        sender: filters.sender || undefined,
        channel: filters.channel || undefined,
        status: filters.status || undefined,
        dateFrom: dateRange.value?.[0],
        dateTo: dateRange.value?.[1],
      },
      silentRequestConfig,
    );
    tableData.value = data.data.list || [];
    pagination.total = data.data.total || 0;
  } catch (error: any) {
    pageError.value =
      error.response?.data?.message || '验证码转发中心加载失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function openDetail(id: number) {
  try {
    const { data } = await getVerificationCodeDispatchDetail(id, silentRequestConfig);
    detailData.value = data.data;
    detailVisible.value = true;
  } catch (error: any) {
    pageError.value =
      error.response?.data?.message || '验证码转发详情加载失败，请稍后重试。';
  }
}

function handleSearch() {
  pagination.page = 1;
  void loadPage();
}

function handleReset() {
  filters.sender = '';
  filters.channel = '';
  filters.status = '';
  dateRange.value = [];
  pagination.page = 1;
  void loadPage();
}

function handleSizeChange(size: number) {
  pagination.pageSize = size;
  pagination.page = 1;
  void loadPage();
}

function formatNullableDate(value?: string | null) {
  return value ? formatDateTime(value) : '-';
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

onMounted(() => {
  void loadPage();
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
  font-weight: 700;
  color: #172033;
}

.subtitle {
  margin-top: 6px;
  color: #667085;
  line-height: 1.6;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
}

.page-alert {
  margin-top: 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.drawer-section {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #172033;
}

.json-block {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  overflow: auto;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
