<template>
  <el-card>
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">统计标签</div>
          <div class="subtitle">查看业务统计标签，支持按来源、周期、确认状态筛选。</div>
        </div>
        <el-button
          v-if="canGenerate"
          type="primary"
          :loading="generating"
          @click="handleGenerate"
        >
          生成标签
        </el-button>
      </div>
    </template>

    <el-form inline class="filters">
      <el-form-item label="标签">
        <el-select v-model="filters.tagCode" clearable style="width: 160px">
          <el-option label="ABC总量" value="abc_overall" />
          <el-option label="A端洗车卡销售" value="a_wash_card_sale" />
          <el-option label="公车" value="public_vehicle" />
          <el-option label="私家车" value="private_vehicle" />
          <el-option label="保险理赔" value="insurance_claim" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源表">
        <el-select v-model="filters.sourceTable" clearable style="width: 180px">
          <el-option label="斯塔克工单" value="work_orders" />
          <el-option label="ABC订单" value="abc_sync_orders" />
          <el-option label="ABC资金" value="abc_sync_funds" />
          <el-option label="ABC卡域" value="abc_sync_cards" />
        </el-select>
      </el-form-item>
      <el-form-item label="周期">
        <el-input v-model="filters.periodKey" clearable placeholder="YYYY-MM" style="width: 120px" />
      </el-form-item>
      <el-form-item label="已确认">
        <el-select v-model="filters.confirmedFlag" clearable style="width: 120px">
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column label="标签" min-width="120">
        <template #default="{ row }">{{ formatBusinessStatTag(row.tagCode) }}</template>
      </el-table-column>
      <el-table-column label="业务域" min-width="120">
        <template #default="{ row }">{{ formatBusinessStatDomain(row.businessDomain) }}</template>
      </el-table-column>
      <el-table-column prop="sourceTable" label="来源表" min-width="140" show-overflow-tooltip />
      <el-table-column prop="sourceOrderNo" label="来源编号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="responsibleEmployeeName" label="责任员工" min-width="120" show-overflow-tooltip />
      <el-table-column label="客户核对" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.customerName || '-' }}</div>
          <div class="subtle-text">{{ row.customerMobile || '-' }}</div>
          <div class="subtle-text">客户ID：{{ row.matchedCustomerId || row.customerId || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="项目/套餐" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.packageName || '-' }}</template>
      </el-table-column>
      <el-table-column label="购买时间" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.purchaseTime || '-' }}</template>
      </el-table-column>
      <el-table-column label="匹配状态" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ formatCustomerBindingStatus(row.customerBinding?.bindingStatus) }}</div>
          <div class="subtle-text">{{ row.matchConfidence || '待人工复核' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="匹配依据" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.matchReason || row.evidenceSummary || '源链暂无稳定手机号/待人工绑定' }}
        </template>
      </el-table-column>
      <el-table-column label="已确认" width="90">
        <template #default="{ row }">
          <el-tag :type="row.confirmedFlag ? 'success' : 'warning'">
            {{ row.confirmedFlag ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发生时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.occurredAt" />
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canManage" link type="primary" @click="handleConfirm(row)">确认</el-button>
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
  </el-card>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { generateStatTags, getStatTags, updateStatTag } from '../../api/business-stats';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import {
  formatBusinessStatDomain,
  formatBusinessStatTag,
  formatCustomerBindingStatus,
} from '../../utils/business-stats';
import { hasPermission } from '../../utils/permissions';

const loading = ref(false);
const generating = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 10,
});

const filters = reactive({
  tagCode: '',
  sourceTable: '',
  periodKey: '',
  confirmedFlag: undefined as boolean | undefined,
});

const canGenerate = computed(() => hasPermission('businessStats.tags.generate'));
const canManage = computed(() => hasPermission('businessStats.tags.manage'));

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getStatTags({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
      tagCode: filters.tagCode || undefined,
      sourceTable: filters.sourceTable || undefined,
      periodKey: filters.periodKey || undefined,
      confirmedFlag: filters.confirmedFlag,
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

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

function resetFilters() {
  filters.tagCode = '';
  filters.sourceTable = '';
  filters.periodKey = '';
  filters.confirmedFlag = undefined;
  handleSearch();
}

async function handleGenerate() {
  generating.value = true;
  try {
    const { data } = await generateStatTags({});
    ElMessage.success(`已处理 ${data.data.processedRecords} 条统计标签`);
    await loadData();
  } finally {
    generating.value = false;
  }
}

async function handleConfirm(row: any) {
  await updateStatTag(row.id, { confirmedFlag: true });
  ElMessage.success('统计标签已确认');
  await loadData();
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

.subtle-text {
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
</style>
