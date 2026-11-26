<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <div>
          <div class="title">{{ ownerRepairAcceptanceEnabled ? '合成工单列表' : '工单列表' }}</div>
          <div class="subtitle">
            {{
              ownerRepairAcceptanceEnabled
                ? '仅显示隔离数据库中的 SYNTHETIC 工单；所有操作均不得填写真实客户资料。'
                : '正式工单统一承载资金与材料；汽修工作台在同一工单下完成接车、诊断、报价、施工、质检和售后。'
            }}
          </div>
        </div>
        <el-button type="primary" @click="router.push('/work-orders/create')">
          {{ ownerRepairAcceptanceEnabled ? '新建合成工单' : '新建工单' }}
        </el-button>
      </div>
    </template>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="workOrderNo" label="工单编号" min-width="160" />
      <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
      <el-table-column prop="customerName" label="客户" min-width="100" show-overflow-tooltip />
      <el-table-column prop="amountDue" label="应收金额" min-width="100" />
      <el-table-column prop="amountReceived" label="已收金额" min-width="100" />
      <el-table-column prop="materialCostTotal" label="材料成本" min-width="100" />
      <el-table-column label="状态" min-width="100">
        <template #default="{ row }">
          <el-tag :type="workOrderStatusMap[row.status]?.type || 'info'">
            {{ workOrderStatusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="200" fixed="right" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.createdAt" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="270" fixed="right">
        <template #default="{ row }">
          <el-tooltip content="查看工单金额、状态和材料等基础信息" placement="top">
            <el-button link type="primary" @click="router.push(`/work-orders/${row.id}`)">
              看工单
            </el-button>
          </el-tooltip>
          <el-tooltip content="进入车辆、VIN、诊断报价、采购、施工、质检、交车和售后工作台" placement="top">
            <el-button link type="success" @click="router.push(`/work-orders/${row.id}/repair`)">
              进入汽修工作台
            </el-button>
          </el-tooltip>
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
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getWorkOrders } from '../../api/work-orders';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { workOrderStatusMap } from '../../utils/status-tag';

const router = useRouter();
const ownerRepairAcceptanceEnabled = __OWNER_REPAIR_ACCEPTANCE__;
const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const query = reactive({
  page: 1,
  pageSize: 10,
});

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getWorkOrders(query);
    tableData.value = data.data.list;
    total.value = data.data.total;
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) {
  query.page = page;
  loadData();
}

onMounted(loadData);
</script>

<style scoped>
.toolbar {
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

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
