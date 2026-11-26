<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">ABC 积分流水 / 对账</div>
            <div class="subtitle">
              这里只展示 ABC 积分的只读流水、产品赠分痕迹和对账筛选，不会写入 ABC。
            </div>
          </div>
        </div>
      </template>

      <el-form inline class="filters">
        <el-form-item label="来源类型">
          <el-select v-model="filters.sourceType" clearable style="width: 220px">
            <el-option label="产品赠分（只读）" value="product_bonus_readonly" />
            <el-option label="总部发起补发" value="hq_issue" />
            <el-option label="纠偏" value="correction" />
            <el-option label="历史手改遗留" value="legacy_db_direct" />
            <el-option label="迁移修复" value="migration_fix" />
            <el-option label="客服补偿" value="customer_service_compensation" />
            <el-option label="其他" value="other" />
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
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadLedger">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-loading="loading">
      <template #header><div class="section-title">ABC 积分流水</div></template>
      <el-table :data="ledgerTable" size="small">
        <el-table-column prop="id" label="流水 ID" width="90" />
        <el-table-column prop="ownerName" label="用户" min-width="120" />
        <el-table-column prop="ownerMobile" label="手机号" width="140" />
        <el-table-column prop="sourceType" label="来源类型" min-width="160" show-overflow-tooltip />
        <el-table-column prop="info" label="说明" min-width="220" show-overflow-tooltip />
        <el-table-column label="积分前" width="100" align="right">
          <template #default="{ row }">{{ formatMoney(row.pointsBefore) }}</template>
        </el-table-column>
        <el-table-column label="积分后" width="100" align="right">
          <template #default="{ row }">{{ formatMoney(row.pointsAfter) }}</template>
        </el-table-column>
        <el-table-column label="积分变动" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.changeAmount) }}</template>
        </el-table-column>
        <el-table-column label="关联订单" min-width="180">
          <template #default="{ row }">
            <div>{{ row.orderSn || '-' }}</div>
            <div class="sub-cell">{{ row.goodsName || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180" />
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next"
        :total="ledgerTotal"
        :page-size="ledgerQuery.pageSize"
        :current-page="ledgerQuery.page"
        @current-change="handlePageChange"
      />
    </el-card>

    <AiSideAssistant
      page-title="ABC 积分流水 / 对账"
      route-path="/abc-points/ledger"
      :current-filters="currentFilters"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import AiSideAssistant from '../../components/ai/AiSideAssistant.vue';
import { getAbcPointsLedger } from '../../api/points';
import { formatMoney } from '../../utils/format';

const loading = ref(false);
const ledgerTable = ref<any[]>([]);
const ledgerTotal = ref(0);
const dateRange = ref<[string, string] | []>([]);

const filters = reactive({
  sourceType: '',
  periodKey: '',
  ownerMobile: '',
  keyword: '',
});

const ledgerQuery = reactive({
  page: 1,
  pageSize: 10,
});

const currentFilters = computed(() => ({
  sourceType: filters.sourceType || undefined,
  periodKey: filters.periodKey || undefined,
  ownerMobile: filters.ownerMobile || undefined,
  keyword: filters.keyword || undefined,
  dateFrom: Array.isArray(dateRange.value) && dateRange.value.length === 2 ? dateRange.value[0] : undefined,
  dateTo: Array.isArray(dateRange.value) && dateRange.value.length === 2 ? dateRange.value[1] : undefined,
}));

function buildParams() {
  return {
    page: ledgerQuery.page,
    pageSize: ledgerQuery.pageSize,
    sourceType: filters.sourceType || undefined,
    periodKey: filters.periodKey || undefined,
    ownerMobile: filters.ownerMobile || undefined,
    keyword: filters.keyword || undefined,
    dateFrom: Array.isArray(dateRange.value) && dateRange.value.length === 2 ? dateRange.value[0] : undefined,
    dateTo: Array.isArray(dateRange.value) && dateRange.value.length === 2 ? dateRange.value[1] : undefined,
  };
}

async function loadLedger() {
  loading.value = true;
  try {
    const response = await getAbcPointsLedger(buildParams());
    const payload = response.data.data;
    ledgerTable.value = payload.list || [];
    ledgerTotal.value = payload.total || 0;
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '加载 ABC 积分流水失败');
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) {
  ledgerQuery.page = page;
  void loadLedger();
}

function resetFilters() {
  filters.sourceType = '';
  filters.periodKey = '';
  filters.ownerMobile = '';
  filters.keyword = '';
  dateRange.value = [];
  ledgerQuery.page = 1;
  void loadLedger();
}

onMounted(() => {
  void loadLedger();
});
</script>
