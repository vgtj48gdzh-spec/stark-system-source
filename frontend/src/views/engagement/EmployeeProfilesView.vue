<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">员工画像摘要</div>
          <div class="subtitle">按员工主体汇总互动、记忆、归因和跟进建议，作为平台线索归因后的内部工作台。</div>
        </div>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="显示名称">
        <el-input v-model="filters.displayName" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model="filters.mobile" clearable style="width: 160px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="subjectId" label="员工ID" width="90" />
      <el-table-column prop="displayName" label="显示名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="mobile" label="手机号" width="130" />
      <el-table-column prop="merchantId" label="商户ID" width="90" />
      <el-table-column prop="interactionCount" label="互动数" width="90" />
      <el-table-column prop="memoryCount" label="记忆数" width="90" />
      <el-table-column prop="attributedBusinessCount" label="归因业务数" width="110" />
      <el-table-column label="最新互动" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><ReadableDateTime :value="row.latestInteractionAt" /></template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">{{ formatProfileStatus(row.status) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.subjectId)">查看</el-button>
        </template>
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

    <el-dialog v-model="detailVisible" title="员工画像详情" width="860px">
      <template v-if="detailData">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="员工ID">{{ detailData.snapshot.subjectId }}</el-descriptions-item>
          <el-descriptions-item label="显示名称">{{ detailData.snapshot.displayName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detailData.snapshot.mobile || '-' }}</el-descriptions-item>
          <el-descriptions-item label="商户ID">{{ detailData.snapshot.merchantId || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div class="section-title">最近归因</div>
        <el-table :data="detailData.attributions" size="small">
          <el-table-column prop="id" label="归因ID" width="90" />
          <el-table-column label="归因状态" width="100">
            <template #default="{ row }">{{ formatAttributionStatus(row.attributionStatus) }}</template>
          </el-table-column>
          <el-table-column prop="attributedBusinessType" label="业务类型" min-width="130" />
          <el-table-column prop="attributedBusinessId" label="业务ID" min-width="130" />
        </el-table>

        <div class="section-title">跟进建议</div>
        <el-table :data="detailData.followupSuggestions" size="small">
          <el-table-column prop="recommendationText" label="建议内容" min-width="260" show-overflow-tooltip />
          <el-table-column prop="recommendationReason" label="建议原因" min-width="220" show-overflow-tooltip />
        </el-table>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { getEmployeeProfile, getEmployeeProfiles } from '../../api/engagement';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formatAttributionStatus, formatProfileStatus } from '../../utils/engagement';

const loading = ref(false);
const detailVisible = ref(false);
const detailData = ref<any | null>(null);
const tableData = ref<any[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 10 });
const filters = reactive({
  displayName: '',
  mobile: '',
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getEmployeeProfiles({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      displayName: filters.displayName || undefined,
      mobile: filters.mobile || undefined,
    });
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.page = 1;
  loadData();
}

function resetFilters() {
  filters.displayName = '';
  filters.mobile = '';
  handleSearch();
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

async function openDetail(id: number) {
  const { data } = await getEmployeeProfile(id);
  detailData.value = data.data;
  detailVisible.value = true;
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
  margin-bottom: 8px;
}
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
.section-title {
  margin: 16px 0 8px;
  font-weight: 600;
}
</style>
