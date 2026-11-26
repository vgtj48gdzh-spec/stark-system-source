<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <div>
          <div class="title">付款记录</div>
          <div class="subtitle">只允许登记已经审批通过的付款申请，后端会再次校验审批状态。</div>
        </div>
        <el-button
          v-if="formalActorIdentityBound"
          type="primary"
          @click="router.push('/payout-records/create')"
        >登记付款</el-button>
      </div>
    </template>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="payoutNo" label="付款编号" min-width="160" />
      <el-table-column prop="approvalRequestId" label="审批 ID" min-width="100" />
      <el-table-column prop="amount" label="金额" min-width="100" />
      <el-table-column prop="payeeName" label="收款方" min-width="140" show-overflow-tooltip />
      <el-table-column prop="paymentMethod" label="付款方式" min-width="120" show-overflow-tooltip />
      <el-table-column label="付款时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.paidAt" />
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getPayoutRecords } from '../../api/payout-records';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { formalActorIdentityBound } from '../../utils/permissions';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getPayoutRecords();
    tableData.value = data.data.list;
  } finally {
    loading.value = false;
  }
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
</style>
