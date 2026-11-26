<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <div>
          <div class="title">库房管理</div>
          <div class="subtitle">维护库房基础信息，供库存流水和工单出库使用。</div>
        </div>
        <el-button v-if="formalActorIdentityBound" type="primary" @click="router.push('/warehouses/create')">新建库房</el-button>
      </div>
    </template>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="warehouseNo" label="库房编号" min-width="160" />
      <el-table-column prop="name" label="库房名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="code" label="编码" min-width="120" />
      <el-table-column prop="managerUserId" label="负责人 ID" min-width="110" />
      <el-table-column prop="address" label="地址" min-width="220" show-overflow-tooltip />
      <el-table-column label="状态" min-width="120">
        <template #default="{ row }">
          <el-tag :type="warehouseStatusMap[row.status]?.type || 'info'">
            {{ warehouseStatusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <ReadableDateTime :value="row.createdAt" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button v-if="formalActorIdentityBound" link type="primary" @click="router.push(`/warehouses/${row.id}/edit`)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getWarehouses } from '../../api/warehouses';
import ReadableDateTime from '../../components/ReadableDateTime.vue';
import { warehouseStatusMap } from '../../utils/status-tag';
import { formalActorIdentityBound } from '../../utils/permissions';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getWarehouses();
    tableData.value = data.data;
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
