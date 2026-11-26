<template>
  <div class="page-stack">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="这是 OWNER 汽修只读验收入口：只查询现有正式工单与汽修档案，不提供新建、编辑、确认、出库、收付款、质检放行或交车操作。"
    />

    <el-card shadow="never">
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">正式工单与汽修进度</div>
            <div class="subtitle">
              点击工单查看客户/车辆、检查诊断、报价确认、施工、质检、交车和售后状态。
            </div>
          </div>
          <el-button :loading="loading" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe empty-text="当前没有可显示的正式工单">
        <el-table-column prop="workOrderNo" label="工单编号" min-width="170" />
        <el-table-column prop="title" label="业务内容" min-width="180" show-overflow-tooltip />
        <el-table-column prop="customerName" label="客户" min-width="110" show-overflow-tooltip />
        <el-table-column label="联系电话" min-width="135">
          <template #default="{ row }">{{ safeMaskedMobile(row.customerMobile) }}</template>
        </el-table-column>
        <el-table-column label="应收 / 已收" min-width="150">
          <template #default="{ row }">
            {{ money(row.amountDue) }} / {{ money(row.amountReceived) }}
          </template>
        </el-table-column>
        <el-table-column label="工单状态" min-width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="plain">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="170">
          <template #default="{ row }">{{ dateTime(row.updatedAt || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="验收" width="145" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openWorkOrder(row.id)">
              查看只读档案
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <section v-if="!loading && total === 0" class="demo-invitation">
        <div class="demo-copy">
          <el-tag type="warning" effect="dark">正式数据 0 条</el-tag>
          <div>
            <strong>当前数据库没有可显示的汽修工单，但你可以先验收完整功能设计。</strong>
            <p>
              合成演示包含八阶段流程、完整演示车牌、手机号脱敏、诊断报价、施工质检、售后，
              以及客户关系/接送边界、车型化保养提醒、AI 维修方案、案例视频和客户解释一致性。
              演示不会写入数据库。
            </p>
          </div>
        </div>
        <el-button type="primary" size="large" @click="demoVisible = true">
          查看合成演示档案
        </el-button>
      </section>

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

    <el-drawer
      v-model="demoVisible"
      title="合成演示档案（非真实工单）"
      size="94%"
      destroy-on-close
      class="synthetic-demo-drawer"
    >
      <OwnerRepairSyntheticDemo />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  getOwnerRepairWorkOrders,
  type OwnerRepairWorkOrder,
} from '../../api/owner-repair-readonly';

const OwnerRepairSyntheticDemo = defineAsyncComponent(
  () => import('./components/OwnerRepairSyntheticDemo.vue'),
);

const router = useRouter();
const loading = ref(false);
const demoVisible = ref(false);
const tableData = ref<OwnerRepairWorkOrder[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 10 });

const labels: Record<string, string> = {
  draft: '草稿',
  pending: '待处理',
  processing: '处理中',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  closed: '已关闭',
};

async function loadData() {
  loading.value = true;
  try {
    const response = await getOwnerRepairWorkOrders(query);
    tableData.value = response.data.data.list ?? [];
    total.value = response.data.data.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) {
  query.page = page;
  void loadData();
}

function openWorkOrder(id: number) {
  void router.push(`/work-orders/${id}`);
}

function safeMaskedMobile(value?: string | null) {
  if (!value) return '未提供';
  const compact = value.trim();
  if (/^\d{3}\*{4}\d{4}$/.test(compact)) return compact;
  const digits = compact.replace(/\D/g, '');
  if (digits.length >= 7) return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  return '已隐藏';
}

function money(value?: string | number | null) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? `¥${numberValue.toFixed(2)}` : '¥0.00';
}

function dateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false });
}

function statusLabel(status?: string) {
  return labels[status ?? ''] ?? status ?? '-';
}

function statusType(status?: string) {
  if (status === 'completed' || status === 'closed') return 'success';
  if (status === 'cancelled') return 'info';
  if (status === 'processing' || status === 'in_progress') return 'primary';
  return 'warning';
}

onMounted(loadData);
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
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
  color: #173c36;
}

.subtitle {
  margin-top: 6px;
  color: #66756f;
  font-size: 13px;
}

.pager {
  margin-top: 18px;
  justify-content: flex-end;
}

.demo-invitation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-top: 18px;
  padding: 20px;
  border: 1px dashed #d5a64e;
  border-radius: 12px;
  background: #fffaf0;
}

.demo-copy {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.demo-copy strong {
  color: #4b3b1e;
}

.demo-copy p {
  max-width: 850px;
  margin: 7px 0 0;
  color: #756648;
  line-height: 1.6;
}

@media (max-width: 720px) {
  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .demo-invitation,
  .demo-copy {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
