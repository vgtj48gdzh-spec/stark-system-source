<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <div>
          <div class="title">供应商管理</div>
          <div class="subtitle">维护材料供应商、联系方式、状态与评分预留字段。</div>
        </div>
        <el-button v-if="formalActorIdentityBound" type="primary" @click="router.push('/suppliers/create')">新建供应商</el-button>
      </div>
    </template>

    <el-table :data="tableData" v-loading="loading">
      <el-table-column prop="supplierNo" label="供应商编号" min-width="160" />
      <el-table-column prop="name" label="名称" min-width="180" />
      <el-table-column prop="contactName" label="联系人" min-width="120" />
      <el-table-column prop="contactMobile" label="联系电话" min-width="140" />
      <el-table-column prop="score" label="评分" min-width="100" />
      <el-table-column label="状态" min-width="120">
        <template #default="{ row }">
          <el-tag :type="supplierStatusMap[row.status]?.type || 'info'">
            {{ supplierStatusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button v-if="formalActorIdentityBound" link type="primary" @click="router.push(`/suppliers/${row.id}/edit`)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getSuppliers } from '../../api/suppliers';
import { supplierStatusMap } from '../../utils/status-tag';
import { formalActorIdentityBound } from '../../utils/permissions';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);

async function loadData() {
  loading.value = true;
  try {
    const { data } = await getSuppliers();
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
